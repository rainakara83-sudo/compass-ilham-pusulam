import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  buildCTASuggestions,
  clearCTABs,
  CTABankEntry,
  CTABankGoal,
  CTABankPlatform,
  CTABankSuggestion,
  CTABankTone,
  CTAB_GOALS,
  CTAB_PLATFORMS,
  CTAB_TONES,
  getCTABList,
  removeCTAB,
  saveCTAB,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

export default function CtaBankScreen() {
  const [platform, setPlatform] = useState<CTABankPlatform>('instagram');
  const [goal, setGoal] = useState<CTABankGoal>('save');
  const [tone, setTone] = useState<CTABankTone>('neutral');
  const [suggestions, setSuggestions] = useState<CTABankSuggestion[]>([]);
  const [list, setList] = useState<CTABankEntry[]>([]);
  const [goalFilter, setGoalFilter] = useState<CTABankGoal | 'all'>('all');

  const load = useCallback(async () => {
    const stored = await getCTABList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onGenerate = () => {
    setSuggestions(buildCTASuggestions(platform, goal, tone));
  };

  const onSaveSuggestion = async (s: CTABankSuggestion) => {
    const entry: CTABankEntry = {
      id: `ctab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platform,
      goal: s.goal,
      tone: s.tone,
      text: s.text,
      emoji: s.emoji,
      ctr: s.estCtr,
      createdAt: Date.now(),
    };
    const next = await saveCTAB(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeCTAB(id);
    setList(next);
  };

  const onClear = async () => {
    await clearCTABs();
    setList([]);
  };

  const filtered = useMemo(() => {
    if (goalFilter === 'all') return list;
    return list.filter(e => e.goal === goalFilter);
  }, [list, goalFilter]);

  const goalBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of list) map[e.goal] = (map[e.goal] ?? 0) + 1;
    return map;
  }, [list]);

  const avgCtr = useMemo(() => {
    if (list.length === 0) return 0;
    return +(list.reduce((s, e) => s + e.ctr, 0) / list.length).toFixed(2);
  }, [list]);

  const topGoal = useMemo(() => {
    let bestId: string | null = null;
    let bestCount = -1;
    for (const [k, v] of Object.entries(goalBreakdown)) {
      if (v > bestCount) { bestCount = v; bestId = k; }
    }
    return bestId;
  }, [goalBreakdown]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📣 CTA Phrasing Bank</Text>
      <Text style={styles.subtitle}>
        Her platform, hedef ve ton için optimize edilmiş eylem çağrıları üret.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Platform</Text>
        <View style={styles.chipRow}>
          {CTAB_PLATFORMS.map(p => (
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
        <Text style={styles.sectionTitle}>2) Hedef</Text>
        <View style={styles.chipRow}>
          {CTAB_GOALS.map(g => (
            <Pressable
              key={g.id}
              onPress={() => setGoal(g.id)}
              style={[styles.chip, goal === g.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, goal === g.id ? styles.chipTextActive : null]}>
                {g.emoji} {g.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>
          {CTAB_GOALS.find(g => g.id === goal)?.desc}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3) Ton</Text>
        <View style={styles.chipRow}>
          {CTAB_TONES.map(t => (
            <Pressable
              key={t.id}
              onPress={() => setTone(t.id)}
              style={[styles.chip, tone === t.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, tone === t.id ? styles.chipTextActive : null]}>
                {t.emoji} {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={onGenerate} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>CTA Üret</Text>
      </Pressable>

      {suggestions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💡 Öneriler</Text>
          {suggestions.map((s, idx) => (
            <View key={idx} style={styles.suggestionCard}>
              <Text style={styles.suggestionText}>{s.emoji} {s.text}</Text>
              <Text style={styles.suggestionReason}>{s.reason}</Text>
              <View style={styles.suggestionMeta}>
                <View style={styles.ctrPill}>
                  <Text style={styles.ctrPillText}>CTR ~{s.estCtr}%</Text>
                </View>
                <Pressable onPress={() => onSaveSuggestion(s)} style={styles.saveMiniBtn}>
                  <Text style={styles.saveMiniBtnText}>Kaydet</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Özet</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>Kayıtlı CTA</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{avgCtr}%</Text>
              <Text style={styles.statLabel}>Ort. CTR</Text>
            </View>
            {topGoal ? (
              <View style={styles.statBox}>
                <Text style={styles.statNum}>
                  {CTAB_GOALS.find(g => g.id === topGoal)?.emoji}
                </Text>
                <Text style={styles.statLabel}>En sık hedef</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.subSection}>Hedef Dağılımı</Text>
          {CTAB_GOALS.map(g => {
            const count = goalBreakdown[g.id] ?? 0;
            if (count === 0) return null;
            return (
              <View key={g.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{g.emoji} {g.label}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(100, (count / list.length) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownVal}>{count}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>💾 Kayıtlı CTA'lar</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setGoalFilter('all')}
              style={[styles.chip, goalFilter === 'all' ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, goalFilter === 'all' ? styles.chipTextActive : null]}>Hepsi</Text>
            </Pressable>
            {CTAB_GOALS.map(g => (
              <Pressable
                key={g.id}
                onPress={() => setGoalFilter(g.id)}
                style={[styles.chip, goalFilter === g.id ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, goalFilter === g.id ? styles.chipTextActive : null]}>
                  {g.emoji}
                </Text>
              </Pressable>
            ))}
          </View>
          {filtered.map(e => {
            const platformMeta = CTAB_PLATFORMS.find(p => p.id === e.platform);
            const goalMeta = CTAB_GOALS.find(g => g.id === e.goal);
            const toneMeta = CTAB_TONES.find(t => t.id === e.tone);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryText}>{e.emoji} {e.text}</Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  {platformMeta?.emoji} {platformMeta?.label} · {goalMeta?.emoji} {goalMeta?.label} · {toneMeta?.emoji} {toneMeta?.label} · CTR {e.ctr}%
                </Text>
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
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  suggestionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  suggestionText: { fontSize: 14, color: '#f8fafc', lineHeight: 20 },
  suggestionReason: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 16 },
  suggestionMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  ctrPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#10b98122',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  ctrPillText: { color: '#10b981', fontSize: 11, fontWeight: '600' },
  saveMiniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  saveMiniBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 6 },
  breakdownLabel: { fontSize: 12, color: '#cbd5e1', width: 100 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#6366f1' },
  breakdownVal: { fontSize: 12, color: '#f1f5f9', fontWeight: '600', width: 30, textAlign: 'right' },
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
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  entryText: { fontSize: 14, color: '#f8fafc', flex: 1, marginRight: 8, lineHeight: 20 },
  entryMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
