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
  calcQualityRadar,
  clearCQRs,
  CQDimension,
  CQEntry,
  CQR_DIMENSIONS,
  CQRadar,
  getCQRList,
  removeCQR,
  saveCQR,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

const ratingColor = (r: CQRadar['rating']): string => {
  if (r === 'mükemmel') return '#10b981';
  if (r === 'güçlü') return '#6366f1';
  if (r === 'iyi') return '#8b5cf6';
  if (r === 'orta') return '#f59e0b';
  return '#ef4444';
};

const SCORE_PRESETS = [20, 40, 60, 80, 100];

export default function QualityRadarScreen() {
  const [title, setTitle] = useState<string>('Sabah 5 ritüelim');
  const [scores, setScores] = useState<Record<CQDimension, number>>({
    clarity: 75,
    value: 80,
    originality: 65,
    engagement: 70,
    structure: 60,
    visuals: 55,
  });
  const [notes, setNotes] = useState<string>('');
  const [radar, setRadar] = useState<CQRadar | null>(null);
  const [entries, setEntries] = useState<CQEntry[]>([]);

  const load = useCallback(async () => {
    setEntries(await getCQRList());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAnalyze = () => {
    if (title.trim().length === 0) return;
    const entry: CQEntry = {
      id: `cqr-${Date.now()}`,
      title: title.trim(),
      scores,
      notes: notes.trim(),
      createdAt: Date.now(),
    };
    setRadar(calcQualityRadar(entry));
  };

  const onSave = async () => {
    if (!radar || title.trim().length === 0) return;
    const entry: CQEntry = {
      id: `cqr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      scores,
      notes: notes.trim(),
      createdAt: Date.now(),
    };
    const next = await saveCQR(entry);
    setEntries(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeCQR(id);
    setEntries(next);
  };

  const onClear = async () => {
    await clearCQRs();
    setEntries([]);
  };

  const avgScore = useMemo(() => {
    if (entries.length === 0) return 0;
    return Math.round(entries.reduce((s, e) => s + calcQualityRadar(e).average, 0) / entries.length);
  }, [entries]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🎯 Content Quality Radar</Text>
      <Text style={styles.subtitle}>
        6 temel boyutta içerik kaliteni ölç, en zayıf noktayı gör.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>İçerik Başlığı</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Başlık" placeholderTextColor="#64748b" style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Boyut Puanları (0-100)</Text>
        {CQR_DIMENSIONS.map(d => (
          <View key={d.id} style={styles.dimBlock}>
            <View style={styles.dimHeader}>
              <Text style={styles.dimLabel}>{d.emoji} {d.label}</Text>
              <Text style={styles.dimValue}>{scores[d.id]}</Text>
            </View>
            <Text style={styles.dimDesc}>{d.desc}</Text>
            <View style={styles.scorePresets}>
              {SCORE_PRESETS.map(p => (
                <Pressable
                  key={p}
                  onPress={() => setScores(prev => ({ ...prev, [d.id]: p }))}
                  style={[styles.presetBtn, scores[d.id] === p ? styles.presetBtnActive : null]}
                >
                  <Text style={[styles.presetText, scores[d.id] === p ? styles.presetTextActive : null]}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${scores[d.id]}%` }]} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notlar (opsiyonel)</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Ek notlar..." placeholderTextColor="#64748b" style={[styles.input, { minHeight: 60 }]} multiline />
      </View>

      <Pressable onPress={onAnalyze} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>Radar Oluştur</Text>
      </Pressable>

      {radar ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Radar Sonucu</Text>
          <View style={styles.radarHeader}>
            <Text style={[styles.radarAvg, { color: ratingColor(radar.rating) }]}>{radar.average}</Text>
            <Text style={styles.radarAvgLabel}>/100</Text>
          </View>
          <View style={[styles.ratingPill, { backgroundColor: ratingColor(radar.rating) }]}>
            <Text style={styles.ratingPillText}>{radar.rating.toUpperCase()}</Text>
          </View>

          <Text style={styles.subSection}>📈 Boyut Grafiği</Text>
          {radar.dimensions.map(d => (
            <View key={d.id} style={styles.barRow}>
              <Text style={styles.barLabel}>{d.emoji} {d.label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${d.value}%`, backgroundColor: d.value >= 75 ? '#10b981' : d.value >= 50 ? '#6366f1' : d.value >= 25 ? '#f59e0b' : '#ef4444' },
                  ]}
                />
              </View>
              <Text style={styles.barVal}>{d.value}</Text>
            </View>
          ))}

          <Text style={styles.subSection}>💡 Öneri</Text>
          <Text style={styles.recommendation}>{radar.recommendation}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statMini}>
              <Text style={styles.statMiniLabel}>En Güçlü</Text>
              <Text style={[styles.statMiniVal, { color: '#10b981' }]}>
                {CQR_DIMENSIONS.find(x => x.id === radar.strongest)?.emoji}
              </Text>
              <Text style={styles.statMiniSub}>{CQR_DIMENSIONS.find(x => x.id === radar.strongest)?.label}</Text>
            </View>
            <View style={styles.statMini}>
              <Text style={styles.statMiniLabel}>En Zayıf</Text>
              <Text style={[styles.statMiniVal, { color: '#ef4444' }]}>
                {CQR_DIMENSIONS.find(x => x.id === radar.weakest)?.emoji}
              </Text>
              <Text style={styles.statMiniSub}>{CQR_DIMENSIONS.find(x => x.id === radar.weakest)?.label}</Text>
            </View>
          </View>

          <Pressable onPress={onSave} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Kaydet</Text>
          </Pressable>
        </View>
      ) : null}

      {entries.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>📈 Geçmiş Analizler</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{entries.length}</Text>
              <Text style={styles.statLabel}>Analiz</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{avgScore}</Text>
              <Text style={styles.statLabel}>Ort. Skor</Text>
            </View>
          </View>
          {entries.slice(0, 6).map(e => {
            const r = calcQualityRadar(e);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{e.title}</Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <View style={styles.entryMetaRow}>
                  <Text style={styles.entryMeta}>
                    En güçlü: {CQR_DIMENSIONS.find(x => x.id === r.strongest)?.emoji}
                  </Text>
                  <Text style={[styles.entryScore, { color: ratingColor(r.rating) }]}>
                    {r.average}/100
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
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  dimBlock: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  dimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dimLabel: { fontSize: 14, color: '#f8fafc', fontWeight: '600' },
  dimValue: { fontSize: 18, color: '#6366f1', fontWeight: '700' },
  dimDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  scorePresets: { flexDirection: 'row', gap: 4, marginTop: 8 },
  presetBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  presetBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  presetText: { fontSize: 12, color: '#94a3b8' },
  presetTextActive: { color: '#fff', fontWeight: '700' },
  sliderTrack: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  sliderFill: { height: 6, backgroundColor: '#6366f1' },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  radarHeader: { alignItems: 'center', marginVertical: 4 },
  radarAvg: { fontSize: 56, fontWeight: '800' },
  radarAvgLabel: { fontSize: 14, color: '#94a3b8' },
  ratingPill: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  ratingPillText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3, gap: 6 },
  barLabel: { fontSize: 12, color: '#cbd5e1', width: 80 },
  barTrack: { flex: 1, height: 10, backgroundColor: '#0f172a', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10 },
  barVal: { fontSize: 12, color: '#f1f5f9', fontWeight: '700', width: 32, textAlign: 'right' },
  recommendation: { fontSize: 13, color: '#cbd5e1', marginTop: 8, lineHeight: 18, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statMini: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statMiniLabel: { fontSize: 11, color: '#94a3b8' },
  statMiniVal: { fontSize: 24, marginTop: 2 },
  statMiniSub: { fontSize: 11, color: '#cbd5e1', fontWeight: '600', marginTop: 2 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 10 },
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
  entryMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  entryMeta: { fontSize: 12, color: '#94a3b8' },
  entryScore: { fontSize: 14, fontWeight: '700' },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
