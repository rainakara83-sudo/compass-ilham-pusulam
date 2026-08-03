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
  clearTSs,
  getTSList,
  removeTS,
  saveTS,
  scoreTitle,
  TSEntry,
  TSGoal,
  TS_GOALS,
  TS_PLATFORMS,
  TSPlatform,
  TSResult,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

const ratingColor = (r: TSResult['rating']): string => {
  if (r === 'mükemmel') return '#10b981';
  if (r === 'güçlü') return '#6366f1';
  if (r === 'iyi') return '#8b5cf6';
  if (r === 'orta') return '#f59e0b';
  return '#ef4444';
};

export default function TitleScorerScreen() {
  const [title, setTitle] = useState<string>('7 Gizli Yöntemle Sabah 5\'te Uyanmak: Üretkenlik Rehberi');
  const [platform, setPlatform] = useState<TSPlatform>('youtube');
  const [goal, setGoal] = useState<TSGoal>('ctr');
  const [result, setResult] = useState<TSResult | null>(null);
  const [list, setList] = useState<TSEntry[]>([]);

  const load = useCallback(async () => {
    const stored = await getTSList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onScore = () => {
    if (title.trim().length === 0) return;
    setResult(scoreTitle(title, platform, goal));
  };

  const onSave = async () => {
    if (!result) return;
    const entry: TSEntry = {
      id: `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      platform,
      goal,
      result,
      createdAt: Date.now(),
    };
    const next = await saveTS(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeTS(id);
    setList(next);
  };

  const onClear = async () => {
    await clearTSs();
    setList([]);
  };

  const avgScore = useMemo(() => {
    if (list.length === 0) return 0;
    return Math.round(list.reduce((s, e) => s + e.result.score, 0) / list.length);
  }, [list]);

  const topTitle = useMemo(() => {
    if (list.length === 0) return null;
    return list.reduce<TSEntry | null>((top, e) => (!top || e.result.score > top.result.score ? e : top), null);
  }, [list]);

  const pMeta = TS_PLATFORMS.find(p => p.id === platform);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>💯 Title Strength Scorer</Text>
      <Text style={styles.subtitle}>
        Başlığını platform ve hedefe göre puanla, hızlı iyileştirmeler al.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Başlık</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Başlığını yaz…"
          placeholderTextColor="#64748b"
          style={styles.input}
          multiline
        />
        <Text style={styles.helperText}>
          {title.length} karakter · {title.trim().split(/\s+/).filter(w => w.length > 0).length} kelime
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Platform</Text>
        <View style={styles.chipRow}>
          {TS_PLATFORMS.map(p => (
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
        <Text style={styles.helperText}>
          Hedef: {pMeta?.ideal}-{pMeta?.max} karakter
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Hedef</Text>
        <View style={styles.chipRow}>
          {TS_GOALS.map(g => (
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
          {TS_GOALS.find(g => g.id === goal)?.desc}
        </Text>
      </View>

      <Pressable onPress={onScore} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>Puanla</Text>
      </Pressable>

      {result ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Puan</Text>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNum, { color: ratingColor(result.rating) }]}>
              {result.score}
            </Text>
            <Text style={styles.scoreLabel}>/100</Text>
          </View>
          <View style={[styles.ratingPill, { backgroundColor: ratingColor(result.rating) }]}>
            <Text style={styles.ratingPillText}>{result.rating.toUpperCase()}</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statMini}>
              <Text style={styles.statMiniLabel}>Kelime</Text>
              <Text style={styles.statMiniVal}>{result.wordCount}</Text>
            </View>
            <View style={styles.statMini}>
              <Text style={styles.statMiniLabel}>Karakter</Text>
              <Text style={styles.statMiniVal}>{result.charCount}</Text>
            </View>
            <View style={styles.statMini}>
              <Text style={styles.statMiniLabel}>Sayı</Text>
              <Text style={styles.statMiniVal}>{result.hasNumber ? '✓' : '—'}</Text>
            </View>
            <View style={styles.statMini}>
              <Text style={styles.statMiniLabel}>Soru</Text>
              <Text style={styles.statMiniVal}>{result.hasQuestion ? '✓' : '—'}</Text>
            </View>
          </View>

          <Text style={styles.subSection}>Kontroller</Text>
          {result.checks.map(c => (
            <View key={c.id} style={styles.checkRow}>
              <Text style={styles.checkIcon}>{c.pass ? '✅' : '⚠️'}</Text>
              <View style={styles.checkContent}>
                <Text style={styles.checkRule}>{c.rule}</Text>
                <Text style={styles.checkNote}>{c.note}</Text>
              </View>
              <Text style={styles.checkWeight}>{c.weight}p</Text>
            </View>
          ))}

          {result.suggestions.length > 0 ? (
            <>
              <Text style={styles.subSection}>💡 Öneriler</Text>
              {result.suggestions.map((s, i) => (
                <Text key={i} style={styles.suggestionText}>• {s}</Text>
              ))}
            </>
          ) : null}

          <Pressable onPress={onSave} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Sonucu Kaydet</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📈 Genel</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>Başlık</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{avgScore}</Text>
              <Text style={styles.statLabel}>Ort. Puan</Text>
            </View>
            {topTitle ? (
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: ratingColor(topTitle.result.rating) }]}>
                  {topTitle.result.score}
                </Text>
                <Text style={styles.statLabel}>En İyi</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.subSection}>Kayıtlar</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          {list.slice(0, 8).map(e => {
            const pMeta = TS_PLATFORMS.find(p => p.id === e.platform);
            const gMeta = TS_GOALS.find(g => g.id === e.goal);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle} numberOfLines={2}>{e.title}</Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <View style={styles.entryMetaRow}>
                  <Text style={styles.entryMeta}>
                    {pMeta?.emoji} {pMeta?.label} · {gMeta?.emoji} {gMeta?.label}
                  </Text>
                  <Text style={[styles.entryScore, { color: ratingColor(e.result.rating) }]}>
                    {e.result.score}/100
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
    minHeight: 44,
  },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
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
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  scoreBox: { alignItems: 'center', marginTop: 4 },
  scoreNum: { fontSize: 56, fontWeight: '800' },
  scoreLabel: { fontSize: 14, color: '#94a3b8', marginTop: -4 },
  ratingPill: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  ratingPillText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  statMini: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  statMiniLabel: { fontSize: 10, color: '#94a3b8' },
  statMiniVal: { fontSize: 16, color: '#f8fafc', fontWeight: '700', marginTop: 2 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#475569',
    gap: 8,
  },
  checkIcon: { fontSize: 14 },
  checkContent: { flex: 1 },
  checkRule: { fontSize: 12, color: '#f1f5f9', fontWeight: '600' },
  checkNote: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  checkWeight: { fontSize: 11, color: '#cbd5e1', fontWeight: '600' },
  suggestionText: { fontSize: 12, color: '#cbd5e1', marginBottom: 4, lineHeight: 18 },
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
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  entryTitle: { fontSize: 13, fontWeight: '600', color: '#f8fafc', flex: 1, marginRight: 8 },
  entryMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  entryMeta: { fontSize: 11, color: '#94a3b8', flex: 1 },
  entryScore: { fontSize: 14, fontWeight: '700' },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
