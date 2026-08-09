import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  ScheduleEntry,
  addScheduleEntry,
  cloneWeekSchedule,
  clearScheduleForDate,
  getScheduleForWeek,
  getStoredNiche,
  removeScheduleEntry,
  toggleScheduleEntry,
  updateScheduleEntry,
} from '../services/storage';
import { NicheId, pickRandomFromPool } from '../services/contentService';
import niches from '../data/niches.json';
import i18n from '../i18n';

type Niche = { id: string; icon: string; color: string };
const NICHE_MAP = (niches as Niche[]).reduce((acc, n) => {
  acc[n.id] = n;
  return acc;
}, {} as Record<string, Niche>);

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const startOfWeek = (d: Date): Date => {
  const day = (d.getDay() + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
};

const addDays = (d: Date, n: number): Date => {
  const next = new Date(d);
  next.setDate(d.getDate() + n);
  return next;
};

const DAY_KEY = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];
const SHORT_KEY = ['shortMon', 'shortTue', 'shortWed', 'shortThu', 'shortFri', 'shortSat', 'shortSun'];
const MONTH_KEY = ['monthJan', 'monthFeb', 'monthMar', 'monthApr', 'monthMay', 'monthJun', 'monthJul', 'monthAug', 'monthSep', 'monthOct', 'monthNov', 'monthDec'];

