import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type Reminder = {
  id: string;
  hour: number;
  minute: number;
  weekdays: number[];
  notificationId?: string;
  title?: string;
  body?: string;
  once?: boolean;
  enabled?: boolean;
  completedCount?: number;
};

export const REMINDER_TEMPLATES: { label: string; icon: string; hour: number; minute: number; weekdays: number[]; title: string; body: string }[] = [
  {
    label: 'Sabah planlaması',
    icon: '☀️',
    hour: 8,
    minute: 0,
    weekdays: [2, 3, 4, 5, 6],
    title: 'Günaydın! ☀️',
    body: 'Bugünkü içeriğini planlamayı unutma.',
  },
  {
    label: 'Yayın saatim',
    icon: '🎬',
    hour: 19,
    minute: 0,
    weekdays: [3, 6],
    title: '🎬 Yayın zamanı!',
    body: 'Bugün içeriğini paylaşmayı unutma.',
  },
  {
    label: 'Haftalık plan',
    icon: '📅',
    hour: 20,
    minute: 0,
    weekdays: [1],
    title: '📅 Haftayı planla',
    body: 'Yeni hafta için fikirlerini seç.',
  },
  {
    label: 'Akşam kontrolü',
    icon: '🌙',
    hour: 22,
    minute: 0,
    weekdays: [1, 2, 3, 4, 5],
    title: '🌙 Akşam kontrolü',
    body: 'Yarınki paylaşımın hazır mı?',
  },
];

const STORAGE_KEY = '@content-coach/reminders';
const DAILY_IDEA_KEY = '@content-coach/daily-idea-id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

if (Platform.OS === 'ios') {
  Notifications.setNotificationCategoryAsync('reminder', [
    { identifier: 'SNOOZE_5', buttonTitle: '5dk ertele', options: { isAuthenticationRequired: false } },
    { identifier: 'DONE', buttonTitle: 'Tamam', options: { isAuthenticationRequired: false } },
  ]).catch(() => {});
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  let final = status;
  if (final !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  return final === 'granted';
};

export const scheduleReminder = async (reminder: Reminder): Promise<string | null> => {
  try {
    if (reminder.enabled === false) return null;
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return null;

    if (reminder.once) {
      const target = new Date();
      target.setHours(reminder.hour, reminder.minute, 0, 0);
      if (target.getTime() <= Date.now()) {
        target.setDate(target.getDate() + 1);
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title ?? 'İçerik zamanı! ✨',
          body: reminder.body ?? 'Bugün paylaşımını planlamayı unutma.',
          categoryIdentifier: Platform.OS === 'ios' ? 'reminder' : undefined,
        },
        trigger: {
          date: target,
        },
      });
    } else {
      for (const weekday of reminder.weekdays) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title ?? 'İçerik zamanı! ✨',
            body: reminder.body ?? 'Bugün paylaşımını planlamayı unutma.',
            categoryIdentifier: Platform.OS === 'ios' ? 'reminder' : undefined,
          },
          trigger: {
            weekday,
            hour: reminder.hour,
            minute: reminder.minute,
            repeats: true,
          },
        });
      }
    }
    return `scheduled-${Date.now()}`;
  } catch (e) {
    console.warn('scheduleReminder error', e);
    return null;
  }
};

export const scheduleSnooze = async (minutes: number, reminder: Pick<Reminder, 'hour' | 'minute'>): Promise<boolean> => {
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Ertelendi',
        body: `${minutes} dakika sonra tekrar hatırlatacağız.`,
      },
      trigger: { seconds: minutes * 60 },
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const cancelReminder = async (notificationId?: string): Promise<void> => {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.warn('cancelReminder error', e);
  }
};

export const loadReminders = async (): Promise<Reminder[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Reminder[];
  } catch {
    return [];
  }
};

export const saveReminders = async (reminders: Reminder[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
};

export const addReminder = async (
  reminder: Omit<Reminder, 'id' | 'notificationId'>
): Promise<Reminder> => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const notificationId = await scheduleReminder({ ...reminder, id });
  const newReminder: Reminder = { ...reminder, id, notificationId: notificationId ?? undefined };
  const existing = await loadReminders();
  await saveReminders([...existing, newReminder]);
  return newReminder;
};

export const deleteReminder = async (id: string): Promise<void> => {
  const existing = await loadReminders();
  const target = existing.find((r) => r.id === id);
  if (target) await cancelReminder(target.notificationId);
  await saveReminders(existing.filter((r) => r.id !== id));
};

export const updateReminder = async (
  id: string,
  patch: Partial<Pick<Reminder, 'hour' | 'minute' | 'weekdays' | 'title' | 'body' | 'once'>>
): Promise<Reminder | null> => {
  const existing = await loadReminders();
  const target = existing.find((r) => r.id === id);
  if (!target) return null;
  await cancelReminder(target.notificationId);
  const merged = { ...target, ...patch };
  const notificationId = await scheduleReminder(merged);
  const updated: Reminder = {
    ...merged,
    notificationId: notificationId ?? undefined,
  };
  await saveReminders(existing.map((r) => (r.id === id ? updated : r)));
  return updated;
};

