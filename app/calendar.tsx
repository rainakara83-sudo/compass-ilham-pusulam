import React, { useCallback, useEffect, useState } from 'react';
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
  POSTING_SLOTS,
  POSTING_DAYS,
  PostingSlot,
  DayKey,
  CalendarGrid,
  CalendarPlanEntry,
  getCalendarGrid,
  getTopThreeSlots,
  getCalendarInsight,
  getCalendarPlan,
  addCalendarPlanEntry,
  removeCalendarPlanEntry,
  clearCalendarPlan,
  getStoredNiche,
  addCopyToHistory,
} from '../services/storage';
import { NicheId } from '../services/contentService';

const scoreColor = (score: number): string => {
  if (score >= 90) return '#10B981';
  if (score >= 80) return '#0EA5E9';
  if (score >= 70) return '#F59E0B';
  if (score >= 60) return '#FB923C';
  return '#94A3B8';
};

const scoreLabel = (score: number): string => {
  if (score >= 90) return '🔥 ŞİMDİ PATLA';
  if (score >= 80) return '⚡ YÜKSEK';
  if (score >= 70) return '🎯 İYİ';
  if (score >= 60) return '🌤 ORTA';
  return '🌙 SAKİN';
};

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [grid, setGrid] = useState<CalendarGrid | null>(null);
  const [plan, setPlan] = useState<CalendarPlanEntry[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{ day: DayKey; slot: PostingSlot } | null>(null);
  const [planText, setPlanText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);

  const load = useCallback(async () => {
    const n = await getStoredNiche();
    setNiche(n);
    setGrid(getCalendarGrid(n));
    setPlan(await getCalendarPlan());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const onPickSlot = (day: DayKey, slot: PostingSlot) => {
    setSelectedSlot({ day, slot });
    const existing = plan.find((p) => p.day === day && p.slot === slot);
    setPlanText(existing ? existing.text : '');
  };

  const onSavePlan = async () => {
    if (!selectedSlot) return;
    const text = planText.trim();
    if (!text) {
      Alert.alert('Boş içerik', 'Lütfen bir fikir notu yaz.');
      return;
    }
    const next = await addCalendarPlanEntry({
      day: selectedSlot.day,
      slot: selectedSlot.slot,
      text,
      niche,
    });
    setPlan(next);
    showToast('✅ Slota kaydedildi');
  };

  const onRemove = async (id: string) => {
    const next = await removeCalendarPlanEntry(id);
    setPlan(next);
    showToast('🗑 Silindi');
  };

  const onClearAll = () => {
    if (plan.length === 0) return;
    Alert.alert('Tüm planı sil', 'Bu haftaki tüm slot kayıtlarını silmek istediğinden emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await clearCalendarPlan();
          setPlan([]);
          showToast('🗑 Tüm plan silindi');
        },
      },
    ]);
  };

  const onCopy = async (text: string) => {
    try {
      Clipboard.setString(text);
      await addCopyToHistory(text, 'detail');
      showToast('📋 Kopyalandı');
    } catch {
      Alert.alert('Hata', 'Kopyalanamadı');
    }
  };

  const insights = grid ? getTopThreeSlots(grid.grid) : [];

  if (!grid) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Takvim hazırlanıyor…</Text>
      </View>
    );
  }

  const dayLabel = (id: DayKey) => POSTING_DAYS.find((d) => d.id === id)?.label ?? id;
  const dayShort = (id: DayKey) => POSTING_DAYS.find((d) => d.id === id)?.short ?? id;
  const slotMeta = (id: PostingSlot) => POSTING_SLOTS.find((s) => s.id === id);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'İçerik Takvimi',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>📅 İÇERİK TAKVİMİ</Text>
          <Text style={styles.heroTitle}>En iyi paylaşım zamanları</Text>
          <Text style={styles.heroSub}>
            {niche ? `${nicheLabels[niche]} nişine özel` : 'Niche seç – en verimli zamanlarını gör'}
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{grid.bestSlot.score}</Text>
              <Text style={styles.heroStatLabel}>peak skor</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{plan.length}</Text>
              <Text style={styles.heroStatLabel}>planlı</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{insights.length}</Text>
              <Text style={styles.heroStatLabel}>önerilen</Text>
            </View>
          </View>
        </View>

        <View style={styles.bestSlotCard}>
          <Text style={styles.bestSlotBadge}>⭐ BU HAFTANIN PEAK ZAMANI</Text>
          <View style={styles.bestSlotRow}>
            <Text style={styles.bestSlotDay}>{dayLabel(grid.bestSlot.day)}</Text>
            <Text style={styles.bestSlotDot}>·</Text>
            <Text style={styles.bestSlotSlot}>
              {slotMeta(grid.bestSlot.slot)?.emoji} {slotMeta(grid.bestSlot.slot)?.label}
            </Text>
            <Text style={styles.bestSlotScore}>{grid.bestSlot.score}/100</Text>
          </View>
          <Text style={styles.bestSlotTime}>{slotMeta(grid.bestSlot.slot)?.hourRange}</Text>
          <Text style={styles.bestSlotReason}>{grid.bestSlot.reason}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>🗓 Haftalık ızgara</Text>
            <Pressable onPress={() => setShowAll(!showAll)} style={styles.toggleBtn}>
              <Text style={styles.toggleBtnText}>{showAll ? 'Sadece yüksek' : 'Tümü'}</Text>
            </Pressable>
          </View>
          <View style={styles.gridCard}>
            <View style={styles.gridHeader}>
              <View style={styles.gridCorner} />
              {POSTING_SLOTS.map((s) => (
                <View key={s.id} style={styles.gridHeaderCell}>
                  <Text style={styles.gridHeaderEmoji}>{s.emoji}</Text>
                  <Text style={styles.gridHeaderLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            {POSTING_DAYS.map((d) => (
              <View key={d.id} style={styles.gridRow}>
                <View style={styles.gridDayCell}>
                  <Text style={styles.gridDayLabel}>{d.short}</Text>
                </View>
                {POSTING_SLOTS.map((s) => {
                  const entry = grid.grid[d.id][s.id];
                  const isVisible = showAll || entry.score >= 70;
                  const hasPlan = plan.some((p) => p.day === d.id && p.slot === s.id);
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => onPickSlot(d.id, s.id)}
                      style={[
                        styles.gridCell,
                        {
                          backgroundColor: isVisible ? scoreColor(entry.score) : '#F1F5F9',
                        },
                        hasPlan && styles.gridCellPlanned,
                      ]}
                    >
                      <Text style={styles.gridCellScore}>{entry.score}</Text>
                      {hasPlan && <Text style={styles.gridCellCheck}>✓</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>90+ Şimdi patla</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#0EA5E9' }]} />
              <Text style={styles.legendText}>80+ Yüksek</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>70+ İyi</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FB923C' }]} />
              <Text style={styles.legendText}>60+ Orta</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 En verimli 3 slot</Text>
          {insights.map((s, i) => {
            const sm = slotMeta(s.slot);
            return (
              <Pressable
                key={`${s.day}-${s.slot}`}
                onPress={() => onPickSlot(s.day, s.slot)}
                style={[styles.insightCard, { borderLeftColor: scoreColor(s.score) }]}
              >
                <View style={styles.insightRank}>
                  <Text style={styles.insightRankNum}>{i + 1}</Text>
                </View>
                <View style={styles.insightBody}>
                  <View style={styles.insightHead}>
                    <Text style={styles.insightDay}>{dayShort(s.day)}</Text>
                    <Text style={styles.insightHeadDot}>·</Text>
                    <Text style={styles.insightSlot}>{sm?.emoji} {sm?.label}</Text>
                    <View style={[styles.insightScorePill, { backgroundColor: scoreColor(s.score) }]}>
                      <Text style={styles.insightScorePillText}>{s.score}</Text>
                    </View>
                  </View>
                  <Text style={styles.insightReason}>{s.reason}</Text>
                  <Text style={styles.insightTime}>{sm?.hourRange}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Niche ipucu</Text>
          <View style={styles.insightCardFixed}>
            <Text style={styles.insightIcon}>💎</Text>
            <Text style={styles.insightFixedText}>{getCalendarInsight(niche)}</Text>
          </View>
        </View>

        {plan.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>📌 Bu haftaki planın</Text>
              <Pressable onPress={onClearAll}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            </View>
            {plan.map((p) => (
              <View key={p.id} style={styles.planCard}>
                <View style={styles.planTop}>
                  <View style={styles.planDayPill}>
                    <Text style={styles.planDayPillText}>{dayShort(p.day)}</Text>
                  </View>
                  <View style={styles.planSlotPill}>
                    <Text style={styles.planSlotEmoji}>{slotMeta(p.slot)?.emoji}</Text>
                    <Text style={styles.planSlotText}>{slotMeta(p.slot)?.label}</Text>
                  </View>
                  <Text style={styles.planScore}>{grid.grid[p.day][p.slot].score}</Text>
                </View>
                <Text style={styles.planText}>{p.text}</Text>
                <View style={styles.planActions}>
                  <Pressable onPress={() => onCopy(p.text)} style={styles.planCopyBtn}>
                    <Text style={styles.planCopyBtnText}>📋 Kopyala</Text>
                  </Pressable>
                  <Pressable onPress={() => onPickSlot(p.day, p.slot)} style={styles.planEditBtn}>
                    <Text style={styles.planEditBtnText}>✏️ Düzenle</Text>
                  </Pressable>
                  <Pressable onPress={() => onRemove(p.id)} style={styles.planDeleteBtn}>
                    <Text style={styles.planDeleteBtnText}>🗑 Sil</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipTitle}>Takvimi nasıl kullanırsın?</Text>
          <Text style={styles.tipText}>
            • Renkli hücreye dokunup o slota not düş{'\n'}
            • Skor 80+ olan saatlere içerik kuyruğunu yerleştir{'\n'}
            • Her Cuma, önümüzdeki haftanın planını buradan hazırla
          </Text>
        </View>
      </ScrollView>

      {selectedSlot && (
        <View style={[styles.modalOverlay, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBadge}>SLOT DETAYI</Text>
            <View style={styles.modalHead}>
              <Text style={styles.modalDay}>{dayLabel(selectedSlot.day)}</Text>
              <Text style={styles.modalDot}>·</Text>
              <Text style={styles.modalSlot}>
                {slotMeta(selectedSlot.slot)?.emoji} {slotMeta(selectedSlot.slot)?.label}
              </Text>
              <Pressable onPress={() => setSelectedSlot(null)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.modalScore}>
              <Text style={styles.modalScoreLabel}>Engagement skoru</Text>
              <Text style={styles.modalScoreValue}>{grid.grid[selectedSlot.day][selectedSlot.slot].score}/100</Text>
            </View>
            <Text style={styles.modalScoreLabel}>{scoreLabel(grid.grid[selectedSlot.day][selectedSlot.slot].score)}</Text>
            <Text style={styles.modalReason}>{grid.grid[selectedSlot.day][selectedSlot.slot].reason}</Text>
            <Text style={styles.modalHour}>{slotMeta(selectedSlot.slot)?.hourRange}</Text>
            <Text style={styles.modalInputLabel}>Bu slota ne paylaşmayı planlıyorsun?</Text>
            <TextInput
              value={planText}
              onChangeText={setPlanText}
              placeholder="Örn: Reel – 3 hızlı tarif"
              placeholderTextColor="#94A3B8"
              style={styles.modalInput}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setSelectedSlot(null)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
              </Pressable>
              <Pressable onPress={onSavePlan} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveBtnText}>💾 Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const nicheLabels: Record<string, string> = {
  fitness: 'fitness',
  food: 'yemek',
  tech: 'teknoloji',
  fashion: 'moda',
  travel: 'seyahat',
  gaming: 'oyun',
  personal_dev: 'kişisel gelişim',
  beauty: 'güzellik',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#475569', fontSize: 14, fontWeight: '600' },
  scroll: { padding: 14, gap: 14 },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
  },
  heroBadge: { color: '#0EA5E9', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  heroSub: { color: '#94A3B8', fontSize: 13, fontWeight: '500', marginBottom: 16 },
  heroStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroStatLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600', marginTop: 2 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: '#334155' },
  bestSlotCard: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    padding: 16,
  },
  bestSlotBadge: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, opacity: 0.9 },
  bestSlotRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  bestSlotDay: { color: '#fff', fontSize: 18, fontWeight: '800' },
  bestSlotDot: { color: '#fff', marginHorizontal: 8, fontSize: 18 },
  bestSlotSlot: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  bestSlotScore: { color: '#fff', fontSize: 18, fontWeight: '800' },
  bestSlotTime: { color: '#E0F2FE', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  bestSlotReason: { color: '#fff', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#E0F2FE', borderRadius: 8 },
  toggleBtnText: { color: '#0EA5E9', fontSize: 11, fontWeight: '700' },
  clearBtn: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  gridCard: { backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  gridHeader: { flexDirection: 'row', marginBottom: 6 },
  gridCorner: { width: 44 },
  gridHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  gridHeaderEmoji: { fontSize: 14, marginBottom: 2 },
  gridHeaderLabel: { color: '#475569', fontSize: 10, fontWeight: '700' },
  gridRow: { flexDirection: 'row', marginBottom: 4 },
  gridDayCell: { width: 44, justifyContent: 'center', alignItems: 'flex-start' },
  gridDayLabel: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  gridCell: { flex: 1, margin: 2, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gridCellPlanned: { borderWidth: 2, borderColor: '#0F172A' },
  gridCellScore: { color: '#fff', fontSize: 11, fontWeight: '800' },
  gridCellCheck: { color: '#fff', fontSize: 10, fontWeight: '800', position: 'absolute', top: 2, right: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#475569', fontSize: 10, fontWeight: '600' },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  insightRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  insightRankNum: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  insightBody: { flex: 1 },
  insightHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  insightDay: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  insightHeadDot: { color: '#94A3B8', marginHorizontal: 6 },
  insightSlot: { color: '#0F172A', fontSize: 13, fontWeight: '700', flex: 1 },
  insightScorePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  insightScorePillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  insightReason: { color: '#475569', fontSize: 12, fontWeight: '500', marginBottom: 2 },
  insightTime: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  insightCardFixed: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  insightIcon: { fontSize: 22, marginRight: 10 },
  insightFixedText: { color: '#78350F', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  planCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  planTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  planDayPill: { backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  planDayPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  planSlotPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 3 },
  planSlotEmoji: { fontSize: 11 },
  planSlotText: { color: '#0EA5E9', fontSize: 11, fontWeight: '700' },
  planScore: { color: '#0F172A', fontSize: 13, fontWeight: '800', marginLeft: 'auto' },
  planText: { color: '#0F172A', fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 10 },
  planActions: { flexDirection: 'row', gap: 6 },
  planCopyBtn: { flex: 1, backgroundColor: '#F0F9FF', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  planCopyBtnText: { color: '#0EA5E9', fontSize: 11, fontWeight: '700' },
  planEditBtn: { flex: 1, backgroundColor: '#FEF3C7', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  planEditBtnText: { color: '#92400E', fontSize: 11, fontWeight: '700' },
  planDeleteBtn: { flex: 1, backgroundColor: '#FEE2E2', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  planDeleteBtnText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },
  tipCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  tipIcon: { fontSize: 22, marginBottom: 4 },
  tipTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  tipText: { color: '#475569', fontSize: 12, fontWeight: '500', lineHeight: 18 },
  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 12,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  modalBadge: { color: '#0EA5E9', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  modalHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalDay: { color: '#0F172A', fontSize: 17, fontWeight: '800' },
  modalDot: { color: '#94A3B8', marginHorizontal: 6, fontSize: 17 },
  modalSlot: { color: '#0F172A', fontSize: 17, fontWeight: '800', flex: 1 },
  modalClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  modalScore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalScoreLabel: { color: '#475569', fontSize: 12, fontWeight: '700' },
  modalScoreValue: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  modalReason: { color: '#0F172A', fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4, lineHeight: 18 },
  modalHour: { color: '#0EA5E9', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  modalInputLabel: { color: '#0F172A', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#0F172A',
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalCancelBtn: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalCancelBtnText: { color: '#475569', fontSize: 13, fontWeight: '700' },
  modalSaveBtn: { flex: 1, backgroundColor: '#0EA5E9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSaveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
