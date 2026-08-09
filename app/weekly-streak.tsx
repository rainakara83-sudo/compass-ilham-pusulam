import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  WeeklyStreakData,
  WeeklyStreakDay,
  WeeklyStreakWeek,
  getWeeklyStreakData,
} from '../services/storage';

const formatRange = (ws: string, we: string, months: string[]): string => {
  const a = new Date(ws);
  const b = new Date(we);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) {
    return `${a.getDate()}-${b.getDate()} ${months[a.getMonth()]}`;
  }
  return `${a.getDate()} ${months[a.getMonth()]} - ${b.getDate()} ${months[b.getMonth()]}`;
};

const dayFill = (day: WeeklyStreakDay): string => {
  if (day.isToday) return '#7c5cff';
  if (!day.hasActivity) return day.isFuture ? '#FAFAFB' : '#F3F4F6';
  const score = day.done * 2 + day.planned;
  if (score >= 5) return '#15803D';
  if (score >= 3) return '#22C55E';
  if (score >= 1) return '#86EFAC';
  return '#DCFCE7';
};

const dayTextColor = (day: WeeklyStreakDay): string => {
  if (day.isToday) return '#fff';
  if (!day.hasActivity) return '#9CA3AF';
  if (day.done * 2 + day.planned >= 3) return '#fff';
  return '#064E3B';
};

