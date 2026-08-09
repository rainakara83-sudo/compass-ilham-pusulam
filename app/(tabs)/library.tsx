import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../services/theme';
import {
  FavoriteEntry,
  HistoryEntry,
  getFavoritesDetailed,
  getHistory,
  removeManyFavorites,
} from '../../services/storage';
import PlanBadge from '../../components/PlanBadge';
import { NicheId } from '../../services/contentService';
import i18n from '../../i18n';

type SubTab = 'favorites' | 'history' | 'packs';

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const lng = (i18n.language || 'en').split('-')[0];
  try {
    return d.toLocaleDateString(lng, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d.toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' });
  }
};

const formatWeek = (weekId: string) => {
  return weekId;
};

export default function LibraryScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const router = useRouter();
  const [sub, setSub] = useState<SubTab>('favorites');
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [planRefresh, setPlanRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [favs, hist] = await Promise.all([getFavoritesDetailed(), getHistory()]);
    setFavorites(favs);
    setHistory(hist);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      setPlanRefresh((x) => x + 1);
    }, [load])
  );

  const onRemoveFav = async (text: string) => {
    const next = await removeManyFavorites([text]);
    setFavorites(next);
  };

  const onShareAll = async () => {
    const list = favorites.map((f) => f.text);
    if (list.length === 0) return;
    try {
      await Share.share({
        message: list.join('\n• '),
        title: t('tabs.library'),
      });
    } catch {
      // ignore
    }
  };

  const filteredFavs = favorites.filter((f) =>
    query.trim() === '' ? true : f.text.toLowerCase().includes(query.toLowerCase())
  );
  const filteredHistory = history.filter((h) =>
    query.trim() === '' ? true : h.weekId.toLowerCase().includes(query.toLowerCase())
  );

  const bg = isDark ? '#0B1220' : '#5C6B4F';
  const cardBg = isDark ? '#1E293B' : 'white';
  const textColor = isDark ? '#FAFCF6' : '#111827';
  const subText = isDark ? '#CBD5E1' : '#6B7280';
  const borderColor = isDark ? '#334155' : '#E5E7EB';
  const inputBg = isDark ? '#0F172A' : '#F9FAFB';
  const activeAccent = isDark ? '#60A5FA' : '#4D96FF';
  const tabBg = isDark ? '#1E293B' : 'white';

  const tabs: { id: SubTab; label: string; emoji: string; count: number }[] = [
    { id: 'favorites', label: t('library.tabFavorites'), emoji: '⭐', count: favorites.length },
    { id: 'history', label: t('library.tabHistory'), emoji: '⏱', count: history.length },
    { id: 'packs', label: t('library.tabPacks'), emoji: '📦', count: 0 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <PlanBadge size="sm" refreshKey={planRefresh} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>{t('library.title')}</Text>

        <View style={[styles.tabBar, { backgroundColor: tabBg, borderColor }]}>
          {tabs.map((tt) => (
            <Pressable
              key={tt.id}
              onPress={() => setSub(tt.id)}
              style={[
                styles.subTab,
                sub === tt.id && { backgroundColor: activeAccent + '22', borderColor: activeAccent },
              ]}
            >
              <Text style={[styles.subTabEmoji]}>{tt.emoji}</Text>
              <Text
                style={[
                  styles.subTabLabel,
                  { color: sub === tt.id ? activeAccent : subText, fontWeight: sub === tt.id ? '800' : '700' },
                ]}
              >
                {tt.label}
              </Text>
              {tt.count > 0 && (
                <View style={[styles.badge, { backgroundColor: activeAccent }]}>
                  <Text style={styles.badgeText}>{tt.count}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {(sub === 'favorites' || sub === 'history') && (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={sub === 'favorites' ? t('favorites.searchPlaceholder', 'Ara...') : '...'}
            placeholderTextColor={subText}
            style={[
              styles.search,
              { backgroundColor: inputBg, borderColor, color: textColor },
            ]}
          />
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={activeAccent} />
          </View>
        ) : sub === 'favorites' ? (
          <FavoritesList
            items={filteredFavs}
            cardBg={cardBg}
            textColor={textColor}
            subText={subText}
            borderColor={borderColor}
            activeAccent={activeAccent}
            emptyText={t('library.emptyFavorites')}
            onRemove={onRemoveFav}
            onShareAll={onShareAll}
            hasAny={favorites.length > 0}
          />
        ) : sub === 'history' ? (
          <HistoryList
            items={filteredHistory}
            cardBg={cardBg}
            textColor={textColor}
            subText={subText}
            borderColor={borderColor}
            activeAccent={activeAccent}
            emptyText={t('library.emptyHistory')}
          />
        ) : (
          <PacksPanel
            cardBg={cardBg}
            textColor={textColor}
            subText={subText}
            borderColor={borderColor}
            activeAccent={activeAccent}
            onOpenPacks={() => router.push('/idea-bank')}
            onOpenHashtags={() => router.push('/hashtags')}
            onOpenHooks={() => router.push('/hooks')}
          />
        )}
      </ScrollView>
    </View>
  );
}

function FavoritesList(props: {
  items: FavoriteEntry[];
  cardBg: string;
  textColor: string;
  subText: string;
  borderColor: string;
  activeAccent: string;
  emptyText: string;
  onRemove: (text: string) => void;
  onShareAll: () => void;
  hasAny: boolean;
}) {
  const { t } = useTranslation();
  const { items, cardBg, textColor, subText, borderColor, activeAccent, emptyText, onRemove, onShareAll, hasAny } = props;
  if (items.length === 0) {
    return (
      <View style={[styles.empty, { borderColor }]}>
        <Text style={[styles.emptyEmoji]}>⭐</Text>
        <Text style={[styles.emptyText, { color: subText }]}>{emptyText}</Text>
        <Text style={[styles.emptyHint, { color: subText }]}>{t('favorites.hint')}</Text>
      </View>
    );
  }
  return (
    <>
      {hasAny && (
        <Pressable onPress={onShareAll} style={[styles.shareAll, { backgroundColor: activeAccent }]}>
          <Text style={styles.shareAllText}>{t('favorites.shareAll', 'Tümünü Paylaş')}</Text>
        </Pressable>
      )}
      {items.map((f, idx) => (
        <View
          key={`${f.text}-${idx}`}
          style={[styles.card, { backgroundColor: cardBg, borderColor }]}
        >
          <Text style={[styles.cardText, { color: textColor }]}>{f.text}</Text>
          <View style={styles.cardMeta}>
            <Text style={[styles.cardMetaText, { color: subText }]}>{formatDate(f.addedAt)}</Text>
            <Text style={[styles.cardMetaNiche, { color: activeAccent }]}>
              {t(`niches.${f.niche ?? ''}`, '')}
            </Text>
            <Pressable onPress={() => onRemove(f.text)} hitSlop={6}>
              <Text style={[styles.removeBtn, { color: '#EF4444' }]}>✕</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </>
  );
}

function HistoryList(props: {
  items: HistoryEntry[];
  cardBg: string;
  textColor: string;
  subText: string;
  borderColor: string;
  activeAccent: string;
  emptyText: string;
}) {
  const { t } = useTranslation();
  const { items, cardBg, textColor, subText, borderColor, activeAccent, emptyText } = props;
  if (items.length === 0) {
    return (
      <View style={[styles.empty, { borderColor }]}>
        <Text style={styles.emptyEmoji}>⏱</Text>
        <Text style={[styles.emptyText, { color: subText }]}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <>
      {items.map((h) => (
        <View key={h.weekId} style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.cardWeek, { color: activeAccent }]}>{formatWeek(h.weekId)}</Text>
          <View style={styles.historyStats}>
            <View style={styles.historyStat}>
              <Text style={[styles.historyStatValue, { color: textColor }]}>{h.totalIdeas}</Text>
              <Text style={[styles.historyStatLabel, { color: subText }]}>{t('stats.ideas')}</Text>
            </View>
            <View style={styles.historyStat}>
              <Text style={[styles.historyStatValue, { color: textColor }]}>{h.completed}</Text>
              <Text style={[styles.historyStatLabel, { color: subText }]}>{t('profile.tileDone')}</Text>
            </View>
            <View style={styles.historyStat}>
              <Text style={[styles.historyStatValue, { color: textColor }]}>{h.favorites}</Text>
              <Text style={[styles.historyStatLabel, { color: subText }]}>{t('profile.tileFavorites')}</Text>
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

function PacksPanel(props: {
  cardBg: string;
  textColor: string;
  subText: string;
  borderColor: string;
  activeAccent: string;
  onOpenPacks: () => void;
  onOpenHashtags: () => void;
  onOpenHooks: () => void;
}) {
  const { t } = useTranslation();
  const { cardBg, textColor, subText, borderColor, activeAccent, onOpenPacks, onOpenHashtags, onOpenHooks } = props;
  const links = [
    { emoji: '💡', title: t('ideaBank.title', 'Fikir Paketleri'), sub: t('ideaBank.sub', 'Hazır fikir paketleri'), onPress: onOpenPacks },
    { emoji: '#️⃣', title: t('hashtags.title', 'Hashtag Paketleri'), sub: t('hashtags.sub', 'Hazır hashtag paketleri'), onPress: onOpenHashtags },
    { emoji: '🪝', title: t('hooks.title', 'Hook Paketleri'), sub: t('hooks.sub', 'Dikkat çekici girişler'), onPress: onOpenHooks },
  ];
  return (
    <>
      {links.map((l, i) => (
        <Pressable key={i} onPress={l.onPress} style={[styles.card, styles.linkCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={styles.linkEmoji}>{l.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.linkTitle, { color: textColor }]}>{l.title}</Text>
            <Text style={[styles.linkSub, { color: subText }]}>{l.sub}</Text>
          </View>
          <Text style={[styles.linkArrow, { color: subText }]}>›</Text>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 80 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 50, marginBottom: 14 },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 4,
  },
  subTabEmoji: { fontSize: 14 },
  subTabLabel: { fontSize: 12 },
  badge: {
    minWidth: 18,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '800' },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  cardMetaText: { fontSize: 11, fontWeight: '600' },
  cardMetaNiche: { fontSize: 11, fontWeight: '700' },
  removeBtn: { fontSize: 18, fontWeight: '700', marginLeft: 'auto' },
  cardWeek: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  historyStats: { flexDirection: 'row', justifyContent: 'space-around' },
  historyStat: { alignItems: 'center', flex: 1 },
  historyStatValue: { fontSize: 22, fontWeight: '800' },
  historyStatLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  empty: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  emptyHint: { fontSize: 12, marginTop: 6, textAlign: 'center' },
  shareAll: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  shareAllText: { color: 'white', fontWeight: '800', fontSize: 13 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkEmoji: { fontSize: 28 },
  linkTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  linkSub: { fontSize: 12, fontWeight: '500' },
  linkArrow: { fontSize: 24, fontWeight: '300' },
  center: { padding: 30, alignItems: 'center' },
});
