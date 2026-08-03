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
  LenOptEntry,
  LenOptGoal,
  LenOptPlatform,
  LenOptRange,
  LENOPT_GOALS,
  LENOPT_PLATFORMS,
  LENOPT_RANGES,
  buildCaptionOptim,
  clearLenOpts,
  getLenOptList,
  removeLenOpt,
  saveLenOpt,
  updateLenOpt,
  addCopyToHistory,
} from '../services/storage';

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
  if (s >= 80) return '🚀';
  if (s >= 60) return '👍';
  if (s >= 40) return '⚠️';
  return '🛑';
};

export default function CaptionLengthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<LenOptEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [platform, setPlatform] = useState<LenOptPlatform>('instagram');
  const [goal, setGoal] = useState<LenOptGoal>('engagement');
  const [preview, setPreview] = useState<Omit<LenOptEntry, 'id' | 'createdAt'> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getLenOptList();
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

  const generatePreview = useCallback(() => {
    if (caption.trim().length === 0) {
      setPreview(null);
      return;
    }
    setPreview(buildCaptionOptim({ caption, platform, goal }));
  }, [caption, platform, goal]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const onSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    const next = await saveLenOpt(preview);
    setList(next);
    setSaving(false);
    setCaption('');
    setPreview(null);
    setToast('Caption analizi kaydedildi ✓');
  }, [preview]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu analizi silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeLenOpt(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  }, [openId]);

  const onClear = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert('Tümünü sil', `${list.length} analiz silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearLenOpts();
          setList([]);
          setToast('Tüm analizler silindi');
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
      const next = await updateLenOpt(id, { notes: note });
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

  const summary = useMemo(() => {
    const byRange: Record<LenOptRange, number> = { micro: 0, short: 0, medium: 0, long: 0, essay: 0 };
    let totalChars = 0;
    list.forEach(e => {
      byRange[e.currentRange] += 1;
      totalChars += e.charCount;
    });
    const avgScore = list.length === 0 ? 0 : Math.round(list.reduce((s, e) => s + e.score, 0) / list.length);
    const avgChars = list.length === 0 ? 0 : Math.round(totalChars / list.length);
    return { byRange, avgScore, avgChars };
  }, [list]);

  const platformKeys = Object.keys(LENOPT_PLATFORMS) as LenOptPlatform[];
  const goalKeys = Object.keys(LENOPT_GOALS) as LenOptGoal[];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Caption Uzunluk',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Caption yapıştır, platform + hedef seç. Otomatik uzunluk analizi + geri bildirim al.
        </Text>

        {/* CAPTION INPUT */}
        <Text style={styles.sectionLabel}>Caption</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Caption metnini buraya yapıştır..."
          placeholderTextColor="#475569"
          style={styles.captionInput}
          multiline
        />

        {/* PLATFORM */}
        <Text style={styles.sectionLabel}>Platform</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {platformKeys.map(pk => {
            const meta = LENOPT_PLATFORMS[pk];
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

        {/* GOAL */}
        <Text style={styles.sectionLabel}>Hedef</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {goalKeys.map(gk => {
            const meta = LENOPT_GOALS[gk];
            const active = goal === gk;
            return (
              <Pressable
                key={gk}
                onPress={() => setGoal(gk)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={styles.chipIcon}>{meta.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* PREVIEW */}
        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={[styles.scoreBig, { backgroundColor: scoreColor(preview.score) + '22', borderColor: scoreColor(preview.score) }]}>
                <Text style={styles.scoreBigEmoji}>{scoreEmoji(preview.score)}</Text>
                <Text style={[styles.scoreBigText, { color: scoreColor(preview.score) }]}>{preview.score}</Text>
              </View>
              <View style={styles.rangeRow}>
                <View style={styles.rangeBox}>
                  <Text style={styles.rangeLabel}>Mevcut</Text>
                  <Text style={[styles.rangeValue, { color: LENOPT_RANGES[preview.currentRange].color }]}>
                    {LENOPT_RANGES[preview.currentRange].emoji} {LENOPT_RANGES[preview.currentRange].label}
                  </Text>
                </View>
                <Text style={styles.rangeArrow}>→</Text>
                <View style={styles.rangeBox}>
                  <Text style={styles.rangeLabel}>Hedef</Text>
                  <Text style={[styles.rangeValue, { color: LENOPT_RANGES[preview.recommended].color }]}>
                    {LENOPT_RANGES[preview.recommended].emoji} {LENOPT_RANGES[preview.recommended].label}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{preview.charCount}</Text>
                <Text style={styles.metricLabel}>karakter</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{preview.wordCount}</Text>
                <Text style={styles.metricLabel}>kelime</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{preview.lineCount}</Text>
                <Text style={styles.metricLabel}>satır</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{preview.emojiCount}</Text>
                <Text style={styles.metricLabel}>emoji</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{preview.hashtagCount}</Text>
                <Text style={styles.metricLabel}>hashtag</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{preview.urlCount}</Text>
                <Text style={styles.metricLabel}>link</Text>
              </View>
            </View>

            <Text style={styles.feedbackTitle}>📋 Geri bildirim</Text>
            {preview.feedback.map((f, idx) => (
              <View key={idx} style={styles.feedbackRow}>
                <Text style={styles.feedbackDot}>•</Text>
                <Text style={styles.feedbackText}>{f}</Text>
              </View>
            ))}

            {preview.improvedCaption !== preview.caption && (
              <View style={styles.improvedBox}>
                <Text style={styles.improvedLabel}>💡 Önerilen</Text>
                <Text style={styles.improvedText}>{preview.improvedCaption}</Text>
                <Pressable onPress={() => onCopy(preview.improvedCaption)} style={styles.improvedCopyBtn}>
                  <Text style={styles.improvedCopyBtnText}>📋 Kopyala</Text>
                </Pressable>
              </View>
            )}

            <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Analizi kaydet</Text>}
            </Pressable>
          </View>
        )}

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📂 Kayıtlı Analizler ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama skor</Text>
                <Text style={[styles.summaryValue, { color: scoreColor(summary.avgScore) }]}>{summary.avgScore}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama karakter</Text>
                <Text style={styles.summaryValue}>{summary.avgChars}</Text>
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 8, marginBottom: 4 }]}>Uzunluk dağılımı</Text>
              <View style={styles.rangeBreakdown}>
                {(Object.keys(LENOPT_RANGES) as LenOptRange[]).map(rk => {
                  const meta = LENOPT_RANGES[rk];
                  return (
                    <View key={rk} style={[styles.rangeChip, { borderColor: meta.color }]}>
                      <Text style={styles.rangeChipEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.rangeChipCount, { color: meta.color }]}>{summary.byRange[rk]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length === 0 ? (
            <Text style={styles.empty}>Henüz analiz yok. Yukarıdan caption yapıştır.</Text>
          ) : (
            list.map(e => {
              const platformMeta = LENOPT_PLATFORMS[e.platform];
              const currentMeta = LENOPT_RANGES[e.currentRange];
              const goalMeta = LENOPT_GOALS[e.goal];
              const open = openId === e.id;
              return (
                <View key={e.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : e.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryCaption} numberOfLines={2}>
                        {platformMeta?.emoji} {e.caption.slice(0, 80)}{e.caption.length > 80 ? '...' : ''}
                      </Text>
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryMeta}>{goalMeta?.emoji} {goalMeta?.label}</Text>
                        <Text style={styles.entryMeta}> · {e.charCount}kr</Text>
                      </View>
                    </View>
                    <View style={[styles.scorePill, { backgroundColor: scoreColor(e.score) + '22', borderColor: scoreColor(e.score) }]}>
                      <Text style={styles.scorePillEmoji}>{scoreEmoji(e.score)}</Text>
                      <Text style={[styles.scorePillText, { color: scoreColor(e.score) }]}>{e.score}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.entryRangeRow}>
                    <View style={[styles.rangePill, { backgroundColor: currentMeta.color + '22', borderColor: currentMeta.color }]}>
                      <Text style={styles.rangePillText}>{currentMeta.emoji} {currentMeta.label}</Text>
                    </View>
                    <Text style={styles.entryDate}>{formatDate(e.createdAt)}</Text>
                  </View>

                  {open && (
                    <View style={styles.entryDetail}>
                      <Text style={styles.entryFullCaption}>{e.caption}</Text>

                      <View style={styles.entryMetricsRow}>
                        <Text style={styles.entryMetric}>📏 {e.charCount} karakter</Text>
                        <Text style={styles.entryMetric}>📝 {e.wordCount} kelime</Text>
                        <Text style={styles.entryMetric}>↩️ {e.lineCount} satır</Text>
                        <Text style={styles.entryMetric}>😀 {e.emojiCount} emoji</Text>
                        <Text style={styles.entryMetric}>#️⃣ {e.hashtagCount} hashtag</Text>
                      </View>

                      <Text style={styles.entryLabel}>Geri bildirim</Text>
                      {e.feedback.map((f, idx) => (
                        <View key={idx} style={styles.entryFeedbackRow}>
                          <Text style={styles.entryFeedbackDot}>•</Text>
                          <Text style={styles.entryFeedbackText}>{f}</Text>
                        </View>
                      ))}

                      {e.improvedCaption !== e.caption && (
                        <View style={styles.entryImprovedBox}>
                          <Text style={styles.entryImprovedLabel}>💡 Önerilen</Text>
                          <Text style={styles.entryImprovedText}>{e.improvedCaption}</Text>
                          <Pressable onPress={() => onCopy(e.improvedCaption)} style={styles.entryCopyBtn}>
                            <Text style={styles.entryCopyBtnText}>📋 Kopyala</Text>
                          </Pressable>
                        </View>
                      )}

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
                        <Pressable onPress={() => onCopy(e.caption)} style={styles.smallBtn}>
                          <Text style={styles.smallBtnText}>📋 Orijinali kopyala</Text>
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
  captionInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    minHeight: 120,
    textAlignVertical: 'top',
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
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipIcon: { fontSize: 16, marginRight: 6 },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  previewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  scoreBig: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  scoreBigEmoji: { fontSize: 16 },
  scoreBigText: { fontSize: 18, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rangeBox: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  rangeLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', marginBottom: 2 },
  rangeValue: { fontSize: 11, fontWeight: '700' },
  rangeArrow: { color: '#94a3b8', fontSize: 16 },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  metricBox: { alignItems: 'center', minWidth: 50 },
  metricValue: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  metricLabel: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  feedbackTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  feedbackRow: { flexDirection: 'row', marginBottom: 6 },
  feedbackDot: { color: '#6366f1', fontSize: 14, marginRight: 6, fontWeight: '700' },
  feedbackText: { color: '#e2e8f0', fontSize: 13, flex: 1, lineHeight: 18 },
  improvedBox: {
    backgroundColor: '#6366f1' + '15',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  improvedLabel: { color: '#6366f1', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  improvedText: { color: '#f8fafc', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  improvedCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#6366f1',
  },
  improvedCopyBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
    marginBottom: 6,
  },
  summaryLabel: { color: '#94a3b8', fontSize: 12 },
  summaryValue: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  rangeBreakdown: { flexDirection: 'row', gap: 6, marginTop: 4 },
  rangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  rangeChipEmoji: { fontSize: 11 },
  rangeChipCount: { fontSize: 12, fontWeight: '700' },
  empty: { color: '#64748b', fontSize: 13, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  entry: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  entryCaption: { color: '#f8fafc', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  entryMeta: { color: '#94a3b8', fontSize: 11 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  scorePillEmoji: { fontSize: 11 },
  scorePillText: { fontSize: 12, fontWeight: '700' },
  entryRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  rangePillText: { fontSize: 11, fontWeight: '700' },
  entryDate: { color: '#64748b', fontSize: 10 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryFullCaption: {
    color: '#cbd5e1',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 10,
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 8,
    lineHeight: 16,
  },
  entryMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  entryMetric: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginTop: 4, marginBottom: 6 },
  entryFeedbackRow: { flexDirection: 'row', marginBottom: 4 },
  entryFeedbackDot: { color: '#6366f1', fontSize: 12, marginRight: 4, fontWeight: '700' },
  entryFeedbackText: { color: '#e2e8f0', fontSize: 12, flex: 1 },
  entryImprovedBox: {
    backgroundColor: '#6366f1' + '15',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  entryImprovedLabel: { color: '#6366f1', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  entryImprovedText: { color: '#f8fafc', fontSize: 12, marginBottom: 6, lineHeight: 16 },
  entryCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  entryCopyBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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