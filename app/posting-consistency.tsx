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
  calcPostingConsistency,
  clearPCS,
  getPCSList,
  PCSPost,
  PCS_CADENCES,
  PCS_PLATFORMS,
  removePCS,
  savePCS,
  todayPCSKey,
} from '../services/storage';

const weekdayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const scoreColor = (s: number): string => {
  if (s >= 80) return '#10b981';
  if (s >= 60) return '#6366f1';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
};

const scoreLabel = (s: number): string => {
  if (s >= 80) return 'Mükemmel';
  if (s >= 60) return 'İyi';
  if (s >= 40) return 'Geliştirilmeli';
  return 'Kritik';
};

export default function PostingConsistencyScreen() {
  const [cadence, setCadence] = useState<PCSPost['cadence']>('3xweek');
  const [platform, setPlatform] = useState<PCSPost['platform']>('instagram');
  const [dateInput, setDateInput] = useState<string>(todayPCSKey());
  const [list, setList] = useState<PCSPost[]>([]);

  const load = useCallback(async () => {
    const stored = await getPCSList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAddToday = async () => {
    const entry: PCSPost = {
      id: `pcs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: dateInput,
      platform,
      cadence,
      createdAt: Date.now(),
    };
    const next = await savePCS(entry);
    setList(next);
  };

  const onAddYesterday = async () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yesterday = `${y}-${m}-${dd}`;
    const entry: PCSPost = {
      id: `pcs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: yesterday,
      platform,
      cadence,
      createdAt: Date.now(),
    };
    const next = await savePCS(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removePCS(id);
    setList(next);
  };

  const onClear = async () => {
    await clearPCS();
    setList([]);
  };

  const score = useMemo(() => calcPostingConsistency(list, cadence, 30), [list, cadence]);

  const recent = useMemo(() => {
    return [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  }, [list]);

  const maxDist = useMemo(() => {
    return Math.max(1, ...score.weeklyDistribution);
  }, [score]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📈 Posting Consistency Score</Text>
      <Text style={styles.subtitle}>
        Son 30 günde hedef cadencene ne kadar uyduğunu ölç, puanını gör.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Cadence</Text>
        <View style={styles.chipRow}>
          {PCS_CADENCES.map(c => (
            <Pressable
              key={c.id}
              onPress={() => setCadence(c.id)}
              style={[styles.chip, cadence === c.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, cadence === c.id ? styles.chipTextActive : null]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2) Platform</Text>
        <View style={styles.chipRow}>
          {PCS_PLATFORMS.map(p => (
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
        <Text style={styles.sectionTitle}>3) Post Ekle</Text>
        <TextInput
          value={dateInput}
          onChangeText={setDateInput}
          placeholder="YYYY-AA-GG"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <View style={styles.btnRow}>
          <Pressable onPress={onAddToday} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Bu günü ekle</Text>
          </Pressable>
          <Pressable onPress={onAddYesterday} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Dün ekle</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🎯 Tutarlılık Skoru</Text>
        <View style={styles.scoreBigBox}>
          <Text style={[styles.scoreBig, { color: scoreColor(score.score) }]}>
            {score.score}
          </Text>
          <Text style={styles.scoreBigLabel}>/100 · {scoreLabel(score.score)}</Text>
        </View>
        <View style={styles.scoreBar}>
          <View
            style={[
              styles.scoreFill,
              { width: `${score.score}%`, backgroundColor: scoreColor(score.score) },
            ]}
          />
        </View>
        <Text style={styles.recommendation}>{score.recommendation}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📊 30 Günlük Metrikler</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{score.totalPosts}</Text>
            <Text style={styles.statLabel}>Toplam Post</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{score.streakDays}</Text>
            <Text style={styles.statLabel}>Aktif Seri</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{score.longestStreak}</Text>
            <Text style={styles.statLabel}>En Uzun Seri</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{score.missedDays}</Text>
            <Text style={styles.statLabel}>Boş Gün</Text>
          </View>
        </View>

        <Text style={styles.subSection}>Cadence Uyumu</Text>
        <View style={styles.barRow}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, score.cadenceFit)}%` },
              ]}
            />
          </View>
          <Text style={styles.barVal}>{score.cadenceFit}%</Text>
        </View>

        <Text style={styles.subSection}>Haftalık Dağılım</Text>
        <View style={styles.weekRow}>
          {score.weeklyDistribution.map((count, idx) => (
            <View key={idx} style={styles.weekCol}>
              <View style={styles.weekBarTrack}>
                <View
                  style={[
                    styles.weekBarFill,
                    { height: `${(count / maxDist) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.weekCount}>{count}</Text>
              <Text style={styles.weekLabel}>{weekdayLabels[idx]}</Text>
            </View>
          ))}
        </View>
      </View>

      {list.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>📋 Son Girişler</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          {recent.map(p => {
            const pMeta = PCS_PLATFORMS.find(x => x.id === p.platform);
            const cMeta = PCS_CADENCES.find(x => x.id === p.cadence);
            return (
              <View key={p.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {pMeta?.emoji} {pMeta?.label}
                  </Text>
                  <Pressable onPress={() => onRemove(p.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  📅 {p.date} · {cMeta?.label}
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
    marginBottom: 10,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  secondaryBtnText: { color: '#c7d2fe', fontSize: 14, fontWeight: '600' },
  scoreBigBox: { alignItems: 'center', marginVertical: 8 },
  scoreBig: { fontSize: 56, fontWeight: '800' },
  scoreBigLabel: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  scoreBar: { height: 10, backgroundColor: '#0f172a', borderRadius: 5, overflow: 'hidden', marginTop: 6 },
  scoreFill: { height: 10 },
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
  statLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#6366f1' },
  barVal: { fontSize: 12, color: '#f1f5f9', fontWeight: '600', width: 40, textAlign: 'right' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, marginTop: 6 },
  weekCol: { flex: 1, alignItems: 'center' },
  weekBarTrack: {
    width: '70%',
    height: 70,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  weekBarFill: { width: '100%', backgroundColor: '#6366f1' },
  weekCount: { fontSize: 12, color: '#f8fafc', fontWeight: '700', marginTop: 4 },
  weekLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
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
