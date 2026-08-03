import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  CAPTION_GOALS,
  CAPTION_LENGTHS,
  CAPTION_TONES,
  CaptionFormula,
  CaptionGoal,
  CaptionLength,
  CaptionTone,
  buildCaption,
  clearCaptions,
  getCaptionList,
  removeCaption,
  saveCaption,
  addCopyToHistory,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const toneMeta = (id: CaptionTone) => CAPTION_TONES.find(t => t.id === id) ?? CAPTION_TONES[0];
const lengthMeta = (id: CaptionLength) => CAPTION_LENGTHS.find(l => l.id === id) ?? CAPTION_LENGTHS[0];
const goalMeta = (id: CaptionGoal) => CAPTION_GOALS.find(g => g.id === id) ?? CAPTION_GOALS[0];

export default function CaptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<CaptionFormula[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [tone, setTone] = useState<CaptionTone>('casual');
  const [length, setLength] = useState<CaptionLength>('short');
  const [goal, setGoal] = useState<CaptionGoal>('engage');
  const [topic, setTopic] = useState('');
  const [preview, setPreview] = useState<{
    name: string;
    tone: CaptionTone;
    length: CaptionLength;
    goal: CaptionGoal;
    hook: string;
    body: string;
    cta: string;
    fullText: string;
    emojiDensity: CaptionFormula['emojiDensity'];
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const l = await getCaptionList();
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
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const tm = useMemo(() => toneMeta(tone), [tone]);
  const lm = useMemo(() => lengthMeta(length), [length]);
  const gm = useMemo(() => goalMeta(goal), [goal]);

  const handleGenerate = () => {
    setGenerating(true);
    const built = buildCaption({
      tone,
      length,
      goal,
      topic: topic.trim() || undefined,
    });
    setPreview(built);
    setGenerating(false);
  };

  const handleReroll = () => handleGenerate();

  const handleSave = async () => {
    if (!preview) return;
    const next = await saveCaption({
      name: preview.name,
      tone: preview.tone,
      hook: preview.hook,
      body: preview.body,
      cta: preview.cta,
      emojiDensity: preview.emojiDensity,
    });
    setList(next);
    await addCopyToHistory(`[caption] ${preview.name}`);
    setToast('Caption kaydedildi ✓');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Caption silinsin mi?', 'Bu kayıt listeden çıkar.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeCaption(id);
          setList(next);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm captionlar silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearCaptions();
          setList([]);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const copy = (label: string, text: string) => {
    Clipboard.setString(text);
    addCopyToHistory(`[caption-copy] ${label}`);
    setToast(`${label} kopyalandı ✓`);
  };

  const charCount = (s: string) => s.length;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Caption Formulas', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>✍️ Caption Formulas</Text>
          <Text style={styles.heroSub}>
            Ton + uzunluk + amaç seç, hızlıca uygulanabilir caption üret. Hook + body + CTA tek
            formülde.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caption Üretici</Text>

          <Text style={styles.label}>Ton</Text>
          <View style={styles.chipRow}>
            {CAPTION_TONES.map(t => {
              const active = tone === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: t.color, borderColor: t.color },
                  ]}
                  onPress={() => setTone(t.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t.emoji} {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Uzunluk</Text>
          <View style={styles.chipRow}>
            {CAPTION_LENGTHS.map(l => {
              const active = length === l.id;
              return (
                <Pressable
                  key={l.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setLength(l.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {l.label} · {l.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Amaç</Text>
          <View style={styles.chipRow}>
            {CAPTION_GOALS.map(g => {
              const active = goal === g.id;
              return (
                <Pressable
                  key={g.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setGoal(g.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {g.emoji} {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Konu / ana tema (opsiyonel)</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="ör: sabah rutini, içerik üretimi"
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>
              {tm.emoji} {tm.label} · {lm.label} · {gm.emoji} {gm.label}
            </Text>
            <Text style={styles.tipText}>
              Hedef uzunluk {lm.chars[0]}–{lm.chars[1]} karakter. Emoji yoğunluğu:{' '}
              {preview?.emojiDensity ?? '—'}.
            </Text>
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              style={[styles.cta, styles.ctaSecondary, generating && { opacity: 0.6 }]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>✨ Caption üret</Text>
              )}
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
              <Text style={styles.sectionTitle}>Önizleme</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: tm.color }]}>
                  <Text style={styles.badgeText}>{tm.emoji} {tm.label}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{lm.label}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{gm.emoji} {gm.label}</Text>
                </View>
              </View>
            </View>

            <Pressable style={styles.previewBox} onPress={() => copy('Tam caption', preview.fullText)}>
              <Text style={styles.previewHook}>{preview.hook}</Text>
              <Text style={styles.previewBody}>{preview.body}</Text>
              <Text style={styles.previewCta}>{preview.cta}</Text>
              <Text style={styles.previewMeta}>
                {charCount(preview.fullText)} karakter · emoji: {preview.emojiDensity} · kopyalamak için dokun
              </Text>
            </Pressable>

            <View style={styles.actionRow}>
              <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]} onPress={() => copy('Hook', preview.hook)}>
                <Text style={styles.smallBtnText}>📋 Hook</Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]} onPress={() => copy('Body', preview.body)}>
                <Text style={styles.smallBtnText}>📋 Body</Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]} onPress={() => copy('CTA', preview.cta)}>
                <Text style={styles.smallBtnText}>📋 CTA</Text>
              </Pressable>
            </View>

            <Pressable style={[styles.cta, styles.ctaSave]} onPress={handleSave}>
              <Text style={styles.ctaText}>💾 Kaydet</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Kayıtlı Captionlar ({list.length})</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>
                Henüz kayıtlı caption yok. Yukarıdan bir tane üret, kaydet, buraya gelsin.
              </Text>
            </View>
          ) : (
            list.map(c => {
              const t = toneMeta(c.tone);
              return (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{c.name}</Text>
                      <Text style={styles.cardSub}>
                        {t.emoji} {t.label} · {formatDate(c.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => copy('Caption', `${c.hook}\n\n${c.body}\n\n${c.cta}`)}>
                    <Text style={styles.cardHook}>{c.hook}</Text>
                    <Text style={styles.cardBody} numberOfLines={3}>{c.body}</Text>
                    <Text style={styles.cardCta}>{c.cta}</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(c.id)}>
                    <Text style={styles.deleteBtnText}>🗑️ Sil</Text>
                  </Pressable>
                </View>
              );
            })
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
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
  tipBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    padding: 10,
    borderRadius: 8,
  },
  tipTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cta: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaSecondary: { backgroundColor: '#6366f1' },
  ctaReroll: { backgroundColor: '#475569' },
  ctaSave: { backgroundColor: '#10B981', marginTop: 12 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  previewHeader: { marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  badge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  previewBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewHook: { color: '#f8fafc', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  previewBody: { color: '#e2e8f0', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  previewCta: { color: '#a5b4fc', fontSize: 13, fontWeight: '600' },
  previewMeta: { color: '#64748b', fontSize: 11, marginTop: 10 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  smallBtnPrimary: { backgroundColor: '#6366f1' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  cardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  cardHook: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  cardBody: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  cardCta: { color: '#a5b4fc', fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  deleteBtnText: { color: '#f87171', fontSize: 11, fontWeight: '700' },

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