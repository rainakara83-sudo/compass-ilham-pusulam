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
import { useTranslation } from 'react-i18next';
import {
  PillarEntry,
  PillarSlot,
  PILLAR_PURPOSES,
  buildPillars,
  clearPillars,
  getPillarList,
  removePillar,
  savePillar,
  updatePillar,
  addCopyToHistory,
} from '../services/storage';
import niches from '../data/niches.json';
import i18n from '../i18n';

const NICHES: { id: string; icon: string; color: string }[] = niches.map(n => ({
  id: n.id,
  icon: n.icon,
  color: n.color,
}));

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const lng = (i18n.language || 'en').split('-')[0];
  const localeTag = lng === 'tr' ? 'tr-TR' : lng === 'es' ? 'es-ES' : lng === 'de' ? 'de-DE' : lng === 'fr' ? 'fr-FR' : 'en-US';
  return d.toLocaleDateString(localeTag, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function ContentPillarsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [list, setList] = useState<PillarEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [niche, setNiche] = useState<string>('fitness');
  const [count, setCount] = useState('5');
  const [preview, setPreview] = useState<PillarSlot[]>([]);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getPillarList();
    setList(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(tm);
  }, [toast]);

  const generate = useCallback(() => {
    const n = Math.max(3, Math.min(6, parseInt(count, 10) || 5));
    setPreview(buildPillars({ niche, count: n }));
  }, [niche, count]);

  useEffect(() => {
    generate();
  }, [generate]);

  const onSave = useCallback(async () => {
    if (preview.length === 0) return;
    setSaving(true);
    const next = await savePillar({ niche, pillars: preview, notes: '' });
    setList(next);
    setSaving(false);
    setToast(t('contentMap.savedToast'));
  }, [preview, niche, t]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert(t('contentMap.removeConfirmTitle'), t('contentMap.removeConfirmBody'), [
      { text: t('contentMap.cancelBtn'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const next = await removePillar(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  }, [openId, t]);

  const onClear = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert(t('contentMap.clearConfirmTitle'), t('contentMap.clearConfirmBody', { count: list.length }), [
      { text: t('contentMap.cancelBtn'), style: 'cancel' },
      {
        text: t('contentMap.clearConfirmBtn'),
        style: 'destructive',
        onPress: async () => {
          await clearPillars();
          setList([]);
          setToast(t('contentMap.clearedToast'));
        },
      },
    ]);
  }, [list.length, t]);

  const onCopy = useCallback(async (text: string) => {
    Clipboard.setString(text);
    await addCopyToHistory(text, 'pool');
    setToast(t('contentMap.copiedToast'));
  }, [t]);

  const onSaveNotes = useCallback(
    async (id: string) => {
      const note = notesDraft[id];
      if (note === undefined) return;
      const next = await updatePillar(id, { notes: note });
      setList(next);
      setToast(t('contentMap.notesUpdatedToast'));
      setNotesDraft(prev => {
        const c = { ...prev };
        delete c[id];
        return c;
      });
    },
    [notesDraft, t]
  );

  const summary = useMemo(() => {
    const purposeCount: Partial<Record<PillarSlot['purpose'], number>> = {};
    list.forEach(e => {
      e.pillars.forEach(p => {
        purposeCount[p.purpose] = (purposeCount[p.purpose] ?? 0) + 1;
      });
    });
    const totalPillars = list.reduce((s, e) => s + e.pillars.length, 0);
    const avgPillars = list.length === 0 ? 0 : Math.round((totalPillars / list.length) * 10) / 10;
    return { purposeCount, totalPillars, avgPillars };
  }, [list]);

  const nicheLabel = (id: string) => t(`niches.${id}`, id);
  const nicheIcon = (id: string) => NICHES.find(n => n.id === id)?.icon ?? '📌';

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: t('contentMap.title'),
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          {t('contentMap.intro')}
        </Text>

        {/* NICHE */}
        <Text style={styles.sectionLabel}>{t('contentMap.sectionNiche')}</Text>
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
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{nicheLabel(n.id)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* COUNT */}
        <Text style={styles.sectionLabel}>{t('contentMap.sectionCount')}</Text>
        <View style={styles.countRow}>
          {['3', '4', '5', '6'].map(c => {
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

        {/* PREVIEW */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>{t('contentMap.previewTitle')}</Text>

          <View style={styles.barRow}>
            {preview.map((p, idx) => (
              <View
                key={`${p.name}-${idx}`}
                style={[styles.bar, { flex: p.ratio, backgroundColor: p.color }]}
              />
            ))}
          </View>
          <Text style={styles.barCaption}>{t('contentMap.barCaption')}</Text>

          {preview.map((p, idx) => {
            const purpose = PILLAR_PURPOSES[p.purpose];
            return (
              <View key={`${p.name}-${idx}`} style={styles.pillarRow}>
                <View style={[styles.pillarColorBar, { backgroundColor: p.color }]} />
                <View style={styles.pillarBody}>
                  <View style={styles.pillarHeader}>
                    <Text style={styles.pillarName}>{p.name}</Text>
                    <View style={[styles.pillarPill, { backgroundColor: p.color + '22', borderColor: p.color }]}>
                      <Text style={styles.pillarPillEmoji}>{purpose.emoji}</Text>
                      <Text style={[styles.pillarPillText, { color: p.color }]}>{purpose.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.pillarRatio}>{t('contentMap.ratioLabel', { ratio: p.ratio })}</Text>
                  <Text style={styles.pillarTip}>💡 {purpose.tip}</Text>
                  <View style={styles.examplesRow}>
                    {p.examples.map((ex, j) => (
                      <View key={j} style={styles.exampleChip}>
                        <Text style={styles.exampleText}>{ex}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}

          <Pressable onPress={onSave} disabled={saving || preview.length === 0} style={[styles.saveBtn, (saving || preview.length === 0) && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('contentMap.saveBtn')}</Text>}
          </Pressable>
        </View>

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{list.length > 0 ? t('contentMap.savedTitleWithCount', { count: list.length }) : t('contentMap.savedTitle')}</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>{t('contentMap.clearAll')}</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('contentMap.totalPillars')}</Text>
                <Text style={styles.summaryValue}>{summary.totalPillars}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('contentMap.avgPerSet')}</Text>
                <Text style={styles.summaryValue}>{summary.avgPillars}</Text>
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 8, marginBottom: 4 }]}>{t('contentMap.purposeDistribution')}</Text>
              <View style={styles.purposeRow}>
                {(Object.keys(PILLAR_PURPOSES) as PillarSlot['purpose'][]).map(pk => {
                  const cnt = summary.purposeCount[pk] ?? 0;
                  if (cnt === 0) return null;
                  const meta = PILLAR_PURPOSES[pk];
                  return (
                    <View key={pk} style={[styles.purposeChip, { borderColor: meta.color }]}>
                      <Text style={styles.purposeChipEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.purposeChipCount, { color: meta.color }]}>{cnt}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length === 0 ? (
            <Text style={styles.empty}>{t('contentMap.emptyList')}</Text>
          ) : (
            list.map(e => {
              const open = openId === e.id;
              return (
                <View key={e.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : e.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryNiche}>
                        {nicheIcon(e.niche)} {nicheLabel(e.niche)}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {t('contentMap.pillarCountMeta', { count: e.pillars.length, date: formatDate(e.createdAt) })}
                      </Text>
                    </View>
                    <Text style={styles.entryChevron}>{open ? '▲' : '▼'}</Text>
                  </Pressable>

                  {open && (
                    <View style={styles.entryDetail}>
                      <View style={styles.barRow}>
                        {e.pillars.map((p, idx) => (
                          <View
                            key={`${p.name}-${idx}`}
                            style={[styles.bar, { flex: p.ratio, backgroundColor: p.color }]}
                          />
                        ))}
                      </View>

                      {e.pillars.map((p, idx) => {
                        const purpose = PILLAR_PURPOSES[p.purpose];
                        return (
                          <View key={`${p.name}-${idx}`} style={styles.entryPillarRow}>
                            <View style={[styles.pillarColorBar, { backgroundColor: p.color }]} />
                            <View style={styles.pillarBody}>
                              <Text style={styles.pillarName}>{p.name}</Text>
                              <Text style={styles.pillarRatio}>
                                {purpose.emoji} {purpose.label} · %{p.ratio}
                              </Text>
                              <View style={styles.examplesRow}>
                                {p.examples.map((ex, j) => (
                                  <View key={j} style={styles.exampleChip}>
                                    <Text style={styles.exampleText}>{ex}</Text>
                                  </View>
                                ))}
                              </View>
                              <Pressable
                                onPress={() => onCopy(t('contentMap.copyFormat', { name: p.name, purpose: purpose.label, examples: p.examples.join(', ') }))}
                                style={styles.pillarCopyBtn}
                              >
                                <Text style={styles.pillarCopyBtnText}>{t('contentMap.copyBtn')}</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}

                      <Text style={styles.entryLabel}>{t('contentMap.notesLabel')}</Text>
                      <TextInput
                        value={notesDraft[e.id] ?? e.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [e.id]: txt }))}
                        placeholder={t('contentMap.notesPlaceholder')}
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
                          <Text style={styles.smallBtnText}>{t('contentMap.saveNotesBtn')}</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(e.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
                          <Text style={[styles.smallBtnText, { color: '#F97316' }]}>{t('contentMap.deleteBtn')}</Text>
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
          <Text style={styles.backBtnText}>{t('contentMap.backBtn')}</Text>
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
  previewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  barRow: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  bar: { height: '100%' },
  barCaption: { color: '#94a3b8', fontSize: 11, marginBottom: 16, fontStyle: 'italic' },
  pillarRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillarColorBar: { width: 4 },
  pillarBody: { flex: 1, padding: 10 },
  pillarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  pillarName: { color: '#f8fafc', fontSize: 14, fontWeight: '700', flex: 1 },
  pillarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  pillarPillEmoji: { fontSize: 11 },
  pillarPillText: { fontSize: 10, fontWeight: '700' },
  pillarRatio: { color: '#cbd5e1', fontSize: 12, marginBottom: 4 },
  pillarTip: { color: '#94a3b8', fontSize: 11, marginBottom: 8, fontStyle: 'italic' },
  examplesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  exampleChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  exampleText: { color: '#cbd5e1', fontSize: 11 },
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
  purposeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  purposeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  purposeChipEmoji: { fontSize: 12 },
  purposeChipCount: { fontSize: 13, fontWeight: '700' },
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
  entryNiche: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  entryMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  entryChevron: { color: '#94a3b8', fontSize: 14 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryPillarRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  pillarCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    marginTop: 6,
  },
  pillarCopyBtnText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
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
