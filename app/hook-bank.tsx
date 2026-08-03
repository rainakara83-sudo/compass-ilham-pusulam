import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  HOOK_CATEGORIES,
  HookCategory,
  HookEntry,
  buildHookSuggestions,
  clearHooks,
  getHookList,
  removeHook,
  saveHook,
  updateHook,
  addCopyToHistory,
} from '../services/storage';

const STRENGTH_DOTS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '○○○○○',
  2: '◐○○○○',
  3: '◑○○○○',
  4: '◕○○○○',
  5: '●○○○○',
};

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'blog'];

const fmtDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

export default function HookBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<HookEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [category, setCategory] = useState<HookCategory>('curiosity');
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filter, setFilter] = useState<HookCategory | 'all' | 'unused'>('all');

  const load = useCallback(async () => {
    const l = await getHookList();
    setList(l);
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
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  const categoryMeta = useMemo(
    () => HOOK_CATEGORIES.find(c => c.id === category) ?? HOOK_CATEGORIES[0],
    [category]
  );

  const filteredList = useMemo(() => {
    if (filter === 'all') return list;
    if (filter === 'unused') return list.filter(h => !h.used);
    return list.filter(h => h.category === filter);
  }, [list, filter]);

  const summary = useMemo(() => {
    const byCat: Record<string, number> = {};
    list.forEach(h => {
      byCat[h.category] = (byCat[h.category] ?? 0) + 1;
    });
    return { total: list.length, used: list.filter(h => h.used).length, byCat };
  }, [list]);

  const handleGenerate = () => {
    const out = buildHookSuggestions({ topic, category, count: 5 });
    setSuggestions(out);
  };

  const handleReroll = () => {
    const out = buildHookSuggestions({ topic, category, count: 5, seed: Date.now() });
    setSuggestions(out);
  };

  const handleAddSuggestion = async (text: string) => {
    const next = await saveHook({
      category,
      text,
      platform,
      topic: topic.trim(),
      strength: 3,
      used: false,
    });
    setList(next);
    setToast('Hook kaydedildi ✓');
  };

  const handleAddManual = async () => {
    if (!topic.trim()) {
      Alert.alert('Eksik bilgi', 'Hook metnini yaz.');
      return;
    }
    const next = await saveHook({
      category,
      text: topic.trim(),
      platform,
      topic: topic.trim(),
      strength: 3,
      used: false,
    });
    setList(next);
    setTopic('');
    setToast('Eklendi ✓');
  };

  const handleToggleUsed = async (h: HookEntry) => {
    const next = await updateHook(h.id, { used: !h.used });
    setList(next);
  };

  const handleBumpStrength = async (h: HookEntry, delta: number) => {
    const next = Math.max(1, Math.min(5, h.strength + delta)) as 1 | 2 | 3 | 4 | 5;
    const list2 = await updateHook(h.id, { strength: next });
    setList(list2);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Hook silinsin mi?', 'Bankadan çıkar.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeHook(id);
          setList(next);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm hook\'lar silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearHooks();
          setList([]);
          setSuggestions([]);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const copy = (label: string, text: string) => {
    Clipboard.setString(text);
    addCopyToHistory(`[hook-copy] ${label}`);
    setToast(`${label} kopyalandı ✓`);
  };

  const renderCard = (h: HookEntry) => {
    const meta = HOOK_CATEGORIES.find(c => c.id === h.category);
    return (
      <View
        key={h.id}
        style={[styles.card, h.used && styles.cardUsed, { borderLeftColor: meta?.color }]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardCat, { color: meta?.color }]}>
            {meta?.emoji} {meta?.label}
          </Text>
          <Text style={styles.cardDate}>{fmtDate(h.createdAt)}</Text>
        </View>
        <Pressable onPress={() => copy('Hook', h.text)}>
          <Text style={[styles.cardText, h.used && styles.cardTextUsed]}>{h.text}</Text>
        </Pressable>
        <View style={styles.cardBottom}>
          <View style={styles.strengthRow}>
            <Pressable onPress={() => handleBumpStrength(h, -1)} hitSlop={6}>
              <Text style={styles.strBtn}>−</Text>
            </Pressable>
            <Text style={styles.strDots}>{STRENGTH_DOTS[h.strength]}</Text>
            <Pressable onPress={() => handleBumpStrength(h, +1)} hitSlop={6}>
              <Text style={styles.strBtn}>+</Text>
            </Pressable>
            <Text style={styles.cardPlatform}>{h.platform}</Text>
          </View>
          <View style={styles.cardActions}>
            <Pressable
              style={[styles.miniBtn, h.used && styles.miniBtnActive]}
              onPress={() => handleToggleUsed(h)}
            >
              <Text style={styles.miniBtnText}>{h.used ? '✓ Kullanıldı' : '○ Kullan'}</Text>
            </Pressable>
            <Pressable style={styles.miniBtnDanger} onPress={() => handleDelete(h.id)}>
              <Text style={styles.miniBtnText}>🗑️</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Hook Bank', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🪝 Hook Bank</Text>
          <Text style={styles.heroSub}>
            Kanıtlanmış 7 hook kategorisinden öneri al; beğendiklerini kaydet, güç puanı ver,
            kullanıldıkça işaretle. Tekrar eden şablonları zamanla ayıkla.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hook Üretici</Text>

          <Text style={styles.label}>Kategori</Text>
          <View style={styles.chipRow}>
            {HOOK_CATEGORIES.map(c => {
              const active = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: c.color, borderColor: c.color },
                  ]}
                  onPress={() => setCategory(c.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c.emoji} {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Konu (topic)</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="ör: içerik üretmek, sabah rutini"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Platform</Text>
          <View style={styles.chipRow}>
            {PLATFORMS.map(p => {
              const active = platform === p;
              return (
                <Pressable
                  key={p}
                  style={[styles.chipSmall, active && styles.chipSmallActive]}
                  onPress={() => setPlatform(p)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.tipBox, { borderLeftColor: categoryMeta.color }]}>
            <Text style={styles.tipTitle}>{categoryMeta.emoji} {categoryMeta.label}</Text>
            <Text style={styles.tipText}>{categoryMeta.hint}</Text>
          </View>

          <View style={styles.ctaRow}>
            <Pressable style={[styles.cta, styles.ctaPrimary]} onPress={handleGenerate}>
              <Text style={styles.ctaText}>✨ Öneri üret</Text>
            </Pressable>
            {suggestions.length > 0 ? (
              <Pressable style={[styles.cta, styles.ctaReroll]} onPress={handleReroll}>
                <Text style={styles.ctaText}>🎲 Yenile</Text>
              </Pressable>
            ) : null}
          </View>

          {suggestions.length > 0 ? (
            <View style={styles.suggestBox}>
              <Text style={styles.suggestTitle}>📋 Önerilen Hook'lar</Text>
              {suggestions.map((s, i) => (
                <View key={i} style={[styles.suggestRow, { borderLeftColor: categoryMeta.color }]}>
                  <Pressable style={styles.suggestTextWrap} onPress={() => copy('Hook', s)}>
                    <Text style={styles.suggestText}>{s}</Text>
                  </Pressable>
                  <Pressable style={styles.suggestAdd} onPress={() => handleAddSuggestion(s)}>
                    <Text style={styles.suggestAddText}>➕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable style={styles.manualBtn} onPress={handleAddManual}>
            <Text style={styles.manualBtnText}>📝 Manuel hook ekle</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>
              Bankadaki Hook'lar ({filteredList.length}/{summary.total})
            </Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                Tümü · {list.length}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, filter === 'unused' && styles.filterChipActive]}
              onPress={() => setFilter('unused')}
            >
              <Text style={[styles.filterText, filter === 'unused' && styles.filterTextActive]}>
                Kullanılmamış · {list.filter(h => !h.used).length}
              </Text>
            </Pressable>
            {HOOK_CATEGORIES.map(c => (
              <Pressable
                key={c.id}
                style={[
                  styles.filterChip,
                  filter === c.id && { backgroundColor: c.color, borderColor: c.color },
                ]}
                onPress={() => setFilter(c.id)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === c.id && styles.filterTextActive,
                  ]}
                >
                  {c.emoji} {summary.byCat[c.id] ?? 0}
                </Text>
              </Pressable>
            ))}
          </View>

          {filteredList.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🪝</Text>
              <Text style={styles.emptyText}>
                {list.length === 0
                  ? 'Henüz hook yok. Yukarıdan öneri al veya manuel ekle.'
                  : 'Bu filtreyle eşleşen hook yok.'}
              </Text>
            </View>
          ) : (
            filteredList.map(renderCard)
          )}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  heroTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  heroSub: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 14, marginBottom: 16 },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipSmall: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipSmallActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  tipBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderLeftWidth: 3,
    padding: 10,
    borderRadius: 8,
  },
  tipTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cta: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaPrimary: { backgroundColor: '#6366f1' },
  ctaReroll: { backgroundColor: '#475569' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  manualBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#6366f1',
    alignItems: 'center',
  },
  manualBtnText: { color: '#a5b4fc', fontSize: 13, fontWeight: '600' },

  suggestBox: { marginTop: 14 },
  suggestTitle: { color: '#a5b4fc', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  suggestRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    alignItems: 'center',
  },
  suggestTextWrap: { flex: 1 },
  suggestText: { color: '#f8fafc', fontSize: 13, lineHeight: 18 },
  suggestAdd: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  suggestAddText: { color: '#22c55e', fontSize: 18, fontWeight: '700' },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    borderLeftWidth: 3,
  },
  cardUsed: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardCat: { fontSize: 11, fontWeight: '700' },
  cardDate: { color: '#64748b', fontSize: 10 },
  cardText: { color: '#f8fafc', fontSize: 14, lineHeight: 20 },
  cardTextUsed: { textDecorationLine: 'line-through' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strBtn: { color: '#a5b4fc', fontSize: 16, fontWeight: '700', paddingHorizontal: 6 },
  strDots: { color: '#F59E0B', fontSize: 11, fontFamily: 'monospace' },
  cardPlatform: { color: '#94a3b8', fontSize: 10, marginLeft: 8 },
  cardActions: { flexDirection: 'row', gap: 6 },
  miniBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  miniBtnActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  miniBtnDanger: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  miniBtnText: { color: '#f8fafc', fontSize: 10, fontWeight: '700' },

  empty: { alignItems: 'center', padding: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 18 },
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