import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../services/theme';
import {
  Reminder,
  addReminder,
  buildReminderTemplates,
  deleteReminder,
  getScheduledNotifications,
  incrementReminderCompletion,
  isWeeklySummaryEnabled,
  loadReminders,
  requestNotificationPermission,
  sendTestNotification,
  setWeeklySummaryEnabled,
  toggleReminderEnabled,
  updateReminder,
} from '../../services/notificationService';
import PlanBadge from '../../components/PlanBadge';
import PageHint from '../../components/PageHint';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const WEEKDAY_FULL_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export default function RemindersScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [days, setDays] = useState<number[]>([2, 4, 6]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [once, setOnce] = useState(false);
  const [permission, setPermission] = useState<boolean>(false);
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [planRefresh, setPlanRefresh] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<boolean>(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState<boolean>(false);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1]);
  const [weeklyHour, setWeeklyHour] = useState<number>(8);
  const [weeklyMinute, setWeeklyMinute] = useState<number>(0);
  const [weeklyBody, setWeeklyBody] = useState<string>('');

  const refresh = async () => {
    setReminders(await loadReminders());
    const list = await getScheduledNotifications();
    setScheduledCount(list.length);
    setWeeklySummary(await isWeeklySummaryEnabled());
  };

  useEffect(() => {
    (async () => {
      const granted = await requestNotificationPermission();
      setPermission(granted);
      await refresh();
      setWeeklyBody(t('reminders.weeklyDefaultMessage'));
    })();
    setPlanRefresh((x) => x + 1);
  }, []);

  const startEdit = (r: Reminder) => {
    setEditingId(r.id);
    setHour(r.hour);
    setMinute(r.minute);
    setDays(r.weekdays);
    setTitle(r.title ?? '');
    setBody(r.body ?? '');
    setOnce(!!r.once);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHour(9);
    setMinute(0);
    setDays([2, 4, 6]);
    setTitle('');
    setBody('');
    setOnce(false);
  };

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const applyTemplate = (idx: number) => {
    const tpl = buildReminderTemplates()[idx];
    setHour(tpl.hour);
    setMinute(tpl.minute);
    setDays(tpl.weekdays);
    setTitle(tpl.title);
    setBody(tpl.body);
    setOnce(false);
  };

  const onSave = async () => {
    if (!permission) {
      const granted = await requestNotificationPermission();
      setPermission(granted);
      if (!granted) {
        Alert.alert(t('reminders.permissionDenied'));
        return;
      }
    }
    if (!once && days.length === 0) {
      Alert.alert(t('reminders.selectAtLeastOneDay'));
      return;
    }

    const payload = {
      hour,
      minute,
      weekdays: once ? [1] : days,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
      once,
    };

    if (editingId) {
      await updateReminder(editingId, payload);
      cancelEdit();
    } else {
      const r = await addReminder(payload);
      setReminders((prev) => [...prev, r]);
      cancelEdit();
    }
    await refresh();
  };

  const onDelete = async (id: string) => {
    Alert.alert(t('reminders.deleteTitle'), t('reminders.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('reminders.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteReminder(id);
          setReminders((prev) => prev.filter((r) => r.id !== id));
          if (editingId === id) cancelEdit();
          await refresh();
        },
      },
    ]);
  };

  const onToggleEnabled = async (r: Reminder) => {
    const updated = await toggleReminderEnabled(r.id);
    if (updated) {
      setReminders((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
      await refresh();
    }
  };

  const onComplete = async (r: Reminder) => {
    const updated = await incrementReminderCompletion(r.id);
    if (updated) {
      setReminders((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    }
  };

  const onTest = async () => {
    const ok = await sendTestNotification();
    if (!ok) {
      Alert.alert(
        t('reminders.testAlertTitle'),
        t('reminders.testAlertWebHint')
      );
    } else {
      Alert.alert(t('reminders.testAlertTitle'), t('reminders.testAlertMsg'));
    }
  };

  const onToggleWeekly = async (next: boolean) => {
    if (next) {
      setShowWeeklyModal(true);
    } else {
      Alert.alert(
        t('reminders.weeklyDisableTitle'),
        t('reminders.weeklyDisableMsg'),
        [
          { text: t('reminders.weeklyDisableCancel'), style: 'cancel' },
          {
            text: t('reminders.delete'),
            style: 'destructive',
            onPress: async () => {
              const ok = await setWeeklySummaryEnabled(false);
              if (ok) setWeeklySummary(false);
            },
          },
        ]
      );
    }
  };

  const saveWeekly = async () => {
    if (weeklyDays.length === 0) {
      Alert.alert(t('reminders.weeklySelectDay'));
      return;
    }
    const ok = await setWeeklySummaryEnabled(true);
    if (!ok) {
      Alert.alert(t('reminders.permissionDenied'));
      return;
    }
    setWeeklySummary(true);
    setShowWeeklyModal(false);
  };

  const toggleWeeklyDay = (day: number) => {
    setWeeklyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#5C6B4F' }]} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <PageHint hintId="reminders" title={t('pageHints.reminders.title')} description={t('pageHints.reminders.desc')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={styles.title}>{t('reminders.title')}</Text>
        <PlanBadge size="sm" refreshKey={planRefresh} />
      </View>

      <View style={styles.statusCard}>
        <View style={[styles.statusDot, { backgroundColor: permission ? '#10B981' : '#DC2626' }]} />
        <Text style={styles.statusText}>
          {permission ? t('reminders.permissionGranted') : t('reminders.permissionNone')}
        </Text>
        <Text style={styles.statusCount}>{t('reminders.activeCount', { count: scheduledCount })}</Text>
      </View>

      <Pressable onPress={onTest} style={styles.testBtn}>
        <Text style={styles.testBtnText}>{t('reminders.testBtn')}</Text>
      </Pressable>

      <Pressable
        onPress={() => onToggleWeekly(!weeklySummary)}
        style={[styles.weeklyRow, weeklySummary && styles.weeklyRowActive]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.weeklyTitle}>{t('reminders.weeklyTitle')}</Text>
          <Text style={styles.weeklySub}>
            {weeklySummary ? t('reminders.weeklySubActive') : t('reminders.weeklySubInactive')}
          </Text>
        </View>
        <Switch
          value={weeklySummary}
          onValueChange={onToggleWeekly}
          trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
          thumbColor={weeklySummary ? '#4D96FF' : '#F3F4F6'}
        />
      </Pressable>

      <Text style={styles.sectionTitle}>⚡ {t('reminders.title')}</Text>
      <View style={styles.templateGrid}>
        {buildReminderTemplates().map((tpl, idx) => (
          <Pressable key={`${tpl.label}-${idx}`} onPress={() => applyTemplate(idx)} style={styles.templateChip}>
            <Text style={styles.templateIcon}>{tpl.icon}</Text>
            <Text style={styles.templateLabel}>{tpl.label}</Text>
            <Text style={styles.templateTime}>{String(tpl.hour).padStart(2, '0')}:{String(tpl.minute).padStart(2, '0')}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>
          {editingId ? t('reminders.editReminder') : t('reminders.addReminder')}
        </Text>

        <Text style={styles.subLabel}>{t('reminders.titleOptional')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('reminders.titlePlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
          maxLength={50}
        />

        <Text style={styles.subLabel}>{t('reminders.bodyOptional')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('reminders.bodyPlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={body}
          onChangeText={setBody}
          maxLength={100}
        />

        <View style={styles.typeRow}>
          <Pressable
            onPress={() => setOnce(false)}
            style={[styles.typeChip, !once && styles.typeChipOn]}
          >
            <Text style={[styles.typeText, !once && styles.typeTextOn]}>{t('reminders.typeRecurring')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setOnce(true)}
            style={[styles.typeChip, once && styles.typeChipOn]}
          >
            <Text style={[styles.typeText, once && styles.typeTextOn]}>{t('reminders.typeOnce')}</Text>
          </Pressable>
        </View>

        <Text style={styles.subLabel}>{t('reminders.time')}</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeBtn}>
            <Pressable onPress={() => setHour((h) => (h + 1) % 24)} hitSlop={8}>
              <Text style={styles.timeArrow}>↑</Text>
            </Pressable>
            <Text style={styles.timeValue}>{String(hour).padStart(2, '0')}</Text>
            <Pressable onPress={() => setHour((h) => (h - 1 + 24) % 24)} hitSlop={8}>
              <Text style={styles.timeArrow}>↓</Text>
            </Pressable>
          </View>
          <Text style={styles.colon}>:</Text>
          <View style={styles.timeBtn}>
            <Pressable onPress={() => setMinute((m) => (m + 5) % 60)} hitSlop={8}>
              <Text style={styles.timeArrow}>↑</Text>
            </Pressable>
            <Text style={styles.timeValue}>{String(minute).padStart(2, '0')}</Text>
            <Pressable onPress={() => setMinute((m) => (m - 5 + 60) % 60)} hitSlop={8}>
              <Text style={styles.timeArrow}>↓</Text>
            </Pressable>
          </View>
        </View>

        {!once && (
          <>
            <Text style={styles.subLabel}>{t('reminders.days')}</Text>
            <View style={styles.daysRow}>
              {WEEKDAY_KEYS.map((key, idx) => {
                const wd = idx === 0 ? 1 : idx === 6 ? 7 : idx + 1;
                const active = days.includes(wd);
                return (
                  <Pressable
                    key={wd}
                    onPress={() => toggleDay(wd)}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                  >
                    <Text style={[styles.dayText, active && styles.dayTextActive]}>{t(`weekdays.${key}`)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {once && (
          <Text style={styles.onceHint}>
            {t('reminders.onceHint', {
              time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            })}
          </Text>
        )}

        <View style={styles.buttonRow}>
          {editingId && (
            <Pressable style={[styles.addBtn, styles.cancelBtn]} onPress={cancelEdit}>
              <Text style={styles.cancelBtnText}>{t('reminders.cancel')}</Text>
            </Pressable>
          )}
          <Pressable style={styles.addBtn} onPress={onSave}>
            <Text style={styles.addBtnText}>{editingId ? t('reminders.update') : t('reminders.addReminder')}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.subTitle}>{t('reminders.savedTitle', { count: reminders.length })}</Text>
      {reminders.length === 0 && <Text style={styles.empty}>{t('reminders.noReminders')}</Text>}
      {reminders.map((r) => {
        const isEnabled = r.enabled !== false;
        const daysLabel = r.once
          ? t('reminders.dayOnce')
          : r.weekdays.length === 7
          ? t('reminders.dayEveryday')
          : r.weekdays.map((d) => t(`weekdays.${WEEKDAY_FULL_KEYS[d - 1]}`)).join(', ');
        return (
          <View key={r.id} style={[styles.item, editingId === r.id && styles.itemActive, !isEnabled && styles.itemDisabled]}>
            <Pressable onPress={() => startEdit(r)} style={{ flex: 1 }}>
              <Text style={styles.itemTime}>
                {String(r.hour).padStart(2, '0')}:{String(r.minute).padStart(2, '0')}
                {'  '}
                {r.title ? <Text style={styles.itemTitle}>· {r.title}</Text> : null}
              </Text>
              <Text style={styles.itemDays}>{daysLabel}</Text>
              {(r.completedCount ?? 0) > 0 && (
                <Text style={styles.itemCount}>{t('reminders.completionCount', { count: r.completedCount })}</Text>
              )}
            </Pressable>
            <View style={styles.itemActions}>
              <Switch
                value={isEnabled}
                onValueChange={() => onToggleEnabled(r)}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={isEnabled ? '#4D96FF' : '#F3F4F6'}
              />
              <Pressable onPress={() => onComplete(r)} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>✓</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(r.id)} style={styles.delBtn}>
                <Text style={styles.delBtnText}>✕</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>

    <Modal visible={showWeeklyModal} transparent animationType="slide" onRequestClose={() => setShowWeeklyModal(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setShowWeeklyModal(false)}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('reminders.weeklyModalTitle')}</Text>
          <Text style={styles.modalHint}>{t('reminders.weeklyModalHint')}</Text>

          <Text style={styles.subLabel}>{t('reminders.weeklyDaysLabel')}</Text>
          <View style={styles.weekDaysRow}>
            {WEEKDAY_KEYS.map((key, i) => {
              const day = i + 1;
              const active = weeklyDays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleWeeklyDay(day)}
                  style={[styles.weekDayChip, active && styles.weekDayChipActive]}
                >
                  <Text style={[styles.weekDayText, active && styles.weekDayTextActive]}>{t(`weekdays.${key}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.subLabel}>{t('reminders.time')}</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeBtn}>
              <Pressable onPress={() => setWeeklyHour((h) => (h + 1) % 24)} hitSlop={8}>
                <Text style={styles.timeArrow}>↑</Text>
              </Pressable>
              <Text style={styles.timeValue}>{String(weeklyHour).padStart(2, '0')}</Text>
              <Pressable onPress={() => setWeeklyHour((h) => (h - 1 + 24) % 24)} hitSlop={8}>
                <Text style={styles.timeArrow}>↓</Text>
              </Pressable>
            </View>
            <Text style={styles.colon}>:</Text>
            <View style={styles.timeBtn}>
              <Pressable onPress={() => setWeeklyMinute((m) => (m + 5) % 60)} hitSlop={8}>
                <Text style={styles.timeArrow}>↑</Text>
              </Pressable>
              <Text style={styles.timeValue}>{String(weeklyMinute).padStart(2, '0')}</Text>
              <Pressable onPress={() => setWeeklyMinute((m) => (m - 5 + 60) % 60)} hitSlop={8}>
                <Text style={styles.timeArrow}>↓</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.subLabel}>{t('reminders.weeklyMessageLabel')}</Text>
          <TextInput
            style={styles.input}
            value={weeklyBody}
            onChangeText={setWeeklyBody}
            placeholder={t('reminders.weeklyBodyPlaceholder')}
            placeholderTextColor="#9CA3AF"
            maxLength={100}
          />

          <View style={styles.modalBtnRow}>
            <Pressable style={[styles.addBtn, styles.cancelBtn]} onPress={() => setShowWeeklyModal(false)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.addBtn} onPress={saveWeekly}>
              <Text style={styles.addBtnText}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C6B4F' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: 50, marginBottom: 16 },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10, gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
  statusCount: { fontSize: 12, color: '#6B7280' },
  testBtn: { backgroundColor: '#FEF3C7', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  testBtnText: { color: '#92400E', fontWeight: '700' },
  weeklyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 2, borderColor: '#E5E7EB' },
  weeklyRowActive: { borderColor: '#4D96FF', backgroundColor: '#EFF6FF' },
  weeklyTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  weeklySub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#6B7280', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  templateChip: { width: '48%', backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  templateIcon: { fontSize: 20, marginBottom: 4 },
  templateLabel: { fontSize: 12, color: '#111827', fontWeight: '700' },
  templateTime: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  subTitle: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8, color: '#374151' },
  card: { backgroundColor: 'white', padding: 18, borderRadius: 16 },
  label: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  typeChipOn: { backgroundColor: '#4D96FF' },
  typeText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  typeTextOn: { color: 'white' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timeBtn: { alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  timeArrow: { color: '#6B7280', fontSize: 12 },
  timeValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  colon: { fontSize: 28, fontWeight: '800', color: '#111827' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayChip: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  dayChipActive: { backgroundColor: '#4D96FF' },
  dayText: { fontWeight: '700', color: '#6B7280', fontSize: 12 },
  dayTextActive: { color: 'white' },
  onceHint: { fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  addBtn: { flex: 1, backgroundColor: '#4D96FF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: 'white', fontWeight: '700' },
  cancelBtn: { backgroundColor: '#F3F4F6', flex: 0, paddingHorizontal: 20 },
  cancelBtnText: { color: '#374151', fontWeight: '700' },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 12 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 8 },
  itemActive: { borderWidth: 2, borderColor: '#4D96FF' },
  itemDisabled: { opacity: 0.55 },
  itemTime: { fontSize: 18, fontWeight: '700', color: '#111827' },
  itemTitle: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  itemDays: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  itemCount: { fontSize: 11, color: '#10B981', fontWeight: '700', marginTop: 2 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  doneBtnText: { color: '#10B981', fontWeight: '800' },
  delBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  delBtnText: { color: '#DC2626', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FAFCF6', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 36 },
  modalHandle: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#C5D2A0', alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 },
  modalHint: { fontSize: 13, color: '#6B7280', marginBottom: 14 },
  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  weekDayChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F4ED', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#C5D2A0' },
  weekDayChipActive: { backgroundColor: '#4D96FF', borderColor: '#4D96FF' },
  weekDayText: { fontSize: 12, fontWeight: '700', color: '#2F3B25' },
  weekDayTextActive: { color: 'white' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
});