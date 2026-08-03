import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  clearREs,
  estimateReach,
  getREList,
  REEntry,
  REFollower,
  REFormat,
  REInput,
  REPlatform,
  REResult,
  RE_FORMATS,
  RE_PLATFORMS,
  RE_TIERS,
  removeRE,
  saveRE,
} from '../services/storage';

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const ratingColor = (r: REResult['rating']): string => {
  if (r === 'viral-potansiyel') return '#10b981';
  if (r === 'güçlü') return '#6366f1';
  if (r === 'iyi') return '#8b5cf6';
  if (r === 'orta') return '#f59e0b';
  return '#ef4444';
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

export default function ReachEstimatorScreen() {
  const [platform, setPlatform] = useState<REPlatform>('instagram');
  const [format, setFormat] = useState<REFormat>('short-video');
  const [followers, setFollowers] = useState<string>('5000');
  const [tier, setTier] = useState<REFollower>('micro');
  const [hashtagCount, setHashtagCount] = useState<string>('5');
  const [quality, setQuality] = useState<number>(75);
  const [consistencyDays, setConsistencyDays] = useState<string>('14');
  const [hasCollab, setHasCollab] = useState<boolean>(false);
  const [hasTrend, setHasTrend] = useState<boolean>(false);
  const [result, setResult] = useState<REResult | null>(null);
  const [list, setList] = useState<REEntry[]>([]);

  const load = useCallback(async () => {
    const stored = await getREList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const buildInput = (): REInput | null => {
    const f = parseInt(followers, 10);
    const h = parseInt(hashtagCount, 10);
    const c = parseInt(consistencyDays, 10);
    if (isNaN(f) || f < 0) return null;
    return {
      platform,
      format,
      followers: f,
      followerTier: tier,
      hashtagCount: isNaN(h) ? 0 : h,
      quality: Math.max(0, Math.min(100, quality)),
      consistencyDays: isNaN(c) ? 0 : c,
      hasCollab,
      hasTrend,
    };
  };

  const onEstimate = () => {
    const inp = buildInput();
    if (!inp) return;
    setResult(estimateReach(inp));
  };

  const onSave = async () => {
    const inp = buildInput();
    if (!inp || !result) return;
    const entry: REEntry = {
      id: `re-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      input: inp,
      result,
      createdAt: Date.now(),
    };
    const next = await saveRE(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeRE(id);
    setList(next);
  };

  const onClear = async () => {
    await clearREs();
    setList([]);
  };

  const topReach = useMemo(() => {
    if (list.length === 0) return 0;
    return Math.max(...list.map(e => e.result.estimatedReach));
  }, [list]);

  const avgViral = useMemo(() => {
    if (list.length === 0) return 0;
    return Math.round(list.reduce((s, e) => s + e.result.viralProbability, 0) / list.length);
  }, [list]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📡 Reach Estimator</Text>
      <Text style={styles.subtitle}>
        İçeriğinin beklenen erişimini, etkileşimini ve viral potansiyelini hesapla.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Platform</Text>
        <View style={styles.chipRow}>
          {RE_PLATFORMS.map(p => (
            <Pressable
              key={p.id}
              onPress={() => setPlatform(p.id)}
              style={[styles.chip, platform === p.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, platform === p.id ? styles.chipTextActive : null]}>
                {p.emoji} {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2) Format</Text>
        <View style={styles.chipRow}>
          {RE_FORMATS.map(f => (
            <Pressable
              key={f.id}
              onPress={() => setFormat(f.id)}
              style={[styles.chip, format === f.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, format === f.id ? styles.chipTextActive : null]}>
                {f.emoji} {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3) Takipçi & Tier</Text>
        <TextInput
          value={followers}
          onChangeText={setFollowers}
          keyboardType="numeric"
          placeholder="Takipçi sayısı"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <View style={styles.chipRow}>
          {RE_TIERS.map(t => (
            <Pressable
              key={t.id}
              onPress={() => setTier(t.id)}
              style={[styles.chip, tier === t.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, tier === t.id ? styles.chipTextActive : null]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4) İçerik Detayları</Text>
        <Text style={styles.label}>Hashtag Sayısı</Text>
        <TextInput
          value={hashtagCount}
          onChangeText={setHashtagCount}
          keyboardType="numeric"
          placeholder="0-30"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <Text style={styles.label}>Kalite (0-100): {quality}</Text>
        <View style={styles.qualityRow}>
          <Pressable onPress={() => setQuality(Math.max(0, quality - 10))} style={styles.qBtn}>
            <Text style={styles.qBtnText}>-10</Text>
          </Pressable>
          <View style={styles.qualityBar}>
            <View style={[styles.qualityFill, { width: `${quality}%` }]} />
          </View>
          <Pressable onPress={() => setQuality(Math.min(100, quality + 10))} style={styles.qBtn}>
            <Text style={styles.qBtnText}>+10</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Tutarlılık (gün)</Text>
        <TextInput
          value={consistencyDays}
          onChangeText={setConsistencyDays}
          keyboardType="numeric"
          placeholder="Gün sayısı"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <View style={styles.toggleRow}>
          <Text style={styles.label}>Collab Var</Text>
          <Switch value={hasCollab} onValueChange={setHasCollab} trackColor={{ true: '#6366f1' }} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.label}>Trend Kullanıyor</Text>
          <Switch value={hasTrend} onValueChange={setHasTrend} trackColor={{ true: '#6366f1' }} />
        </View>
      </View>

      <Pressable onPress={onEstimate} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>Erişim Hesapla</Text>
      </Pressable>

      {result ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Tahmin Sonucu</Text>
          <View style={styles.ratingPill}>
            <Text style={[styles.ratingText, { color: ratingColor(result.rating) }]}>
              {result.rating.toUpperCase()}
            </Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatNumber(result.estimatedReach)}</Text>
              <Text style={styles.statLabel}>Erişim</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatNumber(result.estimatedImpressions)}</Text>
              <Text style={styles.statLabel}>Gösterim</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatNumber(result.estimatedEngagement)}</Text>
              <Text style={styles.statLabel}>Etkileşim</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>${result.cpm}</Text>
              <Text style={styles.statLabel}>CPM</Text>
            </View>
          </View>

          <Text style={styles.subSection}>Viral Olasılık: {result.viralProbability}%</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${result.viralProbability}%`,
                  backgroundColor: ratingColor(result.rating),
                },
              ]}
            />
          </View>

          <Text style={styles.subSection}>Toplam Erişim Çarpanı: ×{result.reachMultiplier}</Text>
          {result.breakdown.map((b, i) => (
            <View key={i} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{b.label}</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    { width: `${Math.min(100, (b.value / 2) * 100)}%`, backgroundColor: b.color },
                  ]}
                />
              </View>
              <Text style={styles.breakdownVal}>×{b.value.toFixed(2)}</Text>
            </View>
          ))}

          <Pressable onPress={onSave} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Sonucu Kaydet</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📈 Geçmiş Tahminler</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>Senaryo</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatNumber(topReach)}</Text>
              <Text style={styles.statLabel}>En Yüksek</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{avgViral}%</Text>
              <Text style={styles.statLabel}>Ort. Viral</Text>
            </View>
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.subSection}>Senaryolar</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          {list.slice(0, 6).map(e => {
            const pMeta = RE_PLATFORMS.find(p => p.id === e.input.platform);
            const fMeta = RE_FORMATS.find(f => f.id === e.input.format);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {pMeta?.emoji} {pMeta?.label} · {fMeta?.emoji} {fMeta?.label}
                  </Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  {formatNumber(e.input.followers)} takipçi · {e.input.quality}/100 kalite
                </Text>
                <View style={styles.entryStatsRow}>
                  <Text style={styles.entryStat}>📡 {formatNumber(e.result.estimatedReach)}</Text>
                  <Text style={styles.entryStat}>💬 {formatNumber(e.result.estimatedEngagement)}</Text>
                  <Text style={[styles.entryStat, { color: ratingColor(e.result.rating) }]}>
                    ⚡ {e.result.viralProbability}%
                  </Text>
                </View>
                <Text style={styles.entryDate}>📅 {formatDate(e.createdAt)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', marginBottom: 10 },
  subSection: { fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { fontSize: 12, color: '#cbd5e1' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 6,
  },
  label: { fontSize: 13, color: '#cbd5e1', marginTop: 8 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  qBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  qBtnText: { color: '#c7d2fe', fontSize: 12, fontWeight: '600' },
  qualityBar: { flex: 1, height: 10, backgroundColor: '#0f172a', borderRadius: 5, overflow: 'hidden' },
  qualityFill: { height: 10, backgroundColor: '#6366f1' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ratingPill: { alignItems: 'center', marginBottom: 10 },
  ratingText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNum: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  barTrack: { height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 8 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3, gap: 6 },
  breakdownLabel: { fontSize: 12, color: '#cbd5e1', width: 80 },
  breakdownBar: { flex: 1, height: 6, backgroundColor: '#0f172a', borderRadius: 3, overflow: 'hidden' },
  breakdownFill: { height: 6 },
  breakdownVal: { fontSize: 11, color: '#f1f5f9', fontWeight: '600', width: 50, textAlign: 'right' },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  clearLink: { color: '#f87171', fontSize: 12 },
  entryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryTitle: { fontSize: 13, fontWeight: '600', color: '#f8fafc', flex: 1, marginRight: 6 },
  entryMeta: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  entryStatsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  entryStat: { fontSize: 12, color: '#cbd5e1', fontWeight: '600' },
  entryDate: { fontSize: 10, color: '#64748b', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 11 },
});
