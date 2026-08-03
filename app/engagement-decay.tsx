import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  analyzeDecay,
  clearEDs,
  ED_CONTENT_TYPES,
  ED_PLATFORMS,
  EDCurve,
  EDEntry,
  EDPlatform,
  getEDList,
  removeED,
  saveED,
} from '../services/storage';

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

const decayColor = (d: EDCurve['decay']): string => {
  if (d === 'kalıcı') return '#10b981';
  if (d === 'yavaş') return '#6366f1';
  if (d === 'normal') return '#f59e0b';
  return '#ef4444';
};

export default function EngagementDecayScreen() {
  const [platform, setPlatform] = useState<EDPlatform>('instagram');
  const [contentType, setContentType] = useState<EDEntry['contentType']>('reel');
  const [day0, setDay0] = useState<string>('1000');
  const [day1, setDay1] = useState<string>('700');
  const [day3, setDay3] = useState<string>('400');
  const [day7, setDay7] = useState<string>('200');
  const [day14, setDay14] = useState<string>('100');
  const [day30, setDay30] = useState<string>('50');
  const [list, setList] = useState<EDEntry[]>([]);
  const [preview, setPreview] = useState<EDCurve | null>(null);

  const load = useCallback(async () => {
    const stored = await getEDList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const buildEntry = (): EDEntry | null => {
    const d0 = parseInt(day0, 10);
    if (isNaN(d0) || d0 < 1) return null;
    return {
      id: `ed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platform,
      contentType,
      day0: d0,
      day1: parseInt(day1, 10) || 0,
      day3: parseInt(day3, 10) || 0,
      day7: parseInt(day7, 10) || 0,
      day14: parseInt(day14, 10) || 0,
      day30: parseInt(day30, 10) || 0,
      createdAt: Date.now(),
    };
  };

  const onAnalyze = () => {
    const e = buildEntry();
    if (!e) return;
    setPreview(analyzeDecay(e));
  };

  const onSave = async () => {
    const e = buildEntry();
    if (!e) return;
    const next = await saveED(e);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeED(id);
    setList(next);
  };

  const onClear = async () => {
    await clearEDs();
    setList([]);
  };

  const onSample = () => {
    setDay0('2000');
    setDay1('900');
    setDay3('500');
    setDay7('300');
    setDay14('180');
    setDay30('80');
  };

  const avgHalfLife = useMemo(() => {
    if (list.length === 0) return 0;
    const total = list.reduce((s, e) => s + analyzeDecay(e).halfLifeDays, 0);
    return +(total / list.length).toFixed(1);
  }, [list]);

  const topLong = useMemo(() => {
    if (list.length === 0) return null;
    return list.reduce<{ entry: EDEntry; curve: EDCurve } | null>((best, e) => {
      const c = analyzeDecay(e);
      if (!best || c.halfLifeDays > best.curve.halfLifeDays) return { entry: e, curve: c };
      return best;
    }, null);
  }, [list]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📉 Engagement Decay Analyzer</Text>
      <Text style={styles.subtitle}>
        İçeriğinin etkileşiminin günden güne nasıl düştüğünü ölç.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Platform</Text>
        <View style={styles.chipRow}>
          {ED_PLATFORMS.map(p => (
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
        <Text style={styles.sectionTitle}>2) İçerik Tipi</Text>
        <View style={styles.chipRow}>
          {ED_CONTENT_TYPES.map(c => (
            <Pressable
              key={c.id}
              onPress={() => setContentType(c.id)}
              style={[styles.chip, contentType === c.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, contentType === c.id ? styles.chipTextActive : null]}>
                {c.emoji} {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3) Günlere Göre Etkileşim</Text>
        <Text style={styles.label}>Gün 0 (yayın anı)</Text>
        <TextInput value={day0} onChangeText={setDay0} keyboardType="numeric" style={styles.input} />
        <Text style={styles.label}>Gün 1</Text>
        <TextInput value={day1} onChangeText={setDay1} keyboardType="numeric" style={styles.input} />
        <Text style={styles.label}>Gün 3</Text>
        <TextInput value={day3} onChangeText={setDay3} keyboardType="numeric" style={styles.input} />
        <Text style={styles.label}>Gün 7</Text>
        <TextInput value={day7} onChangeText={setDay7} keyboardType="numeric" style={styles.input} />
        <Text style={styles.label}>Gün 14</Text>
        <TextInput value={day14} onChangeText={setDay14} keyboardType="numeric" style={styles.input} />
        <Text style={styles.label}>Gün 30</Text>
        <TextInput value={day30} onChangeText={setDay30} keyboardType="numeric" style={styles.input} />
        <View style={styles.btnRow}>
          <Pressable onPress={onSample} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Örnek Doldur</Text>
          </Pressable>
          <Pressable onPress={onAnalyze} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Analiz Et</Text>
          </Pressable>
        </View>
      </View>

      {preview ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📈 Decay Analizi</Text>
          <View style={styles.halfLifeBox}>
            <Text style={styles.halfLifeLabel}>Yarı Ömür</Text>
            <Text style={[styles.halfLifeValue, { color: decayColor(preview.decay) }]}>
              {preview.halfLifeDays} gün
            </Text>
            <View style={[styles.decayBadge, { backgroundColor: decayColor(preview.decay) }]}>
              <Text style={styles.decayBadgeText}>{preview.decay.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.subSection}>📉 Decay Eğrisi</Text>
          <View style={styles.curveBox}>
            {preview.retention.map((p, idx) => {
              const max = Math.max(...preview.retention.map(r => r.v), 1);
              const heightPct = (p.v / max) * 100;
              return (
                <View key={idx} style={styles.curveCol}>
                  <View style={styles.curveBarTrack}>
                    <View
                      style={[
                        styles.curveBar,
                        { height: `${heightPct}%`, backgroundColor: decayColor(preview.decay) },
                      ]}
                    />
                  </View>
                  <Text style={styles.curveVal}>{formatNumber(p.v)}</Text>
                  <Text style={styles.curveDay}>G{p.d}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.recommendation}>{preview.recommendation}</Text>
          <Pressable onPress={onSave} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Kaydet</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Genel</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>İçerik</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{avgHalfLife}</Text>
              <Text style={styles.statLabel}>Ort. Yarı Ömür</Text>
            </View>
            {topLong ? (
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{topLong.curve.halfLifeDays}</Text>
                <Text style={styles.statLabel}>En Uzun</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.subSection}>Kayıtlar</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          {list.map(e => {
            const curve = analyzeDecay(e);
            const pMeta = ED_PLATFORMS.find(p => p.id === e.platform);
            const tMeta = ED_CONTENT_TYPES.find(t => t.id === e.contentType);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {pMeta?.emoji} {pMeta?.label} · {tMeta?.emoji} {tMeta?.label}
                  </Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <View style={styles.entryMetaRow}>
                  <Text style={styles.entryMeta}>
                    ⏳ {curve.halfLifeDays} gün · {curve.decay}
                  </Text>
                  <View style={[styles.miniBadge, { backgroundColor: decayColor(curve.decay) }]}>
                    <Text style={styles.miniBadgeText}>{curve.decay.toUpperCase()}</Text>
                  </View>
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
  label: { fontSize: 13, color: '#cbd5e1', marginTop: 8 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
    marginTop: 4,
  },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  secondaryBtnText: { color: '#c7d2fe', fontSize: 15, fontWeight: '600' },
  halfLifeBox: { alignItems: 'center', marginVertical: 8 },
  halfLifeLabel: { fontSize: 12, color: '#94a3b8' },
  halfLifeValue: { fontSize: 36, fontWeight: '800', marginTop: 2 },
  decayBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 6 },
  decayBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  curveBox: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6, marginTop: 6 },
  curveCol: { flex: 1, alignItems: 'center' },
  curveBarTrack: { width: '70%', flex: 1, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  curveBar: { width: '100%' },
  curveVal: { fontSize: 9, color: '#cbd5e1', marginTop: 4, fontWeight: '600' },
  curveDay: { fontSize: 9, color: '#94a3b8', marginTop: 1 },
  recommendation: { fontSize: 13, color: '#cbd5e1', marginTop: 12, lineHeight: 18, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNum: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
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
  entryTitle: { fontSize: 14, fontWeight: '600', color: '#f8fafc', flex: 1, marginRight: 8 },
  entryMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  entryMeta: { fontSize: 12, color: '#94a3b8' },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  miniBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
