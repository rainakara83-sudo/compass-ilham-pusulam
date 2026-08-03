import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  buildHookStoppers,
  clearHStops,
  getHStopList,
  HSTOP_FORMATS,
  HSTOP_PLATFORMS,
  HookStopEntry,
  HookStopFormat,
  HookStopPlatform,
  HookStopSuggestion,
  removeHStop,
  saveHStop,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

const stopColor = (power: number): string => {
  if (power >= 85) return '#10b981';
  if (power >= 70) return '#6366f1';
  if (power >= 55) return '#f59e0b';
  return '#94a3b8';
};

const stopLabel = (power: number): string => {
  if (power >= 85) return 'Çok güçlü';
  if (power >= 70) return 'Güçlü';
  if (power >= 55) return 'Orta';
  return 'Zayıf';
};

export default function HookStopperScreen() {
  const [platform, setPlatform] = useState<HookStopPlatform>('reels');
  const [format, setFormat] = useState<HookStopFormat>('question');
  const [suggestions, setSuggestions] = useState<HookStopSuggestion[]>([]);
  const [list, setList] = useState<HookStopEntry[]>([]);
  const [formatFilter, setFormatFilter] = useState<HookStopFormat | 'all'>('all');

  const load = useCallback(async () => {
    const stored = await getHStopList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onGenerate = () => {
    setSuggestions(buildHookStoppers(platform, format));
  };

  const onSave = async (s: HookStopSuggestion) => {
    const entry: HookStopEntry = {
      id: `hstop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platform,
      format: s.format,
      text: s.text,
      stopPower: s.stopPower,
      createdAt: Date.now(),
    };
    const next = await saveHStop(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeHStop(id);
    setList(next);
  };

  const onClear = async () => {
    await clearHStops();
    setList([]);
  };

  const filtered = useMemo(() => {
    if (formatFilter === 'all') return list;
    return list.filter(e => e.format === formatFilter);
  }, [list, formatFilter]);

  const formatBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of list) map[e.format] = (map[e.format] ?? 0) + 1;
    return map;
  }, [list]);

  const avgPower = useMemo(() => {
    if (list.length === 0) return 0;
    return Math.round(list.reduce((s, e) => s + e.stopPower, 0) / list.length);
  }, [list]);

  const topHook = useMemo(() => {
    if (list.length === 0) return null;
    return list.reduce((top, e) => (e.stopPower > top.stopPower ? e : top));
  }, [list]);

  const platformMeta = HSTOP_PLATFORMS.find(p => p.id === platform);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🪝 Hook Stopper Library</Text>
      <Text style={styles.subtitle}>
        İlk saniyelerde dikkat çeken, kaydırmayı durduran giriş cümleleri üret.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Platform</Text>
        <View style={styles.chipRow}>
          {HSTOP_PLATFORMS.map(p => (
            <Pressable
              key={p.id}
              onPress={() => setPlatform(p.id)}
              style={[styles.chip, platform === p.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, platform === p.id ? styles.chipTextActive : null]}>
                {p.emoji} {p.label} ({p.window}s)
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>
          {platformMeta?.label} için ilk {platformMeta?.window} saniye kritik pencere.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2) Format</Text>
        <View style={styles.chipRow}>
          {HSTOP_FORMATS.map(f => (
            <Pressable
              key={f.id}
              onPress={() => setFormat(f.id)}
              style={[styles.chip, format === f.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, format === f.id ? styles.chipTextActive : null]}>
                {f.emoji} {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>
          {HSTOP_FORMATS.find(f => f.id === format)?.desc}
        </Text>
      </View>

      <Pressable onPress={onGenerate} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>Hook Üret</Text>
      </Pressable>

      {suggestions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎯 Önerilen Hooklar</Text>
          {suggestions.map((s, idx) => {
            const color = stopColor(s.stopPower);
            return (
              <View key={idx} style={styles.suggestionCard}>
                <Text style={styles.suggestionText}>{s.text}</Text>
                <Text style={styles.suggestionReason}>{s.reason}</Text>
                <View style={styles.suggestionMeta}>
                  <View style={[styles.powerPill, { backgroundColor: color + '22', borderColor: color }]}>
                    <Text style={[styles.powerPillText, { color }]}>
                      ⚡ {s.stopPower}/100 · {stopLabel(s.stopPower)}
                    </Text>
                  </View>
                  <Pressable onPress={() => onSave(s)} style={styles.saveMiniBtn}>
                    <Text style={styles.saveMiniBtnText}>Kaydet</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Özet</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{list.length}</Text>
              <Text style={styles.statLabel}>Toplam Hook</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{avgPower}</Text>
              <Text style={styles.statLabel}>Ort. Stop Gücü</Text>
            </View>
            {topHook ? (
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: stopColor(topHook.stopPower) }]}>
                  {topHook.stopPower}
                </Text>
                <Text style={styles.statLabel}>En Güçlü</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.subSection}>Format Dağılımı</Text>
          {HSTOP_FORMATS.map(f => {
            const count = formatBreakdown[f.id] ?? 0;
            if (count === 0) return null;
            return (
              <View key={f.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{f.emoji} {f.label}</Text>
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
            <Text style={styles.sectionTitle}>💾 Kayıtlı Hooklar</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setFormatFilter('all')}
              style={[styles.chip, formatFilter === 'all' ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, formatFilter === 'all' ? styles.chipTextActive : null]}>Hepsi</Text>
            </Pressable>
            {HSTOP_FORMATS.map(f => (
              <Pressable
                key={f.id}
                onPress={() => setFormatFilter(f.id)}
                style={[styles.chip, formatFilter === f.id ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, formatFilter === f.id ? styles.chipTextActive : null]}>
                  {f.emoji}
                </Text>
              </Pressable>
            ))}
          </View>
          {filtered.map(e => {
            const pMeta = HSTOP_PLATFORMS.find(p => p.id === e.platform);
            const fMeta = HSTOP_FORMATS.find(f => f.id === e.format);
            const color = stopColor(e.stopPower);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryText}>{e.text}</Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <View style={styles.entryMetaRow}>
                  <Text style={styles.entryMeta}>
                    {pMeta?.emoji} {pMeta?.label} · {fMeta?.emoji} {fMeta?.label}
                  </Text>
                  <View style={[styles.powerPillSmall, { borderColor: color }]}>
                    <Text style={[styles.powerPillText, { color }]}>⚡ {e.stopPower}</Text>
                  </View>
                </View>
                <Text style={styles.entryDate}>📅 {formatDate(e.createdAt)}</Text>
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
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  suggestionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  suggestionText: { fontSize: 14, color: '#f8fafc', lineHeight: 20, fontWeight: '500' },
  suggestionReason: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 16 },
  suggestionMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  powerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  powerPillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  powerPillText: { fontSize: 11, fontWeight: '600' },
  saveMiniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  saveMiniBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
  statNum: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 6 },
  breakdownLabel: { fontSize: 12, color: '#cbd5e1', width: 80 },
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
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  entryText: { fontSize: 14, color: '#f8fafc', flex: 1, marginRight: 8, lineHeight: 20, fontWeight: '500' },
  entryMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  entryMeta: { fontSize: 12, color: '#94a3b8', flex: 1 },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