export const toggleReminderEnabled = async (id: string): Promise<Reminder | null> => {
  const existing = await loadReminders();
  const target = existing.find((r) => r.id === id);
  if (!target) return null;
  const nextEnabled = !(target.enabled !== false);
  await cancelReminder(target.notificationId);
  const updated: Reminder = { ...target, enabled: nextEnabled };
  if (nextEnabled) {
    const notificationId = await scheduleReminder(updated);
    updated.notificationId = notificationId ?? undefined;
  } else {
    updated.notificationId = undefined;
  }
  await saveReminders(existing.map((r) => (r.id === id ? updated : r)));
  return updated;
};

export const incrementReminderCompletion = async (id: string): Promise<Reminder | null> => {
  const existing = await loadReminders();
  const target = existing.find((r) => r.id === id);
  if (!target) return null;
  const updated: Reminder = { ...target, completedCount: (target.completedCount ?? 0) + 1 };
  await saveReminders(existing.map((r) => (r.id === id ? updated : r)));
  return updated;
};

export const sendTestNotification = async (): Promise<boolean> => {
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Bu bir test bildirimi 🔔',
        body: 'Hatırlatmaların doğru çalışıyor!',
      },
      trigger: { seconds: 2 },
    });
    return true;
  } catch (e) {
    console.warn('sendTestNotification error', e);
    return false;
  }
};

export const getScheduledNotifications = async () => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
};

const WEEKLY_SUMMARY_KEY = '@content-coach/weekly-summary';

export const isWeeklySummaryEnabled = async (): Promise<boolean> => {
  const v = await AsyncStorage.getItem(WEEKLY_SUMMARY_KEY);
  return v === '1';
};

export const setWeeklySummaryEnabled = async (enabled: boolean): Promise<boolean> => {
  await AsyncStorage.setItem(WEEKLY_SUMMARY_KEY, enabled ? '1' : '0');
  if (enabled) return scheduleWeeklySummary();
  return cancelWeeklySummary();
};

let weeklySummaryId: string | null = null;

export const scheduleWeeklySummary = async (): Promise<boolean> => {
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  try {
    if (weeklySummaryId) {
      await Notifications.cancelScheduledNotificationAsync(weeklySummaryId);
      weeklySummaryId = null;
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Haftalık içerik özeti',
        body: 'Yeni haftanın fikirleri hazır. Uygulamayı aç ve göz at!',
      },
      trigger: {
        weekday: 1,
        hour: 8,
        minute: 0,
        repeats: true,
      },
    });
    weeklySummaryId = id;
    return true;
  } catch (e) {
    console.warn('scheduleWeeklySummary error', e);
    return false;
  }
};

export const cancelWeeklySummary = async (): Promise<boolean> => {
  if (!weeklySummaryId) return true;
  try {
    await Notifications.cancelScheduledNotificationAsync(weeklySummaryId);
    weeklySummaryId = null;
    return true;
  } catch (e) {
    return false;
  }
};

export const isDailyIdeaEnabled = async (): Promise<boolean> => {
  const v = await AsyncStorage.getItem(DAILY_IDEA_KEY + ':enabled');
  return v === '1';
};

export const setDailyIdeaEnabled = async (enabled: boolean): Promise<boolean> => {
  await AsyncStorage.setItem(DAILY_IDEA_KEY + ':enabled', enabled ? '1' : '0');
  if (enabled) return scheduleDailyIdea();
  return cancelDailyIdea();
};

export const scheduleDailyIdea = async (): Promise<boolean> => {
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  try {
    const prev = await AsyncStorage.getItem(DAILY_IDEA_KEY);
    if (prev) {
      await Notifications.cancelScheduledNotificationAsync(prev).catch(() => {});
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💡 Günün fikri hazır',
        body: 'Sabah 8’de yeni bir içerik fikri seni bekliyor. Uygulamayı aç!',
      },
      trigger: { hour: 8, minute: 0, repeats: true },
    });
    await AsyncStorage.setItem(DAILY_IDEA_KEY, id);
    return true;
  } catch (e) {
    console.warn('scheduleDailyIdea error', e);
    return false;
  }
};

export const cancelDailyIdea = async (): Promise<boolean> => {
  try {
    const prev = await AsyncStorage.getItem(DAILY_IDEA_KEY);
    if (prev) {
      await Notifications.cancelScheduledNotificationAsync(prev).catch(() => {});
    }
    await AsyncStorage.removeItem(DAILY_IDEA_KEY);
    return true;
  } catch (e) {
    return false;
  }
};