import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import contentPool from '../data/content-pool.json';
import {
  HOOK_STYLES,
  HOOK_FORMATS,
  HookStyle,
  HookFormat,
  HookReach,
  SavedHook,
  getAllHooks,
  toggleHookFavoriteById,
  deleteSavedHook,
  clearAllSavedHooks,
  addCopyToHistory,
  getHookFavorites,
  addHookFavorite,
  removeHookFavorite,
} from '../services/storage';
import { NicheId } from '../services/contentService';
import PageHint from '../components/PageHint';

const STYLE_ICONS: Record<HookStyle, { emoji: string; color: string; bg: string }> = {
  question: { emoji: '❓', color: '#0EA5E9', bg: '#E0F2FE' },
  stat: { emoji: '📊', color: '#8B5CF6', bg: '#F3E8FF' },
  bold: { emoji: '🔥', color: '#EF4444', bg: '#FEE2E2' },
  story: { emoji: '📖', color: '#10B981', bg: '#D1FAE5' },
  list: { emoji: '📋', color: '#F59E0B', bg: '#FEF3C7' },
  contrarian: { emoji: '⚡', color: '#EC4899', bg: '#FCE7F3' },
};

const REACH_META: Record<HookReach, { label: string; color: string; bg: string; emoji: string }> = {
  low: { label: 'Low', color: '#64748B', bg: '#F1F5F9', emoji: '🌱' },
  medium: { label: 'Medium', color: '#0EA5E9', bg: '#E0F2FE', emoji: '📈' },
  high: { label: 'High', color: '#8B5CF6', bg: '#F3E8FF', emoji: '🚀' },
  viral: { label: 'Viral', color: '#EF4444', bg: '#FEE2E2', emoji: '🔥' },
};

const DATE_RANGES = ['all', '7d', '30d'] as const;
type DateRange = typeof DATE_RANGES[number];

const LANGS: Array<'tr' | 'en' | 'es' | 'de' | 'fr'> = ['tr', 'en', 'es', 'de', 'fr'];

const NICHE_LIST: Array<{ id: NicheId; label: string; color: string }> = (
  contentPool && typeof contentPool === 'object' ? Object.keys(contentPool) : []
).map((id) => {
  return {
    id: id as NicheId,
    label: id,
    color: '#0EA5E9',
  };
});

