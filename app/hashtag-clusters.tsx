import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  buildHashtagCluster,
  clearHClusters,
  getHClusterList,
  HClusterEntry,
  HCLUSTER_INTENTS,
  HCLUSTER_PLATFORMS,
  HClusterIntent,
  HClusterPack,
  HClusterPlatform,
  removeHCluster,
  saveHCluster,
  suggestHClusterPillars,
} from '../services/storage';

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const lng = (i18n.language || 'en').split('-')[0];
  if (lng === 'tr') {
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
  }
  if (lng === 'de') {
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear())}`;
  }
  if (lng === 'es') {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  }
  if (lng === 'fr') {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  }
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

export default function HashtagClustersScreen() {
  const { t } = useTranslation();
  const [pillar, setPillar] = useState<string>('productivity');
  const [customPillar, setCustomPillar] = useState<string>('');
  const [platform, setPlatform] = useState<HClusterPlatform>('instagram');
  const [intent, setIntent] = useState<HClusterIntent>('niche');
  const [pack, setPack] = useState<HClusterPack | null>(null);
  const [list, setList] = useState<HClusterEntry[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  const load = useCallback(async () => {
    const stored = await getHClusterList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const suggestions = useMemo(() => suggestHClusterPillars(), []);

  const onGenerate = () => {
    const usePillar = (customPillar.trim() || pillar).trim();
    if (!usePillar) return;
    setPillar(usePillar);
    const result = buildHashtagCluster(usePillar, platform, intent);
    setPack(result);
    setCopied(false);
  };

  const onSave = async () => {
    if (!pack) return;
    const entry: HClusterEntry = {
      id: `hcluster-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pillar: pack.pillar,
      platform: pack.platform,
      intent: pack.intent,
      tags: pack.tags,
      reach: pack.estReach,
      createdAt: Date.now(),
    };
    const next = await saveHCluster(entry);
    setList(next);
  };

  const onCopyTags = async () => {
    if (!pack) return;
    await AsyncStorage.setItem('@content-coach/last-copied-tags', pack.tags.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const onRemove = async (id: string) => {
    const next = await removeHCluster(id);
    setList(next);
  };

  const onClear = async () => {
    await clearHClusters();
    setList([]);
  };

  const totalReach = useMemo(
    () => list.reduce((s, e) => s + e.reach, 0),
    [list]
  );

  const topEntry = useMemo(() => {
    if (list.length === 0) return null;
    return list.reduce((top, e) => (e.reach > top.reach ? e : top));
  }, [list]);

  const intentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of list) map[e.intent] = (map[e.intent] ?? 0) + 1;
    return map;
  }, [list]);

  const platformBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of list) map[e.platform] = (map[e.platform] ?? 0) + 1;
    return map;
  }, [list]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🏷️ {t('hClusters.title')}</Text>
      <Text style={styles.subtitle}>{t('hClusters.subtitle')}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('hClusters.pillarLabel')}</Text>
        <View style={styles.chipRow}>
          {suggestions.map(s => (
            <Pressable
              key={s}
              onPress={() => {
                setPillar(s);
                setCustomPillar('');
              }}
              style={[styles.chip, pillar === s && !customPillar ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, pillar === s && !customPillar ? styles.chipTextActive : null]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={customPillar}
          onChangeText={setCustomPillar}
          placeholder={t('hClusters.pillarPlaceholder')}
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('hClusters.platformLabel')}</Text>
        <View style={styles.chipRow}>
          {HCLUSTER_PLATFORMS.map(p => (
            <Pressable
              key={p.id}
              onPress={() => setPlatform(p.id)}
              style={[styles.chip, platform === p.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, platform === p.id ? styles.chipTextActive : null]}>
                {p.emoji} {t(`hClusters.platform.${p.id}`, p.label)} (max {p.max})
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('hClusters.intentLabel')}</Text>
        <View style={styles.chipRow}>
          {HCLUSTER_INTENTS.map(i => (
            <Pressable
              key={i.id}
              onPress={() => setIntent(i.id)}
              style={[styles.chip, intent === i.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, intent === i.id ? styles.chipTextActive : null]}>
                {i.emoji} {t(`hClusters.intents.${i.id}.label`, i.label)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>
          {t(`hClusters.intents.${intent}.desc`, HCLUSTER_INTENTS.find(i => i.id === intent)?.desc ?? '')}
        </Text>
      </View>

      <Pressable onPress={onGenerate} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>{t('hClusters.generate')}</Text>
      </Pressable>

      {pack ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📦 {t('hClusters.packPreview')}</Text>
          <Text style={styles.packTitle}>
            {pack.pillar} · {t(`hClusters.intents.${pack.intent}.label`, HCLUSTER_INTENTS.find(i => i.id === pack.intent)?.label ?? '')}
          </Text>
          <Text style={styles.helperText}>
            {t('hClusters.estReach', { reach: formatNumber(pack.estReach) })}
          </Text>
          <View style={styles.tagWrap}>
            {pack.tags.map(t => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={styles.btnRow}>
            <Pressable onPress={onCopyTags} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>
                {copied ? '✓ ' + t('hClusters.copied') : t('hClusters.copyTags')}
              </Text>
            </Pressable>
            <Pressable onPress={onSave} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{t('hClusters.save')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 {t('hClusters.overview')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>{t('hClusters.totalClusters')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatNumber(totalReach)}</Text>
              <Text style={styles.statLabel}>{t('hClusters.totalReach')}</Text>
            </View>
            {topEntry ? (
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{formatNumber(topEntry.reach)}</Text>
                <Text style={styles.statLabel}>{t('hClusters.bestPack')}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.subSection}>{t('hClusters.intentBreakdown')}</Text>
          {HCLUSTER_INTENTS.map(i => {
            const count = intentBreakdown[i.id] ?? 0;
            if (count === 0) return null;
            return (
              <View key={i.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{i.emoji} {t(`hClusters.intents.${i.id}.label`, i.label)}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(100, (count / list.length) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownVal}>{count}</Text>
              </View>
            );
          })}

          <Text style={styles.subSection}>{t('hClusters.platformBreakdown')}</Text>
          {HCLUSTER_PLATFORMS.map(p => {
            const count = platformBreakdown[p.id] ?? 0;
            if (count === 0) return null;
            return (
              <View key={p.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{p.emoji} {t(`hClusters.platform.${p.id}`, p.label)}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(100, (count / list.length) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownVal}>{count}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>💾 {t('hClusters.savedClusters')}</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>{t('hClusters.clearAll')}</Text>
            </Pressable>
          </View>
          {list.map(e => {
            const intentMeta = HCLUSTER_INTENTS.find(i => i.id === e.intent);
            const platformMeta = HCLUSTER_PLATFORMS.find(p => p.id === e.platform);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {platformMeta?.emoji} {e.pillar}
                  </Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>{t('hClusters.delete')}</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  {intentMeta?.emoji} {t(`hClusters.intents.${e.intent}.label`, intentMeta?.label ?? '')} · ~{formatNumber(e.reach)} · {formatDate(e.createdAt)}
                </Text>
                <View style={styles.tagWrap}>
                  {e.tags.map(t => (
                    <View key={t} style={styles.tagSmall}>
                      <Text style={styles.tagSmallText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', marginBottom: 10 },
  subSection: { fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { fontSize: 12, color: '#cbd5e1' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  packTitle: { fontSize: 16, fontWeight: '600', color: '#f8fafc', marginBottom: 4 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  tagText: { color: '#c7d2fe', fontSize: 13, fontWeight: '500' },
  tagSmall: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  tagSmallText: { color: '#94a3b8', fontSize: 11 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  secondaryBtnText: { color: '#c7d2fe', fontSize: 14, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 6 },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNum: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 6 },
  breakdownLabel: { fontSize: 12, color: '#cbd5e1', width: 110 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#6366f1' },
  breakdownVal: { fontSize: 12, color: '#f1f5f9', fontWeight: '600', width: 30, textAlign: 'right' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clearLink: { color: '#f87171', fontSize: 12 },
  entryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryTitle: { fontSize: 14, fontWeight: '600', color: '#f8fafc' },
  entryMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
