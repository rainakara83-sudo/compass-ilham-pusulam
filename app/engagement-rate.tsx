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
  ER_PLATFORMS,
  ErEntry,
  ErPlatform,
  clearEr,
  computeEngagement,
  getErList,
  removeEr,
  saveEr,
} from '../services/storage';

const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const fmtDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

const parseNum = (s: string): number => Math.max(0, Math.floor(parseFloat(s.replace(',', '.')) || 0));

export default function EngagementRateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<ErEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [platform, setPlatform] = useState<ErPlatform>('instagram');
  const [title, setTitle] = useState('');
  const [followers, setFollowers] = useState('1000');
  const [reach, setReach] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [saves, setSaves] = useState('');
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const l = await getErList();
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

  const platformMeta = useMemo(
    () => ER_PLATFORMS.find(p => p.id === platform) ?? ER_PLATFORMS[0],
    [platform]
  );

  const breakdown = useMemo(
    () =>
      computeEngagement(
        {
          platform,
          followers: parseNum(followers),
          reach: parseNum(reach),
          likes: parseNum(likes),
          comments: parseNum(comments),
          shares: parseNum(shares),
          saves: parseNum(saves),
        },
        platform
      ),
    [platform, followers, reach, likes, comments, shares, saves]
  );

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Eksik bilgi', 'İçerik başlığı yaz.');
      return;
    }
    if (parseNum(reach) === 0) {
      Alert.alert('Eksik bilgi', 'Reach 0 olamaz.');
      return;
    }
    setSaving(true);
    try {
      const next = await saveEr({
        title: title.trim(),
        platform,
        followers: parseNum(followers),
        reach: parseNum(reach),
        likes: parseNum(likes),
        comments: parseNum(comments),
        shares: parseNum(shares),
        saves: parseNum(saves),
      });
      setList(next);
      setTitle('');
      setReach('');
      setLikes('');
      setComments('');
      setShares('');
      setSaves('');
      setToast('Kaydedildi ✓');
    } catch {
      Alert.alert('Hata', 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Kayıt silinsin mi?', 'Bu analiz listeden çıkar.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeEr(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm kayıtlar silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearEr();
          setList([]);
          setOpenId(null);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const summary = useMemo(() => {
    if (list.length === 0) return null;
    const avg = list.reduce((acc, e) => {
      const b = computeEngagement(e, e.platform);
      return acc + b.erByReach;
    }, 0) / list.length;
    const best = list.reduce((acc, e) => {
      const b = computeEngagement(e, e.platform);
      return !acc || b.erByReach > acc.breakdown.erByReach
        ? { breakdown: b, entry: e }
        : acc;
    }, null as null | { breakdown: ReturnType<typeof computeEngagement>; entry: ErEntry });
    const byVerdict: Record<string, number> = { great: 0, good: 0, mid: 0, low: 0 };
    list.forEach(e => {
      const b = computeEngagement(e, e.platform);
      byVerdict[b.verdict] += 1;
    });
    return { avg, best, byVerdict, count: list.length };
  }, [list]);

  const renderCard = (e: ErEntry) => {
    const meta = ER_PLATFORMS.find(p => p.id === e.platform);
    const b = computeEngagement(e, e.platform);
    const isOpen = openId === e.id;
    const total = e.likes + e.comments + e.shares + e.saves;
    return (
      <Pressable
        key={e.id}
        style={[styles.card, isOpen && { borderColor: b.verdictColor }]}
        onPress={() => setOpenId(isOpen ? null : e.id)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{e.title}</Text>
            <Text style={styles.cardSub}>
              {meta?.emoji} {meta?.label} · {fmtDate(e.createdAt)} · 👁 {fmtNum(e.reach)} · 👥{' '}
              {fmtNum(e.followers)}
            </Text>
          </View>
          <View style={[styles.erBadge, { backgroundColor: b.verdictColor }]}>
            <Text style={styles.erBadgeText}>{b.erByReach.toFixed(1)}%</Text>
          </View>
        </View>
        <Text style={[styles.cardVerdict, { color: b.verdictColor }]}>
          {b.verdictEmoji} {b.verdictLabel}
        </Text>
        <Text style={styles.cardMeta}>
          ❤️ {fmtNum(e.likes)} · 💬 {fmtNum(e.comments)} · 🔁 {fmtNum(e.shares)} · 🔖{' '}
          {fmtNum(e.saves)} · toplam etkileşim: {fmtNum(total)}
        </Text>
        {isOpen ? (
          <View style={styles.detail}>
            <View style={[styles.tipBox, { borderLeftColor: b.verdictColor }]}>
              <Text style={styles.tipTitle}>{b.verdictEmoji} {b.verdictLabel}</Text>
              <Text style={styles.tipText}>{b.recommendation}</Text>
            </View>
            <View style={styles.breakdownGrid}>
              <BreakdownCell label="ER / followers" value={`${b.erByFollowers.toFixed(2)}%`} />
              <BreakdownCell label="ER / reach" value={`${b.erByReach.toFixed(2)}%`} />
              <BreakdownCell label="Like oranı" value={`${b.likesRate.toFixed(2)}%`} />
              <BreakdownCell label="Yorum oranı" value={`${b.commentsRate.toFixed(3)}%`} />
              <BreakdownCell label="Paylaşım oranı" value={`${b.sharesRate.toFixed(3)}%`} />
              <BreakdownCell label="Kaydetme oranı" value={`${b.savesRate.toFixed(3)}%`} />
            </View>
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
      <Stack.Screen options={{ title: 'Engagement Rate', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>📈 Engagement Rate Calculator</Text>
          <Text style={styles.heroSub}>
            Bir postun etkileşim oranını hem followers'a hem reach'e göre hesapla; platform
            benchmark'larına göre "iyi mi kötü mü" yorumu al.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yeni Analiz</Text>

          <Text style={styles.label}>Platform</Text>
          <View style={styles.chipRow}>
            {ER_PLATFORMS.map(p => {
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

          <Text style={styles.label}>İçerik başlığı *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="ör: Sabah rutini reel"
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Takipçi sayısı</Text>
              <TextInput
                style={styles.input}
                value={followers}
                onChangeText={setFollowers}
                keyboardType="number-pad"
                placeholder="1000"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Reach *</Text>
              <TextInput
                style={styles.input}
                value={reach}
                onChangeText={setReach}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Likes</Text>
              <TextInput
                style={styles.input}
                value={likes}
                onChangeText={setLikes}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Yorum</Text>
              <TextInput
                style={styles.input}
                value={comments}
                onChangeText={setComments}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Paylaşım</Text>
              <TextInput
                style={styles.input}
                value={shares}
                onChangeText={setShares}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Kaydetme</Text>
              <TextInput
                style={styles.input}
                value={saves}
                onChangeText={setSaves}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={[styles.scoreBox, { borderColor: breakdown.verdictColor }]}>
            <Text style={styles.scoreLabel}>ER (reach'e göre)</Text>
            <Text style={[styles.scoreValue, { color: breakdown.verdictColor }]}>
              {breakdown.erByReach.toFixed(2)}% {breakdown.verdictEmoji} {breakdown.verdictLabel}
            </Text>
            <Text style={styles.scoreSub}>
              {platformMeta.emoji} {platformMeta.label} benchmark: iyi {platformMeta.goodEr}% ·
              mükemmel {platformMeta.greatEr}%+
            </Text>
          </View>

          <View style={styles.breakdownGrid}>
            <BreakdownCell label="ER / followers" value={`${breakdown.erByFollowers.toFixed(2)}%`} />
            <BreakdownCell label="Like oranı" value={`${breakdown.likesRate.toFixed(2)}%`} />
            <BreakdownCell label="Yorum oranı" value={`${breakdown.commentsRate.toFixed(3)}%`} />
            <BreakdownCell label="Paylaşım oranı" value={`${breakdown.sharesRate.toFixed(3)}%`} />
          </View>

          <Pressable
            style={[styles.cta, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>💾 Kaydet</Text>
            )}
          </Pressable>
        </View>

        {summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Özet</Text>
            <View style={styles.summaryGrid}>
              <SummaryCell label="Analiz sayısı" value={String(summary.count)} />
              <SummaryCell label="Ort. ER (reach)" value={`${summary.avg.toFixed(2)}%`} />
              <SummaryCell label="🌟 Mükemmel" value={String(summary.byVerdict.great)} />
              <SummaryCell label="✅ İyi" value={String(summary.byVerdict.good)} />
              <SummaryCell label="🌤️ Standart" value={String(summary.byVerdict.mid)} />
              <SummaryCell label="🍂 Düşük" value={String(summary.byVerdict.low)} />
            </View>
            {summary.best ? (
              <View style={[styles.bestBox, { borderLeftColor: summary.best.breakdown.verdictColor }]}>
                <Text style={styles.bestTitle}>🏆 En iyi performans</Text>
                <Text style={styles.bestBody}>{summary.best.entry.title}</Text>
                <Text style={styles.bestMeta}>
                  ER (reach): {summary.best.breakdown.erByReach.toFixed(2)}% ·{' '}
                  {summary.best.breakdown.verdictEmoji} {summary.best.breakdown.verdictLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Geçmiş Analizler ({list.length})</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyText}>
                Henüz analiz yok. Yukarıdan bir içerik gir, buraya gelsin.
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

const BreakdownCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.brkCell}>
    <Text style={styles.brkLabel}>{label}</Text>
    <Text style={styles.brkValue}>{value}</Text>
  </View>
);

const SummaryCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.sumCell}>
    <Text style={styles.sumValue}>{value}</Text>
    <Text style={styles.sumLabel}>{label}</Text>
  </View>
);

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

  scoreBox: {
    marginTop: 14,
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#0f172a',
  },
  scoreLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  scoreValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  scoreSub: { color: '#94a3b8', fontSize: 11, marginTop: 6 },

  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  brkCell: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  brkLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },
  brkValue: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginTop: 2 },

  cta: { marginTop: 14, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sumCell: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  sumValue: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  sumLabel: { color: '#94a3b8', fontSize: 10, marginTop: 2 },

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
  erBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  erBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardVerdict: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  cardMeta: { color: '#94a3b8', fontSize: 11, marginTop: 6 },

  detail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
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
    marginTop: 10,
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