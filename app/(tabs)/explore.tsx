import React, { useCallback, useEffect, useState } from 'react';
import { Clipboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getStoredNiche, getFavorites, toggleFavorite, addCopyToHistory } from '../../services/storage';
import { NicheId, getNichePool, pickRandomFromPool, searchNichePool } from '../../services/contentService';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const deepQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [query, setQuery] = useState(deepQ ?? '');
  const [items, setItems] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [randomIdea, setRandomIdea] = useState<string | null>(null);
  const [randomCopied, setRandomCopied] = useState(false);

  useEffect(() => {
    if (deepQ !== undefined && deepQ !== query) setQuery(deepQ);
  }, [deepQ]);

  const load = useCallback(async () => {
    const n = await getStoredNiche();
    setNiche(n);
    const favs = await getFavorites();
    setFavorites(favs);
    if (n) {
      setItems(query ? searchNichePool(n, query) : getNichePool(n));
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onFav = async (idea: string) => {
    await toggleFavorite(idea);
    setFavorites((prev) => (prev.includes(idea) ? prev.filter((x) => x !== idea) : [idea, ...prev]));
  };

  const onCopy = async (idx: number, text: string) => {
    Clipboard.setString(text);
    setCopiedIdx(idx);
    await addCopyToHistory(text, 'pool');
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const onCopyRandom = async () => {
    if (!randomIdea) return;
    Clipboard.setString(randomIdea);
    setRandomCopied(true);
    await addCopyToHistory(randomIdea, 'pool');
    setTimeout(() => setRandomCopied(false), 1500);
  };

  const rollRandom = () => {
    if (!niche) return;
    const next = pickRandomFromPool(niche, [randomIdea ?? '']);
    setRandomIdea(next);
  };

  const clearSearch = () => setQuery('');

  const openDetail = (text: string) => {
    router.push({
      pathname: '/idea/[text]',
      params: { text: encodeURIComponent(text), niche: niche ?? '', source: 'pool' },
    });
  };

  if (!niche) {
    return (
      <View style={styles.center}>
        <Text>{t('home.noIdeas')}</Text>
      </View>
    );
  }

  const favoriteMatches = query
    ? favorites.filter((f) => f.toLowerCase().includes(query.trim().toLowerCase()))
    : favorites;
  const showFavSection = favoriteMatches.length > 0 && !query;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Keşfet</Text>
        <Text style={styles.subtitle}>
          {t(`niches.${niche}`, niche)} • {items.length} fikir
        </Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder="Fikirlerde ara..."
            value={query}
            onChangeText={setQuery}
            placeholderTextColor="#9CA3AF"
          />
          {query.length > 0 && (
            <Pressable onPress={clearSearch} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={rollRandom} style={styles.randomBtn}>
          <Text style={styles.randomBtnText}>🎲 Rastgele fikir getir</Text>
        </Pressable>
        {randomIdea && (
          <View style={styles.randomCard}>
            <Text style={styles.randomLabel}>🎯 Rastgele fikrin</Text>
            <Text style={styles.randomText}>{randomIdea}</Text>
            <View style={styles.randomActions}>
              <Pressable onPress={onCopyRandom} style={styles.randomAction}>
                <Text style={styles.randomActionText}>{randomCopied ? '✓ Kopyalandı' : '⧉ Kopyala'}</Text>
              </Pressable>
              <Pressable onPress={() => onFav(randomIdea)} style={styles.randomAction}>
                <Text style={styles.randomActionText}>
                  {favorites.includes(randomIdea) ? '★ Favoride' : '☆ Favoriye ekle'}
                </Text>
              </Pressable>
              <Pressable onPress={() => openDetail(randomIdea)} style={styles.randomAction}>
                <Text style={styles.randomActionText}>↗ Detay</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        {items.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>🔎 "{query}" için sonuç yok</Text>
            <Pressable onPress={clearSearch} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Aramayı temizle</Text>
            </Pressable>
          </View>
        )}

        {showFavSection && (
          <>
            <Text style={styles.section}>⭐ Favorilerin ({favoriteMatches.length})</Text>
            {favoriteMatches.map((idea, idx) => (
              <View key={`fav-${idx}`} style={[styles.card, styles.cardFav]}>
                <Pressable onPress={() => openDetail(idea)}>
                  <Text style={styles.ideaText}>{idea}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable onPress={() => onFav(idea)} style={styles.iconBtn}>
                    <Text style={[styles.iconBtnText, { color: '#F59E0B' }]}>★</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.section}>📚 Havuzdan diğerleri</Text>
          </>
        )}

        {items.map((idea, idx) => {
          const isFav = favorites.includes(idea);
          if (showFavSection && isFav) return null;
          return (
            <View key={`${idea}-${idx}`} style={styles.card}>
              <Pressable onPress={() => openDetail(idea)}>
                <Text style={styles.ideaText}>{idea}</Text>
              </Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => onCopy(idx, idea)} style={styles.iconBtn}>
                  <Text style={styles.iconBtnText}>{copiedIdx === idx ? '✓' : '⧉'}</Text>
                </Pressable>
                <Pressable onPress={() => onFav(idea)} style={styles.iconBtn}>
                  <Text style={[styles.iconBtnText, isFav && { color: '#F59E0B' }]}>
                    {isFav ? '★' : '☆'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, textTransform: 'capitalize' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  search: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  clearBtn: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: { fontSize: 14, color: '#374151', fontWeight: '700' },
  randomBtn: {
    marginTop: 12,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  randomBtnText: { color: '#92400E', fontWeight: '800', fontSize: 13 },
  randomCard: {
    marginTop: 10,
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    padding: 14,
    borderRadius: 12,
  },
  randomLabel: { fontSize: 11, fontWeight: '800', color: '#92400E', letterSpacing: 1, marginBottom: 6 },
  randomText: { fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20 },
  randomActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  randomAction: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' },
  randomActionText: { fontSize: 11, color: '#92400E', fontWeight: '700' },
  section: { fontSize: 12, fontWeight: '800', color: '#6B7280', marginTop: 8, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  card: { backgroundColor: 'white', padding: 14, borderRadius: 14, marginBottom: 10 },
  cardFav: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1 },
  ideaText: { fontSize: 15, color: '#111827', fontWeight: '500', lineHeight: 22 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  iconBtnText: { fontSize: 14, color: '#4D96FF', fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  emptyBtn: { backgroundColor: '#4D96FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: 'white', fontWeight: '700' },
});
