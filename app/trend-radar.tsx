import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TrendEntry,
  TrendLifecycle,
  TrendPlatform,
  TREND_LIFECYCLE_META,
  TREND_PLATFORMS,
  buildTrendSuggestions,
  clearTrends,
  getTrendList,
  removeTrend,
  saveTrend,
  trendDaysLeft,
  updateTrend,
  addCopyToHistory,
} from '../services/storage';
import niches from '../data/niches.json';

const NICHES: { id: string; icon: string; color: string; label: string }[] = niches.map(n => ({
  id: n.id,
  icon: n.icon,
  color: n.color,
  label: n.id.replace('_', ' '),
}));

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const scoreColor = (s: number): string => {
  if (s >= 80) return '#10B981';
  if (s >= 60) return '#22C55E';
  if (s >= 40) return '#F59E0B';
  return '#F97316';
};

const scoreEmoji = (s: number): string => {
  if (s >= 80) return '🔥';
  if (s >= 60) return '🚀';
  if (s >= 40) return '⚡';
  return '🍂';
};

export default function TrendRadarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<TrendEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [niche, setNiche] = useState<string>('fitness');
  const [platform, setPlatform] = useState<TrendPlatform>('instagram');
  const [count, setCount] = useState('4');
  const [suggestions, setSuggestions] = useState<Omit<TrendEntry, 'id' | 'createdAt'>[]>([]);
  const [generating, setGenerating] = useState(false);
  const [filterLifecycle, setFilterLifecycle] = useState<TrendLifecycle | 'all'>('all');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getTrendList();
    setList(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const generate = useCallback(() => {
    setGenerating(true);
    const n = Math.max(1, Math.min(8, parseInt(count, 10) || 4));
    const out = buildTrendSuggestions({ niche, platform, count: n });
    setSuggestions(out);
    setGenerating(false);
  }, [niche, platform, count]);

  useEffect(() => {
    generate();
  }, [generate]);

  const onSave = useCallback(
    async (s: Omit<TrendEntry, 'id' | 'createdAt'>) => {
      setSaving(true);
      const next = await saveTrend(s);
      setList(next);
      setSaving(false);
      setToast('Trend kaydedildi ✓');
    },
    []
  );

  const onSaveAll = useCallback(async () => {
    if (suggestions.length === 0) return;
    setSaving(true);
    let next = await getTrendList();
    for (const s of suggestions) {
      const full: TrendEntry = {
        ...s,
        id: `trend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
      };
      next = [full, ...next].slice(0, 60);
    }
    await AsyncStorage.setItem('@content-coach/trend-radar', JSON.stringify(next));
    setList(next);
    setSaving(false);
    setToast(`${suggestions.length} trend kaydedildi ✓`);
  }, [suggestions]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu trendi silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeTrend(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  }, [openId]);

  const onClear = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert('Tümünü sil', `${list.length} trend silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearTrends();
          setList([]);
          setToast('Tüm trendler silindi');
        },
      },
    ]);
  }, [list.length]);

  const onCopy = useCallback(async (text: string, label: 'pool' | 'ai' | 'detail') => {
    Clipboard.setString(text);
    await addCopyToHistory(text, label);
    setToast('Kopyalandı ✓');
  }, []);

  const onSaveNotes = useCallback(
    async (id: string) => {
      const note = notesDraft[id];
      if (note === undefined) return;
      const next = await updateTrend(id, { notes: note });
      setList(next);
      setToast('Not güncellendi ✓');
      setNotesDraft(prev => {
        const c = { ...prev };
        delete c[id];
        return c;
      });
    },
    [notesDraft]
  );

  const filteredList = useMemo(() => {
    if (filterLifecycle === 'all') return list;
    return list.filter(t => t.lifecycle === filterLifecycle);
  }, [list, filterLifecycle]);

  const summary = useMemo(() => {
    const acc: Record<TrendLifecycle, number> = { rising: 0, peak: 0, fading: 0, evergreen: 0 };
    list.forEach(t => {
      acc[t.lifecycle] += 1;
    });
    const avgScore = list.length === 0
      ? 0
      : Math.round(list.reduce((sum, t) => sum + t.opportunityScore, 0) / list.length);
    const top = [...list].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 3);
    return { acc, avgScore, top };
  }, [list]);

  const nicheLabel = (id: string) => NICHES.find(n => n.id === id)?.label ?? id;
  const nicheIcon = (id: string) => NICHES.find(n => n.id === id)?.icon ?? '📌';

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Trend Radar',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Niche + platform seç, otomatik öneri al. Fırsat skoru yüksek olanlara öncelik ver.
        </Text>

        {/* NICHE */}
        <Text style={styles.sectionLabel}>Niche</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {NICHES.map(n => {
            const active = niche === n.id;
            return (
              <Pressable
                key={n.id}
                onPress={() => setNiche(n.id)}
                style={[styles.chip, active && { backgroundColor: n.color, borderColor: n.color }]}
              >
                <Text style={styles.chipIcon}>{n.icon}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {n.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* PLATFORM */}
        <Text style={styles.sectionLabel}>Platform</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {TREND_PLATFORMS.map(p => {
            const active = platform === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlatform(p.id)}
                style={[
                  styles.chip,
                  active && { backgroundColor: p.color, borderColor: p.color },
                ]}
              >
                <Text style={styles.chipIcon}>{p.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* COUNT */}
        <Text style={styles.sectionLabel}>Öneri sayısı</Text>
        <View style={styles.countRow}>
          {['3', '4', '6', '8'].map(c => {
            const active = count === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCount(c)}
                style={[styles.countChip, active && styles.countChipActive]}
              >
                <Text style={[styles.countChipText, active && styles.countChipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* SUGGESTIONS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📡 Öneriler</Text>
            <Pressable onPress={onSaveAll} disabled={suggestions.length === 0 || saving} style={styles.saveAllBtn}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={styles.saveAllBtnText}>Tümünü kaydet</Text>}
            </Pressable>
          </View>

          {generating ? (
            <ActivityIndicator color="#6366f1" style={{ marginVertical: 24 }} />
          ) : suggestions.length === 0 ? (
            <Text style={styles.empty}>Öneri bulunamadı.</Text>
          ) : (
            suggestions.map((s, idx) => {
              const meta = TREND_LIFECYCLE_META[s.lifecycle];
              const days = Math.round((s.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
              return (
                <View key={`${s.topic}-${idx}`} style={styles.suggRow}>
                  <View style={styles.suggHeader}>
                    <Text style={styles.suggTopic}>{s.topic}</Text>
                    <View style={[styles.scorePill, { backgroundColor: scoreColor(s.opportunityScore) + '22', borderColor: scoreColor(s.opportunityScore) }]}>
                      <Text style={styles.scoreEmoji}>{scoreEmoji(s.opportunityScore)}</Text>
                      <Text style={[styles.scoreText, { color: scoreColor(s.opportunityScore) }]}>
                        {s.opportunityScore}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.suggHook}>"{s.hook}"</Text>
                  <View style={styles.suggMeta}>
                    <View style={[styles.lifecyclePill, { backgroundColor: meta.color + '22', borderColor: meta.color }]}>
                      <Text style={styles.lifecycleEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.lifecycleText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={styles.daysText}>⏳ {days} gün</Text>
                  </View>
                  <Text style={styles.suggTip}>💡 {meta.tip}</Text>
                  <View style={styles.suggActions}>
                    <Pressable
                      onPress={() => onCopy(`${s.topic} — ${s.hook}`, 'pool')}
                      style={styles.copyBtn}
                    >
                      <Text style={styles.copyBtnText}>📋 Kopyala</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onSave(s)}
                      disabled={saving}
                      style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                    >
                      <Text style={styles.saveBtnText}>💾 Kaydet</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🗂️ Kayıtlı Trendler ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {/* SUMMARY */}
          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama skor</Text>
                <Text style={[styles.summaryValue, { color: scoreColor(summary.avgScore) }]}>
                  {summary.avgScore}
                </Text>
              </View>
              <View style={styles.lifecycleBreakdown}>
                {(Object.keys(summary.acc) as TrendLifecycle[]).map(lc => {
                  const meta = TREND_LIFECYCLE_META[lc];
                  return (
                    <View key={lc} style={[styles.breakdownChip, { borderColor: meta.color }]}>
                      <Text style={styles.breakdownEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.breakdownCount, { color: meta.color }]}>{summary.acc[lc]}</Text>
                    </View>
                  );
                })}
              </View>
              {summary.top.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.summaryLabel}>En yüksek skor</Text>
                  {summary.top.map(t => (
                    <Text key={t.id} style={styles.topItem} numberOfLines={1}>
                      {nicheIcon(t.niche)} {t.topic} — <Text style={{ color: scoreColor(t.opportunityScore) }}>{t.opportunityScore}</Text>
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* FILTER */}
          {list.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <Pressable
                onPress={() => setFilterLifecycle('all')}
                style={[styles.filterChip, filterLifecycle === 'all' && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, filterLifecycle === 'all' && styles.filterChipTextActive]}>
                  Hepsi ({list.length})
                </Text>
              </Pressable>
              {(Object.keys(TREND_LIFECYCLE_META) as TrendLifecycle[]).map(lc => {
                const meta = TREND_LIFECYCLE_META[lc];
                const cnt = summary.acc[lc];
                const active = filterLifecycle === lc;
                return (
                  <Pressable
                    key={lc}
                    onPress={() => setFilterLifecycle(lc)}
                    style={[styles.filterChip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {meta.emoji} {meta.label} ({cnt})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {filteredList.length === 0 ? (
            <Text style={styles.empty}>
              {list.length === 0 ? 'Henüz kayıtlı trend yok. Yukarıdan öneri oluştur.' : 'Bu filtreyle eşleşen trend yok.'}
            </Text>
          ) : (
            filteredList.map(t => {
              const meta = TREND_LIFECYCLE_META[t.lifecycle];
              const open = openId === t.id;
              const days = trendDaysLeft(t);
              const platformMeta = TREND_PLATFORMS.find(p => p.id === t.platform);
              return (
                <View key={t.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : t.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTopic} numberOfLines={1}>
                        {nicheIcon(t.niche)} {t.topic}
                      </Text>
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryMeta}>{platformMeta?.emoji} {platformMeta?.label}</Text>
                        <Text style={[styles.entryMeta, { color: days <= 3 ? '#F97316' : '#94a3b8' }]}>
                          {' · '}⏳ {days}g
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.scorePill, { backgroundColor: scoreColor(t.opportunityScore) + '22', borderColor: scoreColor(t.opportunityScore) }]}>
                      <Text style={styles.scoreEmoji}>{scoreEmoji(t.opportunityScore)}</Text>
                      <Text style={[styles.scoreText, { color: scoreColor(t.opportunityScore) }]}>{t.opportunityScore}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.entryMetaRow}>
                    <View style={[styles.lifecyclePill, { backgroundColor: meta.color + '22', borderColor: meta.color }]}>
                      <Text style={styles.lifecycleEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.lifecycleText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={styles.entryDate}>· {formatDate(t.spottedAt)}</Text>
                  </View>

                  {open && (
                    <View style={styles.entryDetail}>
                      <Text style={styles.entryHook}>"{t.hook}"</Text>
                      <Text style={styles.entryTip}>💡 {meta.tip}</Text>
                      <Text style={styles.entryLabel}>Notlar</Text>
                      <TextInput
                        value={notesDraft[t.id] ?? t.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [t.id]: txt }))}
                        placeholder="Not ekle..."
                        placeholderTextColor="#475569"
                        style={styles.notesInput}
                        multiline
                      />
                      <View style={styles.entryActions}>
                        <Pressable
                          onPress={() => onSaveNotes(t.id)}
                          disabled={notesDraft[t.id] === undefined}
                          style={[styles.smallBtn, notesDraft[t.id] === undefined && { opacity: 0.4 }]}
                        >
                          <Text style={styles.smallBtnText}>💾 Notu kaydet</Text>
                        </Pressable>
                        <Pressable onPress={() => onCopy(`${t.topic} — ${t.hook}`, 'pool')} style={styles.smallBtn}>
                          <Text style={styles.smallBtnText}>📋 Kopyala</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(t.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
                          <Text style={[styles.smallBtnText, { color: '#F97316' }]}>🗑️ Sil</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* BACK */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </Pressable>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16 },
  intro: { color: '#94a3b8', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  sectionLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipRow: { marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipIcon: { fontSize: 16, marginRight: 6 },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  countRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  countChip: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  countChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  countChipText: { color: '#cbd5e1', fontSize: 14, fontWeight: '700' },
  countChipTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  saveAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  saveAllBtnText: { color: '#6366f1', fontSize: 12, fontWeight: '700' },
  empty: { color: '#64748b', fontSize: 13, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  suggRow: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  suggTopic: { color: '#f8fafc', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  suggHook: { color: '#cbd5e1', fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  suggMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 },
  suggTip: { color: '#94a3b8', fontSize: 12, marginBottom: 10, lineHeight: 16 },
  suggActions: { flexDirection: 'row', gap: 8 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 4,
  },
  scoreEmoji: { fontSize: 12 },
  scoreText: { fontSize: 12, fontWeight: '700' },
  lifecyclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 4,
  },
  lifecycleEmoji: { fontSize: 12 },
  lifecycleText: { fontSize: 11, fontWeight: '700' },
  daysText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  copyBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  copyBtnText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  summaryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  summaryValue: { fontSize: 22, fontWeight: '700' },
  lifecycleBreakdown: { flexDirection: 'row', gap: 6, marginTop: 8 },
  breakdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 4,
  },
  breakdownEmoji: { fontSize: 12 },
  breakdownCount: { fontSize: 13, fontWeight: '700' },
  topItem: { color: '#cbd5e1', fontSize: 12, marginTop: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  filterChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterChipText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  entry: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  entryTopic: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  entryMeta: { color: '#94a3b8', fontSize: 11 },
  entryDate: { color: '#64748b', fontSize: 11, marginLeft: 4 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryHook: { color: '#cbd5e1', fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  entryTip: { color: '#94a3b8', fontSize: 12, marginBottom: 10 },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  notesInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  entryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  smallBtnText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  clearBtn: { color: '#F97316', fontSize: 12, fontWeight: '600' },
  backBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});