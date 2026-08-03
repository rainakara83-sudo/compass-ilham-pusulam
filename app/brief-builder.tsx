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
  buildContentBrief,
  CBBEntry,
  CBBGoal,
  CBB_GOALS,
  CBB_PLATFORMS,
  CBBPlatform,
  CBBBrief,
  clearCBBs,
  getCBBList,
  removeCBB,
  saveCBB,
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

const diffColor = (d: CBBBrief['difficulty']): string => {
  if (d === 'kolay') return '#10b981';
  if (d === 'orta') return '#f59e0b';
  return '#ef4444';
};

export default function BriefBuilderScreen() {
  const [topic, setTopic] = useState<string>('Sabah 5 ritüeli');
  const [platform, setPlatform] = useState<CBBPlatform>('instagram');
  const [goal, setGoal] = useState<CBBGoal>('engagement');
  const [audience, setAudience] = useState<string>('üretkenlik meraklıları');
  const [pillar, setPillar] = useState<string>('lifestyle');
  const [brief, setBrief] = useState<CBBBrief | null>(null);
  const [list, setList] = useState<CBBEntry[]>([]);
  const [goalFilter, setGoalFilter] = useState<CBBGoal | 'all'>('all');

  const load = useCallback(async () => {
    setList(await getCBBList());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onBuild = () => {
    if (topic.trim().length === 0) return;
    setBrief(buildContentBrief(topic.trim(), platform, goal, audience.trim() || 'genel kitle', pillar.trim() || 'genel'));
  };

  const onSave = async () => {
    if (!brief) return;
    const entry: CBBEntry = {
      id: `cbb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      topic: brief.topic,
      platform,
      goal,
      audience: audience.trim() || 'genel kitle',
      pillar: pillar.trim() || 'genel',
      hook: brief.hook,
      outline: brief.outline,
      keyPoints: brief.keyPoints,
      cta: brief.cta,
      keywords: brief.keywords,
      visuals: brief.visuals,
      createdAt: Date.now(),
    };
    const next = await saveCBB(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeCBB(id);
    setList(next);
  };

  const onClear = async () => {
    await clearCBBs();
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📋 Content Brief Builder</Text>
      <Text style={styles.subtitle}>
        Tek bir brief ile tüm prodüksiyon sürecini planla: hook, outline, görsel, CTA.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Konu</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="İçeriğin ana konusu"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Platform</Text>
        <View style={styles.chipRow}>
          {CBB_PLATFORMS.map(p => (
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
        <Text style={styles.sectionTitle}>Hedef</Text>
        <View style={styles.chipRow}>
          {CBB_GOALS.map(g => (
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
        <Text style={styles.helperText}>{CBB_GOALS.find(g => g.id === goal)?.desc}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Kitle & Sütun</Text>
        <Text style={styles.label}>Hedef Kitle</Text>
        <TextInput value={audience} onChangeText={setAudience} placeholderTextColor="#64748b" style={styles.input} />
        <Text style={styles.label}>Sütun</Text>
        <TextInput value={pillar} onChangeText={setPillar} placeholderTextColor="#64748b" style={styles.input} />
      </View>

      <Pressable onPress={onBuild} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>Brief Oluştur</Text>
      </Pressable>

      {brief ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📋 Brief</Text>
          <View style={styles.topicBox}>
            <Text style={styles.topicTitle}>{brief.topic}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.diffBadge, { backgroundColor: diffColor(brief.difficulty) + '33', borderColor: diffColor(brief.difficulty) }]}>
                <Text style={[styles.diffBadgeText, { color: diffColor(brief.difficulty) }]}>
                  {brief.difficulty.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.estReach}>📡 ~{formatNumber(brief.estReach)}</Text>
            </View>
            <Text style={styles.lengthText}>⏱ {brief.estimatedLength}</Text>
          </View>

          <View style={styles.hookBox}>
            <Text style={styles.hookLabel}>🎣 HOOK</Text>
            <Text style={styles.hookText}>{brief.hook}</Text>
          </View>

          <Text style={styles.subSection}>📑 Outline</Text>
          {brief.outline.map((step, idx) => (
            <View key={idx} style={styles.outlineRow}>
              <View style={styles.outlineNum}>
                <Text style={styles.outlineNumText}>{idx + 1}</Text>
              </View>
              <Text style={styles.outlineText}>{step}</Text>
            </View>
          ))}

          <Text style={styles.subSection}>🔑 Anahtar Noktalar</Text>
          {brief.keyPoints.map((kp, idx) => (
            <Text key={idx} style={styles.bulletText}>• {kp}</Text>
          ))}

          <Text style={styles.subSection}>🎨 Görsel Planı</Text>
          {brief.visuals.map((v, idx) => (
            <Text key={idx} style={styles.bulletText}>• {v}</Text>
          ))}

          <Text style={styles.subSection}>📢 CTA</Text>
          <Text style={styles.ctaText}>{brief.cta}</Text>

          <Text style={styles.subSection}>🏷️ Anahtar Kelimeler</Text>
          <View style={styles.tagWrap}>
            {brief.keywords.map(k => (
              <View key={k} style={styles.tag}>
                <Text style={styles.tagText}>#{k}</Text>
              </View>
            ))}
          </View>

          <Pressable onPress={onSave} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Briefi Kaydet</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Özet</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>Brief</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{Object.keys(goalBreakdown).length}</Text>
              <Text style={styles.statLabel}>Farklı Hedef</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{new Set(list.map(e => e.platform)).size}</Text>
              <Text style={styles.statLabel}>Platform</Text>
            </View>
          </View>
          <Text style={styles.subSection}>Hedef Dağılımı</Text>
          {CBB_GOALS.map(g => {
            const count = goalBreakdown[g.id] ?? 0;
            if (count === 0) return null;
            return (
              <View key={g.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{g.emoji} {g.label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(count / list.length) * 100}%` }]} />
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
            <Text style={styles.sectionTitle}>💾 Kayıtlı Briefler</Text>
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
            {CBB_GOALS.map(g => (
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
            const pMeta = CBB_PLATFORMS.find(x => x.id === e.platform);
            const gMeta = CBB_GOALS.find(x => x.id === e.goal);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{e.topic}</Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  {pMeta?.emoji} {pMeta?.label} · {gMeta?.emoji} {gMeta?.label}
                </Text>
                <Text style={styles.entryHook}>🎣 {e.hook}</Text>
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
    marginBottom: 6,
  },
  label: { fontSize: 13, color: '#cbd5e1', marginTop: 6 },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  topicBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#475569',
  },
  topicTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  diffBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  estReach: { fontSize: 12, color: '#cbd5e1', fontWeight: '600' },
  lengthText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  hookBox: {
    backgroundColor: '#6366f122',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  hookLabel: { fontSize: 11, color: '#c7d2fe', fontWeight: '700', letterSpacing: 1 },
  hookText: { fontSize: 14, color: '#f8fafc', marginTop: 4, fontWeight: '500', lineHeight: 20 },
  outlineRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 8 },
  outlineNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  outlineText: { flex: 1, fontSize: 13, color: '#cbd5e1' },
  bulletText: { fontSize: 13, color: '#cbd5e1', marginBottom: 4, lineHeight: 18 },
  ctaText: {
    fontSize: 14,
    color: '#f8fafc',
    backgroundColor: '#10b98122',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  tagText: { color: '#cbd5e1', fontSize: 12 },
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
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryTitle: { fontSize: 14, fontWeight: '600', color: '#f8fafc', flex: 1, marginRight: 8 },
  entryMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  entryHook: { fontSize: 12, color: '#cbd5e1', marginTop: 4, fontStyle: 'italic' },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
