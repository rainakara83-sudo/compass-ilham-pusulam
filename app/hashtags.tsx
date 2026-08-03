import React, { useCallback, useState } from 'react';
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
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HASHTAG_CATEGORY_META, HashtagCategory, HashtagItem, generateHashtags, normalizeTag } from '../services/aiService';
import { NicheId } from '../services/contentService';
import { getStoredNiche, addIdeaTag, addCopyToHistory } from '../services/storage';

export default function HashtagsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ text?: string; niche?: string }>();
  const initialText = typeof params.text === 'string' ? decodeURIComponent(params.text) : '';
  const initialNiche = typeof params.niche === 'string' ? (params.niche as NicheId) : null;

  const [draft, setDraft] = useState(initialText);
  const [niche, setNiche] = useState<NicheId | null>(initialNiche);
  const [items, setItems] = useState<HashtagItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [filterCat, setFilterCat] = useState<HashtagCategory | 'all'>('all');

  const ensureNiche = useCallback(async () => {
    if (!niche) {
      const stored = await getStoredNiche();
      if (stored) setNiche(stored);
    }
  }, [niche]);

  useFocusEffect(
    useCallback(() => {
      ensureNiche();
    }, [ensureNiche])
  );

  const onGenerate = async () => {
    const text = draft.trim();
    if (text.length === 0) {
      Alert.alert('Fikir gerekli', 'Lütfen hashtag üretmek için bir fikir yaz.');
      return;
    }
    const useNiche = (niche ?? 'lifestyle') as NicheId;
    setLoading(true);
    setFallback(false);
    setItems([]);
    setSelected(new Set());
    const result = await generateHashtags(useNiche, text);
    setItems(result.hashtags);
    setFallback(result.usedFallback);
    setSelected(new Set(result.hashtags.map((h) => h.tag)));
    setLoading(false);
  };

  const toggleSelect = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const onCopySelected = async () => {
    const tags = items.filter((h) => selected.has(h.tag));
    if (tags.length === 0) {
      Alert.alert('Seçim yok', 'Kopyalamak için en az bir hashtag seç.');
      return;
    }
    const text = tags.map((h) => `#${h.tag}`).join(' ');
    Clipboard.setString(text);
    addCopyToHistory(text, 'detail').catch(() => {});
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const onCopyOne = (tag: string) => {
    Clipboard.setString(`#${tag}`);
    addCopyToHistory(`#${tag}`, 'detail').catch(() => {});
  };

  const onAddAsTags = async () => {
    const text = draft.trim();
    if (text.length === 0) {
      Alert.alert('Fikir gerekli', 'Önce üretilecek fikri yaz.');
      return;
    }
    const tags = items.filter((h) => selected.has(h.tag));
    if (tags.length === 0) {
      Alert.alert('Seçim yok', 'Etiket olarak eklemek için hashtag seç.');
      return;
    }
    let added = 0;
    for (const t of tags) {
      const cleaned = normalizeTag(t.tag);
      if (cleaned) {
        await addIdeaTag(text, cleaned);
        added += 1;
      }
    }
    Alert.alert('Etiketlere eklendi', `${added} hashtag fikre etiket olarak eklendi.`);
  };

  const visible = filterCat === 'all' ? items : items.filter((h) => h.category === filterCat);
  const counts: Record<HashtagCategory, number> = { genel: 0, nis: 0, uzun: 0, trend: 0 };
  for (const h of items) counts[h.category] = (counts[h.category] ?? 0) + 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Geri</Text>
        </Pressable>
        <Text style={styles.title}># Hashtag Üretici</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={styles.subtitle}>
        Fikrin için AI 15 hashtag önerisi sunsun. Seçtiklerini tek tıkla kopyala veya fikrine etiket olarak ekle.
      </Text>

      <View style={styles.editorBox}>
        <Text style={styles.editorLabel}>Fikrin</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="örn: Sabah rutini için 5 ipucu"
          placeholderTextColor="#9CA3AF"
          style={styles.editorInput}
          multiline
          maxLength={200}
        />
        <View style={styles.editorActions}>
          <Text style={styles.editorCounter}>{draft.length}/200</Text>
          <Pressable
            onPress={onGenerate}
            disabled={loading || draft.trim().length === 0}
            style={[styles.genBtn, (loading || draft.trim().length === 0) && styles.genBtnDisabled]}
          >
            <Text style={styles.genBtnTxt}>{loading ? '⏳ Üretiliyor…' : '✨ Üret'}</Text>
          </Pressable>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#8B5CF6" />
          <Text style={styles.loadingTxt}>AI hashtag hazırlıyor…</Text>
        </View>
      )}

      {!loading && fallback && items.length > 0 && (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineTxt}>📴 AI çevrimdışı — akıllı yerel öneriler kullanıldı</Text>
        </View>
      )}

      {!loading && items.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label={`Tümü (${items.length})`}
              active={filterCat === 'all'}
              onPress={() => setFilterCat('all')}
              color="#111827"
            />
            {(Object.keys(HASHTAG_CATEGORY_META) as HashtagCategory[]).map((c) => {
              if (counts[c] === 0) return null;
              const m = HASHTAG_CATEGORY_META[c];
              return (
                <FilterChip
                  key={c}
                  label={`${m.icon} ${m.label} (${counts[c]})`}
                  active={filterCat === c}
                  onPress={() => setFilterCat(c)}
                  color={m.color}
                />
              );
            })}
          </ScrollView>

          <View style={styles.actionBar}>
            <Pressable onPress={onCopySelected} style={[styles.actionBtn, styles.actionBtnCopy]}>
              <Text style={styles.actionBtnTxt}>{copiedAll ? '✓ Kopyalandı' : '⧉ Seçili Olanları Kopyala'}</Text>
            </Pressable>
            <Pressable onPress={onAddAsTags} style={[styles.actionBtn, styles.actionBtnTag]}>
              <Text style={styles.actionBtnTxt}>🏷 Etiketlere Ekle</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
          >
            <View style={styles.chipGrid}>
              {visible.map((h) => {
                const m = HASHTAG_CATEGORY_META[h.category];
                const isSelected = selected.has(h.tag);
                return (
                  <Pressable
                    key={h.tag}
                    onPress={() => toggleSelect(h.tag)}
                    onLongPress={() => onCopyOne(h.tag)}
                    style={[
                      styles.hashtagChip,
                      { borderColor: m.color },
                      isSelected && { backgroundColor: m.color + '22' },
                    ]}
                  >
                    <Text style={[styles.hashtagChipCheck, { color: m.color }]}>
                      {isSelected ? '✓' : '+'}
                    </Text>
                    <Text style={[styles.hashtagChipTxt, { color: isSelected ? m.color : '#374151' }]}>
                      #{h.tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.hint}>
              💡 İpucu: Bir hashtag'e uzun bas → sadece o kopyalanır.
            </Text>
          </ScrollView>
        </>
      )}

      {!loading && items.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>#️⃣</Text>
          <Text style={styles.emptyTitle}>Hashtag üretilmemiş</Text>
          <Text style={styles.emptyDesc}>
            Yukarıya fikrini yaz ve “Üret”e dokun. AI 15 hashtag önerisi getirsin.
          </Text>
        </View>
      )}
    </View>
  );
}

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
}> = ({ label, active, onPress, color }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.filterChip,
      { borderColor: color },
      active && { backgroundColor: color + '22' },
    ]}
  >
    <Text style={[styles.filterChipTxt, { color: active ? color : '#374151' }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backTxt: { fontSize: 16, color: '#4D96FF', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', paddingHorizontal: 16, marginBottom: 12 },
  editorBox: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  editorLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 1, marginBottom: 6 },
  editorInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    color: '#111827',
  },
  editorActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  editorCounter: { fontSize: 11, color: '#9CA3AF' },
  genBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  genBtnDisabled: { opacity: 0.5 },
  genBtnTxt: { color: 'white', fontWeight: '800', fontSize: 13 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  loadingTxt: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  offlineBox: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  offlineTxt: { fontSize: 12, color: '#92400E', fontWeight: '700', textAlign: 'center' },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'white',
  },
  filterChipTxt: { fontSize: 12, fontWeight: '700' },
  actionBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnCopy: { backgroundColor: '#4D96FF' },
  actionBtnTag: { backgroundColor: '#8B5CF6' },
  actionBtnTxt: { color: 'white', fontWeight: '800', fontSize: 12 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'white',
    gap: 5,
  },
  hashtagChipCheck: { fontSize: 13, fontWeight: '800' },
  hashtagChipTxt: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 16, textAlign: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 50, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingHorizontal: 30 },
});