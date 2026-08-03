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
  buildETCDraft,
  calcETCMix,
  clearETCs,
  ETCCadence,
  ETCDraft,
  ETCEntry,
  getETCList,
  ETC_CADENCES,
  ETC_PEAKS,
  ETC_TYPES,
  ETCType,
  removeETC,
  saveETC,
  suggestETCTopics,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

const formatPercent = (n: number): string => `${Math.round(n * 100)}%`;

export default function EvergreenTrendingScreen() {
  const [seed, setSeed] = useState<number>(1);
  const [customTopic, setCustomTopic] = useState<string>('');
  const [draft, setDraft] = useState<ETCDraft | null>(null);
  const [list, setList] = useState<ETCEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState<ETCType | 'all'>('all');

  const load = useCallback(async () => {
    const stored = await getETCList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const topics = useMemo(() => suggestETCTopics(), []);

  const onGenerate = () => {
    const newSeed = Date.now() % 1000;
    setSeed(newSeed);
    setDraft(buildETCDraft(newSeed, customTopic));
  };

  const onSave = async () => {
    if (!draft) return;
    const entry: ETCEntry = {
      id: `etc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: draft.title,
      type: draft.type,
      cadence: draft.cadence,
      shelfLifeDays: draft.shelfLifeDays,
      trafficPeak: draft.trafficPeak,
      topic: draft.topic,
      notes: draft.notes,
      createdAt: Date.now(),
    };
    const next = await saveETC(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeETC(id);
    setList(next);
  };

  const onClear = async () => {
    await clearETCs();
    setList([]);
  };

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return list;
    return list.filter(e => e.type === typeFilter);
  }, [list, typeFilter]);

  const mix = useMemo(() => calcETCMix(list), [list]);

  const avgShelf = useMemo(() => {
    if (list.length === 0) return 0;
    return Math.round(list.reduce((s, e) => s + e.shelfLifeDays, 0) / list.length);
  }, [list]);

  const perWeek = useMemo(() => {
    return list.reduce((s, e) => s + (ETC_CADENCES.find(c => c.id === e.cadence)?.perWeek ?? 0), 0);
  }, [list]);

  const balance = useMemo(() => {
    if (mix.evergreen >= 0.6 && mix.evergreen <= 0.8) return { state: 'ideal', label: 'Dengeli', color: '#10b981' };
    if (mix.evergreen > 0.8) return { state: 'ever-heavy', label: 'Evergreen ağırlıklı', color: '#6366f1' };
    if (mix.evergreen < 0.4) return { state: 'trend-heavy', label: 'Trend ağırlıklı', color: '#f59e0b' };
    return { state: 'mixed', label: 'Karışık', color: '#8b5cf6' };
  }, [mix]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🌲🔥 Evergreen vs Trending</Text>
      <Text style={styles.subtitle}>
        Kalıcı içeriklerini anlık trendlerle dengele; raf ömrünü uzat, erişimi sabit tut.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Konu Önerileri</Text>
        <View style={styles.chipRow}>
          {topics.map(t => (
            <Pressable
              key={t}
              onPress={() => setCustomTopic(t)}
              style={[styles.chip, customTopic === t ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, customTopic === t ? styles.chipTextActive : null]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={customTopic}
          onChangeText={setCustomTopic}
          placeholder="Veya kendi konunu yaz…"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <Pressable onPress={onGenerate} style={styles.generateBtn}>
          <Text style={styles.generateBtnText}>Taslak Oluştur</Text>
        </Pressable>
      </View>

      {draft ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📝 Taslak</Text>
          <Text style={styles.draftTitle}>{draft.title}</Text>
          <View style={styles.metaRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {ETC_TYPES.find(t => t.id === draft.type)?.emoji} {ETC_TYPES.find(t => t.id === draft.type)?.label}
              </Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                ⏱ {ETC_CADENCES.find(c => c.id === draft.cadence)?.label}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                ⏳ {draft.shelfLifeDays} gün ömür
              </Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {ETC_PEAKS.find(p => p.id === draft.trafficPeak)?.emoji} {ETC_PEAKS.find(p => p.id === draft.trafficPeak)?.label}
              </Text>
            </View>
          </View>
          <Text style={styles.helperText}>{draft.notes}</Text>

          <View style={styles.mixBlock}>
            <Text style={styles.subSection}>İçerik Karması</Text>
            <View style={styles.mixBar}>
              <View
                style={[
                  styles.mixEver,
                  { width: `${draft.ratio.evergreen * 100}%` },
                ]}
              />
              <View
                style={[
                  styles.mixTrend,
                  { width: `${draft.ratio.trending * 100}%` },
                ]}
              />
            </View>
            <View style={styles.mixLabels}>
              <Text style={styles.mixEverText}>🌲 {formatPercent(draft.ratio.evergreen)}</Text>
              <Text style={styles.mixTrendText}>🔥 {formatPercent(draft.ratio.trending)}</Text>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Skor</Text>
            <Text style={styles.scoreValue}>{draft.score}/100</Text>
          </View>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreFill, { width: `${draft.score}%` }]} />
          </View>

          <Pressable onPress={onSave} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Takvime Kaydet</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Takvim Özeti</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>Toplam İçerik</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{avgShelf}</Text>
              <Text style={styles.statLabel}>Ort. Ömür (gün)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{perWeek.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Haftalık Adet</Text>
            </View>
          </View>

          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Denge Durumu</Text>
            <View style={[styles.balancePill, { backgroundColor: balance.color }]}>
              <Text style={styles.balancePillText}>{balance.label}</Text>
            </View>
          </View>

          <Text style={styles.subSection}>Küresel Karışım</Text>
          <View style={styles.mixBar}>
            <View
              style={[
                styles.mixEver,
                { width: `${mix.evergreen * 100}%` },
              ]}
            />
            <View
              style={[
                styles.mixTrend,
                { width: `${mix.trending * 100}%` },
              ]}
            />
          </View>
          <View style={styles.mixLabels}>
            <Text style={styles.mixEverText}>🌲 {formatPercent(mix.evergreen)}</Text>
            <Text style={styles.mixTrendText}>🔥 {formatPercent(mix.trending)}</Text>
          </View>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>🗓️ Takvim</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setTypeFilter('all')}
              style={[styles.chip, typeFilter === 'all' ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, typeFilter === 'all' ? styles.chipTextActive : null]}>Hepsi</Text>
            </Pressable>
            {ETC_TYPES.map(t => (
              <Pressable
                key={t.id}
                onPress={() => setTypeFilter(t.id)}
                style={[styles.chip, typeFilter === t.id ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, typeFilter === t.id ? styles.chipTextActive : null]}>
                  {t.emoji} {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {filtered.map(e => {
            const typeMeta = ETC_TYPES.find(t => t.id === e.type);
            const cadenceMeta = ETC_CADENCES.find(c => c.id === e.cadence);
            const peakMeta = ETC_PEAKS.find(p => p.id === e.trafficPeak);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{e.title}</Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  {typeMeta?.emoji} {typeMeta?.label} · {cadenceMeta?.label} · ⏳ {e.shelfLifeDays}g · {peakMeta?.emoji} {peakMeta?.label}
                </Text>
                <Text style={styles.entryNotes}>{e.notes}</Text>
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
  subSection: { fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginTop: 8, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
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
  },
  generateBtn: {
    marginTop: 10,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  draftTitle: { fontSize: 16, fontWeight: '600', color: '#f8fafc', marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  pill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  pillText: { fontSize: 12, color: '#cbd5e1' },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 8, lineHeight: 18 },
  mixBlock: { marginTop: 12, marginBottom: 6 },
  mixBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: '#0f172a' },
  mixEver: { backgroundColor: '#10b981', height: '100%' },
  mixTrend: { backgroundColor: '#f59e0b', height: '100%' },
  mixLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  mixEverText: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  mixTrendText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  scoreLabel: { fontSize: 13, color: '#cbd5e1' },
  scoreValue: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  scoreBar: { height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  scoreFill: { height: 8, backgroundColor: '#6366f1' },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
  statNum: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  balanceBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 6 },
  balanceLabel: { fontSize: 13, color: '#cbd5e1' },
  balancePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  balancePillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 6 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
