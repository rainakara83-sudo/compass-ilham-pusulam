import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useTranslation } from 'react-i18next';
import {
  CopyEntry,
  getDoneIdeas,
  getFavorites,
  getHistory,
  getRecentCopies,
  getStoredNiche,
  HistoryEntry,
  toggleDone,
  toggleFavorite,
} from '../services/storage';
import { NicheId, getNichePool } from '../services/contentService';
import contentPool from '../data/content-pool.json';

type Source = 'all' | 'pool' | 'favorites' | 'history' | 'done' | 'copies';

type ResultItem = {
  text: string;
  source: Exclude<Source, 'all'>;
  meta?: string;
};

const SOURCE_META: Record<Exclude<Source, 'all'>, { icon: string; label: string; color: string }> = {
  pool: { icon: '📚', label: 'Havuz', color: '#4D96FF' },
  favorites: { icon: '⭐', label: 'Favori', color: '#F59E0B' },
  history: { icon: '📜', label: 'Geçmiş', color: '#8B5CF6' },
  done: { icon: '✅', label: 'Tamamlanan', color: '#10B981' },
  copies: { icon: '⧉', label: 'Kopyalanan', color: '#EC4899' },
};

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<Source>('all');
  const [loading, setLoading] = useState(true);
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [copies, setCopies] = useState<CopyEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, favs, hist, dn, cps] = await Promise.all([
        getStoredNiche(),
        getFavorites(),
        getHistory(),
        getDoneIdeas(),
        getRecentCopies(),
      ]);
      setNiche(n);
      setFavorites(favs ?? []);
      setHistory(hist ?? []);
      setDone(dn ?? []);
      setCopies(cps ?? []);
    } catch (e) {
      console.warn('search load error', e);
      setFavorites([]);
      setHistory([]);
      setDone([]);
      setCopies([]);
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

  const pool: string[] = useMemo(() => {
    const lng = (i18n.language || 'en').split('-')[0] as 'tr' | 'en' | 'es' | 'de' | 'fr';
    if (niche) {
      const fromNiche = getNichePool(niche, lng);
      if (fromNiche.length > 0) return fromNiche;
    }
    const allNicheIds = Object.keys(contentPool) as NicheId[];
    const fallback: string[] = [];
    for (const id of allNicheIds) {
      const items = getNichePool(id, lng);
      for (const item of items) {
        if (!fallback.includes(item)) fallback.push(item);
      }
    }
    return fallback;
  }, [niche, i18n.language]);

  const results: ResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const items: ResultItem[] = [];
    const matches = (text: string) => text.toLowerCase().includes(q);

    if (source === 'all' || source === 'pool') {
      for (const t of pool) if (matches(t)) items.push({ text: t, source: 'pool' });
    }
    if (source === 'all' || source === 'favorites') {
      for (const t of favorites) if (matches(t)) items.push({ text: t, source: 'favorites' });
    }
    if (source === 'all' || source === 'history') {
      const seen = new Set<string>();
      for (const h of history) {
        for (const idea of h.ideas) {
          if (seen.has(idea.text)) continue;
          if (matches(idea.text)) {
            items.push({ text: idea.text, source: 'history', meta: h.weekId });
            seen.add(idea.text);
          }
        }
      }
    }
    if (source === 'all' || source === 'done') {
      for (const t of done) if (matches(t)) items.push({ text: t, source: 'done' });
    }
    if (source === 'all' || source === 'copies') {
      const seen = new Set<string>();
      for (const c of copies) {
        if (seen.has(c.text)) continue;
        if (matches(c.text)) {
          items.push({ text: c.text, source: 'copies', meta: c.source });
          seen.add(c.text);
        }
      }
    }
    return items;
  }, [query, source, pool, favorites, history, done, copies]);

  const counts = useMemo(() => {
    const c: Record<Exclude<Source, 'all'>, number> = { pool: 0, favorites: 0, history: 0, done: 0, copies: 0 };
    for (const r of results) c[r.source] += 1;
    return c;
  }, [results]);

  const onCopy = (text: string) => {
    Clipboard.setString(text);
  };

  const onToggleFav = async (text: string) => {
    await toggleFavorite(text);
    setFavorites((prev) => (prev.includes(text) ? prev.filter((x) => x !== text) : [text, ...prev]));
  };

  const onToggleDone = async (text: string) => {
    await toggleDone(text);
    setDone((prev) => (prev.includes(text) ? prev.filter((x) => x !== text) : [text, ...prev]));
  };

  const openDetail = (text: string) => {
    router.push({
      pathname: '/idea/[text]',
      params: { text: encodeURIComponent(text), niche: niche ?? '', source: 'search' },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
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
        <Text style={styles.title}>🔎 İçerik Ara</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Fikir, başlık, kelime yaz…"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
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
          label={`Tümü${query.trim().length >= 1 ? ` (${results.length})` : ''}`}
          active={source === 'all'}
          color="#111827"
          onPress={() => setSource('all')}
        />
        {(Object.keys(SOURCE_META) as Array<keyof typeof SOURCE_META>).map((s) => (
          <FilterChip
            key={s}
            label={`${SOURCE_META[s].icon} ${SOURCE_META[s].label}${query.trim().length >= 1 ? ` (${counts[s]})` : ''}`}
            active={source === s}
            color={SOURCE_META[s].color}
            onPress={() => setSource(s)}
          />
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 60 }}
      >
        {query.trim().length < 1 ? (
          <Text style={styles.empty}>
            Aramak için bir kelime yaz. Tüm kaynaklarda (havuz, favoriler, geçmiş, tamamlanan, kopyalanan) arar.
          </Text>
        ) : results.length === 0 ? (
          <Text style={styles.empty}>“{query}” için sonuç bulunamadı.</Text>
        ) : (
          results.map((r, idx) => {
            const meta = SOURCE_META[r.source];
            const isFav = favorites.includes(r.text);
            const isDone = done.includes(r.text);
            return (
              <View key={`${r.source}-${idx}-${r.text}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, { backgroundColor: meta.color + '22' }]}>
                    <Text style={[styles.badgeTxt, { color: meta.color }]}>
                      {meta.icon} {meta.label}
                      {r.meta ? ` • ${r.meta}` : ''}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => openDetail(r.text)}>
                  <Text style={styles.text}>{r.text}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable onPress={() => onCopy(r.text)} style={styles.actionBtn}>
                    <Text style={styles.actionTxt}>⧉ Kopyala</Text>
                  </Pressable>
                  {r.source !== 'favorites' && (
                    <Pressable onPress={() => onToggleFav(r.text)} style={styles.actionBtn}>
                      <Text style={[styles.actionTxt, isFav && { color: '#F59E0B' }]}>
                        {isFav ? '★' : '☆'}
                      </Text>
                    </Pressable>
                  )}
                  {r.source !== 'done' && (
                    <Pressable onPress={() => onToggleDone(r.text)} style={styles.actionBtn}>
                      <Text style={[styles.actionTxt, isDone && { color: '#10B981' }]}>
                        {isDone ? '✓ Yapıldı' : '○ Yapıldı'}
                      </Text>
                    </Pressable>
                  )}
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4, width: 50 },
  backTxt: { fontSize: 16, color: '#4D96FF', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#4D96FF',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnTxt: { fontSize: 12, color: '#374151', fontWeight: '800' },
  chipRow: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'white',
  },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  empty: {
    textAlign: 'center',
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 30,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  card: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: { marginBottom: 8 },
  badge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  text: { fontSize: 14, color: '#111827', fontWeight: '500', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  actionTxt: { fontSize: 12, color: '#374151', fontWeight: '700' },
});