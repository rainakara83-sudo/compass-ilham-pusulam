import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  MOODS,
  MoodId,
  MoodProfile,
  MoodMatch,
  addMoodHistory,
  addCopyToHistory,
  getMoodHistory,
  getStoredNiche,
  pickIdeasForMood,
  toggleFavorite,
  getFavorites,
  MoodSessionEntry,
  clearMoodHistory,
} from '../services/storage';
import { NicheId } from '../services/contentService';

export default function MoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null);
  const [matches, setMatches] = useState<MoodMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<MoodSessionEntry[]>([]);
  const [energyHint, setEnergyHint] = useState<string | null>(null);

  const moodReasonShort = (m: MoodMatch): string => {
    if (m.score >= 4) return t('moodIdeas.match4');
    if (m.score >= 2) return t('moodIdeas.match2');
    if (m.score >= 1) return t('moodIdeas.match1');
    return t('moodIdeas.match0');
  };

  const moodLabel = useCallback((id: MoodId): string => t(`moodIdeas.moods.${id}.label`), [t]);
  const moodTagline = useCallback((id: MoodId): string => t(`moodIdeas.moods.${id}.tagline`), [t]);

  useEffect(() => {
    (async () => {
      const n = await getStoredNiche();
      setNiche(n);
      const [favs, hist] = await Promise.all([getFavorites(), getMoodHistory()]);
      setFavorites(new Set(favs));
      setHistory(hist);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const favs = await getFavorites();
        setFavorites(new Set(favs));
      })();
    }, [])
  );

  const selectMood = useCallback(
    async (mood: MoodProfile) => {
      setSelectedMood(mood.id);
      setLoading(true);
      setMatches([]);
      setEnergyHint(moodTagline(mood.id));
      await new Promise((r) => setTimeout(r, 220));
      const exclude = history.filter((h) => h.mood === mood.id).slice(0, 12).map((h) => h.idea);
      const result = pickIdeasForMood(niche, mood, 8, exclude);
      setMatches(result);
      setLoading(false);
    },
    [niche, history, moodTagline]
  );

  const reroll = useCallback(async () => {
    if (!selectedMood) return;
    const mood = MOODS.find((m) => m.id === selectedMood);
    if (!mood) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 200));
    const exclude = [...history.filter((h) => h.mood === mood.id).slice(0, 12).map((h) => h.idea), ...matches.map((m) => m.idea)];
    const result = pickIdeasForMood(niche, mood, 8, exclude);
    setMatches(result);
    setLoading(false);
  }, [selectedMood, niche, history, matches]);

  const onCopy = async (idx: number, text: string) => {
    Clipboard.setString(text);
    setCopiedIdx(idx);
    if (selectedMood) {
      const entry: MoodSessionEntry = {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mood: selectedMood,
        idea: text,
        niche,
        pickedAt: Date.now(),
      };
      const next = await addMoodHistory(entry);
      setHistory(next);
    }
    await addCopyToHistory(text, 'pool');
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const onFav = async (text: string) => {
    await toggleFavorite(text);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  };

  const openDetail = (text: string) => {
    router.push({
      pathname: '/idea/[text]',
      params: { text: encodeURIComponent(text), niche: niche ?? '', source: 'mood' },
    });
  };

  const onClearHistory = () => {
    if (history.length === 0) return;
    Alert.alert(
      t('moodIdeas.clearConfirmTitle'),
      t('moodIdeas.clearConfirmMsg'),
      [
        { text: t('moodIdeas.clearConfirmCancel'), style: 'cancel' },
        {
          text: t('moodIdeas.clearConfirmOk'),
          style: 'destructive',
          onPress: async () => {
            await clearMoodHistory();
            setHistory([]);
          },
        },
      ]
    );
  };

  const moodCounts = history.reduce<Record<string, number>>((acc, h) => {
    acc[h.mood] = (acc[h.mood] ?? 0) + 1;
    return acc;
  }, {});
  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
  const totalPicked = history.length;
  const moodForCard = selectedMood ? MOODS.find((m) => m.id === selectedMood) : null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: t('moodIdeas.screenTitle'),
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerEyebrow}>{t('moodIdeas.eyebrow')}</Text>
          <Text style={styles.headerTitle}>{t('moodIdeas.headerTitle')}</Text>
          {dominantMood && (
            <View style={styles.headerStats}>
              <View style={styles.headerStat}>
                <Text style={styles.headerStatValue}>{totalPicked}</Text>
                <Text style={styles.headerStatLabel}>{t('moodIdeas.totalPicked')}</Text>
              </View>
              <View style={styles.headerStatDivider} />
              <View style={styles.headerStat}>
                <Text style={styles.headerStatValue}>
                  {MOODS.find((m) => m.id === dominantMood[0])?.emoji}
                </Text>
                <Text style={styles.headerStatLabel}>
                  {moodLabel(dominantMood[0] as MoodId)} ({dominantMood[1]})
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.moodGrid}>
          {MOODS.map((m) => {
            const isActive = selectedMood === m.id;
            const count = moodCounts[m.id] ?? 0;
            return (
              <Pressable
                key={m.id}
                onPress={() => selectMood(m)}
                style={[
                  styles.moodCard,
                  { backgroundColor: m.bgColor, borderColor: isActive ? m.color : 'transparent' },
                  isActive && styles.moodCardActive,
                ]}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, { color: m.color }]}>{moodLabel(m.id)}</Text>
                <Text style={styles.moodTagline} numberOfLines={2}>{moodTagline(m.id)}</Text>
                {count > 0 && (
                  <View style={[styles.moodCountBadge, { backgroundColor: m.color }]}>
                    <Text style={styles.moodCountText}>{count}×</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {energyHint && moodForCard && (
          <View style={[styles.hintCard, { backgroundColor: moodForCard.bgColor, borderColor: moodForCard.color }]}>
            <Text style={styles.hintIcon}>{moodForCard.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.hintTitle, { color: moodForCard.color }]}>
                {t('moodIdeas.moodChanged', { mood: moodLabel(moodForCard.id) })}
              </Text>
              <Text style={styles.hintText}>{moodTagline(moodForCard.id)}</Text>
            </View>
          </View>
        )}

        {selectedMood && (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={reroll}
              style={[styles.rerollBtn, loading && styles.rerollBtnDisabled]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#7c5cff" />
              ) : (
                <Text style={styles.rerollBtnText}>{t('moodIdeas.rerollBtn')}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setSelectedMood(null);
                setMatches([]);
                setEnergyHint(null);
              }}
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>{t('moodIdeas.resetBtn')}</Text>
            </Pressable>
          </View>
        )}

        {!selectedMood && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👆</Text>
            <Text style={styles.emptyText}>{t('moodIdeas.emptyText')}</Text>
            <Text style={styles.emptyHint}>{t('moodIdeas.emptyHint')}</Text>
          </View>
        )}

        {selectedMood && loading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={moodForCard?.color ?? '#7c5cff'} />
            <Text style={[styles.loadingText, { color: moodForCard?.color ?? '#7c5cff' }]}>
              {moodForCard ? t('moodIdeas.moodSearching', { mood: moodLabel(moodForCard.id) }) : ''}
            </Text>
          </View>
        )}

        {selectedMood && !loading && matches.length > 0 && moodForCard && (
          <View>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>
                {t('moodIdeas.foundCount', { count: matches.length })}
              </Text>
              <Text style={styles.resultSub}>
                {t('moodIdeas.scoreHint')}
              </Text>
            </View>

            {matches.map((m, idx) => {
              const isFav = favorites.has(m.idea);
              return (
                <View
                  key={`${m.idea}-${idx}`}
                  style={[
                    styles.ideaCard,
                    { borderLeftColor: moodForCard.color },
                  ]}
                >
                  <View style={styles.ideaTopRow}>
                    <View style={[styles.matchPill, { backgroundColor: moodForCard.bgColor }]}>
                      <Text style={[styles.matchPillText, { color: moodForCard.color }]}>
                        ⭐ {m.score}
                      </Text>
                    </View>
                    <Text style={styles.matchReason}>{moodReasonShort(m)}</Text>
                  </View>
                  <Text style={styles.ideaText}>{m.idea}</Text>
                  {m.reason !== 'Genel havuzdan seçildi' && (
                    <Text style={styles.ideaReason}>{m.reason}</Text>
                  )}
                  <View style={styles.ideaActions}>
                    <Pressable onPress={() => onCopy(idx, m.idea)} style={styles.actionBtn}>
                      <Text style={[styles.actionBtnText, copiedIdx === idx && { color: '#10B981' }]}>
                        {copiedIdx === idx ? t('moodIdeas.copied') : t('moodIdeas.copy')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => onFav(m.idea)} style={styles.actionBtn}>
                      <Text style={[styles.actionBtnText, isFav && { color: '#F59E0B' }]}>
                        {isFav ? t('moodIdeas.favOn') : t('moodIdeas.favOff')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => openDetail(m.idea)} style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>{t('moodIdeas.detail')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {selectedMood && !loading && matches.length === 0 && (
          <View style={styles.noMatchCard}>
            <Text style={styles.noMatchEmoji}>😶‍🌫️</Text>
            <Text style={styles.noMatchText}>{t('moodIdeas.noMatchText')}</Text>
            <Pressable onPress={reroll} style={styles.noMatchBtn}>
              <Text style={styles.noMatchBtnText}>{t('moodIdeas.noMatchBtn')}</Text>
            </Pressable>
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>{t('moodIdeas.historyTitle')}</Text>
                <Text style={styles.historySub}>
                  {t('moodIdeas.historySub', { count: history.length })}
                </Text>
              </View>
              <Pressable onPress={onClearHistory} hitSlop={8}>
                <Text style={styles.historyClearBtn}>{t('moodIdeas.historyClear')}</Text>
              </Pressable>
            </View>
            {history.slice(0, 6).map((h, idx) => {
              const moodProfile = MOODS.find((m) => m.id === h.mood);
              if (!moodProfile) return null;
              return (
                <Pressable
                  key={`${h.id}-${idx}`}
                  onPress={() => openDetail(h.idea)}
                  style={[styles.historyRow, { borderLeftColor: moodProfile.color }]}
                >
                  <Text style={styles.historyEmoji}>{moodProfile.emoji}</Text>
                  <Text style={styles.historyText} numberOfLines={2}>{h.idea}</Text>
                  <Text style={styles.historyDate}>
                    {timeAgo(h.pickedAt, t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>{t('moodIdeas.legendTitle')}</Text>
          <View style={styles.legendGrid}>
            {MOODS.map((m) => (
              <View key={`legend-${m.id}`} style={[styles.legendItem, { borderColor: m.color }]}>
                <Text style={styles.legendEmoji}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.legendLabel, { color: m.color }]}>{moodLabel(m.id)}</Text>
                  <Text style={styles.legendText} numberOfLines={1}>{moodTagline(m.id)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const timeAgo = (ts: number, t: (k: string, o?: any) => string): string => {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('moodIdeas.timeNow');
  if (min < 60) return t('moodIdeas.timeMin', { m: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('moodIdeas.timeHour', { h: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t('moodIdeas.timeDay', { d: day });
  const w = Math.floor(day / 7);
  return t('moodIdeas.timeWeek', { w });
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  headerCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#7c5cff',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7c5cff',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  headerTitle: { fontSize: 16, color: '#111827', fontWeight: '700', lineHeight: 22 },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  headerStat: { flex: 1, alignItems: 'center' },
  headerStatValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  headerStatLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', marginTop: 2, textAlign: 'center' },
  headerStatDivider: { width: 1, height: 24, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  moodCard: {
    width: '48.5%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    minHeight: 110,
    justifyContent: 'flex-start',
    position: 'relative',
  },
  moodCardActive: { transform: [{ scale: 1.02 }] },
  moodEmoji: { fontSize: 28, marginBottom: 6 },
  moodLabel: { fontSize: 15, fontWeight: '800' },
  moodTagline: { fontSize: 11, color: '#374151', marginTop: 4, fontWeight: '500' },
  moodCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  moodCountText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  hintIcon: { fontSize: 24 },
  hintTitle: { fontSize: 13, fontWeight: '800' },
  hintText: { fontSize: 11, color: '#374151', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  rerollBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#7c5cff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  rerollBtnDisabled: { opacity: 0.5 },
  rerollBtnText: { color: '#7c5cff', fontWeight: '800', fontSize: 13 },
  resetBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: { color: '#6B7280', fontWeight: '700', fontSize: 12 },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderStyle: 'dashed',
  },
  emptyEmoji: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#374151', fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'center' },
  loadingCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  loadingText: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  resultHeader: { marginBottom: 10 },
  resultTitle: { fontSize: 13, fontWeight: '800', color: '#374151', letterSpacing: 0.5 },
  resultSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  ideaCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  ideaTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  matchPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  matchPillText: { fontSize: 11, fontWeight: '800' },
  matchReason: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  ideaText: { fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20 },
  ideaReason: { fontSize: 10, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' },
  ideaActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 11, color: '#4D96FF', fontWeight: '700' },
  noMatchCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  noMatchEmoji: { fontSize: 32, marginBottom: 8 },
  noMatchText: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  noMatchBtn: { backgroundColor: '#7c5cff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  noMatchBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  historyCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  historyTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  historySub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  historyClearBtn: { fontSize: 12, color: '#EF4444', fontWeight: '700' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FAFAFB',
    marginBottom: 6,
    borderLeftWidth: 3,
  },
  historyEmoji: { fontSize: 18 },
  historyText: { flex: 1, fontSize: 12, color: '#111827', fontWeight: '500', lineHeight: 18 },
  historyDate: { fontSize: 10, color: '#9CA3AF', fontWeight: '700' },
  legendCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  legendTitle: { fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 10 },
  legendGrid: { gap: 8 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FAFAFB',
    borderWidth: 1,
  },
  legendEmoji: { fontSize: 22 },
  legendLabel: { fontSize: 12, fontWeight: '800' },
  legendText: { fontSize: 11, color: '#6B7280', marginTop: 1 },
});