import React, { useCallback, useMemo, useState } from 'react';
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
import { HeatmapData, HeatmapDay, getHeatmapData, getScheduleForDate } from '../services/storage';

const MONTH_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DAY_LABELS = ['', 'Pzt', '', 'Çar', '', 'Cum', ''];

const cellColor = (planned: number, done: number, isToday: boolean): string => {
  if (isToday) return '#7c5cff';
  const score = done * 2 + planned;
  if (score === 0) return '#F3F4F6';
  if (score >= 5) return '#15803D';
  if (score >= 3) return '#22C55E';
  if (score >= 1) return '#86EFAC';
  return '#DCFCE7';
};

const dayIntensity = (planned: number, done: number, isToday: boolean): 'today' | 'none' | 'low' | 'mid' | 'high' => {
  if (isToday) return 'today';
  const score = done * 2 + planned;
  if (score === 0) return 'none';
  if (score >= 5) return 'high';
  if (score >= 3) return 'mid';
  return 'low';
};

export default function HeatmapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HeatmapData | null>(null);
  const [selected, setSelected] = useState<HeatmapDay | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const load = useCallback(async () => {
    const d = await getHeatmapData(365);
    setData(d);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const grid = useMemo(() => {
    if (!data) return null;
    const days = data.days;
    const firstDay = new Date(days[0].date);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const cells: (HeatmapDay | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (const d of days) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { weeks, firstDay };
  }, [data]);

  const monthLabels = useMemo(() => {
    if (!grid) return [] as { weekIdx: number; label: string }[];
    const labels: { weekIdx: number; label: string }[] = [];
    let lastMonth = -1;
    grid.weeks.forEach((week, wIdx) => {
      for (const cell of week) {
        if (!cell) continue;
        const d = new Date(cell.date);
        const m = d.getMonth();
        if (m !== lastMonth) {
          labels.push({ weekIdx: wIdx, label: MONTH_TR[m] });
          lastMonth = m;
          break;
        }
      }
    });
    return labels;
  }, [grid]);

  const onPick = async (day: HeatmapDay) => {
    setSelected(day);
    const items = await getScheduleForDate(day.date);
    setSelectedItems(items.map((e) => e.text));
  };

  if (!data || !grid) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Geri</Text>
        </Pressable>
        <Text style={styles.title}>🗓 İçerik Haritası</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={styles.subtitle}>
        Son 365 günde hangi günlerde içerik ürettin veya planladın. Koyu hücreler daha yoğun günleri gösterir.
      </Text>

      <View style={styles.statsRow}>
        <Stat label="Aktif gün" value={data.activeDays} color="#10B981" />
        <Stat label="Planlı" value={data.totalPlanned} color="#4D96FF" />
        <Stat label="Üretildi" value={data.totalDone} color="#7c5cff" />
      </View>

      <View style={styles.streakRow}>
        <View style={styles.streakBox}>
          <Text style={styles.streakNum}>{data.currentStreak}</Text>
          <Text style={styles.streakLbl}>şimdiki seri</Text>
        </View>
        <View style={styles.streakBox}>
          <Text style={styles.streakNum}>{data.longestStreak}</Text>
          <Text style={styles.streakLbl}>en uzun seri</Text>
        </View>
        <View style={styles.streakBox}>
          <Text style={styles.streakNum}>{data.maxDone}</Text>
          <Text style={styles.streakLbl}>en yoğun gün</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heatmapScroll}>
        <View>
          <View style={styles.monthLabelRow}>
            {monthLabels.map((m) => (
              <Text key={`${m.weekIdx}-${m.label}`} style={[styles.monthLabel, { left: m.weekIdx * 13 + 24 }]}>
                {m.label}
              </Text>
            ))}
          </View>
          <View style={styles.gridRow}>
            <View style={styles.dayLabelCol}>
              {DAY_LABELS.map((d, i) => (
                <Text key={i} style={styles.dayLabel}>{d}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {grid.weeks.map((week, wIdx) => (
                <View key={`w-${wIdx}`} style={styles.weekCol}>
                  {week.map((cell, dIdx) => {
                    if (!cell) return <View key={`empty-${wIdx}-${dIdx}`} style={styles.cell} />;
                    const intensity = dayIntensity(cell.planned, cell.done, cell.isToday);
                    return (
                      <Pressable
                        key={cell.date}
                        onPress={() => onPick(cell)}
                        style={[
                          styles.cell,
                          { backgroundColor: cellColor(cell.planned, cell.done, cell.isToday) },
                          selected?.date === cell.date && styles.cellSelected,
                          intensity === 'today' && styles.cellToday,
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.legendRow}>
        <Text style={styles.legendLbl}>Az</Text>
        {[0, 1, 2, 4, 6].map((score) => (
          <View
            key={score}
            style={[styles.legendCell, { backgroundColor: cellColor(score > 5 ? 0 : score % 2, score > 5 ? 3 : Math.floor(score / 2), false) }]}
          />
        ))}
        <Text style={styles.legendLbl}>Çok</Text>
      </View>

      <View style={styles.detailCard}>
        {selected ? (
          <View>
            <View style={styles.detailHeader}>
              <Text style={styles.detailDate}>
                {new Date(selected.date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {selected.isToday ? ' · bugün' : ''}
              </Text>
              <Pressable onPress={() => setSelected(null)} style={styles.detailClose}>
                <Text style={styles.detailCloseTxt}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.detailStatsRow}>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatNum}>{selected.planned}</Text>
                <Text style={styles.detailStatLbl}>planlanan</Text>
              </View>
              <View style={styles.detailStat}>
                <Text style={[styles.detailStatNum, { color: '#7c5cff' }]}>{selected.done}</Text>
                <Text style={styles.detailStatLbl}>üretildi</Text>
              </View>
            </View>
            {selectedItems.length > 0 ? (
              <View style={styles.detailList}>
                {selectedItems.map((t, i) => (
                  <Text key={`${i}-${t}`} style={styles.detailItem} numberOfLines={2}>• {t}</Text>
                ))}
              </View>
            ) : (
              <Text style={styles.detailEmpty}>Bu gün için plan yok.</Text>
            )}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>👆</Text>
            <Text style={styles.placeholderTxt}>
              Detayları görmek için bir güne dokun. Koyu yeşil = çok yoğun, açık yeşil = az içerik.
            </Text>
          </View>
        )}
      </View>
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
  subtitle: { fontSize: 13, color: '#6B7280', paddingHorizontal: 16, marginBottom: 12 },
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
  streakRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  streakBox: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  streakNum: { fontSize: 18, fontWeight: '800', color: 'white' },
  streakLbl: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  heatmapScroll: { paddingHorizontal: 16, paddingVertical: 8 },
  monthLabelRow: { height: 16, position: 'relative', marginBottom: 4 },
  monthLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
  },
  gridRow: { flexDirection: 'row' },
  dayLabelCol: { marginRight: 4, justifyContent: 'flex-start' },
  dayLabel: {
    height: 12,
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '700',
    textAlignVertical: 'center',
  },
  grid: { flexDirection: 'row' },
  weekCol: { marginRight: 2 },
  cell: {
    width: 11,
    height: 11,
    borderRadius: 2,
    marginBottom: 2,
    backgroundColor: '#F3F4F6',
  },
  cellSelected: { borderWidth: 2, borderColor: '#111827' },
  cellToday: { borderWidth: 1.5, borderColor: '#7c5cff' },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 6,
  },
  legendCell: {
    width: 11,
    height: 11,
    borderRadius: 2,
  },
  legendLbl: { fontSize: 10, color: '#6B7280', fontWeight: '700' },
  detailCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailDate: { fontSize: 13, fontWeight: '800', color: '#111827', flex: 1 },
  detailClose: { padding: 4 },
  detailCloseTxt: { fontSize: 14, color: '#6B7280', fontWeight: '800' },
  detailStatsRow: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  detailStat: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  detailStatNum: { fontSize: 20, fontWeight: '800', color: '#4D96FF' },
  detailStatLbl: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  detailList: { marginTop: 4 },
  detailItem: { fontSize: 12, color: '#374151', marginBottom: 4, lineHeight: 17 },
  detailEmpty: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  placeholder: { alignItems: 'center', paddingVertical: 16 },
  placeholderIcon: { fontSize: 24, marginBottom: 6 },
  placeholderTxt: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingHorizontal: 16, lineHeight: 18 },
});