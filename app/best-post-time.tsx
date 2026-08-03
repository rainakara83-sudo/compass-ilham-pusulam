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
import {
  BPTAudience,
  BPTEntry,
  BPTPlatform,
  BPTSlot,
  BPT_AUDIENCES,
  BPT_PLATFORMS,
  buildBestPostTimes,
  clearBPTs,
  getBPTList,
  removeBPT,
  saveBPT,
  updateBPT,
  addCopyToHistory,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const scoreColor = (s: number): string => {
  if (s >= 80) return '#10B981';
  if (s >= 60) return '#22C55E';
  if (s >= 40) return '#F59E0B';
  return '#F97316';
};

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export default function BestPostTimeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<BPTEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [platform, setPlatform] = useState<BPTPlatform>('instagram');
  const [audience, setAudience] = useState<BPTAudience>('millennial');
  const [preview, setPreview] = useState<Omit<BPTEntry, 'id' | 'createdAt'> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getBPTList();
    setList(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const generate = useCallback(() => {
    setPreview(buildBestPostTimes({ platform, audience }));
  }, [platform, audience]);

  useEffect(() => {
    generate();
  }, [generate]);

  const onSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    const next = await saveBPT(preview);
    setList(next);
    setSaving(false);
    setToast('Zaman planı kaydedildi ✓');
  }, [preview]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu zaman planını silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeBPT(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  }, [openId]);

  const onClear = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert('Tümünü sil', `${list.length} plan silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearBPTs();
          setList([]);
          setToast('Tüm zaman planları silindi');
        },
      },
    ]);
  }, [list.length]);

  const onCopy = useCallback(async (text: string) => {
    Clipboard.setString(text);
    await addCopyToHistory(text, 'pool');
    setToast('Kopyalandı ✓');
  }, []);

  const onSaveNotes = useCallback(
    async (id: string) => {
      const note = notesDraft[id];
      if (note === undefined) return;
      const next = await updateBPT(id, { notes: note });
      setList(next);
      setToast('Not güncellendi ✓');
      setNotesDraft(prev => {
        const c = { ...prev };
        delete c[id];
        return c;
      });
    },
    [notesDraft]
  );

  const summary = useMemo(() => {
    const platformCount: Partial<Record<BPTPlatform, number>> = {};
    list.forEach(e => {
      platformCount[e.platform] = (platformCount[e.platform] ?? 0) + 1;
    });
    const avgScore = list.length === 0 ? 0 : Math.round(list.reduce((s, e) => s + e.score, 0) / list.length);
    return { platformCount, avgScore };
  }, [list]);

  const platformKeys = Object.keys(BPT_PLATFORMS) as BPTPlatform[];
  const audienceKeys = Object.keys(BPT_AUDIENCES) as BPTAudience[];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Paylaşım Zamanı',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Platform + hedef kitle seç. En iyi 10 zaman dilimini otomatik hesapla.
        </Text>

        {/* PLATFORM */}
        <Text style={styles.sectionLabel}>Platform</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {platformKeys.map(pk => {
            const meta = BPT_PLATFORMS[pk];
            const active = platform === pk;
            return (
              <Pressable
                key={pk}
                onPress={() => setPlatform(pk)}
                style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
              >
                <Text style={styles.chipIcon}>{meta.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* AUDIENCE */}
        <Text style={styles.sectionLabel}>Hedef kitle</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {audienceKeys.map(ak => {
            const meta = BPT_AUDIENCES[ak];
            const active = audience === ak;
            return (
              <Pressable
                key={ak}
                onPress={() => setAudience(ak)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={styles.chipIcon}>{meta.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* PREVIEW */}
        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>⏰ En İyi 10 Zaman Dilimi</Text>
              <View style={[styles.scorePill, { backgroundColor: scoreColor(preview.score) + '22', borderColor: scoreColor(preview.score) }]}>
                <Text style={[styles.scoreText, { color: scoreColor(preview.score) }]}>{preview.score}</Text>
              </View>
            </View>

            {preview.reasoning.map((r, idx) => (
              <View key={idx} style={styles.reasonRow}>
                <Text style={styles.reasonDot}>•</Text>
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}

            <Text style={styles.divider}></Text>

            {preview.slots.map((slot, idx) => (
              <View key={`${slot.day}-${slot.hour}`} style={styles.slotRow}>
                <View style={[styles.rankBadge, { backgroundColor: idx < 3 ? '#10B981' : '#475569' }]}>
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </View>
                <View style={styles.slotBody}>
                  <Text style={styles.slotLabel}>{slot.label}</Text>
                  <View style={styles.slotBarBg}>
                    <View
                      style={[
                        styles.slotBarFill,
                        { width: `${slot.score}%`, backgroundColor: scoreColor(slot.score) },
                      ]}
                    />
                  </View>
                </View>
                <View style={[styles.scorePillSmall, { borderColor: scoreColor(slot.score) }]}>
                  <Text style={[styles.scoreTextSmall, { color: scoreColor(slot.score) }]}>{slot.score}</Text>
                </View>
              </View>
            ))}

            <View style={styles.previewActions}>
              <Pressable
                onPress={() => onCopy(preview.slots.map((s, i) => `${i + 1}. ${s.label} (${s.score})`).join('\n'))}
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>📋 Listeyi kopyala</Text>
              </Pressable>
              <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Kaydet</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🗂️ Kayıtlı Planlar ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama skor</Text>
                <Text style={[styles.summaryValue, { color: scoreColor(summary.avgScore) }]}>{summary.avgScore}</Text>
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 8, marginBottom: 4 }]}>Platform dağılımı</Text>
              <View style={styles.platformRow}>
                {platformKeys.map(pk => {
                  const cnt = summary.platformCount[pk] ?? 0;
                  if (cnt === 0) return null;
                  const meta = BPT_PLATFORMS[pk];
                  return (
                    <View key={pk} style={[styles.platformChip, { borderColor: meta.color }]}>
                      <Text style={styles.platformChipEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.platformChipCount, { color: meta.color }]}>{cnt}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length === 0 ? (
            <Text style={styles.empty}>Henüz plan yok. Yukarıdan platform seç.</Text>
          ) : (
            list.map(e => {
              const platformMeta = BPT_PLATFORMS[e.platform];
              const audienceMeta = BPT_AUDIENCES[e.audience];
              const open = openId === e.id;
              return (
                <View key={e.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : e.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>
                        {platformMeta?.emoji} {platformMeta?.label} · {audienceMeta?.emoji} {audienceMeta?.label}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {e.slots.length} slot · {formatDate(e.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.scorePill, { backgroundColor: scoreColor(e.score) + '22', borderColor: scoreColor(e.score) }]}>
                      <Text style={[styles.scoreText, { color: scoreColor(e.score) }]}>{e.score}</Text>
                    </View>
                  </Pressable>

                  {open && (
                    <View style={styles.entryDetail}>
                      {e.slots.map((slot, idx) => (
                        <View key={`${slot.day}-${slot.hour}`} style={styles.entrySlotRow}>
                          <Text style={styles.entrySlotRank}>{idx + 1}.</Text>
                          <Text style={styles.entrySlotLabel}>{slot.label}</Text>
                          <View style={[styles.scorePillSmall, { borderColor: scoreColor(slot.score) }]}>
                            <Text style={[styles.scoreTextSmall, { color: scoreColor(slot.score) }]}>{slot.score}</Text>
                          </View>
                        </View>
                      ))}

                      <Text style={styles.entryLabel}>Notlar</Text>
                      <TextInput
                        value={notesDraft[e.id] ?? e.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [e.id]: txt }))}
                        placeholder="Not ekle..."
                        placeholderTextColor="#475569"
                        style={styles.notesInput}
                        multiline
                      />
                      <View style={styles.entryActions}>
                        <Pressable
                          onPress={() => onSaveNotes(e.id)}
                          disabled={notesDraft[e.id] === undefined}
                          style={[styles.smallBtn, notesDraft[e.id] === undefined && { opacity: 0.4 }]}
                        >
                          <Text style={styles.smallBtnText}>💾 Notu kaydet</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onCopy(e.slots.map((s, i) => `${i + 1}. ${s.label} (${s.score})`).join('\n'))}
                          style={styles.smallBtn}
                        >
                          <Text style={styles.smallBtnText}>📋 Kopyala</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(e.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
                          <Text style={[styles.smallBtnText, { color: '#F97316' }]}>🗑️ Sil</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </Pressable>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16 },
  intro: { color: '#94a3b8', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  sectionLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipRow: { marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipIcon: { fontSize: 16, marginRight: 6 },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  previewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', flex: 1 },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  scoreText: { fontSize: 14, fontWeight: '700' },
  reasonRow: { flexDirection: 'row', marginBottom: 4 },
  reasonDot: { color: '#6366f1', fontSize: 14, marginRight: 6, fontWeight: '700' },
  reasonText: { color: '#cbd5e1', fontSize: 12, flex: 1, lineHeight: 16 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  slotBody: { flex: 1, marginRight: 8 },
  slotLabel: { color: '#f8fafc', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  slotBarBg: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  slotBarFill: { height: '100%', borderRadius: 3 },
  scorePillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  scoreTextSmall: { fontSize: 11, fontWeight: '700' },
  previewActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  copyBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  copyBtnText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  clearBtn: { color: '#F97316', fontSize: 12, fontWeight: '600' },
  summaryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: { color: '#94a3b8', fontSize: 12 },
  summaryValue: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  platformChipEmoji: { fontSize: 12 },
  platformChipCount: { fontSize: 13, fontWeight: '700' },
  empty: { color: '#64748b', fontSize: 13, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  entry: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center' },
  entryTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entrySlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  entrySlotRank: { color: '#6366f1', fontSize: 12, fontWeight: '700', width: 24 },
  entrySlotLabel: { color: '#cbd5e1', fontSize: 12, flex: 1, fontWeight: '600' },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  notesInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  entryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  smallBtnText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
  backBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});