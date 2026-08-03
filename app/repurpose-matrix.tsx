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
  RepurposeEntry,
  RepurposeSource,
  RepurposeTarget,
  RepurposeTargetPlan,
  REPURPOSE_SOURCES,
  REPURPOSE_TARGETS,
  buildRepurposeMatrix,
  clearRepurposes,
  getRepurposeList,
  removeRepurpose,
  saveRepurpose,
  updateRepurpose,
  addCopyToHistory,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const effortColor = (e: 'low' | 'medium' | 'high'): string => {
  if (e === 'low') return '#10B981';
  if (e === 'medium') return '#F59E0B';
  return '#F97316';
};

const effortLabel = (e: 'low' | 'medium' | 'high'): string => {
  if (e === 'low') return 'Düşük efor';
  if (e === 'medium') return 'Orta efor';
  return 'Yüksek efor';
};

const effortEmoji = (e: 'low' | 'medium' | 'high'): string => {
  if (e === 'low') return '⚡';
  if (e === 'medium') return '🔋';
  return '🏋️';
};

export default function RepurposeMatrixScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<RepurposeEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [sourceType, setSourceType] = useState<RepurposeSource>('long_video');
  const [topic, setTopic] = useState('');
  const [hook, setHook] = useState('');
  const [keyQuote, setKeyQuote] = useState('');
  const [cta, setCta] = useState('');
  const [preview, setPreview] = useState<Omit<RepurposeEntry, 'id' | 'createdAt'> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getRepurposeList();
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
    if (topic.trim().length < 2) {
      setPreview(null);
      return;
    }
    setPreview(
      buildRepurposeMatrix({
        sourceType,
        topic: topic.trim(),
        hook: hook.trim() || topic.trim(),
        keyQuote: keyQuote.trim() || topic.trim(),
        cta: cta.trim(),
      })
    );
  }, [sourceType, topic, hook, keyQuote, cta]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const onSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    const next = await saveRepurpose(preview);
    setList(next);
    setSaving(false);
    setTopic('');
    setHook('');
    setKeyQuote('');
    setCta('');
    setPreview(null);
    setToast('Matrix kaydedildi ✓');
  }, [preview]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu matrix kaydını silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeRepurpose(id);
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
          await clearRepurposes();
          setList([]);
          setToast('Tüm matrix kayıtları silindi');
        },
      },
    ]);
  }, [list.length]);

  const onCopy = useCallback(async (text: string) => {
    Clipboard.setString(text);
    await addCopyToHistory(text, 'pool');
    setToast('Kopyalandı ✓');
  }, []);

  const onCopyPlan = useCallback(
    async (entry: RepurposeEntry, plan: RepurposeTargetPlan) => {
      const targetMeta = REPURPOSE_TARGETS[plan.target];
      const text = `📌 ${entry.topic}\n→ ${targetMeta.emoji} ${targetMeta.label}\nHook: ${plan.hook}\nFormat: ${plan.format}\nCTA: ${entry.cta}`;
      await onCopy(text);
    },
    [onCopy]
  );

  const onSaveNotes = useCallback(
    async (id: string) => {
      const note = notesDraft[id];
      if (note === undefined) return;
      const next = await updateRepurpose(id, { notes: note });
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
    const sourceCount: Partial<Record<RepurposeSource, number>> = {};
    let totalPlans = 0;
    list.forEach(r => {
      sourceCount[r.sourceType] = (sourceCount[r.sourceType] ?? 0) + 1;
      totalPlans += r.plans.length;
    });
    const avgPlans = list.length === 0 ? 0 : Math.round((totalPlans / list.length) * 10) / 10;
    return { sourceCount, totalPlans, avgPlans };
  }, [list]);

  const sourceKeys = Object.keys(REPURPOSE_SOURCES) as RepurposeSource[];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Repurpose Matrix',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Bir ana içerik yaz, otomatik tüm platformlara dağıtım planı oluştur. Öncelik sırasına göre dene.
        </Text>

        {/* SOURCE */}
        <Text style={styles.sectionLabel}>Ana içerik tipi</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {sourceKeys.map(sk => {
            const meta = REPURPOSE_SOURCES[sk];
            const active = sourceType === sk;
            return (
              <Pressable
                key={sk}
                onPress={() => setSourceType(sk)}
                style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
              >
                <Text style={styles.chipIcon}>{meta.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* INPUTS */}
        <Text style={styles.sectionLabel}>Konu</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="Ana içeriğin konusu"
          placeholderTextColor="#475569"
          style={styles.input}
        />

        <Text style={styles.sectionLabel}>Hook (opsiyonel)</Text>
        <TextInput
          value={hook}
          onChangeText={setHook}
          placeholder="Açılış cümlesi / dikkat çekici ifade"
          placeholderTextColor="#475569"
          style={styles.input}
        />

        <Text style={styles.sectionLabel}>Anahtar alıntı (opsiyonel)</Text>
        <TextInput
          value={keyQuote}
          onChangeText={setKeyQuote}
          placeholder="Vurgulamak istediğin cümle"
          placeholderTextColor="#475569"
          style={[styles.input, { minHeight: 60 }]}
          multiline
        />

        <Text style={styles.sectionLabel}>CTA (opsiyonel)</Text>
        <TextInput
          value={cta}
          onChangeText={setCta}
          placeholder="Hedef aksiyon (yorum, takip, link...)"
          placeholderTextColor="#475569"
          style={styles.input}
        />

        {/* PREVIEW */}
        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle} numberOfLines={2}>{preview.topic}</Text>
              <View style={styles.planCount}>
                <Text style={styles.planCountEmoji}>📤</Text>
                <Text style={styles.planCountText}>{preview.plans.length}</Text>
              </View>
            </View>

            {preview.hook && (
              <Text style={styles.previewMeta}>🎯 Hook: {preview.hook}</Text>
            )}
            {preview.keyQuote && (
              <Text style={styles.previewMeta}>💬 Quote: "{preview.keyQuote}"</Text>
            )}
            {preview.cta && (
              <Text style={styles.previewMeta}>📣 CTA: {preview.cta}</Text>
            )}

            <Text style={styles.divider}></Text>

            <Text style={styles.sectionTitle}>📋 Dağıtım planı</Text>
            {preview.plans.map((plan, idx) => {
              const targetMeta = REPURPOSE_TARGETS[plan.target];
              return (
                <View key={`${plan.target}-${idx}`} style={styles.planRow}>
                  <View style={styles.planRank}>
                    <Text style={styles.planRankText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.planBody}>
                    <View style={styles.planHeaderRow}>
                      <Text style={[styles.planTarget, { color: targetMeta.color }]}>
                        {targetMeta.emoji} {targetMeta.label}
                      </Text>
                      <View style={[styles.effortBadge, { backgroundColor: effortColor(plan.effort) + '22', borderColor: effortColor(plan.effort) }]}>
                        <Text style={styles.effortBadgeEmoji}>{effortEmoji(plan.effort)}</Text>
                        <Text style={[styles.effortBadgeText, { color: effortColor(plan.effort) }]}>
                          {effortLabel(plan.effort)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.planFormat}>📐 {plan.format}</Text>
                    <Text style={styles.planHook}>🪝 {plan.hook}</Text>
                    <Pressable
                      onPress={() =>
                        onCopy(
                          `${targetMeta.emoji} ${targetMeta.label} — ${plan.format}\nHook: ${plan.hook}${preview.cta ? `\nCTA: ${preview.cta}` : ''}`
                        )
                      }
                      style={styles.planCopyBtn}
                    >
                      <Text style={styles.planCopyBtnText}>📋 Kopyala</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Matrix'i kaydet</Text>}
            </Pressable>
          </View>
        )}

        {!preview && topic.length >= 2 && (
          <View style={styles.previewCard}>
            <ActivityIndicator color="#6366f1" />
          </View>
        )}

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🗂️ Kayıtlı Matrixler ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Toplam plan</Text>
                <Text style={styles.summaryValue}>{summary.totalPlans}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama plan/matrix</Text>
                <Text style={styles.summaryValue}>{summary.avgPlans}</Text>
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 8, marginBottom: 4 }]}>Kaynak dağılımı</Text>
              <View style={styles.sourceRow}>
                {sourceKeys.map(sk => {
                  const meta = REPURPOSE_SOURCES[sk];
                  const cnt = summary.sourceCount[sk] ?? 0;
                  if (cnt === 0) return null;
                  return (
                    <View key={sk} style={[styles.sourceChip, { borderColor: meta.color }]}>
                      <Text style={styles.sourceChipEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.sourceChipCount, { color: meta.color }]}>{cnt}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length === 0 ? (
            <Text style={styles.empty}>Henüz matrix yok. Yukarıdan ana içerik ekle.</Text>
          ) : (
            list.map(entry => {
              const sourceMeta = REPURPOSE_SOURCES[entry.sourceType];
              const open = openId === entry.id;
              return (
                <View key={entry.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : entry.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTopic} numberOfLines={1}>
                        {sourceMeta.emoji} {entry.topic}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {sourceMeta.label} · {entry.plans.length} plan · {formatDate(entry.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.entryChevron}>{open ? '▲' : '▼'}</Text>
                  </Pressable>

                  {open && (
                    <View style={styles.entryDetail}>
                      {entry.hook && (
                        <Text style={styles.entryMetaLine}>🎯 Hook: {entry.hook}</Text>
                      )}
                      {entry.keyQuote && (
                        <Text style={styles.entryMetaLine}>💬 "{entry.keyQuote}"</Text>
                      )}
                      {entry.cta && (
                        <Text style={styles.entryMetaLine}>📣 CTA: {entry.cta}</Text>
                      )}

                      <Text style={[styles.entryLabel, { marginTop: 12 }]}>Planlar (öncelik sırası)</Text>
                      {entry.plans.map((plan, idx) => {
                        const targetMeta = REPURPOSE_TARGETS[plan.target];
                        return (
                          <View key={`${plan.target}-${idx}`} style={styles.entryPlanRow}>
                            <View style={[styles.entryPlanBadge, { backgroundColor: targetMeta.color + '22', borderColor: targetMeta.color }]}>
                              <Text style={styles.entryPlanBadgeEmoji}>{targetMeta.emoji}</Text>
                              <Text style={[styles.entryPlanBadgeText, { color: targetMeta.color }]}>
                                {targetMeta.label}
                              </Text>
                            </View>
                            <View style={styles.entryPlanBody}>
                              <Text style={styles.entryPlanFormat}>{plan.format}</Text>
                              <Text style={styles.entryPlanHook} numberOfLines={1}>🪝 {plan.hook}</Text>
                              <View style={styles.entryPlanMetaRow}>
                                <Text style={[styles.entryPlanEffort, { color: effortColor(plan.effort) }]}>
                                  {effortEmoji(plan.effort)} {effortLabel(plan.effort)}
                                </Text>
                                <Text style={styles.entryPlanPriority}>· ⭐ {plan.priority}</Text>
                              </View>
                              <Pressable onPress={() => onCopyPlan(entry, plan)} style={styles.entryPlanCopyBtn}>
                                <Text style={styles.entryPlanCopyBtnText}>📋 Kopyala</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}

                      <Text style={styles.entryLabel}>Notlar</Text>
                      <TextInput
                        value={notesDraft[entry.id] ?? entry.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [entry.id]: txt }))}
                        placeholder="Not ekle..."
                        placeholderTextColor="#475569"
                        style={styles.notesInput}
                        multiline
                      />
                      <View style={styles.entryActions}>
                        <Pressable
                          onPress={() => onSaveNotes(entry.id)}
                          disabled={notesDraft[entry.id] === undefined}
                          style={[styles.smallBtn, notesDraft[entry.id] === undefined && { opacity: 0.4 }]}
                        >
                          <Text style={styles.smallBtnText}>💾 Notu kaydet</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(entry.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
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
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
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
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  previewTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  planCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1' + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
    gap: 4,
  },
  planCountEmoji: { fontSize: 12 },
  planCountText: { color: '#6366f1', fontSize: 13, fontWeight: '700' },
  previewMeta: { color: '#cbd5e1', fontSize: 12, marginBottom: 4, lineHeight: 16 },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  sectionTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  planRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  planRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  planRankText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  planBody: { flex: 1 },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  planTarget: { fontSize: 13, fontWeight: '700' },
  effortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  effortBadgeEmoji: { fontSize: 11 },
  effortBadgeText: { fontSize: 10, fontWeight: '700' },
  planFormat: { color: '#cbd5e1', fontSize: 12, marginBottom: 4 },
  planHook: { color: '#94a3b8', fontSize: 11, marginBottom: 6, fontStyle: 'italic' },
  planCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
  },
  planCopyBtnText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
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
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  sourceChipEmoji: { fontSize: 12 },
  sourceChipCount: { fontSize: 13, fontWeight: '700' },
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
  entryChevron: { color: '#94a3b8', fontSize: 14, marginLeft: 8 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryMetaLine: { color: '#cbd5e1', fontSize: 12, marginBottom: 4 },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  entryPlanRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    marginRight: 8,
  },
  entryPlanBadgeEmoji: { fontSize: 12 },
  entryPlanBadgeText: { fontSize: 11, fontWeight: '700' },
  entryPlanBody: { flex: 1 },
  entryPlanFormat: { color: '#cbd5e1', fontSize: 12, marginBottom: 4 },
  entryPlanHook: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  entryPlanMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  entryPlanEffort: { fontSize: 11, fontWeight: '600' },
  entryPlanPriority: { color: '#94a3b8', fontSize: 11, marginLeft: 4 },
  entryPlanCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
  },
  entryPlanCopyBtnText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
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
    marginTop: 4,
    marginBottom: 8,
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