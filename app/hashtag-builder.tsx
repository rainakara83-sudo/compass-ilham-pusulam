import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  HASHTAG_PLATFORMS,
  HashtagLayer,
  HashtagPack,
  HashtagPlatform,
  buildHashtagPack,
  clearHashtagPacks,
  getHashtagPackList,
  getStoredNiche,
  removeHashtagPack,
  saveHashtagPack,
  addCopyToHistory,
} from '../services/storage';
import nichesData from '../data/niches.json';

const LAYER_COLORS: Record<HashtagLayer, string> = {
  core: '#6366f1',
  niche: '#10B981',
  community: '#0EA5E9',
  trending: '#F59E0B',
  longtail: '#8B5CF6',
};

const LAYER_EMOJIS: Record<HashtagLayer, string> = {
  core: '🧲',
  niche: '🎯',
  community: '🤝',
  trending: '🔥',
  longtail: '🔬',
};

const LAYER_ORDER: HashtagLayer[] = ['core', 'niche', 'community', 'trending', 'longtail'];

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const lng = (i18n.language || 'en').split('-')[0];
  const localeTag = lng === 'tr' ? 'tr-TR' : lng === 'es' ? 'es-ES' : lng === 'de' ? 'de-DE' : lng === 'fr' ? 'fr-FR' : 'en-US';
  return d.toLocaleDateString(localeTag, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const nicheMap = nichesData as { id: string; icon: string; description: string; color: string }[];

export default function HashtagBuilderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [list, setList] = useState<HashtagPack[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [niche, setNiche] = useState<string>('tech');
  const [platform, setPlatform] = useState<HashtagPlatform>('instagram');
  const [topic, setTopic] = useState('');
  const [preview, setPreview] = useState<HashtagPack | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const stored = await getStoredNiche();
    if (stored && !niche) setNiche(stored);
    const l = await getHashtagPackList();
    setList(l);
  }, [niche]);

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
    const tm = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(tm);
  }, [toast]);

  const platformMeta = useMemo(
    () => HASHTAG_PLATFORMS.find(p => p.id === platform) ?? HASHTAG_PLATFORMS[0],
    [platform]
  );

  const handleGenerate = () => {
    if (!topic.trim()) {
      Alert.alert(t('hashtagBuilder.emptyTopicTitle'), t('hashtagBuilder.emptyTopicBody'));
      return;
    }
    setGenerating(true);
    const built = buildHashtagPack({ niche, platform, topic: topic.trim() });
    setPreview(built);
    setGenerating(false);
  };

  const handleReroll = () => {
    if (!topic.trim()) return;
    const built = buildHashtagPack({ niche, platform, topic: topic.trim(), seed: Date.now() });
    setPreview(built);
  };

  const handleSave = async () => {
    if (!preview) return;
    const next = await saveHashtagPack({
      niche: preview.niche,
      platform: preview.platform,
      topic: preview.topic,
      layers: preview.layers,
      fullList: preview.fullList,
    });
    setList(next);
    await addCopyToHistory(`[hashtag-pack] ${preview.niche}/${preview.platform}`);
    setToast(t('hashtagBuilder.savedToast'));
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('hashtagBuilder.deleteConfirmTitle'), t('hashtagBuilder.deleteConfirmBody'), [
      { text: t('hashtagBuilder.cancelBtn'), style: 'cancel' },
      {
        text: t('hashtagBuilder.deleteBtn'),
        style: 'destructive',
        onPress: async () => {
          const next = await removeHashtagPack(id);
          setList(next);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert(t('hashtagBuilder.clearAllConfirmTitle'), t('hashtagBuilder.clearAllConfirmBody'), [
      { text: t('hashtagBuilder.cancelBtn'), style: 'cancel' },
      {
        text: t('hashtagBuilder.deleteAllBtn'),
        style: 'destructive',
        onPress: async () => {
          await clearHashtagPacks();
          setList([]);
          setToast(t('hashtagBuilder.clearedToast'));
        },
      },
    ]);
  };

  const copy = (label: string, text: string) => {
    Clipboard.setString(text);
    addCopyToHistory(`[hashtag-copy] ${label}`);
    setToast(t('hashtagBuilder.copiedToast', { label }));
  };

  const renderLayer = (layer: HashtagLayer, items: string[]) => {
    if (items.length === 0) return null;
    const color = LAYER_COLORS[layer];
    const emoji = LAYER_EMOJIS[layer];
    const label = t(`hashtagBuilder.layer.${layer}`);
    const hint = t(`hashtagBuilder.layerHint.${layer}`);
    return (
      <View key={layer} style={styles.layerBlock}>
        <View style={styles.layerHeader}>
          <Text style={[styles.layerTitle, { color }]}>
            {emoji} {label}
          </Text>
          <Pressable onPress={() => copy(label, items.join(' '))} hitSlop={6}>
            <Text style={styles.copySmall}>{t('hashtagBuilder.copySmall')}</Text>
          </Pressable>
        </View>
        <Text style={styles.layerHint}>{hint}</Text>
        <View style={styles.tagWrap}>
          {items.map((h, i) => (
            <Pressable
              key={`${layer}-${i}`}
              style={[styles.tagChip, { borderColor: color }]}
              onPress={() => copy(t('hashtagBuilder.copyHashtag'), h)}
            >
              <Text style={[styles.tagText, { color }]}>{h}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: t('hashtagBuilder.title'), headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('hashtagBuilder.heroTitle')}</Text>
          <Text style={styles.heroSub}>
            {t('hashtagBuilder.heroSub')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('hashtagBuilder.newPack')}</Text>

          <Text style={styles.label}>{t('hashtagBuilder.nicheLabel')}</Text>
          <View style={styles.chipRow}>
            {nicheMap.map(n => {
              const active = niche === n.id;
              return (
                <Pressable
                  key={n.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: n.color, borderColor: n.color },
                  ]}
                  onPress={() => setNiche(n.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {n.icon} {n.id}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t('hashtagBuilder.platformLabel')}</Text>
          <View style={styles.chipRow}>
            {HASHTAG_PLATFORMS.map(p => {
              const active = platform === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setPlatform(p.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {p.emoji} {p.label} · max {p.cap}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t('hashtagBuilder.topicLabel')}</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder={t('hashtagBuilder.topicPlaceholder')}
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>
              {t('hashtagBuilder.tipPlatform', { emoji: platformMeta.emoji, label: platformMeta.label, cap: platformMeta.cap })}
            </Text>
            <Text style={styles.tipText}>
              {t('hashtagBuilder.tipLayers')}
            </Text>
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              style={[styles.cta, styles.ctaPrimary, generating && { opacity: 0.6 }]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>{t('hashtagBuilder.generateBtn')}</Text>
              )}
            </Pressable>
            {preview ? (
              <Pressable style={[styles.cta, styles.ctaReroll]} onPress={handleReroll}>
                <Text style={styles.ctaText}>{t('hashtagBuilder.rerollBtn')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {preview ? (
          <View style={styles.section}>
            <View style={styles.previewHeader}>
              <Text style={styles.sectionTitle}>{t('hashtagBuilder.previewTitle')}</Text>
              <View style={[styles.capBadge]}>
                <Text style={styles.capBadgeText}>
                  {t('hashtagBuilder.capBadge', { current: preview.fullList.length, cap: platformMeta.cap })}
                </Text>
              </View>
            </View>

            {LAYER_ORDER.map(layer => renderLayer(layer, preview.layers[layer]))}

            <View style={styles.fullBox}>
              <Text style={styles.fullTitle}>{t('hashtagBuilder.fullListTitle')}</Text>
              <Pressable onPress={() => copy(t('hashtagBuilder.copyAllHashtags'), preview.fullList.join(' '))}>
                <Text style={styles.fullText}>{preview.fullList.join(' ')}</Text>
              </Pressable>
            </View>

            <Pressable style={[styles.cta, styles.ctaSave]} onPress={handleSave}>
              <Text style={styles.ctaText}>{t('hashtagBuilder.saveBtn')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>{t('hashtagBuilder.savedTitle', { count: list.length })}</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>{t('hashtagBuilder.clearAll')}</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{t('hashtagBuilder.emptyEmoji')}</Text>
              <Text style={styles.emptyText}>
                {t('hashtagBuilder.emptyText')}
              </Text>
            </View>
          ) : (
            list.map(p => {
              const platformMetaInner = HASHTAG_PLATFORMS.find(pl => pl.id === p.platform);
              return (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {platformMetaInner?.emoji} {platformMetaInner?.label} ·{' '}
                        {p.topic || p.niche}
                      </Text>
                      <Text style={styles.cardSub}>
                        {t('hashtagBuilder.cardMeta', { date: formatDate(p.createdAt), count: p.fullList.length })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardTags} numberOfLines={2}>
                    {p.fullList.join(' ')}
                  </Text>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={[styles.smallBtn, styles.smallBtnPrimary]}
                      onPress={() => copy(t('hashtagBuilder.copyPack'), p.fullList.join(' '))}
                    >
                      <Text style={styles.smallBtnText}>{t('hashtagBuilder.copyBtn')}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallBtn, styles.smallBtnDanger]}
                      onPress={() => handleDelete(p.id)}
                    >
                      <Text style={styles.smallBtnText}>{t('hashtagBuilder.deleteBtn')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
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
  tipBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    padding: 10,
    borderRadius: 8,
  },
  tipTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cta: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaPrimary: { backgroundColor: '#6366f1' },
  ctaReroll: { backgroundColor: '#475569' },
  ctaSave: { backgroundColor: '#10B981', marginTop: 12 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  capBadgeText: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },

  layerBlock: { marginTop: 12 },
  layerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  layerTitle: { fontSize: 13, fontWeight: '700' },
  copySmall: { color: '#94a3b8', fontSize: 11 },
  layerHint: { color: '#64748b', fontSize: 11, marginTop: 2, marginBottom: 8 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  tagText: { fontSize: 12, fontWeight: '600' },

  fullBox: {
    marginTop: 14,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  fullTitle: { color: '#a5b4fc', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  fullText: { color: '#f8fafc', fontSize: 13, lineHeight: 20 },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  cardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  cardTags: { color: '#cbd5e1', fontSize: 12, marginTop: 8, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  smallBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  smallBtnPrimary: { backgroundColor: '#6366f1' },
  smallBtnDanger: { backgroundColor: '#7f1d1d' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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
