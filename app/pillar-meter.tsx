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
  calcPillarReport,
  clearPMs,
  getPMList,
  PMEntry,
  PM_PILLARS,
  PMPillar,
  removePM,
  savePM,
} from '../services/storage';

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const strengthColor = (s: number): string => {
  if (s >= 70) return '#10b981';
  if (s >= 40) return '#6366f1';
  if (s >= 20) return '#f59e0b';
  return '#94a3b8';
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

export default function PillarMeterScreen() {
  const [pillar, setPillar] = useState<PMPillar>('education');
  const [count, setCount] = useState<string>('3');
  const [reach, setReach] = useState<string>('1500');
  const [engagement, setEngagement] = useState<string>('90');
  const [list, setList] = useState<PMEntry[]>([]);

  const load = useCallback(async () => {
    const stored = await getPMList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAdd = async () => {
    const c = parseInt(count, 10);
    const r = parseInt(reach, 10);
    const eng = parseInt(engagement, 10);
    if (isNaN(c) || c < 1) return;
    const entry: PMEntry = {
      id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pillar,
      count: c,
      reach: isNaN(r) ? 0 : r,
      engagement: isNaN(eng) ? 0 : eng,
      createdAt: Date.now(),
    };
    const next = await savePM(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removePM(id);
    setList(next);
  };

  const onClear = async () => {
    await clearPMs();
    setList([]);
  };

  const report = useMemo(() => calcPillarReport(list), [list]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📊 Pillar Strength Meter</Text>
      <Text style={styles.subtitle}>
        İçerik sütunlarının dağılımını, gücünü ve dengesini ölç.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sütun</Text>
        <View style={styles.chipRow}>
          {PM_PILLARS.map(p => (
            <Pressable
              key={p.id}
              onPress={() => setPillar(p.id)}
              style={[styles.chip, pillar === p.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, pillar === p.id ? styles.chipTextActive : null]}>
                {p.emoji} {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Veri Ekle</Text>
        <Text style={styles.label}>İçerik Sayısı</Text>
        <TextInput
          value={count}
          onChangeText={setCount}
          keyboardType="numeric"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <Text style={styles.label}>Toplam Erişim</Text>
        <TextInput
          value={reach}
          onChangeText={setReach}
          keyboardType="numeric"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <Text style={styles.label}>Toplam Etkileşim</Text>
        <TextInput
          value={engagement}
          onChangeText={setEngagement}
          keyboardType="numeric"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <Pressable onPress={onAdd} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Veriyi Ekle</Text>
        </Pressable>
      </View>

      {report.total > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎯 Genel Rapor</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{report.total}</Text>
              <Text style={styles.statLabel}>Toplam İçerik</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{report.diversity}%</Text>
              <Text style={styles.statLabel}>Çeşitlilik</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{report.balance}%</Text>
              <Text style={styles.statLabel}>Denge</Text>
            </View>
          </View>
          <Text style={styles.recommendation}>{report.recommendation}</Text>
          {report.dominantPillar ? (
            <Text style={styles.helperText}>
              🏆 Baskın: {PM_PILLARS.find(p => p.id === report.dominantPillar)?.emoji} {PM_PILLARS.find(p => p.id === report.dominantPillar)?.label}
            </Text>
          ) : null}
          {report.weakestPillar ? (
            <Text style={styles.helperText}>
              📉 En zayıf: {PM_PILLARS.find(p => p.id === report.weakestPillar)?.emoji} {PM_PILLARS.find(p => p.id === report.weakestPillar)?.label}
            </Text>
          ) : null}
        </View>
      ) : null}

      {report.total > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🧱 Sütun Güçleri</Text>
          {report.pillars.map(p => {
            const meta = PM_PILLARS.find(x => x.id === p.pillar);
            if (!meta) return null;
            return (
              <View key={p.pillar} style={styles.pillarBlock}>
                <View style={styles.pillarHeader}>
                  <Text style={styles.pillarLabel}>
                    {meta.emoji} {meta.label}
                  </Text>
                  <Text style={[styles.pillarValue, { color: strengthColor(p.strength) }]}>
                    {p.strength}/100
                  </Text>
                </View>
                <View style={styles.pillarBarTrack}>
                  <View
                    style={[
                      styles.pillarBarFill,
                      { width: `${p.strength}%`, backgroundColor: strengthColor(p.strength) },
                    ]}
                  />
                </View>
                <Text style={styles.pillarMeta}>
                  {p.count} içerik · {formatNumber(p.reach)} erişim · {formatNumber(p.engagement)} etkileşim · %{p.balance} pay
                </Text>
                <Text style={styles.pillarRec}>💡 {p.recommendation}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>📝 Veri Girişleri</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          {list.map(e => {
            const meta = PM_PILLARS.find(p => p.id === e.pillar);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {meta?.emoji} {meta?.label} × {e.count}
                  </Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  📡 {formatNumber(e.reach)} · 💬 {formatNumber(e.engagement)} · 📅 {formatDate(e.createdAt)}
                </Text>
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
  statNum: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  recommendation: { fontSize: 13, color: '#cbd5e1', marginTop: 10, lineHeight: 18, textAlign: 'center' },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  pillarBlock: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  pillarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillarLabel: { fontSize: 14, fontWeight: '600', color: '#f8fafc' },
  pillarValue: { fontSize: 14, fontWeight: '700' },
  pillarBarTrack: { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  pillarBarFill: { height: 8 },
  pillarMeta: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
  pillarRec: { fontSize: 12, color: '#cbd5e1', marginTop: 4, fontStyle: 'italic' },
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
  entryTitle: { fontSize: 14, fontWeight: '600', color: '#f8fafc' },
  entryMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
