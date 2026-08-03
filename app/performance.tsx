import React, { useCallback, useEffect, useState } from 'react';
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
  PERF_PLATFORMS,
  PERF_FORMATS,
  PERF_OUTCOMES,
  PerfPlatform,
  PerfFormat,
  PerfOutcome,
  PerfEntry,
  PerfInsights,
  PerfStats,
  buildPerfInsights,
  calcPerfScore,
  calcPerfStats,
  savePerfEntry,
  getPerfEntries,
  removePerfEntry,
  clearPerfEntries,
  seedPerfDemoData,
  getStoredNiche,
  addCopyToHistory,
} from '../services/storage';
import { NicheId } from '../services/contentService';

const TREND_LABEL: Record<'up' | 'down' | 'flat', { emoji: string; color: string; label: string }> = {
  up: { emoji: '📈', color: '#10B981', label: 'Yükselişte' },
  down: { emoji: '📉', color: '#EF4444', label: 'Düşüşte' },
  flat: { emoji: '➡️', color: '#94A3B8', label: 'Stabil' },
};

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

export default function PerformanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [entries, setEntries] = useState<PerfEntry[]>([]);
  const [stats, setStats] = useState<PerfStats | null>(null);
  const [insights, setInsights] = useState<PerfInsights | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [newPlatform, setNewPlatform] = useState<PerfPlatform>('instagram');
  const [newFormat, setNewFormat] = useState<PerfFormat>('reel');
  const [newOutcome, setNewOutcome] = useState<PerfOutcome>('high');
  const [newTopic, setNewTopic] = useState('');
  const [newHook, setNewHook] = useState('');
  const [newViews, setNewViews] = useState('');
  const [newLikes, setNewLikes] = useState('');
  const [newComments, setNewComments] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newSaves, setNewSaves] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const n = await getStoredNiche();
    setNiche(n);
    let list = await getPerfEntries();
    if (list.length === 0) {
      list = await seedPerfDemoData();
    }
    setEntries(list);
    setStats(calcPerfStats(list));
    setInsights(buildPerfInsights(list));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleAdd = useCallback(async () => {
    if (!newTopic.trim()) {
      Alert.alert('Konu gerekli', 'İçeriğin konusunu yaz.');
      return;
    }
    const views = parseInt(newViews || '0', 10) || 0;
    if (views <= 0) {
      Alert.alert('View gerekli', 'Görüntülenme sayısını gir.');
      return;
    }
    setSaving(true);
    const entry: PerfEntry = {
      id: `perf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      niche,
      platform: newPlatform,
      format: newFormat,
      topic: newTopic.trim(),
      hookText: newHook.trim() || newTopic.trim(),
      outcome: newOutcome,
      views,
      likes: parseInt(newLikes || '0', 10) || 0,
      comments: parseInt(newComments || '0', 10) || 0,
      shares: parseInt(newShares || '0', 10) || 0,
      saves: parseInt(newSaves || '0', 10) || 0,
      postedAt: Date.now(),
      notes: '',
    };
    const next = await savePerfEntry(entry);
    setEntries(next);
    setStats(calcPerfStats(next));
    setInsights(buildPerfInsights(next));
    setAddOpen(false);
    setSaving(false);
    setNewTopic('');
    setNewHook('');
    setNewViews('');
    setNewLikes('');
    setNewComments('');
    setNewShares('');
    setNewSaves('');
    setToast('📊 Performans kaydı eklendi');
  }, [niche, newPlatform, newFormat, newOutcome, newTopic, newHook, newViews, newLikes, newComments, newShares, newSaves]);

  const handleRemove = useCallback(async (id: string) => {
    const next = await removePerfEntry(id);
    setEntries(next);
    setStats(calcPerfStats(next));
    setInsights(buildPerfInsights(next));
    setToast('🗑️ Kayıt silindi');
  }, []);

  const handleClear = useCallback(() => {
    if (entries.length === 0) return;
    Alert.alert('Tüm kayıtları sil', `${entries.length} performans kaydı silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await clearPerfEntries();
          setEntries([]);
          setStats(null);
          setInsights(null);
          setToast('🧹 Tüm kayıtlar silindi');
        },
      },
    ]);
  }, [entries]);

  const copyInsights = useCallback(async () => {
    if (!insights) return;
    const lines: string[] = [];
    lines.push('📊 PERFORMANS RAPORU');
    lines.push(`Toplam paylaşım: ${insights.totalPosts}`);
    lines.push(`Toplam görüntülenme: ${formatNumber(insights.totalViews)}`);
    lines.push(`Toplam etkileşim: ${formatNumber(insights.totalEngagement)}`);
    lines.push(`Ortalama etkileşim oranı: %${insights.avgEngagementRate.toFixed(2)}`);
    if (insights.bestPlatform) {
      const p = PERF_PLATFORMS.find((pp) => pp.id === insights.bestPlatform);
      lines.push(`En iyi platform: ${p?.emoji} ${p?.label}`);
    }
    if (insights.bestFormat) {
      const f = PERF_FORMATS.find((ff) => ff.id === insights.bestFormat);
      lines.push(`En iyi format: ${f?.emoji} ${f?.label}`);
    }
    if (insights.hookPatterns[0]) {
      lines.push(`En iyi hook stili: ${insights.hookPatterns[0].pattern}`);
    }
    if (insights.topTopics.length > 0) {
      lines.push(`Top konular: ${insights.topTopics.slice(0, 3).map((t) => t.topic).join(', ')}`);
    }
    try {
      Clipboard.setString(lines.join('\n'));
      await addCopyToHistory(lines.join('\n'), 'detail');
      setToast('📋 Rapor kopyalandı');
    } catch {
      setToast('Kopyalama başarısız');
    }
  }, [insights]);

  const trend = stats ? TREND_LABEL[stats.recentTrend] : TREND_LABEL.flat;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Performance Tracker', headerBackTitle: 'Geri' }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>📊 PERFORMANCE TRACKER</Text>
          <Text style={styles.heroTitle}>İçerik performansını analiz et</Text>
          <Text style={styles.heroSub}>
            Hangi platform, format, hook stili tuttu? Trend yukarı mı aşağı mı?
          </Text>
          {stats && (
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{stats.totalPosts}</Text>
                <Text style={styles.heroStatLabel}>paylaşım</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatNumber(stats.totalViews)}</Text>
                <Text style={styles.heroStatLabel}>görüntülenme</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>%{stats.avgEngagementRate.toFixed(1)}</Text>
                <Text style={styles.heroStatLabel}>etkileşim</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: trend.color }]}>{trend.emoji}</Text>
                <Text style={styles.heroStatLabel}>{trend.label}</Text>
              </View>
            </View>
          )}
        </View>

        {insights && stats && stats.totalPosts > 0 && (
          <>
            <View style={styles.bestRow}>
              {insights.bestPlatform && (
                <View style={styles.bestCard}>
                  <Text style={styles.bestLabel}>🏆 EN İYİ PLATFORM</Text>
                  <Text style={styles.bestEmoji}>
                    {PERF_PLATFORMS.find((p) => p.id === insights.bestPlatform)?.emoji}
                  </Text>
                  <Text style={styles.bestName}>
                    {PERF_PLATFORMS.find((p) => p.id === insights.bestPlatform)?.label}
                  </Text>
                </View>
              )}
              {insights.bestFormat && (
                <View style={styles.bestCard}>
                  <Text style={styles.bestLabel}>🎯 EN İYİ FORMAT</Text>
                  <Text style={styles.bestEmoji}>
                    {PERF_FORMATS.find((f) => f.id === insights.bestFormat)?.emoji}
                  </Text>
                  <Text style={styles.bestName}>
                    {PERF_FORMATS.find((f) => f.id === insights.bestFormat)?.label}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.outcomeCard}>
              <Text style={styles.outcomeLabel}>📈 PERFORMANS DAĞILIMI</Text>
              <View style={styles.outcomeRow}>
                {(['high', 'medium', 'low'] as PerfOutcome[]).map((o) => {
                  const info = PERF_OUTCOMES.find((i) => i.id === o)!;
                  const count = stats.outcomeCounts[o];
                  const pct = stats.totalPosts > 0 ? (count / stats.totalPosts) * 100 : 0;
                  return (
                    <View key={o} style={[styles.outcomeChip, { backgroundColor: info.bg, borderColor: info.color }]}>
                      <Text style={[styles.outcomeEmoji]}>{info.emoji}</Text>
                      <Text style={[styles.outcomeName, { color: info.color }]}>{info.label.split(' ')[0]}</Text>
                      <Text style={[styles.outcomeCount, { color: info.color }]}>{count}</Text>
                      <View style={styles.outcomeBarBg}>
                        <View style={[styles.outcomeBarFill, { width: `${pct}%`, backgroundColor: info.color }]} />
                      </View>
                      <Text style={[styles.outcomePct, { color: info.color }]}>%{pct.toFixed(0)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {insights.platformBreakdown.length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>📱 Platform Bazında</Text>
                {insights.platformBreakdown
                  .sort((a, b) => b.avgEngagement - a.avgEngagement)
                  .map((p) => {
                    const info = PERF_PLATFORMS.find((pp) => pp.id === p.platform)!;
                    const max = Math.max(...insights.platformBreakdown.map((x) => x.avgEngagement), 1);
                    const w = (p.avgEngagement / max) * 100;
                    return (
                      <View key={p.platform} style={styles.breakdownRow}>
                        <View style={styles.breakdownLeft}>
                          <Text style={styles.breakdownEmoji}>{info.emoji}</Text>
                          <Text style={styles.breakdownName}>{info.label}</Text>
                          <Text style={styles.breakdownCount}>{p.count} paylaşım</Text>
                        </View>
                        <View style={styles.breakdownBarContainer}>
                          <View style={[styles.breakdownBarFill, { width: `${w}%`, backgroundColor: info.color }]} />
                          <Text style={styles.breakdownBarText}>%{p.avgEngagement.toFixed(1)}</Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}

            {insights.formatBreakdown.length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>🎬 Format Bazında</Text>
                {insights.formatBreakdown
                  .sort((a, b) => b.avgEngagement - a.avgEngagement)
                  .map((f) => {
                    const info = PERF_FORMATS.find((ff) => ff.id === f.format)!;
                    const max = Math.max(...insights.formatBreakdown.map((x) => x.avgEngagement), 1);
                    const w = (f.avgEngagement / max) * 100;
                    return (
                      <View key={f.format} style={styles.breakdownRow}>
                        <View style={styles.breakdownLeft}>
                          <Text style={styles.breakdownEmoji}>{info.emoji}</Text>
                          <Text style={styles.breakdownName}>{info.label}</Text>
                          <Text style={styles.breakdownCount}>{f.count} paylaşım</Text>
                        </View>
                        <View style={styles.breakdownBarContainer}>
                          <View style={[styles.breakdownBarFill, { width: `${w}%`, backgroundColor: '#6366F1' }]} />
                          <Text style={styles.breakdownBarText}>%{f.avgEngagement.toFixed(1)}</Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}

            {insights.hookPatterns.length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>🎯 Hook Stili Bazında</Text>
                {insights.hookPatterns.slice(0, 6).map((h) => {
                  const max = Math.max(...insights.hookPatterns.map((x) => x.avgScore), 1);
                  const w = (h.avgScore / max) * 100;
                  return (
                    <View key={h.pattern} style={styles.hookRow}>
                      <Text style={styles.hookPattern}>{h.pattern}</Text>
                      <View style={styles.hookBarContainer}>
                        <View style={[styles.breakdownBarFill, { width: `${w}%`, backgroundColor: '#10B981' }]} />
                      </View>
                      <Text style={styles.hookScore}>{h.avgScore.toFixed(0)}</Text>
                      <Text style={styles.hookCount}>({h.count})</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {insights.topTopics.length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>🔥 Top Konular (skora göre)</Text>
                {insights.topTopics.map((t, i) => (
                  <View key={t.topic} style={styles.topicRow}>
                    <Text style={styles.topicRank}>{i + 1}</Text>
                    <Text style={styles.topicName} numberOfLines={1}>
                      {t.topic}
                    </Text>
                    <View style={[styles.topicScorePill, { backgroundColor: i === 0 ? '#10B981' : i === 1 ? '#0EA5E9' : '#F59E0B' }]}>
                      <Text style={styles.topicScoreText}>{t.score.toFixed(0)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Pressable onPress={copyInsights} style={styles.reportBtn}>
              <Text style={styles.reportBtnText}>📋 Raporu kopyala</Text>
            </Pressable>
          </>
        )}

        <View style={styles.entriesHeader}>
          <Text style={styles.entriesTitle}>📋 Kayıtlar</Text>
          <View style={styles.entriesActions}>
            <Pressable onPress={() => setAddOpen(!addOpen)} style={styles.addBtn}>
              <Text style={styles.addBtnText}>{addOpen ? '✕ Kapat' : '+ Ekle'}</Text>
            </Pressable>
            {entries.length > 0 && (
              <Pressable onPress={handleClear}>
                <Text style={styles.clearText}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>
        </View>

        {addOpen && (
          <View style={styles.addCard}>
            <Text style={styles.addLabel}>Konu</Text>
            <TextInput
              value={newTopic}
              onChangeText={setNewTopic}
              placeholder="İçerik konusu"
              placeholderTextColor="#94A3B8"
              style={styles.addInput}
            />
            <Text style={styles.addLabel}>Hook (opsiyonel)</Text>
            <TextInput
              value={newHook}
              onChangeText={setNewHook}
              placeholder="Kullandığın hook cümlesi"
              placeholderTextColor="#94A3B8"
              style={styles.addInput}
            />

            <Text style={styles.addLabel}>Platform</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addScroll}>
              {PERF_PLATFORMS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setNewPlatform(p.id)}
                  style={[styles.addChip, newPlatform === p.id && { backgroundColor: p.color, borderColor: p.color }]}
                >
                  <Text style={styles.addChipEmoji}>{p.emoji}</Text>
                  <Text style={[styles.addChipLabel, newPlatform === p.id && { color: '#fff' }]}>{p.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.addLabel}>Format</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addScroll}>
              {PERF_FORMATS.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setNewFormat(f.id)}
                  style={[styles.addChip, newFormat === f.id && styles.addChipActive]}
                >
                  <Text style={styles.addChipEmoji}>{f.emoji}</Text>
                  <Text style={[styles.addChipLabel, newFormat === f.id && styles.addChipLabelActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.addLabel}>Sonuç</Text>
            <View style={styles.outcomeChoiceRow}>
              {PERF_OUTCOMES.map((o) => {
                const isActive = newOutcome === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setNewOutcome(o.id)}
                    style={[styles.outcomeChoice, isActive && { backgroundColor: o.color, borderColor: o.color }]}
                  >
                    <Text style={styles.outcomeChoiceEmoji}>{o.emoji}</Text>
                    <Text style={[styles.outcomeChoiceLabel, isActive && { color: '#fff' }]}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricInput}>
                <Text style={styles.metricInputLabel}>👁 Görüntülenme</Text>
                <TextInput
                  value={newViews}
                  onChangeText={setNewViews}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={styles.metricField}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.metricInput}>
                <Text style={styles.metricInputLabel}>❤️ Beğeni</Text>
                <TextInput
                  value={newLikes}
                  onChangeText={setNewLikes}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={styles.metricField}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metricInput}>
                <Text style={styles.metricInputLabel}>💬 Yorum</Text>
                <TextInput
                  value={newComments}
                  onChangeText={setNewComments}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={styles.metricField}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.metricInput}>
                <Text style={styles.metricInputLabel}>🔁 Paylaşım</Text>
                <TextInput
                  value={newShares}
                  onChangeText={setNewShares}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={styles.metricField}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.metricInput}>
                <Text style={styles.metricInputLabel}>🔖 Kaydetme</Text>
                <TextInput
                  value={newSaves}
                  onChangeText={setNewSaves}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={styles.metricField}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Pressable onPress={handleAdd} disabled={saving} style={styles.saveBtn}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>📊 Kaydet</Text>}
            </Pressable>
          </View>
        )}

        {entries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Henüz performans kaydı yok</Text>
            <Text style={styles.emptySub}>
              İçeriklerinin metriklerini gir, hangi platform/format/hook'un tuttuğunu gör.
            </Text>
          </View>
        ) : (
          <View>
            {entries.map((e) => {
              const pInfo = PERF_PLATFORMS.find((p) => p.id === e.platform);
              const fInfo = PERF_FORMATS.find((f) => f.id === e.format);
              const oInfo = PERF_OUTCOMES.find((o) => o.id === e.outcome);
              const score = calcPerfScore(e);
              const eng = e.likes + e.comments + e.shares + e.saves;
              return (
                <View key={e.id} style={[styles.entryCard, { borderLeftColor: oInfo?.color }]}>
                  <View style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.entryTagsRow}>
                        <View style={[styles.entryTag, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={styles.entryTagEmoji}>{pInfo?.emoji}</Text>
                          <Text style={styles.entryTagText}>{pInfo?.label}</Text>
                        </View>
                        <View style={styles.entryTag}>
                          <Text style={styles.entryTagEmoji}>{fInfo?.emoji}</Text>
                          <Text style={styles.entryTagText}>{fInfo?.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.entryTopic}>{e.topic}</Text>
                      <Text style={styles.entryHook} numberOfLines={2}>
                        "{e.hookText}"
                      </Text>
                    </View>
                    <Pressable onPress={() => handleRemove(e.id)} style={styles.entryDelete}>
                      <Text style={styles.entryDeleteText}>✕</Text>
                    </Pressable>
                  </View>

                  <View style={styles.entryMetricsRow}>
                    <View style={styles.entryMetric}>
                      <Text style={styles.entryMetricLabel}>👁</Text>
                      <Text style={styles.entryMetricValue}>{formatNumber(e.views)}</Text>
                    </View>
                    <View style={styles.entryMetric}>
                      <Text style={styles.entryMetricLabel}>❤️</Text>
                      <Text style={styles.entryMetricValue}>{formatNumber(e.likes)}</Text>
                    </View>
                    <View style={styles.entryMetric}>
                      <Text style={styles.entryMetricLabel}>💬</Text>
                      <Text style={styles.entryMetricValue}>{formatNumber(e.comments)}</Text>
                    </View>
                    <View style={styles.entryMetric}>
                      <Text style={styles.entryMetricLabel}>🔁</Text>
                      <Text style={styles.entryMetricValue}>{formatNumber(e.shares)}</Text>
                    </View>
                    <View style={styles.entryMetric}>
                      <Text style={styles.entryMetricLabel}>🔖</Text>
                      <Text style={styles.entryMetricValue}>{formatNumber(e.saves)}</Text>
                    </View>
                  </View>

                  <View style={styles.entryFooter}>
                    <Text style={styles.entryDate}>{formatDate(e.postedAt)}</Text>
                    <View style={[styles.entryScorePill, { backgroundColor: oInfo?.color }]}>
                      <Text style={styles.entryScoreText}>{score.toFixed(0)} puan</Text>
                    </View>
                    <Text style={styles.entryEngagement}>%{e.views > 0 ? ((eng / e.views) * 100).toFixed(1) : '0'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 16, paddingTop: 8 },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  heroBadge: { color: '#F59E0B', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  heroSub: { color: '#94A3B8', fontSize: 12, fontWeight: '500', lineHeight: 18, marginBottom: 14 },
  heroStatsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  heroStat: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  heroStatValue: { color: '#F59E0B', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  heroStatLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  bestRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  bestCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bestLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 6 },
  bestEmoji: { fontSize: 28, marginBottom: 4 },
  bestName: { fontSize: 13, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  outcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  outcomeLabel: { fontSize: 11, fontWeight: '800', color: '#0F172A', letterSpacing: 0.5, marginBottom: 10 },
  outcomeRow: { flexDirection: 'row', gap: 8 },
  outcomeChip: {
    flex: 1,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  outcomeEmoji: { fontSize: 18, marginBottom: 2 },
  outcomeName: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  outcomeCount: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  outcomeBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 2,
  },
  outcomeBarFill: { height: '100%', borderRadius: 2 },
  outcomePct: { fontSize: 9, fontWeight: '700' },
  breakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  breakdownTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  breakdownLeft: { width: 110 },
  breakdownEmoji: { fontSize: 16, marginRight: 4 },
  breakdownName: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  breakdownCount: { fontSize: 9, color: '#64748B' },
  breakdownBarContainer: {
    flex: 1,
    height: 22,
    backgroundColor: '#F1F5F9',
    borderRadius: 11,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  breakdownBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 11,
  },
  breakdownBarText: { fontSize: 10, fontWeight: '800', color: '#0F172A' },
  hookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  hookPattern: { width: 130, fontSize: 11, fontWeight: '700', color: '#0F172A' },
  hookBarContainer: {
    flex: 1,
    height: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    overflow: 'hidden',
  },
  hookScore: { width: 28, fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
  hookCount: { fontSize: 9, color: '#64748B', width: 30 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  topicRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
  topicName: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '600' },
  topicScorePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  topicScoreText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  reportBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  reportBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  entriesTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  entriesActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  clearText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  addCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  addLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', marginTop: 6, marginBottom: 4, letterSpacing: 0.5 },
  addInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addScroll: { marginBottom: 4, flexGrow: 0 },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  addChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  addChipEmoji: { fontSize: 14 },
  addChipLabel: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  addChipLabelActive: { color: '#fff' },
  outcomeChoiceRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  outcomeChoice: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  outcomeChoiceEmoji: { fontSize: 16, marginBottom: 2 },
  outcomeChoiceLabel: { fontSize: 9, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  metricsRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  metricInput: { flex: 1 },
  metricInputLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', marginBottom: 2 },
  metricField: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center' },
  entryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
  },
  entryHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  entryTagsRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  entryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  entryTagEmoji: { fontSize: 12 },
  entryTagText: { fontSize: 10, fontWeight: '700', color: '#0F172A' },
  entryTopic: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  entryHook: { fontSize: 11, color: '#475569', fontStyle: 'italic' },
  entryDelete: {
    backgroundColor: '#FEE2E2',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryDeleteText: { color: '#EF4444', fontSize: 12, fontWeight: '800' },
  entryMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  entryMetric: { alignItems: 'center', flex: 1 },
  entryMetricLabel: { fontSize: 11, marginBottom: 1 },
  entryMetricValue: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  entryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  entryDate: { fontSize: 10, color: '#64748B' },
  entryScorePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  entryScoreText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  entryEngagement: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});