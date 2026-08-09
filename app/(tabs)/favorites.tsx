import React, { useCallback, useState } from 'react';
import { Alert, Clipboard, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../services/theme';
import i18n from '../../i18n';
import {
  FavoriteEntry,
  getFavoritesDetailed,
  removeManyFavorites,
} from '../../services/storage';
import PlanBadge from '../../components/PlanBadge';

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const lng = (i18n.language || 'en').split('-')[0];
  try {
    return d.toLocaleDateString(lng, { day: '2-digit', month: 'short' });
  } catch {
    return d.toLocaleDateString('en', { day: '2-digit', month: 'short' });
  }
};

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<FavoriteEntry[]>([]);
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [planRefresh, setPlanRefresh] = useState(0);

  const load = useCallback(async () => {
    setItems(await getFavoritesDetailed());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      setPlanRefresh((x) => x + 1);
    }, [load])
  );

  const onCopy = (key: string, text: string) => {
    Clipboard.setString(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const onCopyAll = async () => {
    if (selected.size === 0) return;
    const selectedTexts = items.filter((i) => selected.has(i.text)).map((i) => i.text);
    const message = selectedTexts.join('\n• ');
    try {
      await Share.share({
        message: t('favorites.shareBody', { message }),
        title: t('favorites.shareTitle'),
      });
    } catch {
      Clipboard.setString(selectedTexts.join('\n'));
      Alert.alert(t('favorites.copiedTitle'), t('favorites.copiedMsg'));
    }
  };

  const onBulkDelete = () => {
    if (selected.size === 0) return;
    Alert.alert(
      t('favorites.bulkDeleteTitle', { count: selected.size }),
      t('favorites.bulkDeleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const next = await removeManyFavorites(Array.from(selected));
            setItems(next);
            setSelected(new Set());
            setSelectMode(false);
          },
        },
      ]
    );
  };

  const onRemoveOne = (text: string) => {
    Alert.alert(t('favorites.removeOneTitle'), t('favorites.removeOneMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('favorites.removeBtn'),
        style: 'destructive',
        onPress: async () => {
          const next = await removeManyFavorites([text]);
          setItems(next);
        },
      },
    ]);
  };

  const toggleSelect = (text: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const openDetail = (text: string) => {
    router.push({
      pathname: '/idea/[text]',
      params: { text: encodeURIComponent(text), niche: '', source: 'pool' },
    });
  };

  const q = query.trim().toLowerCase();
  const visible = q ? items.filter((i) => i.text.toLowerCase().includes(q)) : items;

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#5C6B4F' }]} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.title, { color: isDark ? '#FAFCF6' : '#111827' }]}>⭐ {t('favorites.title')}</Text>
            <PlanBadge size="sm" refreshKey={planRefresh} />
          </View>
          <Text style={[styles.subtitle, { color: isDark ? '#CBD5E1' : '#6B7280' }]}>{t('favorites.subtitle', { count: items.length })}</Text>
        </View>
        {items.length > 0 && (
          <Pressable
            onPress={() => (selectMode ? exitSelect() : setSelectMode(true))}
            style={[styles.selectToggle, selectMode && styles.selectToggleOn]}
          >
            <Text style={[styles.selectToggleText, selectMode && styles.selectToggleTextOn]}>
              {selectMode ? t('favorites.cancelSelect') : t('favorites.startSelect')}
            </Text>
          </Pressable>
        )}
      </View>

      {items.length > 0 && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder={t('favorites.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            placeholderTextColor="#9CA3AF"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {q.length > 0 && (
        <Text style={styles.matchInfo}>
          {visible.length === 0
            ? t('favorites.noMatch')
            : t('favorites.matchCount', { count: visible.length })}
        </Text>
      )}

      {selectMode && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkBarText}>{t('favorites.selectedCount', { count: selected.size })}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onCopyAll} disabled={selected.size === 0} style={[styles.bulkBtn, selected.size === 0 && styles.bulkBtnDisabled]}>
            <Text style={[styles.bulkBtnText, selected.size === 0 && styles.bulkBtnTextDisabled]}>↗ {t('favorites.share')}</Text>
          </Pressable>
          <Pressable onPress={onBulkDelete} disabled={selected.size === 0} style={[styles.bulkBtn, styles.bulkBtnDanger, selected.size === 0 && styles.bulkBtnDisabled]}>
            <Text style={[styles.bulkBtnText, styles.bulkBtnDangerText, selected.size === 0 && styles.bulkBtnTextDisabled]}>🗑 {t('common.delete')}</Text>
          </Pressable>
        </View>
      )}

      {items.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💭</Text>
          <Text style={styles.emptyText}>{t('favorites.emptyTitle')}</Text>
          <Text style={styles.emptyHint}>{t('favorites.emptyHint')}</Text>
        </View>
      )}

      {q.length > 0 && visible.length === 0 && items.length > 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔎</Text>
          <Text style={styles.emptyText}>{t('favorites.noResult', { query })}</Text>
        </View>
      )}

      {visible.map((item) => {
        const isSelected = selected.has(item.text);
        return (
          <Pressable
            key={item.addedAt + item.text}
            onPress={() => (selectMode ? toggleSelect(item.text) : openDetail(item.text))}
            style={[styles.card, isSelected && styles.cardSelected]}
          >
            <View style={styles.cardHead}>
              <Text style={styles.addedAt}>📅 {formatDate(item.addedAt)}</Text>
              {selectMode && (
                <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                  <Text style={styles.checkboxText}>{isSelected ? '✓' : ''}</Text>
                </View>
              )}
            </View>
            <Text style={styles.ideaText}>{item.text}</Text>
            {!selectMode && (
              <View style={styles.actions}>
                <Pressable onPress={() => onCopy(item.text, item.text)} style={styles.btn}>
                  <Text style={styles.btnText}>{copiedKey === item.text ? `✓ ${t('common.copied')}` : `⧉ ${t('common.copy')}`}</Text>
                </Pressable>
                <Pressable onPress={() => onRemoveOne(item.text)} style={[styles.btn, styles.btnDanger]}>
                  <Text style={[styles.btnText, styles.btnDangerText]}>✕ {t('favorites.removeBtn')}</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C6B4F' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 50, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  selectToggle: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#4D96FF' },
  selectToggleOn: { backgroundColor: '#4D96FF' },
  selectToggleText: { color: '#4D96FF', fontWeight: '700', fontSize: 12 },
  selectToggleTextOn: { color: 'white' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  search: { flex: 1, backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  clearBtn: { marginLeft: 8, width: 36, height: 36, borderRadius: 10, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  clearBtnText: { fontSize: 14, color: '#374151', fontWeight: '700' },
  matchInfo: { fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '600' },
  bulkBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', padding: 10, borderRadius: 12, marginBottom: 10 },
  bulkBarText: { fontSize: 12, fontWeight: '700', color: '#1E40AF' },
  bulkBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#4D96FF' },
  bulkBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },
  bulkBtnDisabled: { backgroundColor: '#E5E7EB' },
  bulkBtnTextDisabled: { color: '#9CA3AF' },
  bulkBtnDanger: { backgroundColor: '#DC2626' },
  bulkBtnDangerText: { color: 'white' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  cardSelected: { borderColor: '#4D96FF', backgroundColor: '#EFF6FF' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  addedAt: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  checkboxOn: { backgroundColor: '#4D96FF', borderColor: '#4D96FF' },
  checkboxText: { color: 'white', fontWeight: '800', fontSize: 14 },
  ideaText: { fontSize: 15, color: '#111827', fontWeight: '600', lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#4D96FF', fontWeight: '700', fontSize: 13 },
  btnDanger: { backgroundColor: '#FEE2E2' },
  btnDangerText: { color: '#DC2626' },
});