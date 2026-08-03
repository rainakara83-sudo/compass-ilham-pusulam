import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  STORY_MOODS,
  StoryMood,
  StoryScript,
  buildStoryScript,
  clearStoryScripts,
  getStoryList,
  removeStoryScript,
  saveStoryScript,
  addCopyToHistory,
} from '../services/storage';

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'blog'];

const fmtDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function StoryScriptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<StoryScript[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [topic, setTopic] = useState('');
  const [mood, setMood] = useState<StoryMood>('energetic');
  const [platform, setPlatform] = useState('instagram');
  const [preview, setPreview] = useState<ReturnType<typeof buildStoryScript> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const l = await getStoryList();
    setList(l);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const moodMeta = useMemo(() => STORY_MOODS.find(m => m.id === mood) ?? STORY_MOODS[0], [mood]);

  const handleGenerate = () => {
    if (!topic.trim()) {
      Alert.alert('Eksik bilgi', 'Konu yaz ki story\'ni kurgulayayım.');
      return;
    }
    const built = buildStoryScript({ topic, mood, platform });
    setPreview(built);
  };

  const handleReroll = () => {
    if (!topic.trim()) return;
    const built = buildStoryScript({ topic, mood, platform, seed: Date.now() });
    setPreview(built);
  };

  const handleSave = async () => {
    if (!preview) return;
    const next = await saveStoryScript({
      topic: preview.meta.topic,
      mood: preview.meta.mood,
      platform: preview.meta.platform,
      frames: preview.frames,
      totalSeconds: preview.totalSeconds,
    });
    setList(next);
    await addCopyToHistory(`[story] ${preview.meta.topic}/${mood}`);
    setToast('Story kaydedildi ✓');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Story silinsin mi?', 'Bu kayıt listeden çıkar.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeStoryScript(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm story\'ler silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearStoryScripts();
          setList([]);
          setOpenId(null);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const copy = (label: string, text: string) => {
    Clipboard.setString(text);
    addCopyToHistory(`[story-copy] ${label}`);
    setToast(`${label} kopyalandı ✓`);
  };

  const renderFrames = (frames: ReturnType<typeof buildStoryScript>['frames']) => {
    return frames.map((f) => (
      <View key={f.index} style={styles.frameRow}>
        <View style={styles.frameTimeCol}>
          <Text style={styles.frameNum}>#{f.index}</Text>
          <Text style={styles.frameSec}>{f.seconds}</Text>
        </View>
        <View style={styles.frameBody}>
          <Pressable onPress={() => copy('Caption', f.caption)}>
            <Text style={styles.frameCaption}>{f.caption}</Text>
          </Pressable>
          <View style={styles.frameDetail}>
            <Text style={styles.frameDetailLabel}>🎬 Görsel</Text>
            <Text style={styles.frameDetailText}>{f.visual}</Text>
          </View>
          <View style={styles.frameDetail}>
            <Text style={styles.frameDetailLabel}>🎵 Ses</Text>
            <Text style={styles.frameDetailText}>{f.audio}</Text>
          </View>
        </View>
      </View>
    ));
  };

  const renderCard = (s: StoryScript) => {
    const m = STORY_MOODS.find(x => x.id === s.mood);
    const isOpen = openId === s.id;
    return (
      <Pressable
        key={s.id}
        style={[styles.card, isOpen && { borderColor: m?.color }]}
        onPress={() => setOpenId(isOpen ? null : s.id)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{s.topic}</Text>
            <Text style={styles.cardSub}>
              {m?.emoji} {m?.label} · {s.platform} · {fmtDate(s.createdAt)}
            </Text>
          </View>
          <View style={styles.secondsPill}>
            <Text style={styles.secondsPillText}>{s.totalSeconds}sn</Text>
          </View>
        </View>
        <Text style={styles.cardHint} numberOfLines={1}>
          {s.frames[0].caption} → {s.frames[3].caption}
        </Text>
        {isOpen ? (
          <View style={styles.detail}>
            {renderFrames(s.frames)}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.smallBtn, styles.smallBtnPrimary]}
                onPress={() =>
                  copy(
                    'Story script',
                    s.frames
                      .map(f => `[${f.seconds}] ${f.caption}\n  Görsel: ${f.visual}\n  Ses: ${f.audio}`)
                      .join('\n\n')
                  )
                }
              >
                <Text style={styles.smallBtnText}>📋 Tüm script'i kopyala</Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => handleDelete(s.id)}>
                <Text style={styles.smallBtnText}>🗑️ Sil</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Story Script', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🎬 Story Script Generator</Text>
          <Text style={styles.heroSub}>
            15 saniyelik story için frame-by-frame kurgu: hook (0-3sn) → çatışma (3-7sn) →
            çözüm (7-12sn) → CTA (12-15sn). Görsel + ses + altyazı önerisi tek yerde.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yeni Story</Text>

          <Text style={styles.label}>Konu *</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="ör: sabah rutini, içerik üretimi"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Ruh hali (mood)</Text>
          <View style={styles.chipRow}>
            {STORY_MOODS.map(m => {
              const active = mood === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: m.color, borderColor: m.color },
                  ]}
                  onPress={() => setMood(m.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {m.emoji} {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Platform</Text>
          <View style={styles.chipRow}>
            {PLATFORMS.map(p => {
              const active = platform === p;
              return (
                <Pressable
                  key={p}
                  style={[styles.chipSmall, active && styles.chipSmallActive]}
                  onPress={() => setPlatform(p)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.tipBox, { borderLeftColor: moodMeta.color }]}>
            <Text style={styles.tipTitle}>{moodMeta.emoji} {moodMeta.label} modu</Text>
            <Text style={styles.tipText}>🎵 {moodMeta.music}</Text>
          </View>

          <View style={styles.ctaRow}>
            <Pressable style={[styles.cta, styles.ctaPrimary]} onPress={handleGenerate}>
              <Text style={styles.ctaText}>🎬 Story kurgula</Text>
            </Pressable>
            {preview ? (
              <Pressable style={[styles.cta, styles.ctaReroll]} onPress={handleReroll}>
                <Text style={styles.ctaText}>🎲 Yenile</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {preview ? (
          <View style={styles.section}>
            <View style={styles.previewHeader}>
              <Text style={styles.sectionTitle}>Önizleme — {preview.totalSeconds}sn</Text>
              <View style={[styles.moodPill, { backgroundColor: moodMeta.color }]}>
                <Text style={styles.moodPillText}>{moodMeta.emoji} {moodMeta.label}</Text>
              </View>
            </View>
            {renderFrames(preview.frames)}
            <Pressable style={[styles.cta, styles.ctaSave]} onPress={handleSave}>
              <Text style={styles.ctaText}>💾 Story kaydet</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Kayıtlı Story'ler ({list.length})</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyText}>
                Henüz kayıtlı story yok. Yukarıdan bir tane kurgula, buraya gelsin.
              </Text>
            </View>
          ) : (
            list.map(renderCard)
          )}
        </View>
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  heroTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  heroSub: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 14, marginBottom: 16 },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipSmall: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipSmallActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  tipBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderLeftWidth: 3,
    padding: 10,
    borderRadius: 8,
  },
  tipTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cta: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaPrimary: { backgroundColor: '#6366f1' },
  ctaReroll: { backgroundColor: '#475569' },
  ctaSave: { backgroundColor: '#10B981', marginTop: 12 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moodPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  moodPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  frameRow: { flexDirection: 'row', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  frameTimeCol: { width: 60, paddingRight: 8 },
  frameNum: { color: '#a5b4fc', fontSize: 13, fontWeight: '700' },
  frameSec: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  frameBody: { flex: 1 },
  frameCaption: { color: '#f8fafc', fontSize: 14, fontWeight: '600', lineHeight: 18 },
  frameDetail: { marginTop: 6 },
  frameDetailLabel: { color: '#a5b4fc', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  frameDetailText: { color: '#cbd5e1', fontSize: 12, lineHeight: 16 },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  cardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  secondsPill: { backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  secondsPillText: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },
  cardHint: { color: '#cbd5e1', fontSize: 12, marginTop: 8, fontStyle: 'italic' },

  detail: { marginTop: 10 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  smallBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  smallBtnPrimary: { backgroundColor: '#6366f1' },
  smallBtnDanger: { backgroundColor: '#7f1d1d' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', padding: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});