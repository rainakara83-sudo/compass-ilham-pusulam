import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../services/theme';
import i18n from '../../i18n';
import niches from '../../data/niches.json';
import { checkAchievements } from '../../services/achievements';
import {
  ScheduleEntry,
  addScheduleEntry,
  getSchedule,
  getScheduleForMonth,
  getScheduleStats,
  getFavoritesDetailed,
  getStoredNiche,
  removeScheduleEntry,
  toggleScheduleEntry,
} from '../../services/storage';
import { NicheId, pickRandomFromPool } from '../../services/contentService';
import { generateWeeklyIdeasWithAIResult } from '../../services/aiService';
import PlanBadge from '../../components/PlanBadge';
import PageHint from '../../components/PageHint';

type Niche = { id: string; icon: string; color: string };
const NICHE_MAP = (niches as Niche[]).reduce((acc, n) => {
  acc[n.id] = n;
  return acc;
}, {} as Record<string, Niche>);

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const buildMonthGrid = (year: number, month: number): (number | null)[] => {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export default function CalendarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark } = useTheme();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string>(dateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [newText, setNewText] = useState('');
  const [stats, setStats] = useState({ planned: 0, done: 0, upcoming: 0 });
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'write' | 'favorites' | 'pool' | 'ai'>('write');
  const [favorites, setFavorites] = useState<{ text: string; addedAt: number }[]>([]);
  const [poolSuggestions, setPoolSuggestions] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [planRefresh, setPlanRefresh] = useState(0);
  const [view, setView] = useState<'calendar' | 'reminders'>('calendar');

  const load = useCallback(async () => {
    const [list, monthList, st, favs, n] = await Promise.all([
      getSchedule(),
      getScheduleForMonth(cursor.year, cursor.month),
      getScheduleStats(),
      getFavoritesDetailed(),
      getStoredNiche(),
    ]);
    setSchedule(list);
    setStats(st);
    setFavorites(favs);
    setNiche(n);
    void monthList;
  }, [cursor]);

  useFocusEffect(
    useCallback(() => {
      load();
      setPlanRefresh((x) => x + 1);
    }, [load])
  );

  const byDate = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    for (const e of schedule) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [schedule]);

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const selectedEntries = byDate[selectedDate] ?? [];

  const goPrev = () => {
    setCursor((c) => {
      const m = c.month - 1;
      if (m < 0) return { year: c.year - 1, month: 11 };
      return { year: c.year, month: m };
    });
  };
  const goNext = () => {
    setCursor((c) => {
      const m = c.month + 1;
      if (m > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: m };
    });
  };

  const onAdd = async () => {
    const text = newText.trim();
    if (!text) {
      Alert.alert(t('calendar.emptyAlertTitle'), t('calendar.emptyAlertMsg'));
      return;
    }
    await addScheduleEntry(text, selectedDate, niche, undefined);
    void checkAchievements();
    setNewText('');
    await load();
  };

  const openPicker = (tab: typeof pickerTab) => {
    setPickerTab(tab);
    setShowPicker(true);
    if (tab === 'pool') {
      const picks: string[] = [];
      for (let i = 0; i < 5; i++) {
        const p = niche ? pickRandomFromPool(niche, picks) : null;
        if (!p) break;
        picks.push(p);
      }
      setPoolSuggestions(picks);
    }
    if (tab === 'ai' && aiSuggestions.length === 0) {
      void runAISuggestions();
    }
  };

  const runAISuggestions = async () => {
    if (!niche) {
      setAiSuggestions([]);
      Alert.alert(t('calendar.nicheAlertTitle'), t('calendar.nicheAlertMsg'));
      return;
    }
    setAiLoading(true);
    const result = await generateWeeklyIdeasWithAIResult(niche, schedule.map((s) => s.text));
    setAiSuggestions(result.ideas.map((i) => i.text));
    setAiLoading(false);
  };

  const onPickIdea = async (text: string) => {
    await addScheduleEntry(text, selectedDate, niche, undefined);
    void checkAchievements();
    setShowPicker(false);
    setAiSuggestions([]);
    setPoolSuggestions([]);
    await load();
  };

  const onToggle = async (id: string) => {
    await toggleScheduleEntry(id);
    await load();
  };

  const onRemove = (id: string) => {
    Alert.alert(t('calendar.deleteAlertTitle'), t('calendar.deleteAlertMsg'), [
      { text: t('calendar.cancelBtn'), style: 'cancel' },
      {
        text: t('calendar.deleteBtn'),
        style: 'destructive',
        onPress: async () => {
          await removeScheduleEntry(id);
          await load();
        },
      },
    ]);
  };

  const onUseFavorites = () => {
    openPicker('favorites');
  };

  const isToday = (d: number) =>
    isSameDay(new Date(cursor.year, cursor.month, d), today);
  const isPast = (d: number) =>
    new Date(cursor.year, cursor.month, d).getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#5C6B4F' }]} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <PageHint hintId="calendar" title={t('pageHints.calendar.title')} description={t('pageHints.calendar.desc')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={[styles.title, { color: isDark ? '#FAFCF6' : '#111827' }]}>📅 {t('calendar.title')}</Text>
        <PlanBadge size="sm" refreshKey={planRefresh} />
      </View>
      <Text style={[styles.subtitle, { color: isDark ? '#CBD5E1' : '#6B7280' }]}>{t('calendar.subtitle')}</Text>

      <View style={[styles.subTabBar, { backgroundColor: isDark ? '#1E293B' : 'white', borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
        <Pressable
          onPress={() => setView('calendar')}
          style={[
            styles.subTab,
            view === 'calendar' && {
              backgroundColor: isDark ? '#60A5FA22' : '#4D96FF22',
              borderColor: isDark ? '#60A5FA' : '#4D96FF',
            },
          ]}
        >
          <Text style={[styles.subTabLabel, { color: view === 'calendar' ? (isDark ? '#60A5FA' : '#4D96FF') : (isDark ? '#CBD5E1' : '#6B7280'), fontWeight: view === 'calendar' ? '800' : '700' }]}>
            📅 {t('calendar.tabCalendar')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setView('reminders')}
          style={[
            styles.subTab,
            view === 'reminders' && {
              backgroundColor: isDark ? '#60A5FA22' : '#4D96FF22',
              borderColor: isDark ? '#60A5FA' : '#4D96FF',
            },
          ]}
        >
          <Text style={[styles.subTabLabel, { color: view === 'reminders' ? (isDark ? '#60A5FA' : '#4D96FF') : (isDark ? '#CBD5E1' : '#6B7280'), fontWeight: view === 'reminders' ? '800' : '700' }]}>
            🔔 {t('calendar.tabReminders')}
          </Text>
        </Pressable>
      </View>

      {view === 'reminders' ? (
        <RemindersView
          schedule={schedule}
          isDark={isDark}
        />
      ) : null}

      <Pressable onPress={() => router.push('/weekly-planner')} style={styles.weekPlannerBtn}>
        <View style={{ flex: 1 }}>
          <Text style={styles.weekPlannerTitle}>{t('calendar.weekPlannerTitle')}</Text>
          <Text style={styles.weekPlannerSub}>{t('calendar.weekPlannerSub')}</Text>
        </View>
        <Text style={styles.weekPlannerChev}>›</Text>
      </Pressable>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{stats.planned}</Text>
          <Text style={styles.statLabel}>{t('calendar.statPlanned')}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.done}</Text>
          <Text style={styles.statLabel}>{t('calendar.statDone')}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: '#4D96FF' }]}>{stats.upcoming}</Text>
          <Text style={styles.statLabel}>{t('calendar.statUpcoming')}</Text>
        </View>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable onPress={goPrev} style={styles.navBtn}>
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {new Intl.DateTimeFormat((i18n.language || 'en').split('-')[0], { month: 'long' }).format(new Date(cursor.year, cursor.month, 1)).replace(/^./, (c) => c.toLocaleUpperCase((i18n.language || 'en').split('-')[0]))} {cursor.year}
          </Text>
          <Pressable onPress={goNext} style={styles.navBtn}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {(['mon','tue','wed','thu','fri','sat','sun'] as const).map((k) => (
            <Text key={k} style={styles.weekLabel}>{t(`weekdays.${k}`)}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {cells.map((day, idx) => {
            if (day === null) return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
            const key = dateKey(cursor.year, cursor.month, day);
            const isSelected = key === selectedDate;
            const entries = byDate[key] ?? [];
            const todayMark = isToday(day);
            const past = isPast(day);
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedDate(key)}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  todayMark && !isSelected && styles.dayCellToday,
                ]}
              >
                <Text style={[
                  styles.dayText,
                  isSelected && styles.dayTextSelected,
                  todayMark && !isSelected && styles.dayTextToday,
                  past && !isSelected && styles.dayTextPast,
                ]}>
                  {day}
                </Text>
                {entries.length > 0 && (
                  <View style={styles.dotsRow}>
                    {entries.slice(0, 3).map((e, i) => {
                      const color = e.done
                        ? '#10B981'
                        : isSameDay(new Date(cursor.year, cursor.month, day), today) || new Date(key).getTime() > today.getTime()
                          ? '#4D96FF'
                          : '#9CA3AF';
                      return <View key={`${e.id}-${i}`} style={[styles.dot, { backgroundColor: color }]} />;
                    })}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.dayHeader}>
        <Text style={styles.dayHeaderTitle}>📌 {new Date(selectedDate).toLocaleDateString((i18n.language || 'en'), { weekday: 'long', day: '2-digit', month: 'long' })}</Text>
        <Text style={styles.dayHeaderCount}>{t('calendar.dayHeaderCount', { count: selectedEntries.length })}</Text>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder={t('calendar.addIdeaPlaceholder')}
          value={newText}
          onChangeText={setNewText}
          placeholderTextColor="#9CA3AF"
        />
        <Pressable onPress={() => openPicker('write')} style={styles.addBtn}>
          <Text style={styles.addBtnText}>＋</Text>
        </Pressable>
      </View>
      <View style={styles.shortcutRow}>
        <Pressable onPress={() => openPicker('favorites')} style={styles.shortcutChip}>
          <Text style={styles.shortcutIcon}>⭐</Text>
          <Text style={styles.shortcutLabel}>{t('calendar.shortcutFavorites')}</Text>
        </Pressable>
        <Pressable onPress={() => openPicker('pool')} style={styles.shortcutChip}>
          <Text style={styles.shortcutIcon}>📚</Text>
          <Text style={styles.shortcutLabel}>{t('calendar.shortcutPool')}</Text>
        </Pressable>
        <Pressable onPress={() => openPicker('ai')} style={styles.shortcutChip}>
          <Text style={styles.shortcutIcon}>✨</Text>
          <Text style={styles.shortcutLabel}>{t('calendar.shortcutAi')}</Text>
        </Pressable>
      </View>

      {selectedEntries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyText}>{t('calendar.emptyDay')}</Text>
        </View>
      ) : (
        selectedEntries.map((e) => {
          const nicheMeta = NICHE_MAP[e.niche];
          return (
            <View key={e.id} style={[styles.entryCard, e.done && styles.entryCardDone]}>
              <View style={[styles.entryIconWrap, { backgroundColor: (nicheMeta?.color ?? '#4D96FF') + '20' }]}>
                <Text style={styles.entryIcon}>{nicheMeta?.icon ?? '✨'}</Text>
              </View>
              <Pressable onPress={() => onToggle(e.id)} style={{ flex: 1 }}>
                <Text style={[styles.entryText, e.done && styles.entryTextDone]} numberOfLines={3}>{e.text}</Text>
                {e.note && <Text style={styles.entryNote}>{e.note}</Text>}
                <Text style={styles.entryMeta}>
                  {e.done ? t('calendar.entryDone') : isPast(new Date(e.date).getDate()) ? t('calendar.entryPast') : t('calendar.entryWaiting')}
                </Text>
              </Pressable>
              <Pressable onPress={() => onRemove(e.id)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>🗑</Text>
              </Pressable>
            </View>
          );
        })
      )}

      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('calendar.modalTitle')}</Text>
              <Pressable onPress={() => setShowPicker(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.tabRow}>
              {([
                { id: 'write', icon: '✍️', label: t('calendar.tabWrite') },
                { id: 'favorites', icon: '⭐', label: t('calendar.tabFavorites') },
                { id: 'pool', icon: '📚', label: t('calendar.tabPool') },
                { id: 'ai', icon: '✨', label: t('calendar.tabAi') },
              ] as const).map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => openPicker(tab.id)}
                  style={[styles.tabChip, pickerTab === tab.id && styles.tabChipActive]}
                >
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                  <Text style={[styles.tabLabel, pickerTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {pickerTab === 'write' && (
                <View>
                  <Text style={styles.modalHint}>{t('calendar.modalHintWrite')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={t('calendar.ideaPlaceholder')}
                    value={newText}
                    onChangeText={setNewText}
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                  <Pressable
                    onPress={async () => {
                      await onAdd();
                      setShowPicker(false);
                    }}
                    style={[styles.modalSubmit, !newText.trim() && { opacity: 0.4 }]}
                    disabled={!newText.trim()}
                  >
                    <Text style={styles.modalSubmitText}>{t('calendar.modalAddBtn')}</Text>
                  </Pressable>
                </View>
              )}

              {pickerTab === 'favorites' && (
                <View>
                  {favorites.length === 0 ? (
                    <Text style={styles.modalHint}>{t('calendar.modalFavEmpty')}</Text>
                  ) : (
                    favorites.map((f, idx) => (
                      <Pressable
                        key={`${f.text}-${idx}`}
                        onPress={() => onPickIdea(f.text)}
                        style={styles.modalIdeaCard}
                      >
                        <Text style={styles.modalIdeaText}>{f.text}</Text>
                        <Text style={styles.modalIdeaChev}>›</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              {pickerTab === 'pool' && (
                <View>
                  {!niche ? (
                    <Text style={styles.modalHint}>{t('calendar.modalPickNiche')}</Text>
                  ) : poolSuggestions.length === 0 ? (
                    <Text style={styles.modalHint}>{t('calendar.modalPoolEmpty')}</Text>
                  ) : (
                    poolSuggestions.map((s, idx) => (
                      <Pressable key={`${s}-${idx}`} onPress={() => onPickIdea(s)} style={styles.modalIdeaCard}>
                        <Text style={styles.modalIdeaText}>{s}</Text>
                        <Text style={styles.modalIdeaChev}>›</Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable onPress={() => openPicker('pool')} style={styles.modalRefresh}>
                    <Text style={styles.modalRefreshText}>{t('calendar.modalRefresh')}</Text>
                  </Pressable>
                </View>
              )}

              {pickerTab === 'ai' && (
                <View>
                  {!niche ? (
                    <Text style={styles.modalHint}>{t('calendar.modalPickNiche')}</Text>
                  ) : aiLoading ? (
                    <View style={styles.modalLoading}>
                      <ActivityIndicator color="#4D96FF" />
                      <Text style={styles.modalHint}>{t('calendar.modalAiLoading')}</Text>
                    </View>
                  ) : aiSuggestions.length === 0 ? (
                    <Text style={styles.modalHint}>{t('calendar.modalAiEmpty')}</Text>
                  ) : (
                    aiSuggestions.map((s, idx) => (
                      <Pressable key={`${s}-${idx}`} onPress={() => onPickIdea(s)} style={styles.modalIdeaCard}>
                        <Text style={styles.modalIdeaText}>{s}</Text>
                        <Text style={styles.modalIdeaChev}>›</Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable onPress={runAISuggestions} style={styles.modalRefresh}>
                    <Text style={styles.modalRefreshText}>{t('calendar.modalAiRegen')}</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function RemindersView(props: { schedule: ScheduleEntry[]; isDark: boolean }) {
  const { schedule, isDark } = props;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const upcoming = schedule
    .filter((e) => !e.done && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
  const todayItems = schedule.filter((e) => e.date === today && !e.done);
  const tomorrowItems = schedule.filter((e) => e.date === tomorrow && !e.done);
  const cardBg = isDark ? '#1E293B' : 'white';
  const borderColor = isDark ? '#334155' : '#E5E7EB';
  const textColor = isDark ? '#FAFCF6' : '#111827';
  const subText = isDark ? '#CBD5E1' : '#6B7280';
  const accent = isDark ? '#60A5FA' : '#4D96FF';

  return (
    <View>
      <View style={[styles.reminderCard, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.reminderTitle, { color: textColor }]}>📆 Bugün</Text>
        {todayItems.length === 0 ? (
          <Text style={[styles.reminderEmpty, { color: subText }]}>Bugün için planlanmış hatırlatıcı yok.</Text>
        ) : (
          todayItems.map((e) => (
            <View key={e.id} style={[styles.reminderItem, { borderColor }]}>
              <Text style={[styles.reminderItemText, { color: textColor }]}>{e.text}</Text>
            </View>
          ))
        )}
      </View>

      <View style={[styles.reminderCard, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.reminderTitle, { color: textColor }]}>⏭ Yarın</Text>
        {tomorrowItems.length === 0 ? (
          <Text style={[styles.reminderEmpty, { color: subText }]}>Yarın için planlanmış hatırlatıcı yok.</Text>
        ) : (
          tomorrowItems.map((e) => (
            <View key={e.id} style={[styles.reminderItem, { borderColor }]}>
              <Text style={[styles.reminderItemText, { color: textColor }]}>{e.text}</Text>
            </View>
          ))
        )}
      </View>

      <View style={[styles.reminderCard, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.reminderTitle, { color: textColor }]}>🗓 Yaklaşan ({upcoming.length})</Text>
        {upcoming.length === 0 ? (
          <Text style={[styles.reminderEmpty, { color: subText }]}>Yaklaşan hatırlatıcı yok.</Text>
        ) : (
          upcoming.map((e) => (
            <View key={e.id} style={[styles.reminderItem, { borderColor }]}>
              <Text style={[styles.reminderDate, { color: accent }]}>{e.date}</Text>
              <Text style={[styles.reminderItemText, { color: textColor }]}>{e.text}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C6B4F' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: 50 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  subTabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
  },
  subTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subTabActive: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  subTabLabel: { fontSize: 13 },
  reminderCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  reminderTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  reminderEmpty: { fontSize: 12, fontStyle: 'italic', paddingVertical: 6 },
  reminderItem: {
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  reminderItemText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  reminderDate: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  weekPlannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#7c5cff',
    shadowColor: '#7c5cff',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  weekPlannerTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  weekPlannerSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  weekPlannerChev: { fontSize: 28, color: '#7c5cff', fontWeight: '300' },
  statChip: {
    flex: 1, backgroundColor: 'white', paddingVertical: 12,
    borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 10, color: '#6B7280', marginTop: 2, fontWeight: '700' },
  calendarCard: {
    backgroundColor: 'white', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16,
  },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  navBtnText: { fontSize: 22, color: '#374151', fontWeight: '700', lineHeight: 24 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 4, borderRadius: 10,
  },
  dayCellEmpty: { width: `${100 / 7}%`, aspectRatio: 1 },
  dayCellSelected: { backgroundColor: '#4D96FF' },
  dayCellToday: { backgroundColor: '#DBEAFE' },
  dayText: { fontSize: 14, color: '#111827', fontWeight: '600' },
  dayTextSelected: { color: 'white', fontWeight: '800' },
  dayTextToday: { color: '#1E40AF', fontWeight: '800' },
  dayTextPast: { color: '#9CA3AF' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  dayHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#111827', textTransform: 'capitalize' },
  dayHeaderCount: { fontSize: 12, color: '#6B7280', fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  addInput: {
    flex: 1, backgroundColor: 'white', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: '#111827', borderWidth: 1, borderColor: '#E5E7EB',
  },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#4D96FF', justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: 'white', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  favHint: { marginBottom: 12 },
  favHintText: { fontSize: 11, color: '#6B7280', fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingVertical: 30, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  emptyIcon: { fontSize: 32, marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#6B7280' },
  entryCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'white',
    padding: 12, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 10,
  },
  entryCardDone: { backgroundColor: '#F0FDF4', borderColor: '#10B981' },
  entryIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  entryIcon: { fontSize: 18 },
  entryText: { fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  entryTextDone: { textDecorationLine: 'line-through', color: '#6B7280' },
  entryNote: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  entryMeta: { fontSize: 10, color: '#6B7280', marginTop: 4, fontWeight: '700' },
  removeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { fontSize: 14 },
  shortcutRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  shortcutChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'white', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 6,
  },
  shortcutIcon: { fontSize: 14 },
  shortcutLabel: { fontSize: 11, fontWeight: '700', color: '#374151' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { fontSize: 14, color: '#374151', fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tabChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: 'white', gap: 4,
  },
  tabChipActive: { backgroundColor: '#4D96FF', borderColor: '#4D96FF' },
  tabIcon: { fontSize: 14 },
  tabLabel: { fontSize: 11, fontWeight: '700', color: '#374151' },
  tabLabelActive: { color: 'white' },
  modalBody: { paddingBottom: 12 },
  modalHint: { fontSize: 12, color: '#6B7280', marginBottom: 10, fontWeight: '600' },
  modalInput: {
    backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#111827', minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10,
  },
  modalSubmit: { backgroundColor: '#4D96FF', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSubmitText: { color: 'white', fontWeight: '800', fontSize: 14 },
  modalIdeaCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    padding: 12, borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 10,
  },
  modalIdeaText: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500', lineHeight: 20 },
  modalIdeaChev: { fontSize: 20, color: '#9CA3AF', fontWeight: '700' },
  modalRefresh: { alignSelf: 'center', marginTop: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EEF2FF' },
  modalRefreshText: { fontSize: 12, color: '#4338CA', fontWeight: '700' },
  modalLoading: { alignItems: 'center', paddingVertical: 20, gap: 8 },
});