export default function HookLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n: i18nInstance } = useTranslation();
  const currentLng = (i18nInstance.language || 'en').split('-')[0] as 'tr' | 'en' | 'es' | 'de' | 'fr';

  const [hooks, setHooks] = useState<SavedHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheFilter, setNicheFilter] = useState<NicheId | 'all'>('all');
  const [reachFilter, setReachFilter] = useState<HookReach | 'all'>('all');
  const [langFilter, setLangFilter] = useState<typeof LANGS[number] | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateRange>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllHooks();
      setHooks(list ?? []);
    } catch (e) {
      console.warn('hook library load error', e);
      setHooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load, i18n.language]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      dateFilter === '7d' ? 7 * 86400000 : dateFilter === '30d' ? 30 * 86400000 : Infinity;
    return hooks.filter((h) => {
      if (nicheFilter !== 'all' && h.niche !== nicheFilter) return false;
      if (reachFilter !== 'all' && h.reach !== reachFilter) return false;
      if (langFilter !== 'all' && h.language !== langFilter) return false;
      if (cutoff !== Infinity && now - h.createdAt > cutoff) return false;
      if (favOnly && !h.favorited) return false;
      if (q.length > 0 && !h.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [hooks, nicheFilter, reachFilter, langFilter, dateFilter, favOnly, query]);

  const counts = useMemo(() => {
    const c = { total: hooks.length, filtered: filtered.length, favorites: hooks.filter((h) => h.favorited).length };
    return c;
  }, [hooks, filtered]);

  const onCopy = useCallback(async (h: SavedHook) => {
    Clipboard.setString(h.text);
    setCopiedId(h.id);
    try {
      await addCopyToHistory(h.text, 'detail');
    } catch {}
    setTimeout(() => setCopiedId((id) => (id === h.id ? null : id)), 1500);
  }, []);

  const onToggleFav = useCallback(async (h: SavedHook) => {
    const next = await toggleHookFavoriteById(h.id);
    setHooks(next);
    try {
      const favList = await getHookFavorites();
      const exists = favList.some((f) => f.text === h.text && f.style === h.style && f.format === h.format);
      if (h.favorited && exists) {
        const ex = favList.find((f) => f.text === h.text && f.style === h.style && f.format === h.format);
        if (ex) await removeHookFavorite(ex.id);
      } else if (!h.favorited && !exists) {
        await addHookFavorite({
          id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: h.text,
          style: h.style,
          format: h.format,
          pattern: h.pattern,
          niche: h.niche,
          savedAt: Date.now(),
        });
      }
    } catch {}
  }, []);

  const onDelete = useCallback((h: SavedHook) => {
    Alert.alert(t('hookLib.deleteTitle'), t('hookLib.deleteBody'), [
      { text: t('hookLib.cancelBtn'), style: 'cancel' },
      {
        text: t('hookLib.deleteBtn'),
        style: 'destructive',
        onPress: async () => {
          const next = await deleteSavedHook(h.id);
          setHooks(next);
        },
      },
    ]);
  }, [t]);

  const onShare = useCallback(async (h: SavedHook) => {
    try {
      await Share.share({ message: h.text, title: 'Hook' });
    } catch (e) {
      console.warn('share error', e);
    }
  }, []);

  const onClearAll = useCallback(() => {
    Alert.alert(t('hookLib.clearTitle'), t('hookLib.clearBody', { count: hooks.length }), [
      { text: t('hookLib.cancelBtn'), style: 'cancel' },
      {
        text: t('hookLib.clearBtn'),
        style: 'destructive',
        onPress: async () => {
          await clearAllSavedHooks();
          setHooks([]);
        },
      },
    ]);
  }, [hooks.length, t]);

  const exportCSV = useCallback(async () => {
    const headers = ['text', 'niche', 'style', 'format', 'reach', 'language', 'createdAt'];
    const rows = filtered.map((h) => [
      `"${h.text.replace(/"/g, '""')}"`,
      h.niche ?? '',
      h.style,
      h.format,
      h.reach,
      h.language,
      new Date(h.createdAt).toISOString(),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const md = [
      `# Hook Library — ${new Date().toLocaleDateString(currentLng)}`,
      '',
      `**Total:** ${filtered.length}`,
      '',
      '| Text | Niche | Style | Format | Reach | Lang | Date |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...filtered.map((h) =>
        `| ${h.text.replace(/\|/g, '\\|')} | ${h.niche ?? '-'} | ${h.style} | ${h.format} | ${h.reach} | ${h.language} | ${new Date(h.createdAt).toLocaleDateString(currentLng)} |`
      ),
    ].join('\n');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hook-library-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (e) {
        console.warn('web export error', e);
      }
    }
    Clipboard.setString(md);
    Alert.alert(t('hookLib.exportCopiedTitle'), t('hookLib.exportCopiedBody'));
  }, [filtered, t, currentLng]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0EA5E9" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <PageHint hintId="hookLibrary" title={t('pageHints.hookLibrary.title')} description={t('pageHints.hookLibrary.desc')} variant="highlight" />

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={6}>
          <Text style={styles.backTxt}>‹ {t('hookLib.backBtn')}</Text>
        </Pressable>
        <Text style={styles.title}>📚 {t('hookLib.title')}</Text>
        <Pressable onPress={() => router.push('/hooks')} style={styles.headerBtn} hitSlop={6}>
          <Text style={styles.headerBtnTxt}>➕</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.total}</Text>
          <Text style={styles.statLabel}>{t('hookLib.totalLabel')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.filtered}</Text>
          <Text style={styles.statLabel}>{t('hookLib.filteredLabel')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.favorites}</Text>
          <Text style={styles.statLabel}>{t('hookLib.favLabel')}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('hookLib.searchPlaceholder')}
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnTxt}>✕</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <FilterChip
          label={`⭐ ${t('hookLib.favOnly')}`}
          active={favOnly}
          color="#F59E0B"
          onPress={() => setFavOnly((v) => !v)}
        />
        <FilterChip
          label={`📅 ${t('hookLib.allTime')}`}
          active={dateFilter === 'all'}
          color="#64748B"
          onPress={() => setDateFilter('all')}
        />
        <FilterChip
          label={`📅 7${t('hookLib.days')}`}
          active={dateFilter === '7d'}
          color="#64748B"
          onPress={() => setDateFilter('7d')}
        />
        <FilterChip
          label={`📅 30${t('hookLib.days')}`}
          active={dateFilter === '30d'}
          color="#64748B"
          onPress={() => setDateFilter('30d')}
        />
      </ScrollView>

      <Text style={styles.filterSection}>{t('hookLib.reachLabel')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <FilterChip
          label={`${t('hookLib.all')}`}
          active={reachFilter === 'all'}
          color="#111827"
          onPress={() => setReachFilter('all')}
        />
        {(Object.keys(REACH_META) as HookReach[]).map((r) => (
          <FilterChip
            key={r}
            label={`${REACH_META[r].emoji} ${REACH_META[r].label}`}
            active={reachFilter === r}
            color={REACH_META[r].color}
            onPress={() => setReachFilter(r)}
          />
        ))}
      </ScrollView>

      <Text style={styles.filterSection}>{t('hookLib.langLabel')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <FilterChip
          label={`${t('hookLib.all')}`}
          active={langFilter === 'all'}
          color="#111827"
          onPress={() => setLangFilter('all')}
        />
        {LANGS.map((l) => (
          <FilterChip
            key={l}
            label={l.toUpperCase()}
            active={langFilter === l}
            color="#0EA5E9"
            onPress={() => setLangFilter(l)}
          />
        ))}
      </ScrollView>

      <Text style={styles.filterSection}>{t('hookLib.nicheLabel')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <FilterChip
          label={`${t('hookLib.all')}`}
          active={nicheFilter === 'all'}
          color="#111827"
          onPress={() => setNicheFilter('all')}
        />
        {NICHE_LIST.map((n) => (
          <FilterChip
            key={n.id}
            label={n.id}
            active={nicheFilter === n.id}
            color={n.color}
            onPress={() => setNicheFilter(n.id)}
          />
        ))}
      </ScrollView>

      {filtered.length > 0 && (
        <View style={styles.toolbar}>
          <Pressable onPress={exportCSV} style={styles.exportBtn}>
            <Text style={styles.exportBtnTxt}>📤 {t('hookLib.exportBtn')}</Text>
          </Pressable>
          <Pressable onPress={onClearAll} style={styles.clearBtnToolbar}>
            <Text style={styles.clearBtnToolbarTxt}>🗑️ {t('hookLib.clearAllBtn')}</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 60 }}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>{t('hookLib.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('hookLib.emptyText')}</Text>
            <Pressable onPress={() => router.push('/hooks')} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnTxt}>🎣 {t('hookLib.goGenerator')}</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map((h) => {
            const styleInfo = STYLE_ICONS[h.style];
            const formatInfo = HOOK_FORMATS.find((f) => f.id === h.format);
            const reachInfo = REACH_META[h.reach];
            return (
              <View key={h.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.styleBadge, { backgroundColor: styleInfo.bg }]}>
                    <Text style={[styles.styleBadgeTxt, { color: styleInfo.color }]}>
                      {styleInfo.emoji} {h.style.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.reachBadge, { backgroundColor: reachInfo.bg }]}>
                    <Text style={[styles.reachBadgeTxt, { color: reachInfo.color }]}>
                      {reachInfo.emoji} {reachInfo.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.hookText}>{h.text}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaPill}>{formatInfo?.emoji} {formatInfo?.label}</Text>
                  {h.niche && <Text style={styles.metaPill}>🎯 {h.niche}</Text>}
                  <Text style={styles.metaPill}>🌐 {h.language.toUpperCase()}</Text>
                  <Text style={styles.metaPill}>
                    📅 {new Date(h.createdAt).toLocaleDateString(currentLng)}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable onPress={() => onCopy(h)} style={[styles.actionBtn, styles.actionBtnCopy]}>
                    <Text style={styles.actionBtnCopyTxt}>
                      {copiedId === h.id ? t('hookLib.copyDone') : `⧉ ${t('hookLib.copyBtn')}`}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => onToggleFav(h)} style={[styles.actionBtn, h.favorited && styles.actionBtnFavOn]}>
                    <Text style={[styles.actionBtnTxt, h.favorited && styles.actionBtnFavTxtOn]}>
                      {h.favorited ? '★' : '☆'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => onShare(h)} style={styles.actionBtn}>
                    <Text style={styles.actionBtnTxt}>↗</Text>
                  </Pressable>
                  <Pressable onPress={() => onDelete(h)} style={styles.actionBtn}>
                    <Text style={[styles.actionBtnTxt, { color: '#EF4444' }]}>🗑</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const FilterChip: React.FC<{ label: string; active: boolean; onPress: () => void; color: string }> = ({
  label,
  active,
  onPress,
  color,
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, { borderColor: color }, active && { backgroundColor: color + '22' }]}
  >
    <Text style={[styles.chipTxt, { color: active ? color : '#374151' }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4, width: 80 },
  backTxt: { fontSize: 15, color: '#0EA5E9', fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A', flex: 1, textAlign: 'center' },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnTxt: { fontSize: 18, color: '#0EA5E9', fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#0EA5E9' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2, fontWeight: '600' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnTxt: { fontSize: 11, color: '#475569', fontWeight: '800' },
  filterSection: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  chipRow: { paddingHorizontal: 12, gap: 6, paddingVertical: 4 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: '#fff',
  },
  chipTxt: { fontSize: 11, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  exportBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  clearBtnToolbar: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  clearBtnToolbarTxt: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  styleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  styleBadgeTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  reachBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  reachBadgeTxt: { fontSize: 10, fontWeight: '700' },
  hookText: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaPill: {
    fontSize: 10,
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnCopy: { flex: 1, backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  actionBtnCopyTxt: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  actionBtnFavOn: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  actionBtnTxt: { fontSize: 14, color: '#475569', fontWeight: '700' },
  actionBtnFavTxtOn: { color: '#B45309' },
  emptyBox: {
    alignItems: 'center',
    padding: 36,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginTop: 20,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  emptyBtn: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
