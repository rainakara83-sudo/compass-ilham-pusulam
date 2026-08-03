import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  CALENDAR_STATUS_META,
  CalendarItem,
  CalendarItemKind,
  clearCalendar,
  getBriefList,
  getCalendarList,
  getCaptionList,
  getIdeaBank,
  removeCalendarItem,
  saveCalendarItem,
  startOfWeek,
  updateCalendarItem,
  weekDays,
} from '../services/storage';

const KIND_LABEL: Record<CalendarItemKind, { label: string; emoji: string; color: string }> = {
  idea: { label: 'Fikir', emoji: '💡', color: '#F59E0B' },
  brief: { label: 'Brief', emoji: '📋', color: '#6366f1' },
  caption: { label: 'Caption', emoji: '✍️', color: '#10B981' },
  manual: { label: 'Manuel', emoji: '📝', color: '#94a3b8' },
};

const HOUR_OPTIONS = [8, 10, 12, 14, 17, 19, 21];

const fmtWeekRange = (ts: number): string => {
  const start = new Date(ts);
  const end = new Date(ts);
  end.setDate(end.getDate() + 6);
  const f = (d: Date) =>
    d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  return `${f(start)} – ${f(end)}`;
};

export default function CalendarMiniScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [weekStart, setWeekStart] = useState<number>(startOfWeek(Date.now()));
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ day: number; hour: number } | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualPlatform, setManualPlatform] = useState('instagram');

  const [ideas, setIdeas] = useState<{ id: string; title: string }[]>([]);
  const [briefs, setBriefs] = useState<{ id: string; title: string; platform: string }[]>([]);
  const [captions, setCaptions] = useState<{ id: string; title: string }[]>([]);

  const load = useCallback(async () => {
    const [cal, ideaList, briefList, captionList] = await Promise.all([
      getCalendarList(),
      getIdeaBank(),
      getBriefList(),
      getCaptionList(),
    ]);
    setItems(cal);
    setIdeas(ideaList.map(i => ({ id: i.id, title: i.title })));
    setBriefs(briefList.map(b => ({ id: b.id, title: b.projectName, platform: b.platform })));
    setCaptions(captionList.map(c => ({ id: c.id, title: c.name })));
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
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const weekItems = useMemo(
    () => items.filter(i => i.weekStart === weekStart),
    [items, weekStart]
  );

  const summary = useMemo(() => {
    const byStatus: Record<CalendarItem['status'], number> = {
      planned: 0,
      drafting: 0,
      ready: 0,
      published: 0,
    };
    weekItems.forEach(i => {
      byStatus[i.status] += 1;
    });
    return { total: weekItems.length, byStatus };
  }, [weekItems]);

  const handlePrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.getTime());
  };

  const handleNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.getTime());
  };

  const handleToday = () => setWeekStart(startOfWeek(Date.now()));

  const handleAddManual = async () => {
    if (!picker || !manualTitle.trim()) {
      Alert.alert('Eksik bilgi', 'Önce başlık yaz.');
      return;
    }
    const next = await saveCalendarItem({
      weekStart,
      day: picker.day,
      hour: picker.hour,
      kind: 'manual',
      refId: null,
      title: manualTitle.trim(),
      platform: manualPlatform,
      status: 'planned',
      notes: '',
    });
    setItems(next);
    setManualTitle('');
    setPicker(null);
    setToast('Eklendi ✓');
  };

  const handleAttach = async (kind: CalendarItemKind, refId: string, title: string, platform: string) => {
    if (!picker) return;
    const next = await saveCalendarItem({
      weekStart,
      day: picker.day,
      hour: picker.hour,
      kind,
      refId,
      title,
      platform,
      status: 'planned',
      notes: '',
    });
    setItems(next);
    setPicker(null);
    setToast(`${KIND_LABEL[kind].label} eklendi ✓`);
  };

  const handleCycleStatus = async (id: string, current: CalendarItem['status']) => {
    const order: CalendarItem['status'][] = ['planned', 'drafting', 'ready', 'published'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    const list = await updateCalendarItem(id, { status: next });
    setItems(list);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Öğe silinsin mi?', 'Takvimden kaldırılır.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeCalendarItem(id);
          setItems(next);
        },
      },
    ]);
  };

  const handleClearWeek = () => {
    if (weekItems.length === 0) return;
    Alert.alert('Bu hafta temizlensin mi?', 'Tüm planlı öğeler silinir.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          const next = items.filter(i => i.weekStart !== weekStart);
          await clearCalendar();
          const restored = await saveCalendarItem;
          await Promise.all(
            items.filter(i => i.weekStart !== weekStart).map(i =>
              saveCalendarItem({
                weekStart: i.weekStart,
                day: i.day,
                hour: i.hour,
                kind: i.kind,
                refId: i.refId,
                title: i.title,
                platform: i.platform,
                status: i.status,
                notes: i.notes,
              })
            )
          );
          setItems(next);
          setToast('Hafta temizlendi');
        },
      },
    ]);
  };

  const renderItem = (item: CalendarItem) => {
    const status = CALENDAR_STATUS_META[item.status];
    const kind = KIND_LABEL[item.kind];
    return (
      <Pressable
        key={item.id}
        style={[styles.item, { borderLeftColor: status.color }]}
        onPress={() => handleCycleStatus(item.id, item.status)}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.itemTop}>
          <Text style={styles.itemEmoji}>{kind.emoji}</Text>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <View style={styles.itemBottom}>
          <View style={[styles.statusPill, { backgroundColor: status.color }]}>
            <Text style={styles.statusPillText}>
              {status.emoji} {status.label}
            </Text>
          </View>
          <Text style={styles.itemMeta}>{item.platform}</Text>
        </View>
      </Pressable>
    );
  };

  const renderCell = (day: number) => {
    const cellItems = weekItems
      .filter(i => i.day === day)
      .sort((a, b) => a.hour - b.hour);
    const dayMeta = days[day];
    return (
      <View key={day} style={[styles.cell, dayMeta.isToday && styles.cellToday]}>
        <View style={styles.cellHeader}>
          <Text style={[styles.cellDay, dayMeta.isToday && styles.cellDayToday]}>
            {dayMeta.label}
          </Text>
          <Text style={styles.cellDate}>{dayMeta.short}</Text>
        </View>
        <ScrollView style={styles.cellScroll} showsVerticalScrollIndicator={false}>
          {cellItems.length === 0 ? (
            <Text style={styles.cellEmpty}>boş</Text>
          ) : (
            cellItems.map(renderItem)
          )}
        </ScrollView>
        <View style={styles.cellAddRow}>
          {HOUR_OPTIONS.map(h => (
            <Pressable
              key={h}
              style={styles.hourBtn}
              onPress={() => setPicker({ day, hour: h })}
            >
              <Text style={styles.hourBtnText}>{String(h).padStart(2, '0')}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Haftalık Plan', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🗓️ Haftalık İçerik Planı</Text>
          <Text style={styles.heroSub}>
            Brief, fikir, caption veya manuel öğeleri haftanın günlerine yerleştir. Status'a dokun:
            planned → drafting → ready → published.
          </Text>
        </View>

        <View style={styles.weekNav}>
          <Pressable style={styles.navBtn} onPress={handlePrev}>
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Pressable style={styles.navMid} onPress={handleToday}>
            <Text style={styles.navMidText}>{fmtWeekRange(weekStart)}</Text>
            <Text style={styles.navMidSub}>bugüne dön</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={handleNext}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCell label="Toplam" value={summary.total} color="#f8fafc" />
          <SummaryCell label="📌 Planlı" value={summary.byStatus.planned} color="#94a3b8" />
          <SummaryCell label="✏️ Taslak" value={summary.byStatus.drafting} color="#F59E0B" />
          <SummaryCell label="✅ Hazır" value={summary.byStatus.ready} color="#10B981" />
          <SummaryCell label="🚀 Yayında" value={summary.byStatus.published} color="#0EA5E9" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
          {days.map((_, i) => renderCell(i))}
        </ScrollView>

        {weekItems.length > 0 ? (
          <Pressable style={styles.clearWeekBtn} onPress={handleClearWeek}>
            <Text style={styles.clearWeekText}>🗑️ Bu haftayı temizle</Text>
          </Pressable>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nasıl kullanılır</Text>
          <Text style={styles.helpText}>
• Hücre altındaki saat butonlarına dokun → boş slot açılır.{'\n'}
• Açılan picker'dan Fikir / Brief / Caption seç ya da manuel yaz.{'\n'}
• Kart üstüne dokun → status ilerler.{'\n'}
• Kart üzerinde uzun bas → sil.
          </Text>
        </View>
      </ScrollView>

      {picker ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { marginBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {days[picker.day].label} · {String(picker.hour).padStart(2, '0')}:00
              </Text>
              <Pressable onPress={() => setPicker(null)} hitSlop={10}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Manuel ekle</Text>
            <TextInput
              style={styles.input}
              value={manualTitle}
              onChangeText={setManualTitle}
              placeholder="ör: Sabah rutini paylaşımı"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.platformRow}>
              {['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'blog'].map(p => {
                const active = manualPlatform === p;
                return (
                  <Pressable
                    key={p}
                    style={[styles.platformChip, active && styles.platformChipActive]}
                    onPress={() => setManualPlatform(p)}
                  >
                    <Text style={[styles.platformText, active && styles.platformTextActive]}>
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.modalCta} onPress={handleAddManual}>
              <Text style={styles.modalCtaText}>📝 Manuel ekle</Text>
            </Pressable>

            {ideas.length > 0 ? (
              <>
                <Text style={styles.label}>Fikirlerden seç ({ideas.length})</Text>
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
                  {ideas.slice(0, 12).map(i => (
                    <Pressable
                      key={i.id}
                      style={styles.pickerItem}
                      onPress={() => handleAttach('idea', i.id, i.title, manualPlatform)}
                    >
                      <Text style={styles.pickerEmoji}>💡</Text>
                      <Text style={styles.pickerText} numberOfLines={1}>{i.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {briefs.length > 0 ? (
              <>
                <Text style={styles.label}>Brieflerden seç ({briefs.length})</Text>
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
                  {briefs.slice(0, 8).map(b => (
                    <Pressable
                      key={b.id}
                      style={styles.pickerItem}
                      onPress={() => handleAttach('brief', b.id, b.title, b.platform)}
                    >
                      <Text style={styles.pickerEmoji}>📋</Text>
                      <Text style={styles.pickerText} numberOfLines={1}>{b.title}</Text>
                      <Text style={styles.pickerMeta}>{b.platform}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {captions.length > 0 ? (
              <>
                <Text style={styles.label}>Captionlardan seç ({captions.length})</Text>
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
                  {captions.slice(0, 8).map(c => (
                    <Pressable
                      key={c.id}
                      style={styles.pickerItem}
                      onPress={() => handleAttach('caption', c.id, c.title, manualPlatform)}
                    >
                      <Text style={styles.pickerEmoji}>✍️</Text>
                      <Text style={styles.pickerText} numberOfLines={1}>{c.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      ) : null}

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const SummaryCell: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={styles.summaryCell}>
    <Text style={[styles.summaryNum, { color }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  heroTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  heroSub: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },

  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 6,
    marginBottom: 12,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  navMid: { flex: 1, alignItems: 'center' },
  navMidText: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  navMidSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  summaryRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  summaryCell: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  summaryNum: { fontSize: 16, fontWeight: '700' },
  summaryLabel: { color: '#94a3b8', fontSize: 9, marginTop: 2, textAlign: 'center' },

  weekScroll: { marginBottom: 12 },
  cell: {
    width: 130,
    minHeight: 320,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cellToday: { borderColor: '#6366f1', borderWidth: 2 },
  cellHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cellDay: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  cellDayToday: { color: '#a5b4fc' },
  cellDate: { color: '#94a3b8', fontSize: 10 },
  cellScroll: { flex: 1, marginBottom: 6 },
  cellEmpty: { color: '#475569', fontSize: 11, fontStyle: 'italic' },
  item: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 6,
    marginBottom: 4,
    borderLeftWidth: 3,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  itemEmoji: { fontSize: 12, marginRight: 4 },
  itemTitle: { color: '#f8fafc', fontSize: 11, fontWeight: '600', flex: 1 },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  statusPillText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  itemMeta: { color: '#64748b', fontSize: 9 },
  cellAddRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  hourBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hourBtnText: { color: '#a5b4fc', fontSize: 10, fontWeight: '700' },

  clearWeekBtn: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    marginBottom: 12,
  },
  clearWeekText: { color: '#f87171', fontSize: 13, fontWeight: '700' },

  section: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  sectionTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  helpText: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },

  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  modalClose: { color: '#94a3b8', fontSize: 20, paddingHorizontal: 6 },
  label: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  platformChip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  platformChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  platformText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
  platformTextActive: { color: '#fff' },
  modalCta: {
    backgroundColor: '#6366f1',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pickerList: { maxHeight: 120 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerEmoji: { fontSize: 14, marginRight: 6 },
  pickerText: { color: '#f8fafc', fontSize: 12, flex: 1 },
  pickerMeta: { color: '#94a3b8', fontSize: 10 },

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