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
  HOOK_STYLES,
  HOOK_FORMATS,
  GeneratedHook,
  HookStyle,
  HookFormat,
  HookFavorite,
  addHookFavorite,
  removeHookFavorite,
  getHookFavorites,
  addCopyToHistory,
  getStoredNiche,
  generateHooks,
  saveHooksBulk,
  estimateHookReach,
  SavedHook,
} from '../services/storage';
import { NicheId } from '../services/contentService';
import i18n from '../i18n';
import PageHint from '../components/PageHint';

const STYLE_ICONS: Record<HookStyle, { emoji: string; color: string; bg: string }> = {
  question: { emoji: '❓', color: '#0EA5E9', bg: '#E0F2FE' },
  stat: { emoji: '📊', color: '#8B5CF6', bg: '#F3E8FF' },
  bold: { emoji: '🔥', color: '#EF4444', bg: '#FEE2E2' },
  story: { emoji: '📖', color: '#10B981', bg: '#D1FAE5' },
  list: { emoji: '📋', color: '#F59E0B', bg: '#FEF3C7' },
  contrarian: { emoji: '⚡', color: '#EC4899', bg: '#FCE7F3' },
};

export default function HooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n: i18nInstance } = useTranslation();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [styleFilter, setStyleFilter] = useState<HookStyle | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<HookFormat | 'all'>('all');
  const [hooks, setHooks] = useState<GeneratedHook[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<HookFavorite[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [genCount, setGenCount] = useState(0);

  useEffect(() => {
    (async () => {
      const n = await getStoredNiche();
      setNiche(n);
      const favs = await getHookFavorites();
      setFavorites(favs);
    })();
  }, []);

  useEffect(() => {
    if (showFavorites) return;
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleFilter, formatFilter, niche]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const favs = await getHookFavorites();
        setFavorites(favs);
      })();
    }, [])
  );

  const regenerate = useCallback(async () => {
    setLoading(true);
    const list = generateHooks(niche, styleFilter, formatFilter, 30);
    setHooks(list);
    setGenCount((c) => c + 1);
    setLoading(false);
    const lng = (i18n.language || 'tr').split('-')[0] as 'tr' | 'en' | 'es' | 'de' | 'fr';
    const saved: SavedHook[] = list.map((h) => ({
      id: `hk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${h.templateId}`,
      text: h.text,
      style: h.style,
      format: h.format,
      pattern: h.pattern,
      templateId: h.templateId,
      niche,
      reach: estimateHookReach(h),
      language: lng,
      createdAt: Date.now(),
      favorited: false,
    }));
    try {
      await saveHooksBulk(saved);
    } catch {}
  }, [niche, styleFilter, formatFilter]);

  const isFavorited = (h: GeneratedHook): boolean => {
    return favorites.some(
      (f) => f.text === h.text && f.style === h.style && f.format === h.format
    );
  };

  const toggleFav = useCallback(
    async (h: GeneratedHook) => {
      const existing = favorites.find(
        (f) => f.text === h.text && f.style === h.style && f.format === h.format
      );
      let next: HookFavorite[];
      if (existing) {
        next = await removeHookFavorite(existing.id);
      } else {
        const fav: HookFavorite = {
          id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: h.text,
          style: h.style,
          format: h.format,
          pattern: h.pattern,
          niche,
          savedAt: Date.now(),
        };
        next = await addHookFavorite(fav);
      }
      setFavorites(next);
    },
    [favorites, niche]
  );

  const copyHook = useCallback(
    async (h: GeneratedHook, idx: number) => {
      try {
        Clipboard.setString(h.text);
        setCopiedIdx(idx);
        await addCopyToHistory(h.text, 'detail');
        setTimeout(() => setCopiedIdx(null), 1500);
      } catch {
        Alert.alert(t('hooks.copyErrorTitle'), t('hooks.copyErrorBody'));
      }
    },
    []
  );

  const clearAllFavorites = useCallback(() => {
    Alert.alert(
      t('hooks.clearAlertTitle'),
      t('hooks.clearAlertBody', { count: favorites.length }),
      [
        { text: t('hooks.cancelBtn'), style: 'cancel' },
        {
          text: t('hooks.deleteBtn'),
          style: 'destructive',
          onPress: async () => {
            for (const f of favorites) {
              await removeHookFavorite(f.id);
            }
            setFavorites([]);
          },
        },
      ]
    );
  }, [favorites, t]);

  const styleCount: Record<HookStyle, number> = {
    question: 0,
    stat: 0,
    bold: 0,
    story: 0,
    list: 0,
    contrarian: 0,
  };
  hooks.forEach((h) => {
    styleCount[h.style] += 1;
  });

  const formatCount: Record<HookFormat, number> = {
    reel: 0,
    carousel: 0,
    caption: 0,
    story: 0,
    thread: 0,
  };
  hooks.forEach((h) => {
    formatCount[h.format] += 1;
  });

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: t('hooks.title'),
          headerStyle: { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '700' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 18 }}>{t('hooks.backBtn')}</Text>
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => router.push('/hook-library')}
                style={{ paddingHorizontal: 8 }}
              >
                <Text style={{ fontSize: 14, color: '#0EA5E9', fontWeight: '600' }}>
                  📚
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowFavorites((v) => !v)}
                style={{ paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: 14, color: '#0EA5E9', fontWeight: '600' }}>
                  {showFavorites ? t('hooks.listBack') : t('hooks.favCountTpl', { count: favorites.length })}
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PageHint hintId="hooks" title={t('pageHints.hooks.title')} description={t('pageHints.hooks.desc')} variant="tip" />
        {!showFavorites ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroBadge}>{t('hooks.heroBadge')}</Text>
              <Text style={styles.heroTitle}>{t('hooks.heroTitle')}</Text>
              <Text style={styles.heroSub}>
                {niche
                  ? t('hooks.heroSubNiche')
                  : t('hooks.heroSubNoNiche')}
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{hooks.length}</Text>
                  <Text style={styles.heroStatLabel}>{t('hooks.statGenerated')}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{favorites.length}</Text>
                  <Text style={styles.heroStatLabel}>{t('hooks.statFavorites')}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{genCount}</Text>
                  <Text style={styles.heroStatLabel}>{t('hooks.statRefreshes')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('hooks.styleTitle')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  onPress={() => setStyleFilter('all')}
                  style={[
                    styles.styleChip,
                    styleFilter === 'all' && styles.styleChipOn,
                  ]}
                >
                  <Text style={[styles.styleChipText, styleFilter === 'all' && styles.styleChipTextOn]}>
                    {t('hooks.allFilter')}
                  </Text>
                </Pressable>
                {HOOK_STYLES.map((s) => {
                  const count = styleCount[s.id];
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setStyleFilter(s.id)}
                      style={[
                        styles.styleChip,
                        styleFilter === s.id && { backgroundColor: s.bg, borderColor: s.color },
                      ]}
                    >
                      <Text style={styles.styleChipEmoji}>{s.emoji}</Text>
                      <Text style={[styles.styleChipText, styleFilter === s.id && { color: s.color, fontWeight: '700' }]}>
                        {s.label}
                      </Text>
                      {count > 0 && (
                        <Text style={styles.styleChipCount}>{count}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('hooks.formatTitle')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  onPress={() => setFormatFilter('all')}
                  style={[
                    styles.styleChip,
                    formatFilter === 'all' && styles.styleChipOn,
                  ]}
                >
                  <Text style={[styles.styleChipText, formatFilter === 'all' && styles.styleChipTextOn]}>
                    {t('hooks.allFilter')}
                  </Text>
                </Pressable>
                {HOOK_FORMATS.map((f) => {
                  const count = formatCount[f.id];
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setFormatFilter(f.id)}
                      style={[
                        styles.styleChip,
                        formatFilter === f.id && styles.styleChipOn,
                      ]}
                    >
                      <Text style={styles.styleChipEmoji}>{f.emoji}</Text>
                      <Text style={[styles.styleChipText, formatFilter === f.id && styles.styleChipTextOn]}>
                        {f.label}
                      </Text>
                      {count > 0 && (
                        <Text style={styles.styleChipCount}>{count}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Pressable onPress={regenerate} style={styles.refreshBtn}>
              <Text style={styles.refreshBtnText}>{t('hooks.refreshBtn')}</Text>
            </Pressable>

            {loading ? (
              <ActivityIndicator color="#0EA5E9" style={{ marginVertical: 24 }} />
            ) : (
              <View style={styles.hookList}>
                {hooks.length === 0 ? (
                  <Text style={styles.emptyText}>{t('hooks.emptyText')}</Text>
                ) : (
                  hooks.map((h, idx) => {
                    const styleInfo = STYLE_ICONS[h.style];
                    const formatInfo = HOOK_FORMATS.find((f) => f.id === h.format);
                    const isFav = isFavorited(h);
                    return (
                      <View key={`${h.templateId}-${idx}`} style={styles.hookCard}>
                        <View style={styles.hookHeader}>
                          <View style={[styles.hookBadge, { backgroundColor: styleInfo.bg }]}>
                            <Text style={[styles.hookBadgeText, { color: styleInfo.color }]}>
                              {styleInfo.emoji} {h.style.toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.hookFormat}>
                            <Text style={styles.hookFormatText}>
                              {formatInfo?.emoji} {formatInfo?.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.hookText}>{h.text}</Text>
                        <Text style={styles.hookPattern}>{t('hooks.patternPrefix')}{h.pattern}</Text>
                        <View style={styles.hookActions}>
                          <Pressable
                            onPress={() => copyHook(h, idx)}
                            style={[styles.hookBtn, styles.hookBtnCopy]}
                          >
                            <Text style={styles.hookBtnCopyText}>
                              {copiedIdx === idx ? t('hooks.copyDone') : t('hooks.copyBtn')}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => toggleFav(h)}
                            style={[styles.hookBtn, styles.hookBtnFav, isFav && styles.hookBtnFavOn]}
                          >
                            <Text style={[styles.hookBtnFavText, isFav && styles.hookBtnFavTextOn]}>
                              {isFav ? t('hooks.favorited') : t('hooks.addFavorite')}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>{t('hooks.tipTitle')}</Text>
              <Text style={styles.tipText}>
                {t('hooks.tipBody')}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroBadge}>{t('hooks.favHeroBadge')}</Text>
              <Text style={styles.heroTitle}>{t('hooks.favHeroTitle')}</Text>
              <Text style={styles.heroSub}>
                {t('hooks.favHeroSub', { count: favorites.length })}
              </Text>
            </View>

            {favorites.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>{t('hooks.favEmpty')}</Text>
              </View>
            ) : (
              <>
                <Pressable onPress={clearAllFavorites} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>{t('hooks.clearAllBtn')}</Text>
                </Pressable>
                <View style={styles.hookList}>
                  {favorites.map((f, idx) => {
                    const styleInfo = STYLE_ICONS[f.style];
                    const formatInfo = HOOK_FORMATS.find((x) => x.id === f.format);
                    return (
                      <View key={f.id} style={styles.hookCard}>
                        <View style={styles.hookHeader}>
                          <View style={[styles.hookBadge, { backgroundColor: styleInfo.bg }]}>
                            <Text style={[styles.hookBadgeText, { color: styleInfo.color }]}>
                              {styleInfo.emoji} {f.style.toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.hookFormat}>
                            <Text style={styles.hookFormatText}>
                              {formatInfo?.emoji} {formatInfo?.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.hookText}>{f.text}</Text>
                        <Text style={styles.hookPattern}>{t('hooks.patternPrefix')}{f.pattern}</Text>
                        <Text style={styles.hookMeta}>
                          {new Date(f.savedAt).toLocaleDateString((i18nInstance.language || 'en').split('-')[0], {
                            day: '2-digit',
                            month: 'short',
                          })}
                          {f.niche ? ` · ${f.niche}` : ''}
                        </Text>
                        <View style={styles.hookActions}>
                          <Pressable
                            onPress={async () => {
                              Clipboard.setString(f.text);
                              await addCopyToHistory(f.text, 'detail');
                              Alert.alert(t('hooks.copyAlertTitle'), t('hooks.copyAlertBody'));
                            }}
                            style={[styles.hookBtn, styles.hookBtnCopy]}
                          >
                            <Text style={styles.hookBtnCopyText}>{t('hooks.copyBtn')}</Text>
                          </Pressable>
                          <Pressable
                            onPress={async () => {
                              const next = await removeHookFavorite(f.id);
                              setFavorites(next);
                            }}
                            style={[styles.hookBtn, styles.hookBtnFav, styles.hookBtnFavOn]}
                          >
                            <Text style={[styles.hookBtnFavText, styles.hookBtnFavTextOn]}>
                              {t('hooks.removeFavBtn')}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 16 },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  heroBadge: {
    color: '#0EA5E9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  heroSub: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 12 },
  heroStats: { flexDirection: 'row', gap: 12 },
  heroStat: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: '#0EA5E9' },
  heroStatLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  styleChipOn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  styleChipEmoji: { fontSize: 14 },
  styleChipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  styleChipTextOn: { color: '#fff', fontWeight: '700' },
  styleChipCount: {
    fontSize: 10,
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  refreshBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hookList: { gap: 12 },
  hookCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  hookBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hookBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  hookFormat: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hookFormatText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  hookText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 6,
  },
  hookPattern: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  hookMeta: { fontSize: 10, color: '#94A3B8', marginBottom: 10 },
  hookActions: { flexDirection: 'row', gap: 8 },
  hookBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  hookBtnCopy: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  hookBtnCopyText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  hookBtnFav: { backgroundColor: '#fff', borderColor: '#E2E8F0' },
  hookBtnFavOn: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  hookBtnFavText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  hookBtnFavTextOn: { color: '#B45309', fontWeight: '700' },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 14,
    paddingVertical: 24,
  },
  emptyBox: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  tipBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  tipTitle: { fontSize: 13, fontWeight: '700', color: '#0369A1', marginBottom: 6 },
  tipText: { fontSize: 13, color: '#0C4A6E', lineHeight: 18 },
  clearBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  clearBtnText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
});