import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PostingOverride,
  PostingPlatform,
  buildPostingHeatmap,
  clearPostingOverride,
  currentSlotLive,
  getPostingOverrides,
  setPostingOverride,
  slotMeta,
} from '../services/storage';

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const POSTING_PLATFORMS: { id: PostingPlatform; label: string; emoji: string; color: string }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: '#000000' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', color: '#FF0000' },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
  { id: 'blog', label: 'Blog / SEO', emoji: '📝', color: '#10B981' },
];

const HOUR_LABELS: string[] = Array.from({ length: 24 }, (_, h) =>
  h === 0 ? '00' : h === 12 ? '12' : h < 12 ? String(h) : String(h)
);

export default function PostingHeatmapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [platform, setPlatform] = useState<PostingPlatform>('instagram');
  const [overrides, setOverrides] = useState<PostingOverride[]>([]);
  const [selected, setSelected] = useState<{ day: number; hour: number } | null>(null);

  const load = useCallback(async () => {
    const o = await getPostingOverrides();
    setOverrides(o);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const grid = useMemo(() => buildPostingHeatmap(platform, overrides), [platform, overrides]);
  const platformMeta = useMemo(
    () => POSTING_PLATFORMS.find(p => p.id === platform) ?? POSTING_PLATFORMS[0],
    [platform]
  );

  const live = useMemo(() => currentSlotLive(platform, overrides), [platform, overrides]);

  const topSlots = useMemo(() => {
    const flat: { day: number; hour: number; score: number }[] = [];
    grid.forEach(row => row.forEach(s => flat.push(s)));
    return flat
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [grid]);

  const cellColor = (score: number): string => {
    const meta = slotMeta(score);
    const opacities: Record<string, string> = {
      'Altın saat': meta.color,
      'Pozitif pencere': meta.color,
      'Nötr': meta.color,
      'Sakin': meta.color,
      'Uyku': meta.color,
    };
    return opacities[meta.label] ?? meta.color;
  };

  const cellOpacity = (score: number): number => {
    if (score >= 14) return 1;
    if (score >= 11) return 0.85;
    if (score >= 8) return 0.6;
    if (score >= 5) return 0.4;
    return 0.18;
  };

  const handleCellPress = (day: number, hour: number) => {
    setSelected({ day, hour });
  };

  const handleBump = async (delta: number) => {
    if (!selected) return;
    const slot = grid[selected.day][selected.hour];
    const newScore = Math.max(0, Math.min(20, slot.score + delta));
    const next = await setPostingOverride({ platform, cell: `${selected.day}-${selected.hour}`, score: newScore });
    setOverrides(next);
  };

  const handleReset = async () => {
    if (!selected) return;
    const next = await clearPostingOverride(platform, `${selected.day}-${selected.hour}`);
    setOverrides(next);
  };

  const handleClearAllPlatform = () => {
    Alert.alert(
      'Bu platformun override\'ları silinsin mi?',
      'Tüm manuel düzeltmeler kaldırılır, varsayılan eğriye dönülür.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            const filtered = overrides.filter(o => o.platform !== platform);
            await Promise.all(
              overrides
                .filter(o => o.platform === platform)
                .map(o => clearPostingOverride(platform, o.cell))
            );
            setOverrides(filtered);
            setToast('Varsayılana dönüldü ✓');
          },
        },
      ]
    );
  };

  const [toast, setToastState] = useState<string | null>(null);
  const setToast = (msg: string | null) => {
    setToastState(msg);
    if (msg) setTimeout(() => setToastState(null), 1600);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Posting Time Heatmap', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>⏰ Posting Time Heatmap</Text>
          <Text style={styles.heroSub}>
            Gün × saat matrisinde, platforma göre paylaşım için en güçlü anlar. Hücreye dokun,
            skorunu override et; canlı gösterge \"şu an paylaşmalı mıyım?\" sorusunu yanıtlar.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Platform</Text>
          <View style={styles.chipRow}>
            {POSTING_PLATFORMS.map(p => {
              const active = platform === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: p.color, borderColor: p.color },
                  ]}
                  onPress={() => {
                    setPlatform(p.id);
                    setSelected(null);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {p.emoji} {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { borderLeftWidth: 4, borderLeftColor: live.meta.color }]}>
          <Text style={styles.liveLabel}>📍 Şu an</Text>
          <Text style={[styles.liveHeadline, { color: live.meta.color }]}>
            {live.meta.emoji} {live.meta.label} — skor {live.slot.score}
          </Text>
          <Text style={styles.liveText}>
            {DAY_LABELS[live.slot.day]} · {HOUR_LABELS[live.slot.hour]}:00
          </Text>
          <Text style={styles.liveTip}>{live.recommendation}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.heatmapHeader}>
            <Text style={styles.sectionTitle}>Isı Haritası</Text>
            <View style={styles.legendRow}>
              <LegendCell color="#10B981" opacity={1} label="Altın" />
              <LegendCell color="#22C55E" opacity={0.85} label="İyi" />
              <LegendCell color="#F59E0B" opacity={0.6} label="Nötr" />
              <LegendCell color="#F97316" opacity={0.4} label="Sakin" />
              <LegendCell color="#475569" opacity={0.18} label="Uyku" />
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.hourRow}>
                <View style={styles.dayColSpacer} />
                {HOUR_LABELS.map((h, i) => (
                  <View key={i} style={styles.hourLabelCell}>
                    <Text style={styles.hourLabel}>{h}</Text>
                  </View>
                ))}
              </View>
              {grid.map((row, day) => (
                <View key={day} style={styles.dayRow}>
                  <View style={styles.dayCol}>
                    <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
                  </View>
                  {row.map(slot => {
                    const isSelected = selected?.day === day && selected?.hour === slot.hour;
                    return (
                      <Pressable
                        key={slot.hour}
                        style={[
                          styles.cell,
                          {
                            backgroundColor: cellColor(slot.score),
                            opacity: cellOpacity(slot.score),
                          },
                          isSelected && styles.cellActive,
                        ]}
                        onPress={() => handleCellPress(day, slot.hour)}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {selected ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Seçili hücre — {DAY_LABELS[selected.day]} · {HOUR_LABELS[selected.hour]}:00
            </Text>
            {(() => {
              const slot = grid[selected.day][selected.hour];
              const meta = slotMeta(slot.score);
              return (
                <>
                  <View style={[styles.scoreRow, { borderColor: meta.color }]}>
                    <Text style={[styles.scoreText, { color: meta.color }]}>
                      {meta.emoji} {meta.label}
                    </Text>
                    <Text style={styles.scoreNum}>skor: {slot.score}</Text>
                  </View>
                  <Text style={styles.tipText}>{meta.tip}</Text>

                  <View style={styles.bumpRow}>
                    <Pressable style={[styles.bumpBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleBump(-2)}>
                      <Text style={styles.bumpText}>−2</Text>
                    </Pressable>
                    <Pressable style={[styles.bumpBtn, { backgroundColor: '#F97316' }]} onPress={() => handleBump(-1)}>
                      <Text style={styles.bumpText}>−1</Text>
                    </Pressable>
                    <Pressable style={[styles.bumpBtn, { backgroundColor: '#10B981' }]} onPress={() => handleBump(+1)}>
                      <Text style={styles.bumpText}>+1</Text>
                    </Pressable>
                    <Pressable style={[styles.bumpBtn, { backgroundColor: '#059669' }]} onPress={() => handleBump(+2)}>
                      <Text style={styles.bumpText}>+2</Text>
                    </Pressable>
                  </View>
                  <Pressable style={styles.resetBtn} onPress={handleReset}>
                    <Text style={styles.resetText}>↺ Override'ı temizle</Text>
                  </Pressable>
                </>
              );
            })()}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Top 5 Pencere — {platformMeta.label}</Text>
          {topSlots.map((s, i) => {
            const meta = slotMeta(s.score);
            return (
              <View key={i} style={styles.topRow}>
                <Text style={[styles.topNum, { color: meta.color }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topDay}>
                    {DAY_LABELS[s.day]} · {HOUR_LABELS[s.hour]}:00
                  </Text>
                  <Text style={styles.topMeta}>
                    {meta.emoji} {meta.label} · skor {s.score}
                  </Text>
                </View>
              </View>
            );
          })}
          {overrides.some(o => o.platform === platform) ? (
            <Pressable style={styles.clearAllBtn} onPress={handleClearAllPlatform}>
              <Text style={styles.clearAllText}>↺ Tüm override'ları temizle</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const LegendCell: React.FC<{ color: string; opacity: number; label: string }> = ({ color, opacity, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendBox, { backgroundColor: color, opacity }]} />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  heroTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  heroSub: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 14, marginBottom: 16 },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  liveLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  liveHeadline: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  liveText: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
  liveTip: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },

  heatmapHeader: { marginBottom: 8 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendBox: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { color: '#94a3b8', fontSize: 10 },

  hourRow: { flexDirection: 'row', marginBottom: 4 },
  dayColSpacer: { width: 36 },
  hourLabelCell: { width: 24, alignItems: 'center' },
  hourLabel: { color: '#64748b', fontSize: 9, fontWeight: '600' },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  dayCol: { width: 36 },
  dayLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  cell: {
    width: 22,
    height: 22,
    borderRadius: 4,
    marginRight: 2,
  },
  cellActive: { borderWidth: 2, borderColor: '#f8fafc' },

  scoreRow: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreText: { fontSize: 14, fontWeight: '700' },
  scoreNum: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  tipText: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  bumpRow: { flexDirection: 'row', gap: 6 },
  bumpBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  bumpText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resetBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  resetText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },

  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  topNum: { fontSize: 18, fontWeight: '700', width: 26 },
  topDay: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  topMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  clearAllBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  clearAllText: { color: '#f87171', fontSize: 12, fontWeight: '700' },

  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});