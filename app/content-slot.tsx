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
  buildCSOPlan,
  clearCSOs,
  CSO_DAYS,
  CSO_PLATFORMS,
  CSO_SLOTS,
  CSOEntry,
  CSOPlatform,
  CSOSlot,
  getCSOList,
  removeCSO,
  saveCSO,
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

export default function ContentSlotScreen() {
  const [day, setDay] = useState<CSOEntry['day']>('mon');
  const [slot, setSlot] = useState<CSOSlot>('evening');
  const [platform, setPlatform] = useState<CSOPlatform>('instagram');
  const [pillar, setPillar] = useState<string>('education');
  const [format, setFormat] = useState<string>('reel');
  const [list, setList] = useState<CSOEntry[]>([]);
  const [target, setTarget] = useState<string>('5');

  const load = useCallback(async () => {
    const stored = await getCSOList();
    setList(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAdd = async () => {
    const slotMeta = CSO_SLOTS.find(s => s.id === slot);
    const dayMeta = CSO_DAYS.find(d => d.id === day);
    const expectedReach = Math.round((slotMeta?.reach ?? 800) * (dayMeta?.reachMult ?? 1));
    const entry: CSOEntry = {
      id: `cso-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platform,
      slot,
      day,
      pillar,
      format,
      expectedReach,
      createdAt: Date.now(),
    };
    const next = await saveCSO(entry);
    setList(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeCSO(id);
    setList(next);
  };

  const onClear = async () => {
    await clearCSOs();
    setList([]);
  };

  const targetNum = useMemo(() => Math.max(1, parseInt(target, 10) || 5), [target]);
  const plan = useMemo(() => buildCSOPlan(list, targetNum), [list, targetNum]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🕒 Content Slot Optimizer</Text>
      <Text style={styles.subtitle}>
        Haftanın hangi gün ve saatinde hangi içeriği paylaşacağını optimize et.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Gün</Text>
        <View style={styles.chipRow}>
          {CSO_DAYS.map(d => (
            <Pressable
              key={d.id}
              onPress={() => setDay(d.id)}
              style={[styles.chip, day === d.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, day === d.id ? styles.chipTextActive : null]}>
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2) Slot</Text>
        <View style={styles.chipRow}>
          {CSO_SLOTS.map(s => (
            <Pressable
              key={s.id}
              onPress={() => setSlot(s.id)}
              style={[styles.chip, slot === s.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, slot === s.id ? styles.chipTextActive : null]}>
                {s.emoji} {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3) Platform</Text>
        <View style={styles.chipRow}>
          {CSO_PLATFORMS.map(p => (
            <Pressable
              key={p.id}
              onPress={() => setPlatform(p.id)}
              style={[styles.chip, platform === p.id ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, platform === p.id ? styles.chipTextActive : null]}>
                {p.emoji} {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4) Sütun & Format</Text>
        <TextInput value={pillar} onChangeText={setPillar} placeholder="Sütun (education, sales...)" placeholderTextColor="#64748b" style={styles.input} />
        <TextInput value={format} onChangeText={setFormat} placeholder="Format (reel, carousel...)" placeholderTextColor="#64748b" style={styles.input} />
      </View>

      <Pressable onPress={onAdd} style={styles.generateBtn}>
        <Text style={styles.generateBtnText}>Slot Ekle</Text>
      </Pressable>

      {plan.totalSlots > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Haftalık Plan</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{plan.totalSlots}</Text>
              <Text style={styles.statLabel}>Slot</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{plan.coverage}%</Text>
              <Text style={styles.statLabel}>Hedef Karşılama</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatNumber(plan.totalReach)}</Text>
              <Text style={styles.statLabel}>Toplam Erişim</Text>
            </View>
          </View>

          <Text style={styles.subSection}>Boş Günler: {plan.freeDays}/7</Text>
          <Text style={styles.helperText}>🟢 Dolu: {plan.busyDays} gün</Text>

          {plan.bestSlot ? (
            <View style={styles.bestBox}>
              <Text style={styles.bestLabel}>🏆 En İyi Slot</Text>
              <Text style={styles.bestValue}>
                {CSO_DAYS.find(d => d.id === plan.bestSlot?.day)?.label} · {CSO_SLOTS.find(s => s.id === plan.bestSlot?.slot)?.label} ({formatNumber(plan.bestSlot.reach)})
              </Text>
            </View>
          ) : null}

          <Text style={styles.subSection}>Hafta Görünümü</Text>
          {CSO_DAYS.map(d => (
            <View key={d.id} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{d.emoji} {d.label}</Text>
              <View style={styles.daySlots}>
                {plan.week[d.id].length === 0 ? (
                  <Text style={styles.dayEmpty}>boş</Text>
                ) : (
                  plan.week[d.id].map(s => {
                    const sMeta = CSO_SLOTS.find(x => x.id === s);
                    return (
                      <View key={s} style={styles.daySlot}>
                        <Text style={styles.daySlotText}>{sMeta?.emoji}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ))}

          <Text style={styles.recommendation}>{plan.recommendation}</Text>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>📋 Kayıtlı Slotlar</Text>
            <Pressable onPress={onClear}>
              <Text style={styles.clearLink}>Tümünü sil</Text>
            </Pressable>
          </View>
          {list.map(e => {
            const dMeta = CSO_DAYS.find(d => d.id === e.day);
            const sMeta = CSO_SLOTS.find(s => s.id === e.slot);
            const pMeta = CSO_PLATFORMS.find(p => p.id === e.platform);
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {dMeta?.label} {sMeta?.emoji} · {pMeta?.label}
                  </Text>
                  <Pressable onPress={() => onRemove(e.id)}>
                    <Text style={styles.removeLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.entryMeta}>
                  {e.pillar} · {e.format} · ~{formatNumber(e.expectedReach)}
                </Text>
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
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
    marginBottom: 8,
  },
  generateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
  statLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  bestBox: {
    backgroundColor: '#10b98122',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  bestLabel: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  bestValue: { fontSize: 13, color: '#f8fafc', marginTop: 4 },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3, gap: 8 },
  dayLabel: { fontSize: 13, color: '#cbd5e1', width: 40, fontWeight: '600' },
  daySlots: { flex: 1, flexDirection: 'row', gap: 4 },
  dayEmpty: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  daySlot: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySlotText: { fontSize: 14 },
  recommendation: { fontSize: 13, color: '#cbd5e1', marginTop: 12, lineHeight: 18, textAlign: 'center' },
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
  entryTitle: { fontSize: 13, fontWeight: '600', color: '#f8fafc' },
  entryMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 2 },
  removeLink: { color: '#f87171', fontSize: 12 },
});
