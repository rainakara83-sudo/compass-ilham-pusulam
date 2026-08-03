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
  calcVelocity,
  clearCVTs,
  CVT_PLATFORMS,
  CVT_TYPES,
  CVTPost,
  getCVTList,
  removeCVT,
  saveCVT,
  todayPCSKey,
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

const trendColor = (t: 'artan' | 'sabit' | 'azalan'): string => {
  if (t === 'artan') return '#10b981';
  if (t === 'azalan') return '#ef4444';
  return '#f59e0b';
};

const today = (): string => todayPCSKey();

export default function VelocityTrackerScreen() {
  const [date, setDate] = useState<string>(today());
  const [platform, setPlatform] = useState<CVTPost['platform']>('instagram');
  const [type, setType] = useState<CVTPost['type']>('reel');
  const [effort, setEffort] = useState<string>('60');
  const [reach, setReach] = useState<string>('1500');
  const [list, setList] = useState<CVTPost[]>([]);

  const load = useCallback(async () => {
    const stored = await getCVTList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAdd = async () => {
    const e = parseInt(effort, 10);
    const r = parseInt(reach, 10);
    if (isNaN(e) || e < 0) return;
    const entry: CVTPost = {
      id: `cvt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date,
      platform,
      type,
      effortMinutes: e,
      reach: isNaN(r) ? 0 : r,
      createdAt: Date.now(),
    };
    const next = await saveCVT(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeCVT(id);
    setList(next);
  };

  const onClear = async () => {
    await clearCVTs();
    setList([]);
  };

  const report = useMemo(() => calcVelocity(list), [list]);
  const maxEff = useMemo(() => Math.max(1, ...report.weeks.map(w => w.efficiency)), [report]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⚡ Content Velocity Tracker</Text>
      <Text style={styles.subtitle}>
        Haftalık içerik hızını, eforunu ve verimini ölç.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Yeni Giriş</Text>
        <Text style={styles.label}>Tarih</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="YYYY-AA-GG" placeholderTextColor="#64748b" style={styles.input} />
        <Text style={styles.label}>Platform</Text>
        <View style={styles.chipRow}>
          {CVT_PLATFORMS.map(p => (
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
        <Text style={styles.label}>Tip</Text>
        <View style={styles.chipRow}>
          {CVT_TYPES.map(t => (
            <Pressable
              key={t.id}
              onPress={() => {
                setType(t.id);
                setEffort(String(t.effort));
              }}
              style={[styles.chip, type === t.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, type === t.id ? styles.chipTextActive : null]}>
                {t.emoji} {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.dualRow}>
          <View style={styles.dualCol}>
            <Text style={styles.label}>Efor (dk)</Text>
            <TextInput value={effort} onChangeText={setEffort} keyboardType="numeric" style={styles.input} />
          </View>
          <View style={styles.dualCol}>
            <Text style={styles.label}>Erişim</Text>
            <TextInput value={reach} onChangeText={setReach} keyboardType="numeric" style={styles.input} />
          </View>
        </View>
        <Pressable onPress={onAdd} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Ekle</Text>
        </Pressable>
      </View>

      {report.weeks.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📈 Velocity Raporu</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{report.totalPosts}</Text>
              <Text style={styles.statLabel}>Toplam İçerik</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{report.totalMinutes}dk</Text>
              <Text style={styles.statLabel}>Toplam Efor</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: trendColor(report.trend) }]}>
                {report.trend}
              </Text>
              <Text style={styles.statLabel}>Trend</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{report.avgVelocity}</Text>
              <Text style={styles.statLabel}>Ort. Günlük</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{report.avgEfficiency}</Text>
              <Text style={styles.statLabel}>Erişim/dk</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatNumber(report.totalReach / Math.max(1, report.totalPosts))}</Text>
              <Text style={styles.statLabel}>Ort. Erişim</Text>
            </View>
          </View>
          <Text style={styles.recommendation}>{report.recommendation}</Text>

          <Text style={styles.subSection}>Haftalık Verim</Text>
          {report.weeks.map(w => (
            <View key={w.weekStart} style={styles.weekRow}>
              <Text style={styles.weekLabel}>📅 {w.weekStart.slice(5)}</Text>
              <View style={styles.weekBarTrack}>
                <View
                  style={[
                    styles.weekBarFill,
                    { width: `${(w.efficiency / maxEff) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.weekVal}>
                {w.posts}p · {w.efficiency}e/d
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>📋 Kayıtlar</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          {list.slice(0, 10).map(p => {
            const pMeta = CVT_PLATFORMS.find(x => x.id === p.platform);
            const tMeta = CVT_TYPES.find(x => x.id === p.type);
            return (
              <View key={p.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {pMeta?.emoji} {tMeta?.emoji} {tMeta?.label}
                  </Text>
                  <Pressable onPress={() => onRemove(p.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  📅 {p.date} · ⏱ {p.effortMinutes}dk · 📡 {formatNumber(p.reach)}
                </Text>
                <Text style={styles.entryDate}>📅 {formatDate(p.createdAt)}</Text>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
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
  dualRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dualCol: { flex: 1 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
  statNum: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  recommendation: { fontSize: 13, color: '#cbd5e1', marginTop: 12, lineHeight: 18, textAlign: 'center' },
  weekRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3, gap: 6 },
  weekLabel: { fontSize: 11, color: '#cbd5e1', width: 50 },
  weekBarTrack: { flex: 1, height: 10, backgroundColor: '#0f172a', borderRadius: 5, overflow: 'hidden' },
  weekBarFill: { height: 10, backgroundColor: '#6366f1' },
  weekVal: { fontSize: 11, color: '#f1f5f9', fontWeight: '600', width: 80, textAlign: 'right' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
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
  entryTitle: { fontSize: 13, fontWeight: '600', color: '#f8fafc' },
  entryMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 2 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