export default function WeeklyStreakScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [data, setData] = useState<WeeklyStreakData | null>(null);
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<WeeklyStreakDay | null>(null);

  const MONTH_LABELS = (t('weeklyStreak.month', { returnObjects: true }) as string[]) || [];
  const LOCALE_TAG = (() => {
    const l = (i18n.language || 'en').split('-')[0];
    return l === 'tr' ? 'tr-TR' : l === 'es' ? 'es-ES' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US';
  })();

  const load = useCallback(async () => {
    const d = await getWeeklyStreakData(8);
    setData(d);
    setViewIdx((cur) => (cur === null ? d.currentWeekIndex : cur));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  const idx = viewIdx ?? data.currentWeekIndex;
  const week: WeeklyStreakWeek = data.weeks[idx] ?? data.weeks[data.currentWeekIndex];
  const overallCompletion = data.totalPlanned > 0 ? data.totalDone / data.totalPlanned : 0;
  const goalRate = data.weeklyGoal > 0 ? Math.min(1, week.doneTotal / data.weeklyGoal) : 0;
  const isCurrent = week.isCurrent;

  const renderWeekRow = (w: WeeklyStreakWeek) => (
    <View
      key={w.weekId}
      style={[
        styles.weekRow,
        w.isCurrent && styles.weekRowCurrent,
        w.weekId === week.weekId && styles.weekRowActive,
      ]}
    >
      <View style={styles.weekRowLabelCol}>
        <Text style={styles.weekRowRange}>{formatRange(w.startDate, w.endDate, MONTH_LABELS)}</Text>
        <Text style={styles.weekRowMeta}>
          {w.activeDays}/7 gün • {w.doneTotal} içerik
        </Text>
      </View>
      <View style={styles.weekRowDots}>
        {w.days.map((d) => (
          <View
            key={d.date}
            style={[
              styles.weekRowDot,
              { backgroundColor: dayFill(d) },
              d.isToday && styles.weekRowDotToday,
            ]}
          />
        ))}
      </View>
      {w.goalAchieved ? (
        <Text style={styles.weekRowBadge}>🏆</Text>
      ) : w.doneTotal > 0 ? (
        <Text style={styles.weekRowBadgeSoft}>•</Text>
      ) : (
        <Text style={styles.weekRowBadgeSoft}>–</Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFB' }}>
      <Stack.Screen
        options={{
          title: t('weeklyStreak.title'),
          headerStyle: { backgroundColor: '#FAFAFB' },
          headerTitleStyle: { color: '#111827', fontWeight: '700' },
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>{t('weeklyStreak.thisWeek')}</Text>
              <Text style={styles.heroTitle}>{t('weeklyStreak.thisWeekContent', { count: week.doneTotal })}</Text>
              <Text style={styles.heroSub}>
                {formatRange(week.startDate, week.endDate, MONTH_LABELS)} •{' '}
                {t('weeklyStreak.thisWeekDays', { count: week.activeDays })}
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{t('weeklyStreak.weeklyRate', { count: data.weeklyGoal })}</Text>
            </View>
          </View>

          <View style={styles.goalBarTrack}>
            <View
              style={[
                styles.goalBarFill,
                { width: `${Math.round(goalRate * 100)}%` },
                week.goalAchieved && styles.goalBarFillDone,
              ]}
            />
          </View>
          <View style={styles.goalBarMeta}>
            <Text style={styles.goalBarText}>
              {week.goalAchieved
                ? t('weeklyStreak.goalComplete', { target: data.weeklyGoal })
                : t('weeklyStreak.goalRemaining', { count: Math.max(0, data.weeklyGoal - week.doneTotal) })}
            </Text>
            <Text style={styles.goalBarPct}>{Math.round(goalRate * 100)}%</Text>
          </View>

          <View style={styles.daysRow}>
            {week.days.map((d) => {
              const isSel = selectedDay?.date === d.date;
              return (
                <Pressable
                  key={d.date}
                  onPress={() => setSelectedDay(isSel ? null : d)}
                  style={[
                    styles.dayCell,
                    { backgroundColor: dayFill(d) },
                    d.isToday && styles.dayCellToday,
                    isSel && styles.dayCellSelected,
                  ]}
                >
                  <Text style={[styles.dayLabel, { color: dayTextColor(d) }]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.dayCount, { color: dayTextColor(d) }]}>
                    {d.done > 0 ? d.done : d.isFuture ? '·' : '–'}
                  </Text>
                  {d.isToday && <View style={styles.todayDot} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {selectedDay && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>
              {new Date(selectedDay.date).toLocaleDateString(LOCALE_TAG, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailItemLabel}>{t('weeklyStreak.colPlanned')}</Text>
                <Text style={styles.detailItemVal}>{selectedDay.planned}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailItemLabel}>{t('weeklyStreak.colDone')}</Text>
                <Text style={[styles.detailItemVal, { color: '#22C55E' }]}>
                  {selectedDay.done}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailItemLabel}>{t('weeklyStreak.colStatus')}</Text>
                <Text style={styles.detailItemVal}>
                  {selectedDay.isFuture
                    ? t('weeklyStreak.statusUpcoming')
                    : selectedDay.hasActivity
                    ? t('weeklyStreak.statusActive')
                    : t('weeklyStreak.statusEmpty')}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>🔥 {data.currentWeekDone}</Text>
            <Text style={styles.statLabel}>{t('weeklyStreak.statThisWeek')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>🏆 {data.bestWeekDone}</Text>
            <Text style={styles.statLabel}>{t('weeklyStreak.statBestWeek')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>⭐ {data.achievedWeeks}</Text>
            <Text style={styles.statLabel}>{t('weeklyStreak.statOnGoal')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>💎 {data.perfectWeeks}</Text>
            <Text style={styles.statLabel}>{t('weeklyStreak.statPerfect')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>📊 {Math.round(overallCompletion * 100)}%</Text>
            <Text style={styles.statLabel}>{t('weeklyStreak.statFillRate')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>� {data.totalDone}</Text>
            <Text style={styles.statLabel}>{t('weeklyStreak.statTotal')}</Text>
          </View>
        </View>

        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>{t('weeklyStreak.last9')}</Text>
            <View style={styles.timelineNav}>
              <Pressable
                onPress={() => setViewIdx((cur) => Math.max(0, (cur ?? idx) - 1))}
                style={styles.navBtn}
                hitSlop={8}
              >
                <Text style={styles.navBtnText}>‹</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setViewIdx((cur) => Math.min(data.weeks.length - 1, (cur ?? idx) + 1))
                }
                style={styles.navBtn}
                hitSlop={8}
              >
                <Text style={styles.navBtnText}>›</Text>
              </Pressable>
            </View>
          </View>
          {data.weeks.slice().reverse().map(renderWeekRow)}
        </View>

        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>{t('weeklyStreak.scaleTitle')}</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendBox, { backgroundColor: '#F3F4F6' }]} />
            <Text style={styles.legendText}>{t('weeklyStreak.scaleEmpty')}</Text>
            <View style={[styles.legendBox, { backgroundColor: '#DCFCE7' }]} />
            <Text style={styles.legendText}>{t('weeklyStreak.scaleLow')}</Text>
            <View style={[styles.legendBox, { backgroundColor: '#86EFAC' }]} />
            <Text style={styles.legendText}>{t('weeklyStreak.scaleMid')}</Text>
            <View style={[styles.legendBox, { backgroundColor: '#22C55E' }]} />
            <Text style={styles.legendText}>{t('weeklyStreak.scaleHigh')}</Text>
            <View style={[styles.legendBox, { backgroundColor: '#15803D' }]} />
            <Text style={styles.legendText}>{t('weeklyStreak.scaleMax')}</Text>
            <View style={[styles.legendBox, { backgroundColor: '#7c5cff' }]} />
            <Text style={styles.legendText}>{t('weeklyStreak.scaleToday')}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/weekly-planner')}
          style={styles.ctaBtn}
        >
          <Text style={styles.ctaText}>{t('weeklyStreak.openPlanner')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 14 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c5cff',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  heroSub: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  heroBadge: {
    backgroundColor: '#F3F0FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '700', color: '#7c5cff' },
  goalBarTrack: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 16,
  },
  goalBarFill: {
    height: '100%',
    backgroundColor: '#7c5cff',
    borderRadius: 999,
  },
  goalBarFillDone: { backgroundColor: '#22C55E' },
  goalBarMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  goalBarText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  goalBarPct: { fontSize: 12, color: '#7c5cff', fontWeight: '800' },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dayCell: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dayCellToday: { borderWidth: 2, borderColor: '#7c5cff' },
  dayCellSelected: { borderWidth: 2, borderColor: '#111827' },
  dayLabel: { fontSize: 11, fontWeight: '700' },
  dayCount: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7c5cff',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },
  detailRow: { flexDirection: 'row', gap: 10 },
  detailItem: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  detailItemLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  detailItemVal: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statVal: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 2, fontWeight: '600' },
  timelineCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  timelineNav: { flexDirection: 'row', gap: 6 },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 18, color: '#111827', fontWeight: '700', lineHeight: 20 },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  weekRowCurrent: { backgroundColor: '#F3F0FF' },
  weekRowActive: { borderWidth: 1, borderColor: '#7c5cff' },
  weekRowLabelCol: { width: 110 },
  weekRowRange: { fontSize: 13, fontWeight: '700', color: '#111827' },
  weekRowMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  weekRowDots: { flexDirection: 'row', gap: 3, flex: 1 },
  weekRowDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  weekRowDotToday: { borderWidth: 2, borderColor: '#7c5cff' },
  weekRowBadge: { fontSize: 18, marginLeft: 8 },
  weekRowBadgeSoft: { fontSize: 14, color: '#9CA3AF', marginLeft: 8, fontWeight: '700' },
  legendCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  legendTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 2,
  },
  legendText: { fontSize: 11, color: '#374151', marginRight: 8, fontWeight: '600' },
  ctaBtn: {
    backgroundColor: '#7c5cff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
