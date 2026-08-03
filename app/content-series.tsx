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
  SERIES_ARCS,
  EPISODE_FORMATS,
  SeriesArc,
  EpisodeFormat,
  Episode,
  ContentSeries,
  buildContentSeries,
  saveContentSeries,
  getContentSeriesList,
  removeContentSeries,
  clearContentSeries,
  getStoredNiche,
  addCopyToHistory,
} from '../services/storage';
import { NicheId } from '../services/contentService';

const ARC_INFO: Record<SeriesArc, { color: string; bg: string }> = {
  educational: { color: '#0EA5E9', bg: '#E0F2FE' },
  myth_busting: { color: '#EC4899', bg: '#FCE7F3' },
  story_journey: { color: '#10B981', bg: '#D1FAE5' },
  step_by_step: { color: '#F59E0B', bg: '#FEF3C7' },
  case_study: { color: '#8B5CF6', bg: '#F3E8FF' },
  countdown: { color: '#EF4444', bg: '#FEE2E2' },
  challenge: { color: '#6366F1', bg: '#E0E7FF' },
};

export default function ContentSeriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [arc, setArc] = useState<SeriesArc>('educational');
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [series, setSeries] = useState<ContentSeries | null>(null);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [savedSeries, setSavedSeries] = useState<ContentSeries[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const n = await getStoredNiche();
      setNiche(n);
      const list = await getContentSeriesList();
      setSavedSeries(list);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const list = await getContentSeriesList();
        setSavedSeries(list);
      })();
    }, [])
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const generate = useCallback(async () => {
    if (!topic.trim()) {
      Alert.alert('Konu gerekli', 'Lütfen serinin ana konusunu yaz.');
      return;
    }
    setLoading(true);
    setSeries(null);
    await new Promise((r) => setTimeout(r, 240));
    const result = buildContentSeries(niche, arc, topic, audience);
    setSeries(result);
    setActiveEpisodeIdx(0);
    setLoading(false);
    setToast('🎬 Seri planı hazır');
  }, [niche, arc, topic, audience]);

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      Clipboard.setString(text);
      setCopied(key);
      await addCopyToHistory(text, 'detail');
      setToast('📋 Panoya kopyalandı');
      setTimeout(() => setCopied(null), 1400);
    } catch {
      setToast('Kopyalama başarısız');
    }
  }, []);

  const saveCurrent = useCallback(async () => {
    if (!series) return;
    const next = await saveContentSeries(series);
    setSavedSeries(next);
    setToast('💾 Seri kaydedildi');
  }, [series]);

  const removeSaved = useCallback(async (id: string) => {
    const next = await removeContentSeries(id);
    setSavedSeries(next);
    setToast('🗑️ Seri silindi');
  }, []);

  const clearSaved = useCallback(() => {
    if (savedSeries.length === 0) return;
    Alert.alert('Tüm serileri sil', `${savedSeries.length} kayıtlı seri silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await clearContentSeries();
          setSavedSeries([]);
          setToast('🧹 Tüm seriler silindi');
        },
      },
    ]);
  }, [savedSeries]);

  const arcInfo = ARC_INFO[arc];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Content Series', headerBackTitle: 'Geri' }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>🎬 CONTENT SERIES BUILDER</Text>
          <Text style={styles.heroTitle}>7 bölümlük seri planla</Text>
          <Text style={styles.heroSub}>
            Bir ana konuyu seç, anlatı arkını belirle — tüm bölümleri tek seferde üret.
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{SERIES_ARCS.length}</Text>
              <Text style={styles.heroStatLabel}>ark tipi</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{EPISODE_FORMATS.length}</Text>
              <Text style={styles.heroStatLabel}>format</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{savedSeries.length}</Text>
              <Text style={styles.heroStatLabel}>kayıtlı seri</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>1. Anlatı arkı</Text>
        <View style={styles.arcGrid}>
          {SERIES_ARCS.map((a) => {
            const info = ARC_INFO[a.id];
            const isActive = arc === a.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => setArc(a.id)}
                style={[
                  styles.arcChip,
                  isActive && { backgroundColor: info.bg, borderColor: info.color },
                ]}
              >
                <Text style={styles.arcEmoji}>{a.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.arcLabel,
                      isActive && { color: info.color, fontWeight: '800' },
                    ]}
                  >
                    {a.label}
                  </Text>
                  <Text style={styles.arcHint} numberOfLines={1}>
                    {a.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>2. Konu & Hedef Kitle</Text>
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Ana konu</Text>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="Örn: Sabah 5 dakikalık meditasyon"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
            maxLength={140}
          />
          <Text style={styles.inputLabel}>Hedef kitle (opsiyonel)</Text>
          <TextInput
            value={audience}
            onChangeText={setAudience}
            placeholder="Örn: yeni başlayanlar, yoğun çalışanlar"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            maxLength={100}
          />
          <Pressable
            onPress={generate}
            disabled={loading}
            style={[styles.generateButton, { backgroundColor: arcInfo.color }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>🎬 7 bölümlük seri üret</Text>
            )}
          </Pressable>
        </View>

        {series && (
          <>
            <View style={[styles.seriesHeader, { borderColor: arcInfo.color, backgroundColor: arcInfo.bg }]}>
              <Text style={[styles.seriesArcLabel, { color: arcInfo.color }]}>
                {SERIES_ARCS.find((a) => a.id === arc)?.emoji} {SERIES_ARCS.find((a) => a.id === arc)?.label}
              </Text>
              <Text style={styles.seriesTopic}>{series.topic}</Text>
              <Text style={styles.seriesMeta}>
                {series.episodes.length} bölüm · {series.audience}
              </Text>
              <View style={styles.seriesHookBox}>
                <Text style={styles.seriesHookLabel}>🎯 SERİ HOOK'U</Text>
                <Text style={styles.seriesHookText}>{series.seriesHook}</Text>
                <Pressable
                  onPress={() => copyText(series.seriesHook, 'seriesHook')}
                  style={styles.copyMiniBtnDark}
                >
                  <Text style={styles.copyMiniText}>{copied === 'seriesHook' ? '✓' : '📋'}</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.sectionTitle}>3. Bölümler</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.episodeTabs}>
              {series.episodes.map((ep, idx) => (
                <Pressable
                  key={ep.index}
                  onPress={() => setActiveEpisodeIdx(idx)}
                  style={[
                    styles.episodeTab,
                    activeEpisodeIdx === idx && {
                      backgroundColor: arcInfo.color,
                      borderColor: arcInfo.color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.episodeTabNum,
                      activeEpisodeIdx === idx && { color: '#fff' },
                    ]}
                  >
                    {ep.index}
                  </Text>
                  <Text
                    style={[
                      styles.episodeTabFormat,
                      activeEpisodeIdx === idx && { color: '#fff' },
                    ]}
                  >
                    {EPISODE_FORMATS.find((f) => f.id === ep.format)?.emoji}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <EpisodeCard
              episode={series.episodes[activeEpisodeIdx]}
              arcColor={arcInfo.color}
              arcBg={arcInfo.bg}
              copied={copied}
              onCopy={copyText}
            />

            <View style={styles.seriesActions}>
              <Pressable
                onPress={() =>
                  copyText(
                    series.episodes
      .map(
        (e) =>
          `Bölüm ${e.index}: ${e.title}\nFormat: ${EPISODE_FORMATS.find((f) => f.id === e.format)?.label}\nHook: ${e.hook}\nBeat: ${e.beat}\nDeliverable: ${e.deliverable}\nCTA: ${e.cta}\nCliffhanger: ${e.cliffhanger}`
      )
                      .join('\n\n---\n\n'),
                    'allEpisodes'
                  )
                }
                style={[styles.actionBtn, { backgroundColor: arcInfo.color }]}
              >
                <Text style={styles.actionBtnText}>
                  {copied === 'allEpisodes' ? '✓ Kopyalandı' : '📋 Tüm seriyi kopyala'}
                </Text>
              </Pressable>
              <Pressable onPress={saveCurrent} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>💾 Seriyi kaydet</Text>
              </Pressable>
            </View>
          </>
        )}

        {savedSeries.length > 0 && (
          <>
            <View style={styles.savedHeader}>
              <Text style={styles.sectionTitle}>Kayıtlı seriler</Text>
              <Pressable onPress={clearSaved}>
                <Text style={styles.clearAllText}>Tümünü sil</Text>
              </Pressable>
            </View>

            {savedSeries.map((s) => {
              const info = ARC_INFO[s.arc];
              return (
                <View key={s.id} style={styles.savedCard}>
                  <View style={styles.savedHeaderRow}>
                    <View
                      style={[
                        styles.savedArcPill,
                        { backgroundColor: info.bg, borderColor: info.color },
                      ]}
                    >
                      <Text style={[styles.savedArcText, { color: info.color }]}>
                        {SERIES_ARCS.find((a) => a.id === s.arc)?.emoji}{' '}
                        {SERIES_ARCS.find((a) => a.id === s.arc)?.label}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeSaved(s.id)} style={styles.savedDelete}>
                      <Text style={styles.savedDeleteText}>✕</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.savedTopic} numberOfLines={2}>
                    {s.topic}
                  </Text>
                  <Text style={styles.savedMeta}>
                    {s.episodes.length} bölüm · {s.audience}
                  </Text>
                  <View style={styles.savedEpisodesRow}>
                    {s.episodes.slice(0, 7).map((ep) => (
                      <View
                        key={ep.index}
                        style={[
                          styles.savedEpisodePill,
                          { backgroundColor: info.bg, borderColor: info.color },
                        ]}
                      >
                        <Text style={[styles.savedEpisodeNum, { color: info.color }]}>
                          {ep.index}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {savedSeries.length === 0 && !series && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyTitle}>Henüz seri oluşturulmadı</Text>
            <Text style={styles.emptySub}>
              Bir ana konu seç, anlatı arkını belirle — 7 bölümlük planı saniyeler içinde al.
            </Text>
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

function EpisodeCard({
  episode,
  arcColor,
  arcBg,
  copied,
  onCopy,
}: {
  episode: Episode;
  arcColor: string;
  arcBg: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const formatInfo = EPISODE_FORMATS.find((f) => f.id === episode.format);

  const buildFullScript = (): string => {
    return `Bölüm ${episode.index}: ${episode.title}\n\nFormat: ${formatInfo?.label}\n\nHook: ${episode.hook}\n\nBeat: ${episode.beat}\n\nDeliverable: ${episode.deliverable}\n\nCTA: ${episode.cta}\n\nCliffhanger: ${episode.cliffhanger}`;
  };

  return (
    <View style={[styles.episodeCard, { borderColor: arcColor, backgroundColor: arcBg }]}>
      <View style={styles.episodeCardHeader}>
        <View style={styles.episodeBadgeRow}>
          <View style={[styles.episodeNumBadge, { backgroundColor: arcColor }]}>
            <Text style={styles.episodeNumText}>#{episode.index}</Text>
          </View>
          <View style={[styles.episodeFormatBadge, { backgroundColor: '#fff' }]}>
            <Text style={styles.episodeFormatEmoji}>{formatInfo?.emoji}</Text>
            <Text style={[styles.episodeFormatLabel, { color: arcColor }]}>
              {formatInfo?.label}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => onCopy(buildFullScript(), `ep${episode.index}`)}
          style={styles.copyFullBtn}
        >
          <Text style={styles.copyFullText}>
            {copied === `ep${episode.index}` ? '✓ Kopyalandı' : '📋 Senaryo'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.episodeTitle}>{episode.title}</Text>

      <FieldBox label="🎯 Hook" text={episode.hook} onCopy={() => onCopy(episode.hook, `ep${episode.index}-hook`)} copied={copied === `ep${episode.index}-hook`} />

      <FieldBox label="🎭 Beat" text={episode.beat} onCopy={() => onCopy(episode.beat, `ep${episode.index}-beat`)} copied={copied === `ep${episode.index}-beat`} />

      <FieldBox label="🎁 Deliverable" text={episode.deliverable} onCopy={() => onCopy(episode.deliverable, `ep${episode.index}-del`)} copied={copied === `ep${episode.index}-del`} />

      <FieldBox label="📣 CTA" text={episode.cta} onCopy={() => onCopy(episode.cta, `ep${episode.index}-cta`)} copied={copied === `ep${episode.index}-cta`} />

      <View style={[styles.cliffhangerBox, { borderColor: arcColor }]}>
        <Text style={[styles.cliffhangerLabel, { color: arcColor }]}>⏭️ SONRAKİ BÖLÜM</Text>
        <Text style={styles.cliffhangerText}>{episode.cliffhanger}</Text>
      </View>
    </View>
  );
}

function FieldBox({
  label,
  text,
  onCopy,
  copied,
}: {
  label: string;
  text: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Pressable onPress={onCopy} style={styles.copyMiniBtn}>
          <Text style={styles.copyMiniText}>{copied ? '✓' : '📋'}</Text>
        </Pressable>
      </View>
      <View style={styles.fieldBox}>
        <Text style={styles.fieldText}>{text}</Text>
      </View>
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
    borderColor: '#8B5CF6',
  },
  heroBadge: { color: '#8B5CF6', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
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
  heroStatValue: { color: '#8B5CF6', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  heroStatLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 8, marginBottom: 10 },
  arcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  arcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexBasis: '48%',
    flexGrow: 1,
    gap: 8,
  },
  arcEmoji: { fontSize: 18 },
  arcLabel: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  arcHint: { fontSize: 10, color: '#64748B', marginTop: 1 },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    minHeight: 44,
  },
  generateButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  generateButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  seriesHeader: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
  },
  seriesArcLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  seriesTopic: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  seriesMeta: { fontSize: 11, color: '#475569', fontWeight: '600', marginBottom: 10 },
  seriesHookBox: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seriesHookLabel: { fontSize: 9, fontWeight: '800', color: '#475569', letterSpacing: 0.5 },
  seriesHookText: { flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '700' },
  copyMiniBtnDark: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyMiniText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  episodeTabs: { marginBottom: 12, flexGrow: 0 },
  episodeTab: {
    width: 50,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  episodeTabNum: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  episodeTabFormat: { fontSize: 16, marginTop: 2 },
  episodeCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
  },
  episodeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  episodeBadgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  episodeNumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  episodeNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  episodeFormatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  episodeFormatEmoji: { fontSize: 14 },
  episodeFormatLabel: { fontSize: 11, fontWeight: '800' },
  copyFullBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  copyFullText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  episodeTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  fieldContainer: { marginBottom: 10 },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },
  copyMiniBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fieldBox: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    padding: 10,
  },
  fieldText: { fontSize: 13, color: '#0F172A', lineHeight: 19 },
  cliffhangerBox: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  cliffhangerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  cliffhangerText: { fontSize: 13, color: '#0F172A', fontStyle: 'italic', fontWeight: '600' },
  seriesActions: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  savedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  clearAllText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  savedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  savedHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  savedArcPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  savedArcText: { fontSize: 11, fontWeight: '800' },
  savedDelete: {
    backgroundColor: '#FEE2E2',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedDeleteText: { color: '#EF4444', fontSize: 14, fontWeight: '800' },
  savedTopic: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  savedMeta: { fontSize: 11, color: '#64748B', marginBottom: 8 },
  savedEpisodesRow: { flexDirection: 'row', gap: 4 },
  savedEpisodePill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  savedEpisodeNum: { fontSize: 12, fontWeight: '800' },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center' },
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