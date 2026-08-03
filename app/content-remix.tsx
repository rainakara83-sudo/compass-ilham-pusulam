import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  buildRemixPlan,
  clearRemixes,
  getRemixList,
  REMIX_SOURCES,
  REMIX_TARGETS,
  RemixEntry,
  RemixPlan,
  RemixSource,
  RemixTarget,
  removeRemix,
  saveRemix,
} from '../services/storage';

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

export default function ContentRemixScreen() {
  const [source, setSource] = useState<RemixSource>('long-video');
  const [target, setTarget] = useState<RemixTarget>('reel');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [plan, setPlan] = useState<RemixPlan | null>(null);
  const [list, setList] = useState<RemixEntry[]>([]);
  const [sourceFilter, setSourceFilter] = useState<RemixSource | 'all'>('all');

  const load = useCallback(async () => {
    const stored = await getRemixList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onGenerate = () => {
    setPlan(buildRemixPlan(source, target, customTitle));
  };

  const onSave = async () => {
    if (!plan) return;
    const entry: RemixEntry = {
      id: `remix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source,
      target,
      title: plan.title,
      angle: plan.angle,
      hook: plan.hook,
      outline: plan.outline,
      estEffort: plan.estEffort,
      estReach: plan.estReach,
      createdAt: Date.now(),
    };
    const next = await saveRemix(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeRemix(id);
    setList(next);
  };

  const onClear = async () => {
    await clearRemixes();
    setList([]);
  };

  const filtered = useMemo(() => {
    if (sourceFilter === 'all') return list;
    return list.filter(e => e.source === sourceFilter);
  }, [list, sourceFilter]);

  const totalEffort = useMemo(() => list.reduce((s, e) => s + e.estEffort, 0), [list]);
  const totalReach = useMemo(() => list.reduce((s, e) => s + e.estReach, 0), [list]);
  const targetBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of list) map[e.target] = (map[e.target] ?? 0) + 1;
    return map;
  }, [list]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🔁 Content Remix Switch</Text>
      <Text style={styles.subtitle}>
        Bir içeriği al, farklı bir formata dönüştür. Açı, hook ve outline otomatik.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Kaynak İçerik</Text>
        <View style={styles.chipRow}>
          {REMIX_SOURCES.map(s => (
            <Pressable
              key={s.id}
              onPress={() => setSource(s.id)}
              style={[styles.chip, source === s.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, source === s.id ? styles.chipTextActive : null]}>
                {s.emoji} {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2) Hedef Format</Text>
        <View style={styles.chipRow}>
          {REMIX_TARGETS.map(t => (
            <Pressable
              key={t.id}
              onPress={() => setTarget(t.id)}
              style={[styles.chip, target === t.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, target === t.id ? styles.chipTextActive : null]}>
                {t.emoji} {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3) Başlık (opsiyonel)</Text>
        <TextInput
          value={customTitle}
          onChangeText={setCustomTitle}
          placeholder="Örn: Sabah rutinim"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <Pressable onPress={onGenerate} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>Remix Planı Üret</Text>
      </Pressable>

      {plan ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🪄 Plan</Text>
          <Text style={styles.planTitle}>{plan.title}</Text>

          <View style={styles.angleBox}>
            <Text style={styles.angleLabel}>Açı</Text>
            <Text style={styles.angleValue}>{plan.angle}</Text>
          </View>

          <View style={styles.hookBox}>
            <Text style={styles.hookLabel}>🎣 Hook</Text>
            <Text style={styles.hookValue}>{plan.hook}</Text>
          </View>

          <Text style={styles.subSection}>📋 Outline</Text>
          {plan.outline.map((step, idx) => (
            <View key={idx} style={styles.outlineRow}>
              <View style={styles.outlineNum}>
                <Text style={styles.outlineNumText}>{idx + 1}</Text>
              </View>
              <Text style={styles.outlineText}>{step}</Text>
            </View>
          ))}

          <View style={styles.estimateRow}>
            <View style={styles.estimateBox}>
              <Text style={styles.estimateNum}>⏱ {plan.estEffort}dk</Text>
              <Text style={styles.estimateLabel}>Tahmini Efor</Text>
            </View>
            <View style={styles.estimateBox}>
              <Text style={styles.estimateNum}>📡 {formatNumber(plan.estReach)}</Text>
              <Text style={styles.estimateLabel}>Tahmini Erişim</Text>
            </View>
          </View>

          <Pressable onPress={onSave} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Planı Kaydet</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Remix Özeti</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>Plan</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{totalEffort}dk</Text>
              <Text style={styles.statLabel}>Toplam Efor</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatNumber(totalReach)}</Text>
              <Text style={styles.statLabel}>Toplam Erişim</Text>
            </View>
          </View>

          <Text style={styles.subSection}>Hedef Format Dağılımı</Text>
          {REMIX_TARGETS.map(t => {
            const count = targetBreakdown[t.id] ?? 0;
            if (count === 0) return null;
            return (
              <View key={t.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t.emoji} {t.label}</Text>
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
            <Text style={styles.sectionTitle}>💾 Kayıtlı Planlar</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setSourceFilter('all')}
              style={[styles.chip, sourceFilter === 'all' ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, sourceFilter === 'all' ? styles.chipTextActive : null]}>Hepsi</Text>
            </Pressable>
            {REMIX_SOURCES.map(s => (
              <Pressable
                key={s.id}
                onPress={() => setSourceFilter(s.id)}
                style={[styles.chip, sourceFilter === s.id ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, sourceFilter === s.id ? styles.chipTextActive : null]}>
                  {s.emoji}
                </Text>
              </Pressable>
            ))}
          </View>
          {filtered.map(e => {
            const sMeta = REMIX_SOURCES.find(s => s.id === e.source);
            const tMeta = REMIX_TARGETS.find(t => t.id === e.target);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{e.title}</Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  {sMeta?.emoji} {sMeta?.label} → {tMeta?.emoji} {tMeta?.label}
                </Text>
                <Text style={styles.entryAngle}>💡 {e.angle}</Text>
                <View style={styles.entryMetaRow}>
                  <Text style={styles.entryStat}>⏱ {e.estEffort}dk</Text>
                  <Text style={styles.entryStat}>📡 {formatNumber(e.estReach)}</Text>
                  <Text style={styles.entryDate}>📅 {formatDate(e.createdAt)}</Text>
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
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  planTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 12 },
  angleBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  angleLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  angleValue: { fontSize: 14, color: '#f8fafc', marginTop: 4 },
  hookBox: {
    backgroundColor: '#6366f122',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  hookLabel: { fontSize: 11, color: '#c7d2fe', fontWeight: '600' },
  hookValue: { fontSize: 14, color: '#f8fafc', marginTop: 4, fontWeight: '500' },
  outlineRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 4, gap: 8 },
  outlineNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  outlineText: { flex: 1, fontSize: 13, color: '#cbd5e1', lineHeight: 18 },
  estimateRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  estimateBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  estimateNum: { fontSize: 14, fontWeight: '700', color: '#f8fafc' },
  estimateLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNum: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 6 },
  breakdownLabel: { fontSize: 12, color: '#cbd5e1', width: 100 },
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
  entryTitle: { fontSize: 14, fontWeight: '600', color: '#f8fafc', flex: 1, marginRight: 8 },
  entryMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  entryAngle: { fontSize: 12, color: '#cbd5e1', marginTop: 6, lineHeight: 16 },
  entryMetaRow: { flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  entryStat: { fontSize: 12, color: '#cbd5e1', fontWeight: '600' },
  entryDate: { fontSize: 11, color: '#64748b' },
  removeLink: { color: '#f87171', fontSize: 12 },
});
