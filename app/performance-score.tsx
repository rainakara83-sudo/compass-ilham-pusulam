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
  calcPSCScore,
  clearPSCs,
  getPSCList,
  PSC_DIMENSIONS,
  PSCEntry,
  PSCInput,
  PSCResult,
  removePSC,
  savePSC,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

const gradeColor = (g: PSCResult['grade']): string => {
  if (g === 'S') return '#10b981';
  if (g === 'A') return '#22c55e';
  if (g === 'B') return '#f59e0b';
  if (g === 'C') return '#f97316';
  return '#ef4444';
};

const dimColor = (s: number): string => {
  if (s >= 80) return '#10b981';
  if (s >= 60) return '#f59e0b';
  if (s >= 40) return '#f97316';
  return '#ef4444';
};

const initialScores = (): PSCInput => ({
  hook: 70,
  emotion: 70,
  clarity: 70,
  cta: 70,
  hashtag: 70,
  format: 70,
  consistency: 70,
  niche: 70,
});

export default function PerformanceScoreScreen() {
  const [scores, setScores] = useState<PSCInput>(initialScores);
  const [title, setTitle] = useState('');
  const [list, setList] = useState<PSCEntry[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getPSCList();
    setList(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const result = useMemo(() => calcPSCScore(scores), [scores]);

  const onChange = useCallback((id: keyof PSCInput, delta: number) => {
    setScores(prev => ({ ...prev, [id]: Math.max(0, Math.min(100, prev[id] + delta)) }));
  }, []);

  const onReset = useCallback(() => {
    setScores(initialScores());
    setTitle('');
  }, []);

  const onSave = useCallback(async () => {
    const entry: PSCEntry = {
      id: String(Date.now()),
      title: title.trim() || `Skor ${list.length + 1}`,
      overall: result.overall,
      grade: result.grade,
      weakest: result.weakest,
      scores,
      createdAt: Date.now(),
    };
    const next = await savePSC(entry);
    setList(next);
    setSaved('Kaydedildi ✓');
    setTimeout(() => setSaved(null), 1500);
  }, [title, result, scores, list.length]);

  const onRemove = useCallback(async (id: string) => {
    const next = await removePSC(id);
    setList(next);
  }, []);

  const onClear = useCallback(async () => {
    await clearPSCs();
    setList([]);
  }, []);

  const avgOverall = list.length > 0 ? Math.round(list.reduce((s, e) => s + e.overall, 0) / list.length) : 0;
  const gradeCount = list.reduce<Record<string, number>>((acc, e) => {
    acc[e.grade] = (acc[e.grade] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Performance Score Card</Text>
      <Text style={styles.subtitle}>8 kritere göre içerik puanı</Text>

      <View style={styles.heroCard}>
        <Text style={styles.gradeLabel}>Not</Text>
        <View style={[styles.gradeBox, { borderColor: gradeColor(result.grade) }]}>
          <Text style={[styles.gradeText, { color: gradeColor(result.grade) }]}>{result.grade}</Text>
        </View>
        <Text style={styles.overallVal}>{result.overall}</Text>
        <Text style={styles.overallLbl}>/ 100 Genel Skor</Text>
        <Text style={styles.recommendation}>{result.recommendation}</Text>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{result.estReach}</Text>
            <Text style={styles.statLbl}>Tahmini Erişim</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{result.estEngagement}</Text>
            <Text style={styles.statLbl}>Tahmini Etkileşim</Text>
          </View>
        </View>
        <View style={styles.highlightRow}>
          <View style={styles.highlight}>
            <Text style={styles.highlightLbl}>En güçlü</Text>
            <Text style={styles.highlightVal}>{result.strongest}</Text>
          </View>
          <View style={styles.highlight}>
            <Text style={[styles.highlightLbl, { color: '#fca5a5' }]}>En zayıf</Text>
            <Text style={[styles.highlightVal, { color: '#fca5a5' }]}>{result.weakest}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Boyutlar (0-100)</Text>
        {PSC_DIMENSIONS.map(d => (
          <View key={d.id} style={styles.dimRow}>
            <View style={styles.dimHead}>
              <Text style={styles.dimEmoji}>{d.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dimLabel}>{d.label}</Text>
                <Text style={styles.dimHint}>{d.hint}</Text>
              </View>
              <Text style={[styles.dimScore, { color: dimColor(scores[d.id as keyof PSCInput]) }]}>
                {scores[d.id as keyof PSCInput]}
              </Text>
            </View>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${scores[d.id as keyof PSCInput]}%`,
                    backgroundColor: dimColor(scores[d.id as keyof PSCInput]),
                  },
                ]}
              />
            </View>
            <View style={styles.btnRow}>
              <Pressable onPress={() => onChange(d.id as keyof PSCInput, -10)} style={styles.smBtn}>
                <Text style={styles.smBtnText}>-10</Text>
              </Pressable>
              <Pressable onPress={() => onChange(d.id as keyof PSCInput, -5)} style={styles.smBtn}>
                <Text style={styles.smBtnText}>-5</Text>
              </Pressable>
              <Pressable onPress={() => onChange(d.id as keyof PSCInput, +5)} style={styles.smBtn}>
                <Text style={styles.smBtnText}>+5</Text>
              </Pressable>
              <Pressable onPress={() => onChange(d.id as keyof PSCInput, +10)} style={styles.smBtn}>
                <Text style={styles.smBtnText}>+10</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Başlık (opsiyonel)</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="bu kart için"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <Pressable onPress={onSave} style={styles.button}>
        <Text style={styles.buttonText}>{saved ?? 'Skoru Kaydet'}</Text>
      </Pressable>

      <Pressable onPress={onReset} style={[styles.button, styles.buttonGhost]}>
        <Text style={[styles.buttonText, { color: '#94a3b8' }]}>Sıfırla (70)</Text>
      </Pressable>

      {list.length > 0 && (
        <Pressable onPress={onClear} style={[styles.button, styles.buttonGhost, { borderColor: '#ef4444' }]}>
          <Text style={[styles.buttonText, { color: '#fca5a5' }]}>Tümünü Temizle</Text>
        </Pressable>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Geçmiş ({list.length})</Text>
        {list.length === 0 ? (
          <Text style={styles.empty}>Henüz skor yok</Text>
        ) : (
          <View style={styles.summaryRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{avgOverall}</Text>
              <Text style={styles.statLbl}>Ort. Skor</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{gradeCount['S'] ?? 0}</Text>
              <Text style={styles.statLbl}>S notu</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{gradeCount['A'] ?? 0}</Text>
              <Text style={styles.statLbl}>A notu</Text>
            </View>
          </View>
        )}

        {list.map(entry => (
          <View key={entry.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{entry.title}</Text>
              <View style={[styles.gradePill, { borderColor: gradeColor(entry.grade) }]}>
                <Text style={[styles.gradePillText, { color: gradeColor(entry.grade) }]}>{entry.grade}</Text>
              </View>
            </View>
            <View style={styles.cardStatRow}>
              <Text style={styles.cardOverall}>{entry.overall}/100</Text>
              <Text style={styles.cardMeta}>{formatDate(entry.createdAt)}</Text>
            </View>
            <Text style={styles.cardWeak}>En zayıf: {entry.weakest}</Text>
            <Pressable onPress={() => onRemove(entry.id)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>Sil</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  heroCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  gradeLabel: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  gradeBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  gradeText: { fontSize: 40, fontWeight: '800' },
  overallVal: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
  overallLbl: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  recommendation: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: '#6366f1' },
  statLbl: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  highlightRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  highlight: { alignItems: 'center', flex: 1 },
  highlightLbl: { fontSize: 10, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 },
  highlightVal: { fontSize: 13, fontWeight: '700', color: '#f8fafc', marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingVertical: 8 },
  section: { marginBottom: 16 },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  dimRow: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dimHead: { flexDirection: 'row', alignItems: 'center' },
  dimEmoji: { fontSize: 20, marginRight: 10 },
  dimLabel: { fontSize: 14, fontWeight: '700', color: '#f8fafc' },
  dimHint: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  dimScore: { fontSize: 18, fontWeight: '800' },
  bar: { height: 6, backgroundColor: '#334155', borderRadius: 3, marginTop: 8, marginBottom: 8, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  smBtn: {
    flex: 1,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  smBtnText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#f8fafc', flex: 1 },
  gradePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  gradePillText: { fontSize: 12, fontWeight: '800' },
  cardStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardOverall: { fontSize: 16, fontWeight: '800', color: '#6366f1' },
  cardMeta: { fontSize: 11, color: '#94a3b8' },
  cardWeak: { fontSize: 12, color: '#fca5a5', marginBottom: 8 },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignSelf: 'flex-start',
  },
  removeBtnText: { color: '#fca5a5', fontSize: 11, fontWeight: '700' },
});