export default function WeeklyPlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<ScheduleEntry[] | null>(null);
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftNiche, setDraftNiche] = useState<NicheId | null>(null);
  const [pickerNiche, setPickerNiche] = useState(false);

  const todayKey = useMemo(() => dateKey(new Date()), []);

  const load = useCallback(async () => {
    const [list, stored] = await Promise.all([
      getScheduleForWeek(dateKey(weekStart)),
      getStoredNiche(),
    ]);
    setEntries(list);
    if (stored && !niche) setNiche(stored);
    if (!draftNiche && stored) setDraftNiche(stored);
  }, [weekStart, niche, draftNiche]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goPrev = () => {
    setEntries(null);
    setWeekStart((s) => addDays(s, -7));
  };
  const goNext = () => {
    setEntries(null);
    setWeekStart((s) => addDays(s, 7));
  };
  const goToday = () => {
    setEntries(null);
    setWeekStart(startOfWeek(new Date()));
  };

  const dayEntries = (dayIdx: number): ScheduleEntry[] => {
    if (!entries) return [];
    const key = dateKey(addDays(weekStart, dayIdx));
    return entries.filter((e) => e.date === key);
  };

  const openAdd = (dayIdx: number) => {
    setShowAdd(dateKey(addDays(weekStart, dayIdx)));
    setDraftText('');
    setDraftNote('');
  };

  const onSaveAdd = async () => {
    if (!showAdd) return;
    const text = draftText.trim();
    if (text.length === 0) {
      Alert.alert(t('weeklyPlan.noIdeaTitle'), t('weeklyPlan.noIdeaBody'));
      return;
    }
    await addScheduleEntry(text, showAdd, draftNiche ?? niche, draftNote.trim() || undefined);
    setShowAdd(null);
    setDraftText('');
    setDraftNote('');
    await load();
  };

  const onPickFromPool = async () => {
    const useNiche = (draftNiche ?? niche ?? 'personal_dev') as NicheId;
    const idea = pickRandomFromPool(useNiche);
    if (!idea) {
      Alert.alert(t('weeklyPlan.poolEmptyTitle'), t('weeklyPlan.poolEmptyBody'));
      return;
    }
    setDraftText(idea);
  };

  const onToggle = async (id: string) => {
    const next = await toggleScheduleEntry(id);
    setEntries(next.filter((e) => e.date >= dateKey(weekStart) && e.date <= dateKey(addDays(weekStart, 6))));
  };

  const onRemove = (entry: ScheduleEntry) => {
    Alert.alert(t('weeklyPlan.removeTitle'), t('weeklyPlan.removeBody', { text: `"${entry.text.slice(0, 40)}${entry.text.length > 40 ? '…' : ''}"` }), [
      { text: t('weeklyPlan.cancelBtn'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const next = await removeScheduleEntry(entry.id);
          setEntries(next.filter((e) => e.date >= dateKey(weekStart) && e.date <= dateKey(addDays(weekStart, 6))));
        },
      },
    ]);
  };

  const onClearDay = (dayIdx: number) => {
    const key = dateKey(addDays(weekStart, dayIdx));
    const items = dayEntries(dayIdx);
    if (items.length === 0) return;
    Alert.alert(
      t('weeklyPlan.clearDayTitle'),
      t('weeklyPlan.clearDayBody', { day: t(`weeklyPlan.${DAY_KEY[dayIdx]}`), count: items.length }),
      [
        { text: t('weeklyPlan.cancelBtn'), style: 'cancel' },
        {
          text: t('weeklyPlan.clearDayBtn'),
          style: 'destructive',
          onPress: async () => {
            const next = await clearScheduleForDate(key);
            setEntries(next.filter((e) => e.date >= dateKey(weekStart) && e.date <= dateKey(addDays(weekStart, 6))));
          },
        },
      ]
    );
  };

  const onCloneWeek = () => {
    Alert.alert(
      t('weeklyPlan.cloneWeekTitle'),
      t('weeklyPlan.cloneWeekBody'),
      [
        { text: t('weeklyPlan.cancelBtn'), style: 'cancel' },
        {
          text: t('weeklyPlan.cloneConfirmBtn'),
          onPress: async () => {
            const nextStart = addDays(weekStart, 7);
            await cloneWeekSchedule(dateKey(weekStart), dateKey(nextStart));
            Alert.alert(t('weeklyPlan.cloneDoneTitle'), t('weeklyPlan.cloneDoneBody'));
          },
        },
      ]
    );
  };

  const onEditNote = async (entry: ScheduleEntry) => {
    Alert.prompt?.(
      t('weeklyPlan.editNoteTitle'),
      t('weeklyPlan.editNoteBody'),
      [
        { text: t('weeklyPlan.cancelBtn'), style: 'cancel' },
        {
          text: t('weeklyPlan.saveBtn'),
          onPress: async (val) => {
            const next = await updateScheduleEntry(entry.id, { note: val?.trim() || undefined } as Partial<Pick<ScheduleEntry, 'note'>>);
            setEntries(next.filter((e) => e.date >= dateKey(weekStart) && e.date <= dateKey(addDays(weekStart, 6))));
          },
        },
      ],
      'plain-text',
      entry.note ?? ''
    );
    if (!Alert.prompt) {
      Alert.alert(t('weeklyPlan.alertNotSupportedTitle'), t('weeklyPlan.alertNotSupportedBody'));
    }
  };

  const totalPlanned = entries?.length ?? 0;
  const totalDone = entries?.filter((e) => e.done).length ?? 0;
  const totalUpcoming = entries?.filter((e) => !e.done && e.date >= todayKey).length ?? 0;

  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${weekStart.getDate()} ${t(`weeklyPlan.${MONTH_KEY[weekStart.getMonth()]}`)} – ${weekEnd.getDate()} ${t(`weeklyPlan.${MONTH_KEY[weekEnd.getMonth()]}`)} ${weekEnd.getFullYear()}`;

  if (!entries) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  const NICHE_LIST = Object.entries(NICHE_MAP);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>{t('weeklyPlan.backBtn')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('weeklyPlan.title')}</Text>
        <Pressable onPress={onCloneWeek} style={styles.cloneBtn}>
          <Text style={styles.cloneBtnTxt}>{t('weeklyPlan.cloneBtn')}</Text>
        </Pressable>
      </View>

      <View style={styles.rangeRow}>
        <Pressable onPress={goPrev} style={styles.rangeBtn}>
          <Text style={styles.rangeBtnTxt}>‹</Text>
        </Pressable>
        <Pressable onPress={goToday} style={styles.rangeCenter}>
          <Text style={styles.rangeLabel}>{rangeLabel}</Text>
          <Text style={styles.rangeHint}>{t('weeklyPlan.rangeHint')}</Text>
        </Pressable>
        <Pressable onPress={goNext} style={styles.rangeBtn}>
          <Text style={styles.rangeBtnTxt}>›</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <Stat label={t('weeklyPlan.statPlanned')} value={totalPlanned} color="#7c5cff" />
        <Stat label={t('weeklyPlan.statDone')} value={totalDone} color="#10B981" />
        <Stat label={t('weeklyPlan.statUpcoming')} value={totalUpcoming} color="#F59E0B" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
      >
        {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
          const day = addDays(weekStart, dayIdx);
          const key = dateKey(day);
          const isToday = key === todayKey;
          const items = dayEntries(dayIdx);
          const doneCount = items.filter((e) => e.done).length;
          return (
            <View key={key} style={[styles.dayCard, isToday && styles.dayCardToday]}>
              <View style={styles.dayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dayTitle, isToday && styles.dayTitleToday]}>
                    {t(`weeklyPlan.${DAY_KEY[dayIdx]}`)} {isToday ? t('weeklyPlan.today') : ''}
                  </Text>
                  <Text style={styles.dayDate}>
                    {day.getDate()} {t(`weeklyPlan.${MONTH_KEY[day.getMonth()]}`)} · {t('weeklyPlan.doneFraction', { done: doneCount, total: items.length })}
                  </Text>
                </View>
                {items.length > 0 && (
                  <Pressable onPress={() => onClearDay(dayIdx)} style={styles.dayClearBtn} hitSlop={6}>
                    <Text style={styles.dayClearBtnTxt}>🗑</Text>
                  </Pressable>
                )}
              </View>

              {items.length === 0 ? (
                <Text style={styles.dayEmpty}>{t('weeklyPlan.dayEmpty')}</Text>
              ) : (
                items.map((entry) => {
                  const meta = NICHE_MAP[entry.niche];
                  return (
                    <View key={entry.id} style={[styles.entryRow, entry.done && styles.entryRowDone]}>
                      <Pressable
                        onPress={() => onToggle(entry.id)}
                        style={[styles.entryCheck, entry.done && styles.entryCheckDone]}
                      >
                        <Text style={[styles.entryCheckTxt, entry.done && styles.entryCheckTxtDone]}>
                          {entry.done ? '✓' : ''}
                        </Text>
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.entryText, entry.done && styles.entryTextDone]} numberOfLines={2}>
                          {entry.text}
                        </Text>
                        <View style={styles.entryMeta}>
                          {meta && (
                            <Text style={styles.entryNiche}>
                              {meta.icon} {t(`niches.${entry.niche}`, entry.niche)}
                            </Text>
                          )}
                          {entry.note && <Text style={styles.entryNote}>📝 {entry.note}</Text>}
                        </View>
                      </View>
                      <Pressable onPress={() => onEditNote(entry)} style={styles.entryAction} hitSlop={6}>
                        <Text style={styles.entryActionTxt}>📝</Text>
                      </Pressable>
                      <Pressable onPress={() => onRemove(entry)} style={styles.entryAction} hitSlop={6}>
                        <Text style={styles.entryActionTxt}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })
              )}

              <Pressable onPress={() => openAdd(dayIdx)} style={styles.dayAddBtn}>
                <Text style={styles.dayAddBtnTxt}>{t('weeklyPlan.dayAddBtn')}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {showAdd ? t('weeklyPlan.modalTitleFmt', {
                short: t(`weeklyPlan.${SHORT_KEY[(new Date(showAdd).getDay() + 6) % 7]}`),
                day: new Date(showAdd).getDate(),
                month: t(`weeklyPlan.${MONTH_KEY[new Date(showAdd).getMonth()]}`),
              }) : ''}
            </Text>

            <TextInput
              value={draftText}
              onChangeText={setDraftText}
              placeholder={t('weeklyPlan.draftTextPlaceholder')}
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
              multiline
              maxLength={200}
              autoFocus
            />

            <Pressable onPress={onPickFromPool} style={styles.modalPickBtn}>
              <Text style={styles.modalPickBtnTxt}>{t('weeklyPlan.pickFromPool')}</Text>
            </Pressable>

            <TextInput
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder={t('weeklyPlan.notePlaceholder')}
              placeholderTextColor="#9CA3AF"
              style={[styles.modalInput, { marginTop: 8, minHeight: 50 }]}
              maxLength={80}
            />

            <Text style={styles.modalLabel}>{t('weeklyPlan.nicheLabel')}</Text>
            <Pressable onPress={() => setPickerNiche(true)} style={styles.modalNicheBtn}>
              <Text style={styles.modalNicheBtnTxt}>
                {draftNiche && NICHE_MAP[draftNiche]
                  ? `${NICHE_MAP[draftNiche].icon} ${t(`niches.${draftNiche}`, draftNiche)}`
                  : t('weeklyPlan.nicheSelectPlaceholder')}
              </Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowAdd(null)} style={[styles.modalBtn, styles.modalBtnCancel]}>
                <Text style={styles.modalBtnCancelTxt}>{t('weeklyPlan.cancelBtn')}</Text>
              </Pressable>
              <Pressable onPress={onSaveAdd} style={[styles.modalBtn, styles.modalBtnSave]}>
                <Text style={styles.modalBtnSaveTxt}>{t('weeklyPlan.saveBtn')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pickerNiche} animationType="slide" transparent onRequestClose={() => setPickerNiche(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('weeklyPlan.modalNichePickerTitle')}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {NICHE_LIST.map(([id, m]) => (
                <Pressable
                  key={id}
                  onPress={() => {
                    setDraftNiche(id as NicheId);
                    setPickerNiche(false);
                  }}
                  style={styles.nicheRow}
                >
                  <Text style={styles.nicheIcon}>{m.icon}</Text>
                  <Text style={styles.nicheLabel}>{t(`niches.${id}`, id)}</Text>
                  {draftNiche === id && <Text style={styles.nicheCheck}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setPickerNiche(false)} style={[styles.modalBtn, styles.modalBtnCancel, { marginTop: 10 }]}>
              <Text style={styles.modalBtnCancelTxt}>{t('weeklyPlan.closeBtn')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const Stat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={styles.statBox}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backTxt: { fontSize: 16, color: '#4D96FF', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  cloneBtn: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#7c5cff', borderRadius: 8 },
  cloneBtnTxt: { color: 'white', fontWeight: '700', fontSize: 12 },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  rangeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  rangeBtnTxt: { fontSize: 20, color: '#374151', fontWeight: '800' },
  rangeCenter: {
    flex: 1, alignItems: 'center',
  },
  rangeLabel: { fontSize: 14, fontWeight: '800', color: '#111827' },
  rangeHint: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayCardToday: { borderColor: '#7c5cff', borderWidth: 2, backgroundColor: '#FAF5FF' },
  dayHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  dayTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  dayTitleToday: { color: '#7c5cff' },
  dayDate: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  dayClearBtn: { padding: 4 },
  dayClearBtnTxt: { fontSize: 16 },
  dayEmpty: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  entryRowDone: { opacity: 0.65 },
  entryCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#C7D2FE',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'white',
  },
  entryCheckDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  entryCheckTxt: { fontSize: 12, color: 'white', fontWeight: '800' },
  entryCheckTxtDone: { color: 'white' },
  entryText: { fontSize: 13, color: '#111827', fontWeight: '600', lineHeight: 18 },
  entryTextDone: { textDecorationLine: 'line-through', color: '#6B7280' },
  entryMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  entryNiche: { fontSize: 10, color: '#7c5cff', fontWeight: '700' },
  entryNote: { fontSize: 10, color: '#6B7280', fontStyle: 'italic' },
  entryAction: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  entryActionTxt: { fontSize: 13, color: '#374151', fontWeight: '700' },
  dayAddBtn: {
    marginTop: 8,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
  },
  dayAddBtnTxt: { fontSize: 12, fontWeight: '700', color: '#7c5cff' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 14 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    color: '#111827',
  },
  modalPickBtn: {
    marginTop: 8,
    paddingVertical: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalPickBtnTxt: { color: '#4338CA', fontWeight: '700', fontSize: 12 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 8 },
  modalNicheBtn: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalNicheBtnTxt: { fontSize: 13, color: '#111827', fontWeight: '700' },
  modalActions: { flexDirection: 'row', marginTop: 20, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#F3F4F6' },
  modalBtnCancelTxt: { color: '#374151', fontWeight: '700' },
  modalBtnSave: { backgroundColor: '#7c5cff' },
  modalBtnSaveTxt: { color: 'white', fontWeight: '700' },
  nicheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  nicheIcon: { fontSize: 18, marginRight: 12 },
  nicheLabel: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '600' },
  nicheCheck: { fontSize: 16, color: '#10B981', fontWeight: '800' },
});
