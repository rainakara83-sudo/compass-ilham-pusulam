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
  HookTesterEntry,
  HookTesterPlatform,
  HookTesterType,
  HOOKTEST_PLATFORMS,
  HOOKTEST_TYPES,
  buildHookVariants,
  clearHookTests,
  getHookTestList,
  removeHookTest,
  saveHookTest,
  updateHookTest,
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

export default function HookTesterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<HookTesterEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [hook, setHook] = useState('');
  const [platform, setPlatform] = useState<HookTesterPlatform>('instagram');
  const [preview, setPreview] = useState<Omit<HookTesterEntry, 'id' | 'createdAt'> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getHookTestList();
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
    if (hook.trim().length < 3) {
      setPreview(null);
      return;
    }
    setPreview(buildHookVariants({ hook, platform }));
  }, [hook, platform]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const onSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    const next = await saveHookTest(preview);
    setList(next);
    setSaving(false);
    setHook('');
    setPreview(null);
    setToast('Hook testi kaydedildi ✓');
  }, [preview]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu hook testini silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeHookTest(id);
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
          await clearHookTests();
          setList([]);
          setToast('Tüm hook testleri silindi');
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
      const next = await updateHookTest(id, { notes: note });
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
    const typeCount: Partial<Record<HookTesterType, number>> = {};
    list.forEach(e => {
      typeCount[e.detectedType] = (typeCount[e.detectedType] ?? 0) + 1;
    });
    const platformCount: Partial<Record<HookTesterPlatform, number>> = {};
    list.forEach(e => {
      platformCount[e.platform] = (platformCount[e.platform] ?? 0) + 1;
    });
    let bestScore = 0;
    list.forEach(e => {
      const best = e.variants.find(v => v.id === e.bestVariantId);
      if (best && best.score > bestScore) bestScore = best.score;
    });
    const avgBest = list.length === 0 ? 0 : Math.round(list.reduce((s, e) => {
      const b = e.variants.find(v => v.id === e.bestVariantId);
      return s + (b?.score ?? 0);
    }, 0) / list.length);
    return { typeCount, platformCount, avgBest, bestScore };
  }, [list]);

  const platformKeys = Object.keys(HOOKTEST_PLATFORMS) as HookTesterPlatform[];
  const typeKeys = Object.keys(HOOKTEST_TYPES) as HookTesterType[];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Hook Tester',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Bir hook yaz, platform seç. Otomatik tip tespiti + 7 alternatif varyant + skor.
        </Text>

        {/* HOOK INPUT */}
        <Text style={styles.sectionLabel}>Hook</Text>
        <TextInput
          value={hook}
          onChangeText={setHook}
          placeholder="Açılış cümlesi..."
          placeholderTextColor="#475569"
          style={styles.hookInput}
        />

        {/* PLATFORM */}
        <Text style={styles.sectionLabel}>Platform</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {platformKeys.map(pk => {
            const meta = HOOKTEST_PLATFORMS[pk];
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

        {/* PREVIEW */}
        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.detectedBox}>
                <Text style={styles.detectedLabel}>Tespit edilen tip</Text>
                <View style={styles.detectedPill}>
                  <Text style={styles.detectedEmoji}>{HOOKTEST_TYPES[preview.detectedType].emoji}</Text>
                  <Text style={styles.detectedText}>{HOOKTEST_TYPES[preview.detectedType].label}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>🎯 Varyantlar (skora göre)</Text>
            {preview.variants.map(v => {
              const isBest = v.id === preview.bestVariantId;
              const typeMeta = HOOKTEST_TYPES[v.type];
              return (
                <View key={v.id} style={[styles.variantRow, isBest && styles.variantRowBest]}>
                  {isBest && <Text style={styles.bestBadge}>⭐ EN İYİ</Text>}
                  <View style={styles.variantHeader}>
                    <View style={styles.variantTypePill}>
                      <Text style={styles.variantTypeEmoji}>{typeMeta.emoji}</Text>
                      <Text style={styles.variantTypeText}>{typeMeta.label}</Text>
                    </View>
                    <View style={[styles.scorePill, { backgroundColor: scoreColor(v.score) + '22', borderColor: scoreColor(v.score) }]}>
                      <Text style={styles.scorePillEmoji}>{scoreEmoji(v.score)}</Text>
                      <Text style={[styles.scorePillText, { color: scoreColor(v.score) }]}>{v.score}</Text>
                    </View>
                  </View>
                  <Text style={styles.variantText}>{v.text}</Text>
                  <Text style={styles.variantReason}>💡 {v.reason}</Text>
                  <Pressable onPress={() => onCopy(v.text)} style={styles.variantCopyBtn}>
                    <Text style={styles.variantCopyBtnText}>📋 Kopyala</Text>
                  </Pressable>
                </View>
              );
            })}

            <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Hook'u kaydet</Text>}
            </Pressable>
          </View>
        )}

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🗂️ Kayıtlı Hooklar ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama en iyi skor</Text>
                <Text style={[styles.summaryValue, { color: scoreColor(summary.avgBest) }]}>{summary.avgBest}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>En yüksek skor</Text>
                <Text style={[styles.summaryValue, { color: scoreColor(summary.bestScore) }]}>{summary.bestScore}</Text>
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 8, marginBottom: 4 }]}>Tip dağılımı</Text>
              <View style={styles.typeRow}>
                {typeKeys.map(tk => {
                  const cnt = summary.typeCount[tk] ?? 0;
                  if (cnt === 0) return null;
                  const meta = HOOKTEST_TYPES[tk];
                  return (
                    <View key={tk} style={styles.typeChip}>
                      <Text style={styles.typeChipEmoji}>{meta.emoji}</Text>
                      <Text style={styles.typeChipCount}>{cnt}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length === 0 ? (
            <Text style={styles.empty}>Henüz hook yok. Yukarıdan bir tane yaz.</Text>
          ) : (
            list.map(e => {
              const platformMeta = HOOKTEST_PLATFORMS[e.platform];
              const typeMeta = HOOKTEST_TYPES[e.detectedType];
              const best = e.variants.find(v => v.id === e.bestVariantId);
              const open = openId === e.id;
              return (
                <View key={e.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : e.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryHook} numberOfLines={2}>
                        {platformMeta?.emoji} {e.hook}
                      </Text>
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryMeta}>{typeMeta?.emoji} {typeMeta?.label}</Text>
                      </View>
                    </View>
                    {best && (
                      <View style={[styles.scorePill, { backgroundColor: scoreColor(best.score) + '22', borderColor: scoreColor(best.score) }]}>
                        <Text style={styles.scorePillEmoji}>{scoreEmoji(best.score)}</Text>
                        <Text style={[styles.scorePillText, { color: scoreColor(best.score) }]}>{best.score}</Text>
                      </View>
                    )}
                  </Pressable>

                  {open && (
                    <View style={styles.entryDetail}>
                      <Text style={styles.entryLabel}>Tüm varyantlar</Text>
                      {e.variants.map(v => {
                        const isBest = v.id === e.bestVariantId;
                        const vType = HOOKTEST_TYPES[v.type];
                        return (
                          <View key={v.id} style={[styles.entryVariant, isBest && styles.entryVariantBest]}>
                            <View style={styles.entryVariantHeader}>
                              <Text style={[styles.entryVariantType, isBest && { color: '#10B981' }]}>
                                {vType.emoji} {vType.label}{isBest ? ' ⭐' : ''}
                              </Text>
                              <Text style={[styles.entryVariantScore, { color: scoreColor(v.score) }]}>
                                {scoreEmoji(v.score)} {v.score}
                              </Text>
                            </View>
                            <Text style={styles.entryVariantText}>{v.text}</Text>
                            <Text style={styles.entryVariantReason}>💡 {v.reason}</Text>
                            <Pressable onPress={() => onCopy(v.text)} style={styles.entryVariantCopyBtn}>
                              <Text style={styles.entryVariantCopyBtnText}>📋 Kopyala</Text>
                            </Pressable>
                          </View>
                        );
                      })}

                      <Text style={styles.entryLabel}>Notlar</Text>
                      <TextInput
                        value={notesDraft[e.id] ?? e.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [e.id]: txt }))}
                        placeholder="Not ekle..."
                        placeholderTextColor="#475569"
                        style={styles.notesInput}
                        multiline
                      />
                      <Text style={styles.entryDate}>{formatDate(e.createdAt)}</Text>
                      <View style={styles.entryActions}>
                        <Pressable
                          onPress={() => onSaveNotes(e.id)}
                          disabled={notesDraft[e.id] === undefined}
                          style={[styles.smallBtn, notesDraft[e.id] === undefined && { opacity: 0.4 }]}
                        >
                          <Text style={styles.smallBtnText}>💾 Notu kaydet</Text>
                        </Pressable>
                        {best && (
                          <Pressable onPress={() => onCopy(best.text)} style={styles.smallBtn}>
                            <Text style={styles.smallBtnText}>📋 En iyi</Text>
                          </Pressable>
                        )}
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
  hookInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    minHeight: 60,
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
  previewHeader: { marginBottom: 12 },
  detectedBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detectedLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6 },
  detectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#6366f1' + '22',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
    gap: 6,
  },
  detectedEmoji: { fontSize: 14 },
  detectedText: { color: '#6366f1', fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  variantRow: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  variantRowBest: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  bestBadge: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 1,
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  variantTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  variantTypeEmoji: { fontSize: 11 },
  variantTypeText: { color: '#cbd5e1', fontSize: 10, fontWeight: '700' },
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
  variantText: { color: '#f8fafc', fontSize: 13, marginBottom: 6, lineHeight: 18 },
  variantReason: { color: '#94a3b8', fontSize: 11, marginBottom: 8, fontStyle: 'italic' },
  variantCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
  },
  variantCopyBtnText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  typeChipEmoji: { fontSize: 11 },
  typeChipCount: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  empty: { color: '#64748b', fontSize: 13, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  entry: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  entryHook: { color: '#f8fafc', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  entryMeta: { color: '#94a3b8', fontSize: 11 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginBottom: 8 },
  entryVariant: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryVariantBest: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  entryVariantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  entryVariantType: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  entryVariantScore: { fontSize: 12, fontWeight: '700' },
  entryVariantText: { color: '#f8fafc', fontSize: 12, marginBottom: 4, lineHeight: 16 },
  entryVariantReason: { color: '#94a3b8', fontSize: 11, marginBottom: 6, fontStyle: 'italic' },
  entryVariantCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
  },
  entryVariantCopyBtnText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
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
    marginBottom: 6,
  },
  entryDate: { color: '#64748b', fontSize: 10, marginBottom: 8 },
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