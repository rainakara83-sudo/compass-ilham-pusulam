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
  calcPulse,
  clearNTPs,
  getNicheTopics,
  getNTPList,
  NTP_AUDIENCES,
  NTP_NICHES,
  NTP_STAGES,
  NTPPlatform,
  NTPStage,
  NTPPulse,
  NTPSignal,
  removeNTP,
  saveNTP,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

const formatDays = (ms: number): string => {
  const days = Math.round((ms - Date.now()) / (1000 * 60 * 60 * 24));
  return `${days} gün`;
};

const PLATFORMS: { id: NTPPlatform; label: string; emoji: string }[] = [
  { id: 'general', label: 'Genel', emoji: '✨' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦' },
];

export default function NichePulseScreen() {
  const [niche, setNiche] = useState<string>('tech');
  const [topic, setTopic] = useState<string>('AI araçları');
  const [stage, setStage] = useState<NTPStage>('rising');
  const [platform, setPlatform] = useState<NTPPlatform>('tiktok');
  const [audience, setAudience] = useState<NTPSignal['audience']>('gen-z');
  const [velocity, setVelocity] = useState<string>('10');
  const [lifespan, setLifespan] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [pulse, setPulse] = useState<NTPPulse | null>(null);
  const [list, setList] = useState<NTPSignal[]>([]);
  const [stageFilter, setStageFilter] = useState<NTPStage | 'all'>('all');

  const load = useCallback(async () => {
    const stored = await getNTPList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const topics = useMemo(() => getNicheTopics(niche), [niche]);

  const buildSignal = (): NTPSignal | null => {
    if (topic.trim().length === 0) return null;
    return {
      id: `ntp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      topic: topic.trim(),
      niche,
      platform,
      stage,
      velocity: parseInt(velocity, 10) || 0,
      lifespanDays: parseInt(lifespan, 10) || 0,
      audience,
      notes: notes.trim(),
      createdAt: Date.now(),
    };
  };

  const onAnalyze = () => {
    const s = buildSignal();
    if (!s) return;
    setPulse(calcPulse(s));
  };

  const onSave = async () => {
    const s = buildSignal();
    if (!s) return;
    const next = await saveNTP(s);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeNTP(id);
    setList(next);
  };

  const onClear = async () => {
    await clearNTPs();
    setList([]);
  };

  const filtered = useMemo(() => {
    if (stageFilter === 'all') return list;
    return list.filter(e => e.stage === stageFilter);
  }, [list, stageFilter]);

  const stageBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of list) map[e.stage] = (map[e.stage] ?? 0) + 1;
    return map;
  }, [list]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>💓 Niche Trend Pulse</Text>
      <Text style={styles.subtitle}>
        Nişindeki konuların trend aşamasını, hızını ve fırsat penceresini gör.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Niş</Text>
        <View style={styles.chipRow}>
          {NTP_NICHES.map(n => (
            <Pressable
              key={n.id}
              onPress={() => {
                setNiche(n.id);
                const t = getNicheTopics(n.id);
                if (t.length > 0) setTopic(t[0]);
              }}
              style={[styles.chip, niche === n.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, niche === n.id ? styles.chipTextActive : null]}>
                {n.emoji} {n.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2) Konu Önerileri</Text>
        <View style={styles.chipRow}>
          {topics.map(t => (
            <Pressable
              key={t}
              onPress={() => setTopic(t)}
              style={[styles.chip, topic === t ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, topic === t ? styles.chipTextActive : null]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={topic} onChangeText={setTopic} placeholder="Konu" placeholderTextColor="#64748b" style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3) Aşama</Text>
        <View style={styles.chipRow}>
          {NTP_STAGES.map(s => (
            <Pressable
              key={s.id}
              onPress={() => setStage(s.id)}
              style={[styles.chip, stage === s.id ? { backgroundColor: s.color, borderColor: s.color } : null]}
            >
              <Text style={[styles.chipText, stage === s.id ? styles.chipTextActive : null]}>
                {s.emoji} {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>{NTP_STAGES.find(s => s.id === stage)?.desc}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4) Platform & Kitle</Text>
        <View style={styles.chipRow}>
          {PLATFORMS.map(p => (
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
        <View style={styles.chipRow}>
          {NTP_AUDIENCES.map(a => (
            <Pressable
              key={a.id}
              onPress={() => setAudience(a.id)}
              style={[styles.chip, audience === a.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, audience === a.id ? styles.chipTextActive : null]}>
                {a.emoji} {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.dualRow}>
          <View style={styles.dualCol}>
            <Text style={styles.label}>Hız (+/-)</Text>
            <TextInput value={velocity} onChangeText={setVelocity} keyboardType="numeric" style={styles.input} />
          </View>
          <View style={styles.dualCol}>
            <Text style={styles.label}>Ömür (gün)</Text>
            <TextInput value={lifespan} onChangeText={setLifespan} keyboardType="numeric" style={styles.input} />
          </View>
        </View>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Not (opsiyonel)" placeholderTextColor="#64748b" style={styles.input} />
      </View>

      <Pressable onPress={onAnalyze} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>Pulse Hesapla</Text>
      </Pressable>

      {pulse ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Pulse Sonucu</Text>
          <View style={[styles.pulseCard, { borderColor: pulse.stageColor }]}>
            <Text style={styles.pulseTopic}>{pulse.topic}</Text>
            <View style={[styles.stageBadge, { backgroundColor: pulse.stageColor }]}>
              <Text style={styles.stageBadgeText}>{pulse.stageLabel.toUpperCase()}</Text>
            </View>
            <Text style={styles.pulseDetail}>
              ⏱ Pencere: {formatDays(pulse.windowEnd)}
            </Text>
            <Text style={styles.pulseDetail}>
              🚀 Tahmini Yoğunluk: {pulse.estPeak}/100
            </Text>
            <Text style={styles.pulseRec}>{pulse.recommendation}</Text>
          </View>
          <Pressable onPress={onSave} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Kaydet</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📈 Özet</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>Sinyal</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{Object.keys(stageBreakdown).length}</Text>
              <Text style={styles.statLabel}>Aşama</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{new Set(list.map(e => e.niche)).size}</Text>
              <Text style={styles.statLabel}>Niş</Text>
            </View>
          </View>
          <Text style={styles.subSection}>Aşama Dağılımı</Text>
          {NTP_STAGES.map(s => {
            const count = stageBreakdown[s.id] ?? 0;
            if (count === 0) return null;
            return (
              <View key={s.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{s.emoji} {s.label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(count / list.length) * 100}%`, backgroundColor: s.color }]} />
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
            <Text style={styles.sectionTitle}>📋 Sinyaller</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setStageFilter('all')}
              style={[styles.chip, stageFilter === 'all' ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, stageFilter === 'all' ? styles.chipTextActive : null]}>Hepsi</Text>
            </Pressable>
            {NTP_STAGES.map(s => (
              <Pressable
                key={s.id}
                onPress={() => setStageFilter(s.id)}
                style={[styles.chip, stageFilter === s.id ? { backgroundColor: s.color, borderColor: s.color } : null]}
              >
                <Text style={[styles.chipText, stageFilter === s.id ? styles.chipTextActive : null]}>
                  {s.emoji}
                </Text>
              </Pressable>
            ))}
          </View>
          {filtered.map(s => {
            const sMeta = NTP_STAGES.find(x => x.id === s.stage);
            const nMeta = NTP_NICHES.find(x => x.id === s.niche);
            const aMeta = NTP_AUDIENCES.find(x => x.id === s.audience);
            return (
              <View key={s.id} style={[styles.entryCard, { borderLeftWidth: 3, borderLeftColor: sMeta?.color }]}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{s.topic}</Text>
                  <Pressable onPress={() => onRemove(s.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  {nMeta?.emoji} {nMeta?.label} · {sMeta?.emoji} {sMeta?.label} · {aMeta?.emoji} {aMeta?.label}
                </Text>
                {s.notes ? <Text style={styles.entryNotes}>📝 {s.notes}</Text> : null}
                <Text style={styles.entryDate}>📅 {formatDate(s.createdAt)}</Text>
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
  },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  label: { fontSize: 13, color: '#cbd5e1', marginTop: 6 },
  dualRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dualCol: { flex: 1 },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pulseCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
    borderWidth: 2,
  },
  pulseTopic: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 6 },
  stageBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  stageBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  pulseDetail: { fontSize: 13, color: '#cbd5e1', marginTop: 4 },
  pulseRec: { fontSize: 13, color: '#94a3b8', marginTop: 10, lineHeight: 18, fontStyle: 'italic' },
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
  breakdownLabel: { fontSize: 12, color: '#cbd5e1', width: 90 },
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
  entryNotes: { fontSize: 12, color: '#cbd5e1', marginTop: 4, lineHeight: 16 },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
