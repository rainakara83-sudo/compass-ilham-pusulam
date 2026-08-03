import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  SCORE_FORMATS,
  SCORE_PLATFORMS,
  ScorecardEntry,
  ScoreFormat,
  ScorePlatform,
  ScoreVerdict,
  clearScorecards,
  computeScore,
  getScorecardList,
  removeScorecard,
  saveScorecard,
  verdictFromScore,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

const fmtNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const empty = () => ({
  title: '',
  hook: '',
  reach: '',
  likes: '',
  comments: '',
  shares: '',
  saves: '',
  effortHours: '1',
  notes: '',
});

const parseNum = (s: string): number => Math.max(0, Math.floor(parseFloat(s.replace(',', '.')) || 0));

export default function ScorecardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<ScorecardEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [platform, setPlatform] = useState<ScorePlatform>('instagram');
  const [format, setFormat] = useState<ScoreFormat>('reel');
  const [form, setForm] = useState(empty());
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const l = await getScorecardList();
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

  const metrics = useMemo(
    () => ({
      reach: parseNum(form.reach),
      likes: parseNum(form.likes),
      comments: parseNum(form.comments),
      shares: parseNum(form.shares),
      saves: parseNum(form.saves),
    }),
    [form]
  );

  const previewScore = useMemo(
    () => computeScore(metrics, platform),
    [metrics, platform]
  );

  const previewVerdict = useMemo(() => verdictFromScore(previewScore), [previewScore]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Eksik bilgi', 'İçerik başlığı yazmalısın.');
      return;
    }
    setSaving(true);
    try {
      const next = await saveScorecard({
        title: form.title.trim(),
        platform,
        format,
        hook: form.hook.trim(),
        publishedAt: Date.now(),
        metrics,
        effortHours: Math.max(0, parseFloat(form.effortHours.replace(',', '.')) || 0),
        notes: form.notes.trim(),
      });
      setList(next);
      setForm(empty());
      setToast('Scorecard kaydedildi ✓');
    } catch {
      Alert.alert('Hata', 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Scorecard silinsin mi?', 'Bu kayıt listeden çıkar.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeScorecard(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm scorecardlar silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearScorecards();
          setList([]);
          setOpenId(null);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const summary = useMemo(() => {
    if (list.length === 0) return null;
    const avg = Math.round(list.reduce((acc, e) => acc + computeScore(e.metrics, e.platform), 0) / list.length);
    const best = list.reduce((acc, e) => {
      const sc = computeScore(e.metrics, e.platform);
      return !acc || sc > acc.score ? { score: sc, entry: e } : acc;
    }, null as null | { score: number; entry: ScorecardEntry });
    const byVerdict: Record<ScoreVerdict, number> = { viral: 0, hit: 0, ok: 0, flop: 0 };
    list.forEach(e => {
      const v = verdictFromScore(computeScore(e.metrics, e.platform)).id;
      byVerdict[v] += 1;
    });
    const totalReach = list.reduce((a, e) => a + e.metrics.reach, 0);
    const totalEngagement = list.reduce(
      (a, e) => a + e.metrics.likes + e.metrics.comments + e.metrics.shares + e.metrics.saves,
      0
    );
    return { avg, best, byVerdict, totalReach, totalEngagement, count: list.length };
  }, [list]);

  const renderCard = (e: ScorecardEntry) => {
    const platformMeta = SCORE_PLATFORMS.find(p => p.id === e.platform);
    const formatMeta = SCORE_FORMATS.find(f => f.id === e.format);
    const score = computeScore(e.metrics, e.platform);
    const verdict = verdictFromScore(score);
    const isOpen = openId === e.id;
    const eng = e.metrics.likes + e.metrics.comments + e.metrics.shares + e.metrics.saves;
    return (
      <Pressable
        key={e.id}
        style={[styles.card, isOpen && { borderColor: verdict.color }]}
        onPress={() => setOpenId(isOpen ? null : e.id)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{e.title}</Text>
            <Text style={styles.cardSub}>
              {platformMeta?.emoji} {platformMeta?.label} · {formatMeta?.emoji} {formatMeta?.label} ·{' '}
              {formatDate(e.publishedAt)}
            </Text>
          </View>
          <View style={[styles.scoreBox, { backgroundColor: verdict.color }]}>
            <Text style={styles.scoreText}>{score}</Text>
          </View>
        </View>
        <Text style={styles.cardVerdict}>
          {verdict.emoji} {verdict.label}
        </Text>
        <Text style={styles.cardMeta}>
          👁 {fmtNumber(e.metrics.reach)} · ❤️ {fmtNumber(e.metrics.likes)} · 💬{' '}
          {fmtNumber(e.metrics.comments)} · 🔁 {fmtNumber(e.metrics.shares)} · 🔖{' '}
          {fmtNumber(e.metrics.saves)} · eng: {fmtNumber(eng)} · ⏱ {e.effortHours}sa
        </Text>
        {isOpen ? (
          <View style={styles.detail}>
            {e.hook ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Hook</Text>
                <Text style={styles.detailBody}>{e.hook}</Text>
              </View>
            ) : null}
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Metrikler</Text>
              <Text style={styles.detailBody}>
                Reach: {fmtNumber(e.metrics.reach)} {'\n'}
                Likes: {fmtNumber(e.metrics.likes)} ({((e.metrics.likes / Math.max(1, e.metrics.reach)) * 100).toFixed(2)}%) {'\n'}
                Comments: {fmtNumber(e.metrics.comments)} ({((e.metrics.comments / Math.max(1, e.metrics.reach)) * 100).toFixed(2)}%) {'\n'}
                Shares: {fmtNumber(e.metrics.shares)} ({((e.metrics.shares / Math.max(1, e.metrics.reach)) * 100).toFixed(2)}%) {'\n'}
                Saves: {fmtNumber(e.metrics.saves)} ({((e.metrics.saves / Math.max(1, e.metrics.reach)) * 100).toFixed(2)}%)
              </Text>
            </View>
            <View style={[styles.tipBox, { borderLeftColor: verdict.color }]}>
              <Text style={styles.tipTitle}>{verdict.emoji} {verdict.label} — öneri</Text>
              <Text style={styles.tipText}>{verdict.tip}</Text>
            </View>
            {e.notes ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Notlar</Text>
                <Text style={styles.detailBody}>{e.notes}</Text>
              </View>
            ) : null}
            <Pressable style={styles.deleteBtn} onPress={() => handleDelete(e.id)}>
              <Text style={styles.deleteBtnText}>🗑️ Sil</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Content Scorecard', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>📊 Content Scorecard</Text>
          <Text style={styles.heroSub}>
            Yayınladığın içeriği sonradan puanla. Reach + engagement oranları birleşip 0-100 arası
            skor üretir; hangi format ve hook kazandırıyor görünür hale gelir.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yeni Skor</Text>

          <Text style={styles.label}>İçerik başlığı *</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={v => setForm(f => ({ ...f, title: v }))}
            placeholder="ör: Sabah rutini reel — 12 Ağustos"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Platform</Text>
          <View style={styles.chipRow}>
            {SCORE_PLATFORMS.map(p => {
              const active = platform === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.chip, active && styles.chipActive]}
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
            {SCORE_FORMATS.map(f => {
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

          <Text style={styles.label}>Hook (ilk cümle / frame)</Text>
          <TextInput
            style={styles.input}
            value={form.hook}
            onChangeText={v => setForm(f => ({ ...f, hook: v }))}
            placeholder="ör: Çoğu içerik üreticisi ilk 3 saniyeyi boşa harcıyor."
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Reach</Text>
              <TextInput
                style={styles.input}
                value={form.reach}
                onChangeText={v => setForm(f => ({ ...f, reach: v }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Likes</Text>
              <TextInput
                style={styles.input}
                value={form.likes}
                onChangeText={v => setForm(f => ({ ...f, likes: v }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Yorum</Text>
              <TextInput
                style={styles.input}
                value={form.comments}
                onChangeText={v => setForm(f => ({ ...f, comments: v }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Paylaşım</Text>
              <TextInput
                style={styles.input}
                value={form.shares}
                onChangeText={v => setForm(f => ({ ...f, shares: v }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Kaydetme</Text>
              <TextInput
                style={styles.input}
                value={form.saves}
                onChangeText={v => setForm(f => ({ ...f, saves: v }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Efor (saat)</Text>
              <TextInput
                style={styles.input}
                value={form.effortHours}
                onChangeText={v => setForm(f => ({ ...f, effortHours: v }))}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <Text style={styles.label}>Notlar (opsiyonel)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={form.notes}
            onChangeText={v => setForm(f => ({ ...f, notes: v }))}
            placeholder="ör: CTA caption'a ekledim, ilk yorum olumlu"
            placeholderTextColor="#94a3b8"
            multiline
          />

          <View style={[styles.scorePreview, { borderColor: previewVerdict.color }]}>
            <View>
              <Text style={styles.scorePreviewLabel}>Tahmini skor</Text>
              <Text style={[styles.scorePreviewText, { color: previewVerdict.color }]}>
                {previewVerdict.emoji} {previewScore} · {previewVerdict.label}
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.cta, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>💾 Scorecard kaydet</Text>
            )}
          </Pressable>
        </View>

        {summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Özet</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryNum}>{summary.count}</Text>
                <Text style={styles.summaryLabel}>İçerik</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryNum}>{summary.avg}</Text>
                <Text style={styles.summaryLabel}>Ort. skor</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryNum}>{fmtNumber(summary.totalReach)}</Text>
                <Text style={styles.summaryLabel}>Toplam erişim</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryNum}>{fmtNumber(summary.totalEngagement)}</Text>
                <Text style={styles.summaryLabel}>Toplam etkileşim</Text>
              </View>
            </View>
            <View style={styles.verdictRow}>
              {(['viral', 'hit', 'ok', 'flop'] as ScoreVerdict[]).map(v => {
                const meta = verdictFromScore(v === 'viral' ? 80 : v === 'hit' ? 60 : v === 'ok' ? 35 : 15);
                return (
                  <View key={v} style={[styles.verdictChip, { borderColor: meta.color }]}>
                    <Text style={[styles.verdictNum, { color: meta.color }]}>
                      {summary.byVerdict[v]}
                    </Text>
                    <Text style={styles.verdictLabel}>{meta.emoji} {meta.label}</Text>
                  </View>
                );
              })}
            </View>
            {summary.best ? (
              <View style={[styles.bestBox, { borderColor: verdictFromScore(summary.best.score).color }]}>
                <Text style={styles.bestTitle}>🏆 En iyi içerik</Text>
                <Text style={styles.bestBody}>{summary.best.entry.title}</Text>
                <Text style={styles.bestMeta}>
                  {summary.best.score} puan · {fmtNumber(summary.best.entry.metrics.reach)} erişim
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Geçmiş Scorecardlar ({list.length})</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📈</Text>
              <Text style={styles.emptyText}>
                Henüz scorecard yok. Yukarıdan bir içerik puanla, buraya gelsin.
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
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  row2: { flexDirection: 'row' },
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
  scorePreview: {
    marginTop: 14,
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#0f172a',
  },
  scorePreviewLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  scorePreviewText: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  cta: { marginTop: 14, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  summaryCell: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryNum: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  summaryLabel: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  verdictRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  verdictChip: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#0f172a',
  },
  verdictNum: { fontSize: 16, fontWeight: '700' },
  verdictLabel: { color: '#cbd5e1', fontSize: 11, marginTop: 2 },
  bestBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  bestTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  bestBody: { color: '#e2e8f0', fontSize: 13 },
  bestMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

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
  scoreBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  scoreText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardVerdict: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginTop: 8 },
  cardMeta: { color: '#94a3b8', fontSize: 11, marginTop: 6 },

  detail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  detailBlock: { marginBottom: 10 },
  detailLabel: { color: '#a5b4fc', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  detailBody: { color: '#e2e8f0', fontSize: 13, lineHeight: 18 },
  tipBox: { backgroundColor: '#1e293b', borderLeftWidth: 3, padding: 10, borderRadius: 8, marginBottom: 10 },
  tipTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  deleteBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    marginTop: 4,
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