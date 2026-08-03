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
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CCEntry,
  CCIntensity,
  CCPlatform,
  CHEAT_INTENSITY_META,
  CHEAT_PLATFORMS,
  buildCalendarHeatmap,
  clearCheats,
  getCheatList,
  intensityFromEngagement,
  removeCheat,
  saveCheat,
  updateCheat,
  addCopyToHistory,
} from '../services/storage';

const formatNumber = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CalendarHeatmapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<CCEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [date, setDate] = useState(todayStr());
  const [platform, setPlatform] = useState<CCPlatform>('instagram');
  const [topic, setTopic] = useState('');
  const [engagement, setEngagement] = useState('100');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getCheatList();
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

  const onSave = useCallback(async () => {
    if (topic.trim().length < 2) return;
    const eng = parseInt(engagement, 10) || 0;
    setSaving(true);
    const next = await saveCheat({
      date,
      platform,
      topic: topic.trim(),
      intensity: intensityFromEngagement(eng),
      engagement: eng,
      notes: '',
    });
    setList(next);
    setSaving(false);
    setTopic('');
    setEngagement('100');
    setToast('İçerik kaydedildi ✓');
  }, [date, platform, topic, engagement]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu kaydı silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeCheat(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  }, [openId]);

  const onClear = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert('Tümünü sil', `${list.length} kayıt silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearCheats();
          setList([]);
          setToast('Tüm kayıtlar silindi');
        },
      },
    ]);
  }, [list.length]);

  const onCopy = useCallback(async (text: string) => {
    Clipboard.setString(text);
    await addCopyToHistory(text, 'pool');
    setToast('Kopyalandı ✓');
  }, []);

  const onSaveNotes = useCallback(
    async (id: string) => {
      const note = notesDraft[id];
      if (note === undefined) return;
      const next = await updateCheat(id, { notes: note });
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

  const heatmap = useMemo(() => buildCalendarHeatmap(list), [list]);

  const last60Days = useMemo(() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return out;
  }, []);

  const platformKeys = Object.keys(CHEAT_PLATFORMS) as CCPlatform[];
  const intensityKeys = Object.keys(CHEAT_INTENSITY_META) as CCIntensity[];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Calendar Heatmap',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Yayınladığın içerikleri tarih + etkileşim ile kaydet. Otomatik heatmap + streak analizi.
        </Text>

        {/* QUICK ADD */}
        <View style={styles.quickCard}>
          <Text style={styles.sectionTitle}>⚡ Hızlı Ekle</Text>

          <Text style={styles.label}>Tarih (YYYY-AA-GG)</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="2025-12-31"
            placeholderTextColor="#475569"
            style={styles.input}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Platform</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {platformKeys.map(pk => {
              const meta = CHEAT_PLATFORMS[pk];
              const active = platform === pk;
              return (
                <Pressable
                  key={pk}
                  onPress={() => setPlatform(pk)}
                  style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                >
                  <Text style={styles.chipIcon}>{meta.emoji}</Text>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Konu / başlık</Text>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="İçerik başlığı"
            placeholderTextColor="#475569"
            style={styles.input}
          />

          <Text style={styles.label}>Toplam etkileşim</Text>
          <TextInput
            value={engagement}
            onChangeText={setEngagement}
            keyboardType="numeric"
            placeholderTextColor="#475569"
            style={styles.input}
          />

          <Pressable
            onPress={onSave}
            disabled={saving || topic.trim().length < 2}
            style={[styles.saveBtn, (saving || topic.trim().length < 2) && { opacity: 0.5 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Ekle</Text>}
          </Pressable>
        </View>

        {/* HEATMAP */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔥 Son 60 gün</Text>
          <View style={styles.heatmapGrid}>
            {last60Days.map((d, idx) => {
              const dayEntries = heatmap.byDay[d] ?? [];
              const maxEng = dayEntries.reduce((s, e) => Math.max(s, e.engagement), 0);
              const intensity = maxEng >= 1000 ? 'viral' : maxEng >= 200 ? 'high' : maxEntries(dayEntries) > 0 ? 'medium' : 'low';
              const meta = CHEAT_INTENSITY_META[intensity];
              return (
                <View
                  key={d}
                  style={[
                    styles.heatCell,
                    { backgroundColor: intensity === 'low' ? '#1e293b' : meta.color + '88' },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <Text style={styles.legendLabel}>Az</Text>
            {intensityKeys.map(ik => {
              const meta = CHEAT_INTENSITY_META[ik];
              return (
                <View key={ik} style={[styles.legendCell, { backgroundColor: ik === 'low' ? '#1e293b' : meta.color + '88' }]} />
              );
            })}
            <Text style={styles.legendLabel}>Çok</Text>
          </View>
        </View>

        {/* SUMMARY */}
        {list.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>📊 Özet</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Toplam içerik</Text>
              <Text style={styles.summaryValue}>{list.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>En iyi gün</Text>
              <Text style={styles.summaryValue}>{heatmap.bestDay ?? '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>En çok platform</Text>
              <Text style={styles.summaryValue}>
                {heatmap.bestPlatform ? `${CHEAT_PLATFORMS[heatmap.bestPlatform].emoji} ${CHEAT_PLATFORMS[heatmap.bestPlatform].label}` : '—'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Streak</Text>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>🔥 {heatmap.streakDays} gün</Text>
            </View>

            <Text style={[styles.summaryLabel, { marginTop: 8, marginBottom: 4 }]}>Aylık dağılım</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthRow}>
              {Object.entries(heatmap.byMonth).sort().map(([m, s]) => (
                <View key={m} style={styles.monthChip}>
                  <Text style={styles.monthLabel}>{m}</Text>
                  <Text style={styles.monthTotal}>{s.total}</Text>
                  {s.viral > 0 && <Text style={styles.monthViral}>🚀{s.viral}</Text>}
                  {s.high > 0 && <Text style={styles.monthHigh}>🟢{s.high}</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🗂️ Tüm Kayıtlar ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {list.length === 0 ? (
            <Text style={styles.empty}>Henüz kayıt yok. Yukarıdan içerik ekle.</Text>
          ) : (
            [...list].sort((a, b) => b.date.localeCompare(a.date)).map(e => {
              const platformMeta = CHEAT_PLATFORMS[e.platform];
              const intensityMeta = CHEAT_INTENSITY_META[e.intensity];
              const open = openId === e.id;
              return (
                <View key={e.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : e.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTopic} numberOfLines={1}>
                        {platformMeta?.emoji} {e.topic}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {e.date} · {formatNumber(e.engagement)} etkileşim
                      </Text>
                    </View>
                    <View style={[styles.intensityPill, { backgroundColor: intensityMeta.color + '22', borderColor: intensityMeta.color }]}>
                      <Text style={styles.intensityEmoji}>{intensityMeta.emoji}</Text>
                    </View>
                  </Pressable>

                  {open && (
                    <View style={styles.entryDetail}>
                      <Text style={styles.entryMetaRow}>
                        📍 {platformMeta?.label} · 📅 {e.date} · {intensityMeta.emoji} {intensityMeta.label}
                      </Text>
                      <Text style={styles.entryEngagement}>📈 {formatNumber(e.engagement)} toplam etkileşim</Text>

                      <Text style={styles.entryLabel}>Notlar</Text>
                      <TextInput
                        value={notesDraft[e.id] ?? e.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [e.id]: txt }))}
                        placeholder="Not ekle..."
                        placeholderTextColor="#475569"
                        style={styles.notesInput}
                        multiline
                      />
                      <View style={styles.entryActions}>
                        <Pressable
                          onPress={() => onSaveNotes(e.id)}
                          disabled={notesDraft[e.id] === undefined}
                          style={[styles.smallBtn, notesDraft[e.id] === undefined && { opacity: 0.4 }]}
                        >
                          <Text style={styles.smallBtnText}>💾 Notu kaydet</Text>
                        </Pressable>
                        <Pressable onPress={() => onCopy(`${e.date} — ${e.topic} (${formatNumber(e.engagement)})`)} style={styles.smallBtn}>
                          <Text style={styles.smallBtnText}>📋 Kopyala</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(e.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
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

const maxEntries = (list: CCEntry[]): number => list.length;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16 },
  intro: { color: '#94a3b8', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  sectionTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  label: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  chipRow: { marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipIcon: { fontSize: 14, marginRight: 4 },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  quickCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
  clearBtn: { color: '#F97316', fontSize: 12, fontWeight: '600' },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginBottom: 12,
  },
  heatCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  legendLabel: { color: '#94a3b8', fontSize: 10 },
  legendCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: { color: '#94a3b8', fontSize: 12 },
  summaryValue: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  monthRow: { marginTop: 4 },
  monthChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  monthTotal: { color: '#6366f1', fontSize: 13, fontWeight: '700' },
  monthViral: { color: '#EF4444', fontSize: 11, fontWeight: '700' },
  monthHigh: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  empty: { color: '#64748b', fontSize: 13, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  entry: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center' },
  entryTopic: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  intensityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  intensityEmoji: { fontSize: 14 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryMetaRow: { color: '#cbd5e1', fontSize: 12, marginBottom: 4 },
  entryEngagement: { color: '#10B981', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  notesInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  entryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  smallBtnText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
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