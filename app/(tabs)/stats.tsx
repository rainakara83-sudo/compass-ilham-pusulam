import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Stats,
  getStats,
  getIdeaStats,
  IdeaStats,
  getWeeklyTrend,
  WeeklyTrendPoint,
  getDailyDoneTrend,
  DailyDonePoint,
  getProductionPace,
  ProductionPace,
  getConsistencyScore,
  ConsistencyScore,
} from '../../services/storage';

type Tile = { key: keyof Stats; label: string; icon: string; color: string };

const TILES: Tile[] = [
  { key: 'totalWeeks', label: 'Toplam Hafta', icon: '📅', color: '#4D96FF' },
  { key: 'totalIdeas', label: 'Üretilen Fikir', icon: '💡', color: '#F59E0B' },
  { key: 'totalFavorites', label: 'Favori', icon: '⭐', color: '#EC4899' },
  { key: 'totalReminders', label: 'Hatırlatıcı', icon: '🔔', color: '#10B981' },
];

const NICHE_COLORS = ['#4D96FF', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#06B6D4'];

export default function StatsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [ideaStats, setIdeaStats] = useState<IdeaStats | null>(null);
  const [trend, setTrend] = useState<WeeklyTrendPoint[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyDonePoint[]>([]);
  const [pace, setPace] = useState<ProductionPace | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyScore | null>(null);

  const load = useCallback(async () => {
    const [s, is, tr, dt, pc, cs] = await Promise.all([
      getStats(),
      getIdeaStats(),
      getWeeklyTrend(8),
      getDailyDoneTrend(7),
      getProductionPace(),
      getConsistencyScore(4),
    ]);
    setStats(s);
    setIdeaStats(is);
    setTrend(tr);
    setDailyTrend(dt);
    setPace(pc);
    setConsistency(cs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!stats || !ideaStats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const nicheEntries = Object.entries(ideaStats.nicheBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const nicheMax = nicheEntries.length > 0 ? nicheEntries[0][1] : 0;
  const trendMax = trend.length > 0 ? Math.max(...trend.map((p) => p.count)) : 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <Text style={styles.title}>📊 İstatistikler</Text>
      <Text style={styles.subtitle}>
        {stats.lastWeekId ? `Son hafta: ${stats.lastWeekId}` : 'Henüz veri yok'}
      </Text>

      <Pressable onPress={() => router.push('/heatmap')} style={styles.heatmapCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heatmapTitle}>🗓 İçerik Haritası</Text>
          <Text style={styles.heatmapSub}>
            Son 365 günün ısı haritası — hangi günlerde ürettin gör
          </Text>
        </View>
        <Text style={styles.heatmapChev}>›</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/weekly-streak')} style={styles.streakCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.streakTitle}>🔥 Haftalık Streak</Text>
          <Text style={styles.streakSub}>
            Haftalık seri takibi — hedeflerini gör, mükemmel haftaları kutla
          </Text>
        </View>
        <Text style={styles.streakChev}>›</Text>
      </Pressable>

      <View style={styles.grid}>
        {TILES.map((tile) => (
          <View key={tile.key} style={[styles.tile, { borderColor: tile.color }]}>
            <Text style={styles.tileIcon}>{tile.icon}</Text>
            <Text style={[styles.tileValue, { color: tile.color }]}>
              {String(stats[tile.key] ?? 0)}
            </Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏷 Niş dağılımın</Text>
        {nicheEntries.length === 0 ? (
          <Text style={styles.empty}>Henüz veri yok.</Text>
        ) : (
          nicheEntries.map(([id, count], idx) => {
            const pct = nicheMax > 0 ? Math.round((count / nicheMax) * 100) : 0;
            const color = NICHE_COLORS[idx % NICHE_COLORS.length];
            return (
              <View key={id} style={styles.barRow}>
                <View style={styles.barHeader}>
                  <Text style={styles.barLabel}>{t(`niches.${id}`, id)}</Text>
                  <Text style={[styles.barCount, { color }]}>{count}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      {ideaStats.topNiche && (
        <View style={[styles.card, styles.cardHighlight]}>
          <Text style={styles.cardTitle}>🏆 En aktif nişin</Text>
          <Text style={styles.highlightValue}>{ideaStats.topNicheLabel}</Text>
          <Text style={styles.highlightSub}>{ideaStats.topNicheCount} fikir üretildi</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📈 Haftalık trend</Text>
        {trend.length === 0 ? (
          <Text style={styles.empty}>Henüz veri yok.</Text>
        ) : (
          <View style={styles.chartBox}>
            {trend.map((p) => {
              const pct = trendMax > 0 ? Math.round((p.count / trendMax) * 100) : 0;
              return (
                <View key={p.weekId} style={styles.barCol}>
                  <Text style={styles.barColValue}>{p.count}</Text>
                  <View style={styles.barColBg}>
                    <View style={[styles.barColFill, { height: `${pct}%` }]} />
                  </View>
                  <Text style={styles.barColLabel} numberOfLines={1}>{p.weekId.slice(-2)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {ideaStats.mostFrequentIdea && ideaStats.mostFrequentIdea.count > 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔥 Sık çıkan fikir</Text>
          <Text style={styles.repeatText} numberOfLines={3}>{ideaStats.mostFrequentIdea.text}</Text>
          <Text style={styles.repeatCount}>{ideaStats.mostFrequentIdea.count} kez üretildi</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 Son 7 gün aktivite</Text>
        {dailyTrend.length === 0 ? (
          <Text style={styles.empty}>Henüz veri yok.</Text>
        ) : (
          <View style={styles.heatRow}>
            {dailyTrend.map((p) => {
              const intensity = p.count === 0 ? 0 : Math.min(1, 0.3 + p.count * 0.2);
              const bg =
                p.count === 0
                  ? '#F3F4F6'
                  : p.count >= 4
                  ? '#10B981'
                  : p.count >= 2
                  ? '#34D399'
                  : '#A7F3D0';
              const txtColor = p.count === 0 ? '#9CA3AF' : '#064E3B';
              return (
                <View key={p.date} style={styles.heatCell}>
                  <View style={[styles.heatBox, { backgroundColor: bg, opacity: p.count === 0 ? 1 : intensity + 0.5 }]}>
                    <Text style={[styles.heatCount, { color: txtColor }]}>{p.count}</Text>
                  </View>
                  <Text style={styles.heatLabel}>
                    {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'][p.weekday]}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {pace && pace.daysActive > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚡ Üretim hızı</Text>
          <View style={styles.paceRow}>
            <View style={styles.paceItem}>
              <Text style={[styles.paceValue, { color: '#4D96FF' }]}>{pace.ideasPerDay}</Text>
              <Text style={styles.paceLabel}>fikir/gün</Text>
            </View>
            <View style={styles.paceDivider} />
            <View style={styles.paceItem}>
              <Text style={[styles.paceValue, { color: '#10B981' }]}>{pace.donePerDay}</Text>
              <Text style={styles.paceLabel}>tamamlanan/gün</Text>
            </View>
            <View style={styles.paceDivider} />
            <View style={styles.paceItem}>
              <Text style={[styles.paceValue, { color: '#F59E0B' }]}>{pace.daysActive}</Text>
              <Text style={styles.paceLabel}>aktif gün</Text>
            </View>
          </View>
        </View>
      )}

      {consistency && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎯 Tutarlılık skoru</Text>
          <View style={styles.progHeader}>
            <Text style={styles.progLabel}>Son {consistency.totalWeeks} hafta</Text>
            <Text style={[styles.progValue, { color: '#8B5CF6' }]}>%{consistency.score}</Text>
          </View>
          <View style={styles.progBg}>
            <View
              style={[styles.progFill, { width: `${consistency.score}%`, backgroundColor: '#8B5CF6' }]}
            />
          </View>
          <Text style={styles.consistencySub}>
            {consistency.weeksActive}/{consistency.totalWeeks} hafta aktif içerik ürettin
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Hedefler</Text>
        <ProgressRow
          label="Haftalık 3 fikir tamamlandı mı?"
          current={stats.totalIdeas % 3 || 3}
          target={3}
          color="#4D96FF"
        />
        <ProgressRow
          label="Favori sayısı"
          current={Math.min(stats.totalFavorites, 10)}
          target={10}
          color="#F59E0B"
        />
        <ProgressRow
          label="Aktif hatırlatıcılar"
          current={Math.min(stats.totalReminders, 5)}
          target={5}
          color="#10B981"
        />
      </View>

      <Pressable onPress={load} style={styles.refreshBtn}>
        <Text style={styles.refreshBtnText}>🔄 Yenile</Text>
      </Pressable>
    </ScrollView>
  );
}

const ProgressRow: React.FC<{ label: string; current: number; target: number; color: string }> = ({
  label,
  current,
  target,
  color,
}) => {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.progHeader}>
        <Text style={styles.progLabel}>{label}</Text>
        <Text style={[styles.progValue, { color }]}>
          {current}/{target}
        </Text>
      </View>
      <View style={styles.progBg}>
        <View style={[styles.progFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: 50 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  heatmapCard: {
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
  heatmapTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  heatmapSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  heatmapChev: { fontSize: 28, color: '#7c5cff', fontWeight: '300' },
  streakCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  streakTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  streakSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  streakChev: { fontSize: 28, color: '#F59E0B', fontWeight: '300' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  tileIcon: { fontSize: 32, marginBottom: 8 },
  tileValue: { fontSize: 28, fontWeight: '800' },
  tileLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: 'white', padding: 18, borderRadius: 16, marginTop: 8 },
  cardHighlight: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14 },
  empty: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  barRow: { marginBottom: 14 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 13, color: '#374151', fontWeight: '600', textTransform: 'capitalize' },
  barCount: { fontSize: 13, fontWeight: '800' },
  barBg: { height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  highlightValue: { fontSize: 22, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  highlightSub: { fontSize: 12, color: '#78350F', fontWeight: '600' },
  chartBox: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8 },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barColValue: { fontSize: 10, color: '#6B7280', fontWeight: '700', marginBottom: 4 },
  barColBg: { width: '70%', flex: 1, backgroundColor: '#F3F4F6', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barColFill: { width: '100%', backgroundColor: '#4D96FF', borderRadius: 4 },
  barColLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '700', marginTop: 4 },
  repeatText: { fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20, marginBottom: 6 },
  repeatCount: { fontSize: 11, color: '#10B981', fontWeight: '800' },
  progHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  progValue: { fontSize: 13, fontWeight: '700' },
  progBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: 8, borderRadius: 4 },
  refreshBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  refreshBtnText: { color: '#4D96FF', fontWeight: '700' },
  heatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heatCell: { flex: 1, alignItems: 'center' },
  heatBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  heatCount: { fontSize: 13, fontWeight: '800' },
  heatLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  paceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  paceItem: { alignItems: 'center', flex: 1 },
  paceValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  paceLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  paceDivider: { width: 1, height: 40, backgroundColor: '#E5E7EB' },
  consistencySub: { fontSize: 12, color: '#6B7280', marginTop: 8, fontWeight: '500' },
});
