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
  BRIEF_FORMATS,
  BRIEF_GOAL_PRESETS_LIST,
  BRIEF_PLATFORMS,
  Brief,
  BriefFormat,
  BriefPlatform,
  buildBrief,
  clearBriefs,
  getBriefList,
  removeBrief,
  saveBrief,
  addCopyToHistory,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const budgetLabel = (b: Brief['budget']): string =>
  b === 'low' ? 'Düşük bütçe' : b === 'high' ? 'Yüksek bütçe' : 'Orta bütçe';

const budgetEmoji = (b: Brief['budget']): string => (b === 'low' ? '🪙' : b === 'high' ? '💎' : '💼');

export default function BriefScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Brief[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState('');
  const [goal, setGoal] = useState<string>('engagement');
  const [platform, setPlatform] = useState<BriefPlatform>('instagram');
  const [format, setFormat] = useState<BriefFormat>('reel');
  const [audience, setAudience] = useState('');
  const [hook, setHook] = useState('');
  const [cta, setCta] = useState('');
  const [toneNotes, setToneNotes] = useState('');
  const [visualDirection, setVisualDirection] = useState('');
  const [budget, setBudget] = useState<Brief['budget']>('medium');
  const [deadlineDays, setDeadlineDays] = useState('7');

  const load = useCallback(async () => {
    const l = await getBriefList();
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

  const platformInfo = useMemo(
    () => BRIEF_PLATFORMS.find(p => p.id === platform) ?? BRIEF_PLATFORMS[0],
    [platform]
  );

  const resetForm = () => {
    setProjectName('');
    setAudience('');
    setHook('');
    setCta('');
    setToneNotes('');
    setVisualDirection('');
    setBudget('medium');
    setDeadlineDays('7');
    setGoal('engagement');
    setPlatform('instagram');
    setFormat('reel');
  };

  const handleGenerate = async () => {
    if (!projectName.trim()) {
      Alert.alert('Eksik bilgi', 'Proje adını yazmalısın.');
      return;
    }
    if (!hook.trim()) {
      Alert.alert('Eksik bilgi', 'En azından bir hook cümlesi yaz.');
      return;
    }
    setSaving(true);
    try {
      const days = Math.max(1, Math.min(60, parseInt(deadlineDays, 10) || 7));
      const built = buildBrief({
        projectName: projectName.trim(),
        platform,
        format,
        goal,
        audience: audience.trim(),
        hook: hook.trim(),
        cta: cta.trim() || 'Kaydet & paylaş',
        toneNotes: toneNotes.trim() || undefined,
        visualDirection: visualDirection.trim() || undefined,
        budget,
        deadlineDays: days,
      });
      const next = await saveBrief(built);
      setList(next);
      await addCopyToHistory(`[brief] ${built.projectName} → ${built.platform}/${built.format}`);
      setToast('Brief kaydedildi ✓');
      resetForm();
    } catch (e) {
      Alert.alert('Hata', 'Brief kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Brief silinsin mi?', 'Bu kayıt listeden çıkar.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeBrief(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm briefler silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearBriefs();
          setList([]);
          setOpenId(null);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const copyText = (label: string, text: string) => {
    Clipboard.setString(text);
    addCopyToHistory(`[brief-copy] ${label}`);
    setToast(`${label} kopyalandı ✓`);
  };

  const renderOpen = (b: Brief) => {
    const platformMeta = BRIEF_PLATFORMS.find(p => p.id === b.platform);
    const formatMeta = BRIEF_FORMATS.find(f => f.id === b.format);
    const goalMeta = BRIEF_GOAL_PRESETS_LIST.find(g => g.id === b.goal);
    return (
      <View style={styles.detail}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>{b.projectName}</Text>
          <Pressable onPress={() => setOpenId(null)} hitSlop={10}>
            <Text style={styles.detailClose}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.detailSub}>
          {platformMeta?.emoji} {platformMeta?.label} · {formatMeta?.emoji} {formatMeta?.label} ·{' '}
          {goalMeta?.emoji} {goalMeta?.label}
        </Text>
        <Text style={styles.detailMeta}>
          {budgetEmoji(b.budget)} {budgetLabel(b.budget)} · ⏳ {b.deadlineDays} gün
        </Text>

        <Section title="🎯 Ana mesaj">
          <Text style={styles.bodyText}>{b.keyMessage}</Text>
        </Section>

        <Section title="🪝 Hook">
          <Pressable onPress={() => copyText('Hook', b.hook)}>
            <Text style={styles.bodyText}>{b.hook || '(boş)'}</Text>
          </Pressable>
        </Section>

        <Section title="🧭 Hedef kitle">
          <Text style={styles.bodyText}>{b.audience || 'Genel sosyal medya kullanıcıları'}</Text>
        </Section>

        <Section title="📋 İçerik akışı">
          {b.outline.map((step, i) => (
            <View key={i} style={styles.outlineRow}>
              <Text style={styles.outlineNum}>{i + 1}</Text>
              <Text style={styles.outlineText}>{step}</Text>
            </View>
          ))}
        </Section>

        <Section title="📣 CTA">
          <Pressable onPress={() => copyText('CTA', b.cta)}>
            <Text style={styles.bodyText}>{b.cta}</Text>
          </Pressable>
        </Section>

        <Section title="#️⃣ Hashtag önerileri">
          <View style={styles.tagWrap}>
            {b.hashtags.map((h, i) => (
              <Pressable
                key={i}
                style={styles.tagChip}
                onPress={() => copyText('Hashtag', h)}
              >
                <Text style={styles.tagText}>{h}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="🎨 Görsel yön">
          <Text style={styles.bodyText}>{b.visualDirection}</Text>
        </Section>

        {b.toneNotes ? (
          <Section title="🎙️ Ton notu">
            <Text style={styles.bodyText}>{b.toneNotes}</Text>
          </Section>
        ) : null}

        <Section title="📊 Takip edilecek metrikler">
          {b.metrics.map((m, i) => (
            <Text key={i} style={styles.bullet}>• {m}</Text>
          ))}
        </Section>

        <Section title="🚀 Dağıtım planı">
          <Text style={styles.bodyText}>{b.distributionPlan}</Text>
        </Section>

        <View style={styles.detailActions}>
          <Pressable
            style={[styles.smallBtn, styles.smallBtnPrimary]}
            onPress={() =>
              copyText(
                'Tüm brief',
                [
                  `Proje: ${b.projectName}`,
                  `Platform/Format: ${platformMeta?.label}/${formatMeta?.label}`,
                  `Hedef: ${goalMeta?.label}`,
                  `Hook: ${b.hook}`,
                  `CTA: ${b.cta}`,
                  `Hashtag: ${b.hashtags.join(' ')}`,
                ].join('\n')
              )
            }
          >
            <Text style={styles.smallBtnText}>📋 Hepsini kopyala</Text>
          </Pressable>
          <Pressable
            style={[styles.smallBtn, styles.smallBtnDanger]}
            onPress={() => handleDelete(b.id)}
          >
            <Text style={styles.smallBtnText}>🗑️ Sil</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderCard = (b: Brief) => {
    const platformMeta = BRIEF_PLATFORMS.find(p => p.id === b.platform);
    const formatMeta = BRIEF_FORMATS.find(f => f.id === b.format);
    const goalMeta = BRIEF_GOAL_PRESETS_LIST.find(g => g.id === b.goal);
    const isOpen = openId === b.id;
    return (
      <Pressable
        key={b.id}
        style={[styles.card, isOpen && styles.cardActive]}
        onPress={() => setOpenId(isOpen ? null : b.id)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{b.projectName}</Text>
            <Text style={styles.cardSub}>
              {platformMeta?.emoji} {platformMeta?.label} · {formatMeta?.emoji} {formatMeta?.label}
            </Text>
          </View>
          <Text style={styles.cardDate}>{formatDate(b.createdAt)}</Text>
        </View>
        <Text style={styles.cardGoal} numberOfLines={2}>
          {goalMeta?.emoji} {goalMeta?.label} — {b.hook || '(hook yok)'}
        </Text>
        {isOpen && renderOpen(b)}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Brief Manager', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>📋 Content Brief Manager</Text>
          <Text style={styles.heroSub}>
            Tek bir içerik için kısa, uygulanabilir brief üret. Hook → akış → CTA → metrikler →
            dağıtım planı tek yerde.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yeni Brief</Text>

          <Text style={styles.label}>Proje / kampanya adı *</Text>
          <TextInput
            style={styles.input}
            value={projectName}
            onChangeText={setProjectName}
            placeholder="ör: Yaz kampanyası açılışı"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Hook (ilk cümle / frame) *</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={hook}
            onChangeText={setHook}
            placeholder="ör: 'Çoğu içerik üreticisi ilk 3 saniyeyi boşa harcıyor.'"
            placeholderTextColor="#94a3b8"
            multiline
          />

          <Text style={styles.label}>Hedef kitle (opsiyonel)</Text>
          <TextInput
            style={styles.input}
            value={audience}
            onChangeText={setAudience}
            placeholder="ör: 25-34 yaş, Türkiye, içerik üreticileri"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Hedef</Text>
          <View style={styles.chipRow}>
            {BRIEF_GOAL_PRESETS_LIST.map(g => {
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

          <Text style={styles.label}>Platform</Text>
          <View style={styles.chipRow}>
            {BRIEF_PLATFORMS.map(p => {
              const active = platform === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: p.color, borderColor: p.color },
                  ]}
                  onPress={() => setPlatform(p.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {p.emoji} {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Format</Text>
          <View style={styles.chipRow}>
            {BRIEF_FORMATS.map(f => {
              const active = format === f.id;
              return (
                <Pressable
                  key={f.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFormat(f.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {f.emoji} {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>CTA (Call to action)</Text>
          <TextInput
            style={styles.input}
            value={cta}
            onChangeText={setCta}
            placeholder="ör: Kaydet, sonra uygula!"
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Bütçe</Text>
              <View style={styles.chipRow}>
                {(['low', 'medium', 'high'] as Brief['budget'][]).map(b => {
                  const active = budget === b;
                  return (
                    <Pressable
                      key={b}
                      style={[styles.chipSmall, active && styles.chipActive]}
                      onPress={() => setBudget(b)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {budgetEmoji(b)} {b === 'low' ? 'Düşük' : b === 'high' ? 'Yüksek' : 'Orta'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Deadline (gün)</Text>
              <TextInput
                style={styles.input}
                value={deadlineDays}
                onChangeText={setDeadlineDays}
                keyboardType="number-pad"
                placeholder="7"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <Text style={styles.label}>Ton notu (opsiyonel)</Text>
          <TextInput
            style={styles.input}
            value={toneNotes}
            onChangeText={setToneNotes}
            placeholder="ör: samimi, biraz ironi var"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Görsel yön (opsiyonel)</Text>
          <TextInput
            style={styles.input}
            value={visualDirection}
            onChangeText={setVisualDirection}
            placeholder="ör: pastel arka plan, el yazısı font"
            placeholderTextColor="#94a3b8"
          />

          <View style={[styles.tipBox, { borderLeftColor: platformInfo.color }]}>
            <Text style={styles.tipTitle}>{platformInfo.emoji} {platformInfo.label} ipucu</Text>
            <Text style={styles.tipText}>{platformInfo.tip}</Text>
          </View>

          <Pressable
            style={[styles.cta, saving && { opacity: 0.6 }]}
            onPress={handleGenerate}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>📋 Brief oluştur ve kaydet</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Kayıtlı Briefler ({list.length})</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🗂️</Text>
              <Text style={styles.emptyText}>
                Henüz kayıtlı brief yok. Yukarıdan bir tane üret, buraya gelecek.
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

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.detailSection}>
    <Text style={styles.detailSectionTitle}>{title}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  heroTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  heroSub: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
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
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
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
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  row2: { flexDirection: 'row' },
  tipBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderLeftWidth: 3,
    padding: 10,
    borderRadius: 8,
  },
  tipTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  cta: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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
  cardActive: { borderColor: '#6366f1' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardSub: { color: '#94a3b8', fontSize: 12 },
  cardDate: { color: '#64748b', fontSize: 11 },
  cardGoal: { color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 18 },

  detail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', flex: 1 },
  detailClose: { color: '#94a3b8', fontSize: 18, paddingLeft: 12 },
  detailSub: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  detailMeta: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  detailSection: { marginTop: 12 },
  detailSectionTitle: { color: '#a5b4fc', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  bodyText: { color: '#e2e8f0', fontSize: 13, lineHeight: 18 },
  bullet: { color: '#cbd5e1', fontSize: 13, marginVertical: 1 },
  outlineRow: { flexDirection: 'row', marginVertical: 2 },
  outlineNum: {
    color: '#a5b4fc',
    fontWeight: '700',
    width: 22,
    fontSize: 13,
  },
  outlineText: { color: '#e2e8f0', fontSize: 13, flex: 1, lineHeight: 18 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tagText: { color: '#a5b4fc', fontSize: 12 },
  detailActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  smallBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  smallBtnPrimary: { backgroundColor: '#6366f1' },
  smallBtnDanger: { backgroundColor: '#7f1d1d' },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

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