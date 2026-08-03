import AsyncStorage from '@react-native-async-storage/async-storage';
import { NicheId, getNichePool } from './contentService';

const NICHE_KEY = '@content-coach/niche';
const FAVORITES_KEY = '@content-coach/favorites';
const HISTORY_KEY = '@content-coach/history';
const EXPERIENCE_KEY = '@content-coach/experience';
const GOAL_KEY = '@content-coach/goal';
const STREAK_KEY = '@content-coach/streak';
const STREAK_LAST_KEY = '@content-coach/streak-last';
const DONE_KEY = '@content-coach/done';
const DONE_DAY_KEY = '@content-coach/done-today';
const COPIES_KEY = '@content-coach/copies';
const FAV_PROMPTS_KEY = '@content-coach/fav-prompts';
const RECENT_QUESTIONS_KEY = '@content-coach/recent-questions';
const ACCOUNT_CREATED_KEY = '@content-coach/account-created';
const STREAK_BEST_KEY = '@content-coach/streak-best';
const WEEKLY_GOAL_KEY = '@content-coach/weekly-goal';
const WEEKLY_GOAL_PROGRESS_KEY = '@content-coach/weekly-goal-progress';
const SCHEDULE_KEY = '@content-coach/schedule';
const COMMENT_TPL_KEY = '@content-coach/comment-templates';
const IDEA_TAGS_KEY = '@content-coach/idea-tags';
const STREAK_SHIELDS_KEY = '@content-coach/streak-shields';
const STREAK_LAST_USED_SHIELD_KEY = '@content-coach/streak-last-used-shield';
const COLLECTIONS_KEY = '@content-coach/collections';
const DAILY_CARD_KEY = '@content-coach/daily-card';
const DAILY_CARD_FLIPS_KEY = '@content-coach/daily-card-flips';

export type ScheduleEntry = {
  id: string;
  text: string;
  date: string;
  niche: NicheId;
  note?: string;
  done: boolean;
  createdAt: number;
};

export const getSchedule = async (): Promise<ScheduleEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ScheduleEntry =>
        e &&
        typeof e === 'object' &&
        typeof e.id === 'string' &&
        typeof e.text === 'string' &&
        typeof e.date === 'string' &&
        typeof e.niche === 'string' &&
        typeof e.done === 'boolean' &&
        typeof e.createdAt === 'number'
    );
  } catch {
    return [];
  }
};

export const addScheduleEntry = async (text: string, date: string, niche: NicheId | null, note?: string): Promise<ScheduleEntry> => {
  const list = await getSchedule();
  const entry: ScheduleEntry = {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    date,
    niche: (niche ?? 'personal_dev') as NicheId,
    note,
    done: false,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify([entry, ...list]));
  return entry;
};

export const toggleScheduleEntry = async (id: string): Promise<ScheduleEntry[]> => {
  const list = await getSchedule();
  const next = list.map((e) => (e.id === id ? { ...e, done: !e.done } : e));
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  return next;
};

export const removeScheduleEntry = async (id: string): Promise<ScheduleEntry[]> => {
  const list = await getSchedule();
  const next = list.filter((e) => e.id !== id);
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  return next;
};

export const updateScheduleEntry = async (id: string, patch: Partial<Pick<ScheduleEntry, 'text' | 'date' | 'note'>>): Promise<ScheduleEntry[]> => {
  const list = await getSchedule();
  const next = list.map((e) => (e.id === id ? { ...e, ...patch } : e));
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  return next;
};

export const getScheduleForDate = async (date: string): Promise<ScheduleEntry[]> => {
  const list = await getSchedule();
  return list.filter((e) => e.date === date);
};

export const getScheduleForMonth = async (year: number, month: number): Promise<ScheduleEntry[]> => {
  const list = await getSchedule();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  return list.filter((e) => e.date.startsWith(prefix));
};

export const getScheduleStats = async (): Promise<{ planned: number; done: number; upcoming: number }> => {
  const list = await getSchedule();
  const today = new Date().toISOString().slice(0, 10);
  return {
    planned: list.length,
    done: list.filter((e) => e.done).length,
    upcoming: list.filter((e) => !e.done && e.date >= today).length,
  };
};

export type HeatmapDay = {
  date: string;
  planned: number;
  done: number;
  isToday: boolean;
};

export type HeatmapData = {
  days: HeatmapDay[];
  maxPlanned: number;
  maxDone: number;
  totalPlanned: number;
  totalDone: number;
  activeDays: number;
  longestStreak: number;
  currentStreak: number;
};

const heatmapDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const getHeatmapData = async (daysBack: number = 365): Promise<HeatmapData> => {
  const [schedule, done] = await Promise.all([getSchedule(), getDoneIdeasDetailed()]);
  const doneByDate = new Map<string, number>();
  for (const e of done) {
    const d = e.date;
    if (!d) continue;
    doneByDate.set(d, (doneByDate.get(d) ?? 0) + 1);
  }
  const plannedByDate = new Map<string, number>();
  for (const e of schedule) {
    plannedByDate.set(e.date, (plannedByDate.get(e.date) ?? 0) + 1);
  }
  const today = new Date();
  const todayKey = heatmapDateKey(today);
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startMs = todayMs - (daysBack - 1) * 24 * 60 * 60 * 1000;
  const out: HeatmapDay[] = [];
  let maxPlanned = 0;
  let maxDone = 0;
  let totalPlanned = 0;
  let totalDone = 0;
  let activeDays = 0;
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(startMs + i * 24 * 60 * 60 * 1000);
    const key = heatmapDateKey(d);
    const planned = plannedByDate.get(key) ?? 0;
    const doneCount = doneByDate.get(key) ?? 0;
    out.push({ date: key, planned, done: doneCount, isToday: key === todayKey });
    if (planned > maxPlanned) maxPlanned = planned;
    if (doneCount > maxDone) maxDone = doneCount;
    totalPlanned += planned;
    totalDone += doneCount;
    if (planned > 0 || doneCount > 0) activeDays += 1;
  }
  let longestStreak = 0;
  let currentRun = 0;
  for (const day of out) {
    if (day.planned > 0 || day.done > 0) {
      currentRun += 1;
      if (currentRun > longestStreak) longestStreak = currentRun;
    } else {
      currentRun = 0;
    }
  }
  let currentStreak = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    const d = out[i];
    if (d.planned > 0 || d.done > 0) currentStreak += 1;
    else break;
  }
  return {
    days: out,
    maxPlanned,
    maxDone,
    totalPlanned,
    totalDone,
    activeDays,
    longestStreak,
    currentStreak,
  };
};

export type WeeklyStreakDay = {
  date: string;
  label: string;
  done: number;
  planned: number;
  hasActivity: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
};

export type WeeklyStreakWeek = {
  weekId: string;
  startDate: string;
  endDate: string;
  days: WeeklyStreakDay[];
  activeDays: number;
  plannedTotal: number;
  doneTotal: number;
  completionRate: number;
  goalTarget: WeeklyGoalTarget;
  goalCompleted: number;
  goalAchieved: boolean;
  isCurrent: boolean;
};

export type WeeklyStreakData = {
  weeks: WeeklyStreakWeek[];
  currentWeekIndex: number;
  currentWeekDone: number;
  currentWeekPlanned: number;
  currentWeekActiveDays: number;
  currentWeekCompletion: number;
  bestWeekDone: number;
  bestWeekId: string | null;
  totalDone: number;
  totalPlanned: number;
  perfectWeeks: number;
  achievedWeeks: number;
  weeklyGoal: WeeklyGoalTarget;
  recentActivityDays: number;
};

const startOfWeekMonday = (d: Date): Date => {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  return out;
};

const weeklyStreakDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayShortLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const getWeeklyStreakData = async (
  weeksBack: number = 8
): Promise<WeeklyStreakData> => {
  const [schedule, done, weeklyGoal] = await Promise.all([
    getSchedule(),
    getDoneIdeasDetailed(),
    getWeeklyGoal(),
  ]);

  const doneByDate = new Map<string, number>();
  for (const e of done) {
    if (!e.date) continue;
    doneByDate.set(e.date, (doneByDate.get(e.date) ?? 0) + 1);
  }
  const plannedByDate = new Map<string, number>();
  for (const e of schedule) {
    plannedByDate.set(e.date, (plannedByDate.get(e.date) ?? 0) + 1);
  }

  const today = new Date();
  const todayKey = weeklyStreakDateKey(today);
  const currentWeekStart = startOfWeekMonday(today);
  const totalWeeks = weeksBack + 1;
  const startMonday = new Date(currentWeekStart);
  startMonday.setDate(startMonday.getDate() - (totalWeeks - 1) * 7);

  const weeks: WeeklyStreakWeek[] = [];
  let bestWeekDone = 0;
  let bestWeekId: string | null = null;
  let totalDone = 0;
  let totalPlanned = 0;
  let perfectWeeks = 0;
  let achievedWeeks = 0;
  let recentActivityDays = 0;
  let currentWeekIndex = 0;

  for (let w = 0; w < totalWeeks; w++) {
    const ws = new Date(startMonday);
    ws.setDate(ws.getDate() + w * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const wsKey = weeklyStreakDateKey(ws);
    const weKey = weeklyStreakDateKey(we);
    const isCurrent = ws.getTime() === currentWeekStart.getTime();
    if (isCurrent) currentWeekIndex = w;

    let activeDays = 0;
    let plannedTotal = 0;
    let doneTotal = 0;
    const days: WeeklyStreakDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(ws);
      day.setDate(day.getDate() + d);
      const key = weeklyStreakDateKey(day);
      const planned = plannedByDate.get(key) ?? 0;
      const doneCount = doneByDate.get(key) ?? 0;
      const hasActivity = planned > 0 || doneCount > 0;
      if (hasActivity) {
        activeDays += 1;
        if (w === totalWeeks - 1 || isCurrent) recentActivityDays += 1;
      }
      plannedTotal += planned;
      doneTotal += doneCount;
      days.push({
        date: key,
        label: dayShortLabels[d],
        done: doneCount,
        planned,
        hasActivity,
        isToday: key === todayKey,
        isPast: day.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
        isFuture: day.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
      });
    }
    const completionRate = plannedTotal > 0 ? doneTotal / plannedTotal : 0;
    const weekId = `${wsKey}_${weKey}`;
    const goalCompleted = Math.min(doneTotal, weeklyGoal);
    const goalAchieved = doneTotal >= weeklyGoal;
    if (goalAchieved) achievedWeeks += 1;
    if (plannedTotal > 0 && doneTotal >= plannedTotal) perfectWeeks += 1;
    if (doneTotal > bestWeekDone) {
      bestWeekDone = doneTotal;
      bestWeekId = weekId;
    }
    totalDone += doneTotal;
    totalPlanned += plannedTotal;
    weeks.push({
      weekId,
      startDate: wsKey,
      endDate: weKey,
      days,
      activeDays,
      plannedTotal,
      doneTotal,
      completionRate,
      goalTarget: weeklyGoal,
      goalCompleted,
      goalAchieved,
      isCurrent,
    });
  }

  const current = weeks[currentWeekIndex];
  return {
    weeks,
    currentWeekIndex,
    currentWeekDone: current.doneTotal,
    currentWeekPlanned: current.plannedTotal,
    currentWeekActiveDays: current.activeDays,
    currentWeekCompletion: current.completionRate,
    bestWeekDone,
    bestWeekId,
    totalDone,
    totalPlanned,
    perfectWeeks,
    achievedWeeks,
    weeklyGoal,
    recentActivityDays,
  };
};

export const getScheduleForWeek = async (startDate: string): Promise<ScheduleEntry[]> => {
  const list = await getSchedule();
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  return list.filter((e) => e.date >= startKey && e.date <= endKey);
};

export const clearScheduleForDate = async (date: string): Promise<ScheduleEntry[]> => {
  const list = await getSchedule();
  const next = list.filter((e) => e.date !== date);
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  return next;
};

export const cloneWeekSchedule = async (fromStart: string, toStart: string): Promise<ScheduleEntry[]> => {
  const list = await getSchedule();
  const from = new Date(fromStart);
  const to = new Date(toStart);
  const fromKey = from.toISOString().slice(0, 10);
  const toKey = to.toISOString().slice(0, 10);
  const sources = list.filter((e) => {
    const d = new Date(e.date);
    const diff = Math.round((d.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 6;
  });
  const newEntries: ScheduleEntry[] = sources.map((src, i) => {
    const target = new Date(to);
    target.setDate(target.getDate() + i);
    return {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
      text: src.text,
      date: target.toISOString().slice(0, 10),
      niche: src.niche,
      note: src.note,
      done: false,
      createdAt: Date.now(),
    };
  });
  const next = [...newEntries, ...list];
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  return next;
};

export type WeeklyGoalTarget = 3 | 5 | 7;

export const getWeeklyGoal = async (): Promise<WeeklyGoalTarget> => {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_GOAL_KEY);
    const n = raw ? parseInt(raw, 10) : 5;
    if (n === 3 || n === 5 || n === 7) return n;
  } catch {}
  return 5;
};

export const setWeeklyGoal = async (target: WeeklyGoalTarget): Promise<void> => {
  await AsyncStorage.setItem(WEEKLY_GOAL_KEY, String(target));
};

export type WeeklyGoalProgress = {
  weekId: string;
  target: WeeklyGoalTarget;
  completed: number;
  achieved: boolean;
};

export const getCurrentWeekGoalProgress = async (): Promise<WeeklyGoalProgress> => {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const millisInDay = 86400000;
  const dayOfYear = (d.getTime() - onejan.getTime() + ((onejan.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000)) / millisInDay;
  const weekNum = Math.ceil((dayOfYear + onejan.getDay() + 1) / 7);
  const weekId = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  const target = await getWeeklyGoal();
  let progress: WeeklyGoalProgress = { weekId, target, completed: 0, achieved: false };
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_GOAL_PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.weekId === weekId) progress = parsed;
      else progress = { weekId, target, completed: 0, achieved: false };
    }
  } catch {}
  if (progress.target !== target) {
    progress = { weekId, target, completed: 0, achieved: false };
  }
  return progress;
};

export const incrementWeeklyGoalProgress = async (): Promise<WeeklyGoalProgress> => {
  const current = await getCurrentWeekGoalProgress();
  if (current.achieved) return current;
  const next: WeeklyGoalProgress = {
    ...current,
    completed: current.completed + 1,
    achieved: current.completed + 1 >= current.target,
  };
  await AsyncStorage.setItem(WEEKLY_GOAL_PROGRESS_KEY, JSON.stringify(next));
  return next;
};

export const decrementWeeklyGoalProgress = async (): Promise<WeeklyGoalProgress> => {
  const current = await getCurrentWeekGoalProgress();
  if (current.completed <= 0) return current;
  const next: WeeklyGoalProgress = {
    ...current,
    completed: current.completed - 1,
    achieved: false,
  };
  await AsyncStorage.setItem(WEEKLY_GOAL_PROGRESS_KEY, JSON.stringify(next));
  return next;
};

export const clearWeeklyGoalProgress = async (): Promise<void> => {
  await AsyncStorage.removeItem(WEEKLY_GOAL_PROGRESS_KEY);
};

export const getWeeklyGoalStats = async (): Promise<{ achievedWeeks: number; totalWeeks: number }> => {
  const history = await getHistory();
  if (history.length === 0) return { achievedWeeks: 0, totalWeeks: 0 };
  const raw = await AsyncStorage.getItem(WEEKLY_GOAL_PROGRESS_KEY);
  let snapshotAchieved = 0;
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p && p.achieved) snapshotAchieved = 1;
    } catch {}
  }
  return { achievedWeeks: snapshotAchieved, totalWeeks: history.length };
};

export type ExperienceLevel = 'beginner' | 'intermediate' | 'pro';
export type ContentGoal = 'growth' | 'engagement' | 'monetize' | 'community';

export const getStoredNiche = async (): Promise<NicheId | null> => {
  try {
    const v = await AsyncStorage.getItem(NICHE_KEY);
    return v as NicheId | null;
  } catch {
    return null;
  }
};

export const setStoredNiche = async (niche: NicheId): Promise<void> => {
  await AsyncStorage.setItem(NICHE_KEY, niche);
};

export const clearStoredNiche = async (): Promise<void> => {
  await AsyncStorage.removeItem(NICHE_KEY);
};

export const getFavorites = async (): Promise<string[]> => {
  const detailed = await getFavoritesDetailed();
  return detailed.map((f) => f.text);
};

export const isFavorite = async (idea: string): Promise<boolean> => {
  const list = await getFavorites();
  return list.includes(idea);
};

export const toggleFavorite = async (idea: string): Promise<boolean> => {
  const detailed = await getFavoritesDetailed();
  const isFav = detailed.some((f) => f.text === idea);
  const next = isFav
    ? detailed.filter((f) => f.text !== idea)
    : [{ text: idea, addedAt: Date.now() }, ...detailed];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return !isFav;
};

export type FavoriteEntry = {
  text: string;
  addedAt: number;
};

export const getFavoritesDetailed = async (): Promise<FavoriteEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (parsed.length > 0 && typeof parsed[0] === 'string') {
      const migrated: FavoriteEntry[] = (parsed as string[]).map((text) => ({
        text,
        addedAt: Date.now(),
      }));
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return (parsed as FavoriteEntry[]).filter(
      (e): e is FavoriteEntry =>
        e && typeof e === 'object' && typeof e.text === 'string' && typeof e.addedAt === 'number'
    );
  } catch {
    return [];
  }
};

export const removeManyFavorites = async (ideas: string[]): Promise<FavoriteEntry[]> => {
  const detailed = await getFavoritesDetailed();
  const set = new Set(ideas);
  const next = detailed.filter((f) => !set.has(f.text));
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
};

export const clearFavorites = async (): Promise<void> => {
  await AsyncStorage.removeItem(FAVORITES_KEY);
};

export type HistoryEntry = {
  weekId: string;
  niche: NicheId;
  ideas: { day: string; text: string; source: 'pool' | 'ai' }[];
  createdAt: number;
};

export const getHistory = async (): Promise<HistoryEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
};

export const saveWeekToHistory = async (entry: HistoryEntry): Promise<void> => {
  const list = await getHistory();
  const filtered = list.filter((e) => e.weekId !== entry.weekId);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...filtered].slice(0, 20)));
};

export const getHistoryByWeek = async (weekId: string): Promise<HistoryEntry | null> => {
  const list = await getHistory();
  return list.find((e) => e.weekId === weekId) ?? null;
};

export const deleteHistoryEntry = async (weekId: string): Promise<void> => {
  const list = await getHistory();
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list.filter((e) => e.weekId !== weekId)));
};

export const clearHistory = async (): Promise<void> => {
  await AsyncStorage.removeItem(HISTORY_KEY);
};

export type Stats = {
  totalWeeks: number;
  totalIdeas: number;
  totalFavorites: number;
  totalReminders: number;
  lastWeekId: string | null;
};

export const getStats = async (): Promise<Stats> => {
  const history = await getHistory();
  const favorites = await getFavorites();
  const remindersRaw = await AsyncStorage.getItem('@content-coach/reminders');
  const reminders = remindersRaw ? (JSON.parse(remindersRaw) as unknown[]) : [];
  return {
    totalWeeks: history.length,
    totalIdeas: history.reduce((acc, h) => acc + h.ideas.length, 0),
    totalFavorites: favorites.length,
    totalReminders: Array.isArray(reminders) ? reminders.length : 0,
    lastWeekId: history[0]?.weekId ?? null,
  };
};

export const getExperience = async (): Promise<ExperienceLevel | null> => {
  const v = await AsyncStorage.getItem(EXPERIENCE_KEY);
  if (v === 'beginner' || v === 'intermediate' || v === 'pro') return v;
  return null;
};

export const setExperience = async (level: ExperienceLevel): Promise<void> => {
  await AsyncStorage.setItem(EXPERIENCE_KEY, level);
};

export const getGoal = async (): Promise<ContentGoal | null> => {
  const v = await AsyncStorage.getItem(GOAL_KEY);
  if (v === 'growth' || v === 'engagement' || v === 'monetize' || v === 'community') return v;
  return null;
};

export const setGoal = async (g: ContentGoal): Promise<void> => {
  await AsyncStorage.setItem(GOAL_KEY, g);
};

export const getStreak = async (): Promise<{ count: number; lastDate: string | null }> => {
  const countRaw = await AsyncStorage.getItem(STREAK_KEY);
  const lastDate = await AsyncStorage.getItem(STREAK_LAST_KEY);
  return {
    count: countRaw ? parseInt(countRaw, 10) : 0,
    lastDate,
  };
};

const isConsecutiveDay = (prev: string, today: string): boolean => {
  const p = new Date(prev);
  const t = new Date(today);
  const diff = Math.round((t.getTime() - p.getTime()) / (1000 * 60 * 60 * 24));
  return diff === 1;
};

const todayKey = (): string => new Date().toISOString().slice(0, 10);

export const recordStreakActivity = async (): Promise<{ count: number; isNew: boolean; shieldEarned?: boolean; shieldUsed?: boolean }> => {
  const today = todayKey();
  const { count, lastDate } = await getStreak();
  if (lastDate === today) return { count, isNew: false };
  const isConsecutive = lastDate ? isConsecutiveDay(lastDate, today) : false;
  let next: number;
  let shieldUsed = false;
  if (isConsecutive) {
    next = count + 1;
  } else if (lastDate) {
    const shields = await getStreakShields();
    const lastUsedShield = await getLastUsedShieldDate();
    const shieldEligible = shields > 0 && lastUsedShield !== lastDate;
    if (shieldEligible) {
      const used = await useStreakShield();
      shieldUsed = used.ok;
      next = count + 1;
    } else {
      next = 1;
    }
  } else {
    next = 1;
  }
  await AsyncStorage.setItem(STREAK_KEY, String(next));
  await AsyncStorage.setItem(STREAK_LAST_KEY, today);
  const bestRaw = await AsyncStorage.getItem(STREAK_BEST_KEY);
  const best = bestRaw ? parseInt(bestRaw, 10) : 0;
  if (next > best) {
    await AsyncStorage.setItem(STREAK_BEST_KEY, String(next));
  }
  let shieldEarned = false;
  if (next > 0 && next % 7 === 0) {
    await addStreakShield();
    shieldEarned = true;
  }
  return { count: next, isNew: true, shieldEarned, shieldUsed };
};

export const getStreakBest = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(STREAK_BEST_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
};

export const getStreakShields = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(STREAK_SHIELDS_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
};

export const addStreakShield = async (): Promise<number> => {
  const current = await getStreakShields();
  const next = current + 1;
  await AsyncStorage.setItem(STREAK_SHIELDS_KEY, String(next));
  return next;
};

export const useStreakShield = async (): Promise<{ ok: boolean; remaining: number; usedDate: string | null }> => {
  const current = await getStreakShields();
  if (current <= 0) return { ok: false, remaining: 0, usedDate: null };
  const next = current - 1;
  await AsyncStorage.setItem(STREAK_SHIELDS_KEY, String(next));
  const today = new Date().toISOString().slice(0, 10);
  await AsyncStorage.setItem(STREAK_LAST_USED_SHIELD_KEY, today);
  return { ok: true, remaining: next, usedDate: today };
};

export const getLastUsedShieldDate = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STREAK_LAST_USED_SHIELD_KEY);
  } catch {
    return null;
  }
};

export const getAccountCreatedAt = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_CREATED_KEY);
    if (raw) return parseInt(raw, 10);
  } catch {}
  const now = Date.now();
  await AsyncStorage.setItem(ACCOUNT_CREATED_KEY, String(now));
  return now;
};

export type DoneEntry = { text: string; date?: string };

export const getDoneIdeas = async (): Promise<string[]> => {
  const detailed = await getDoneIdeasDetailed();
  return detailed.map((e) => e.text);
};

export const getDoneIdeasDetailed = async (): Promise<DoneEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(DONE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (parsed.length > 0 && typeof parsed[0] === 'string') {
      const migrated: DoneEntry[] = (parsed as string[]).map((text) => ({ text }));
      await AsyncStorage.setItem(DONE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return (parsed as DoneEntry[]).filter(
      (e): e is DoneEntry => e && typeof e === 'object' && typeof e.text === 'string'
    );
  } catch {
    return [];
  }
};

export const toggleDone = async (idea: string): Promise<boolean> => {
  const list = await getDoneIdeasDetailed();
  const isDone = list.some((e) => e.text === idea);
  const next = isDone
    ? list.filter((e) => e.text !== idea)
    : [{ text: idea, date: todayKey() }, ...list];
  await AsyncStorage.setItem(DONE_KEY, JSON.stringify(next));
  return !isDone;
};

export const getTodayDoneCount = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(DONE_DAY_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { day: string; count: number };
    if (parsed.day !== todayKey()) return 0;
    return typeof parsed.count === 'number' ? parsed.count : 0;
  } catch {
    return 0;
  }
};

export const bumpTodayDoneCount = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(DONE_DAY_KEY);
  let parsed: { day: string; count: number } = { day: todayKey(), count: 0 };
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (v && v.day === todayKey() && typeof v.count === 'number') parsed = v;
    } catch {}
  }
  parsed.count += 1;
  parsed.day = todayKey();
  await AsyncStorage.setItem(DONE_DAY_KEY, JSON.stringify(parsed));
  return parsed.count;
};

export const clearDone = async (): Promise<void> => {
  await AsyncStorage.removeItem(DONE_KEY);
  await AsyncStorage.removeItem(DONE_DAY_KEY);
};

export type IdeaStats = {
  totalIdeas: number;
  uniqueIdeas: number;
  topDay: string | null;
  topDayCount: number;
  mostFrequentIdea: { text: string; count: number } | null;
  mostFrequentDayLabel: string | null;
  nicheBreakdown: Record<string, number>;
  topNiche: string | null;
  topNicheCount: number;
  topNicheLabel: string | null;
};

const DAY_LABELS_TR: Record<string, string> = {
  monday: 'Pzt',
  tuesday: 'Sal',
  wednesday: 'Çar',
  thursday: 'Per',
  friday: 'Cum',
  saturday: 'Cmt',
  sunday: 'Paz',
};

export const getIdeaStats = async (): Promise<IdeaStats> => {
  const history = await getHistory();
  const dayCounts: Record<string, number> = {};
  const ideaCounts: Record<string, number> = {};
  const nicheCounts: Record<string, number> = {};
  let total = 0;
  for (const h of history) {
    nicheCounts[h.niche] = (nicheCounts[h.niche] ?? 0) + h.ideas.length;
    for (const idea of h.ideas) {
      total += 1;
      dayCounts[idea.day] = (dayCounts[idea.day] ?? 0) + 1;
      ideaCounts[idea.text] = (ideaCounts[idea.text] ?? 0) + 1;
    }
  }
  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  const topDay = sortedDays[0]?.[0] ?? null;
  const topDayCount = sortedDays[0]?.[1] ?? 0;
  const sortedIdeas = Object.entries(ideaCounts).sort((a, b) => b[1] - a[1]);
  const topIdeaEntry = sortedIdeas[0];
  const sortedNiches = Object.entries(nicheCounts).sort((a, b) => b[1] - a[1]);
  const topNiche = sortedNiches[0]?.[0] ?? null;
  const topNicheCount = sortedNiches[0]?.[1] ?? 0;
  return {
    totalIdeas: total,
    uniqueIdeas: Object.keys(ideaCounts).length,
    topDay,
    topDayCount,
    mostFrequentIdea: topIdeaEntry ? { text: topIdeaEntry[0], count: topIdeaEntry[1] } : null,
    mostFrequentDayLabel: topDay ? (DAY_LABELS_TR[topDay] ?? topDay) : null,
    nicheBreakdown: nicheCounts,
    topNiche,
    topNicheCount,
    topNicheLabel: topNiche ? NICHE_LABELS_TR[topNiche] ?? topNiche : null,
  };
};

export type WeeklyTrendPoint = { weekId: string; count: number };

export const getWeeklyTrend = async (weeks: number = 8): Promise<WeeklyTrendPoint[]> => {
  const history = await getHistory();
  const map = new Map<string, number>();
  for (const h of history) {
    map.set(h.weekId, (map.get(h.weekId) ?? 0) + h.ideas.length);
  }
  const all = Array.from(map.entries())
    .map(([weekId, count]) => ({ weekId, count }))
    .sort((a, b) => (a.weekId < b.weekId ? 1 : -1));
  return all.slice(0, weeks);
};

export type DailyDonePoint = { date: string; count: number; weekday: number };

export const getDailyDoneTrend = async (days: number = 7): Promise<DailyDonePoint[]> => {
  const detailed = await getDoneIdeasDetailed();
  const counts = new Map<string, number>();
  for (const e of detailed) {
    const d = e.date;
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const out: DailyDonePoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({
      date: key,
      count: counts.get(key) ?? 0,
      weekday: (d.getDay() + 6) % 7,
    });
  }
  return out;
};

export type ProductionPace = {
  ideasPerDay: number;
  donePerDay: number;
  daysActive: number;
};

export const getProductionPace = async (): Promise<ProductionPace> => {
  const [history, done] = await Promise.all([getHistory(), getDoneIdeasDetailed()]);
  if (history.length === 0) return { ideasPerDay: 0, donePerDay: 0, daysActive: 0 };
  const totalIdeas = history.reduce((acc, h) => acc + h.ideas.length, 0);
  const createdAts = history.map((h) => h.createdAt);
  const oldest = Math.min(...createdAts);
  const daysActive = Math.max(1, Math.ceil((Date.now() - oldest) / (1000 * 60 * 60 * 24)));
  return {
    ideasPerDay: Math.round((totalIdeas / daysActive) * 10) / 10,
    donePerDay: Math.round((done.length / daysActive) * 10) / 10,
    daysActive,
  };
};

export type ConsistencyScore = {
  score: number;
  weeksActive: number;
  totalWeeks: number;
};

export const getConsistencyScore = async (weeks: number = 4): Promise<ConsistencyScore> => {
  const history = await getHistory();
  if (history.length === 0) return { score: 0, weeksActive: 0, totalWeeks: weeks };
  const weekIds = new Set(history.map((h) => h.weekId));
  return {
    score: Math.round((weekIds.size / weeks) * 100),
    weeksActive: weekIds.size,
    totalWeeks: weeks,
  };
};

const NICHE_LABELS_TR: Record<string, string> = {
  fitness: 'Fitness',
  tech: 'Teknoloji',
  food: 'Yemek',
  travel: 'Seyahat',
  fashion: 'Moda',
  finance: 'Finans',
  education: 'Eğitim',
  gaming: 'Oyun',
  beauty: 'Güzellik',
  lifestyle: 'Yaşam',
  business: 'İş Dünyası',
  parenting: 'Ebeveynlik',
  art: 'Sanat',
  music: 'Müzik',
  sports: 'Spor',
  diy: 'DIY',
  photography: 'Fotoğrafçılık',
  pets: 'Evcil Hayvan',
  health: 'Sağlık',
  motivation: 'Motivasyon',
};

export type CopyEntry = {
  text: string;
  copiedAt: number;
  source: 'pool' | 'ai' | 'detail';
};

const COPIES_LIMIT = 20;

export const getRecentCopies = async (): Promise<CopyEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(COPIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is CopyEntry =>
        e && typeof e === 'object' && typeof e.text === 'string' && typeof e.copiedAt === 'number'
    );
  } catch {
    return [];
  }
};

export const addCopyToHistory = async (
  text: string,
  source: CopyEntry['source'] = 'pool'
): Promise<CopyEntry[]> => {
  const list = await getRecentCopies();
  const next: CopyEntry[] = [{ text, copiedAt: Date.now(), source }, ...list].slice(0, COPIES_LIMIT);
  await AsyncStorage.setItem(COPIES_KEY, JSON.stringify(next));
  return next;
};

export const clearCopyHistory = async (): Promise<void> => {
  await AsyncStorage.removeItem(COPIES_KEY);
};

export type QACategory = 'titles' | 'ideas' | 'hashtag' | 'caption' | 'analytics' | 'other';

export type FavoritePrompt = {
  id: string;
  text: string;
  category: QACategory;
  addedAt: number;
};

export type RecentQuestion = {
  text: string;
  askedAt: number;
};

const RECENT_LIMIT = 10;

export const getFavoritePrompts = async (): Promise<FavoritePrompt[]> => {
  try {
    const raw = await AsyncStorage.getItem(FAV_PROMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as FavoritePrompt[]).filter(
      (p): p is FavoritePrompt =>
        p && typeof p === 'object' && typeof p.text === 'string' && typeof p.category === 'string'
    );
  } catch {
    return [];
  }
};

export const addFavoritePrompt = async (text: string, category: QACategory = 'other'): Promise<FavoritePrompt[]> => {
  const list = await getFavoritePrompts();
  if (list.some((p) => p.text === text)) return list;
  const entry: FavoritePrompt = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    category,
    addedAt: Date.now(),
  };
  const next = [entry, ...list];
  await AsyncStorage.setItem(FAV_PROMPTS_KEY, JSON.stringify(next));
  return next;
};

export const removeFavoritePrompt = async (id: string): Promise<FavoritePrompt[]> => {
  const list = await getFavoritePrompts();
  const next = list.filter((p) => p.id !== id);
  await AsyncStorage.setItem(FAV_PROMPTS_KEY, JSON.stringify(next));
  return next;
};

export const isFavoritePrompt = async (text: string): Promise<boolean> => {
  const list = await getFavoritePrompts();
  return list.some((p) => p.text === text);
};

export type CommentCategory = 'fire' | 'love' | 'question' | 'tip' | 'shoutout' | 'custom';

export type CommentTemplate = {
  id: string;
  text: string;
  category: CommentCategory;
  createdAt: number;
};

export const DEFAULT_COMMENT_TEMPLATES: CommentTemplate[] = [
  { id: 'tpl-default-1', text: '🔥 Harika içerik! Ellerine sağlık 👏', category: 'fire', createdAt: 0 },
  { id: 'tpl-default-2', text: '❤️ Tam bana göre, çok beğendim!', category: 'love', createdAt: 0 },
  { id: 'tpl-default-3', text: '❓ Bunu nasıl yapıyorsun? Paylaşır mısın?', category: 'question', createdAt: 0 },
  { id: 'tpl-default-4', text: '💡 Çok faydalı bir ipucu, kaydettim!', category: 'tip', createdAt: 0 },
  { id: 'tpl-default-5', text: '📢 Takip eden herkese selamlar! 🚀', category: 'shoutout', createdAt: 0 },
];

export const getCommentTemplates = async (): Promise<CommentTemplate[]> => {
  try {
    const raw = await AsyncStorage.getItem(COMMENT_TPL_KEY);
    if (!raw) return DEFAULT_COMMENT_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_COMMENT_TEMPLATES;
    const list = (parsed as CommentTemplate[]).filter(
      (t): t is CommentTemplate =>
        t &&
        typeof t === 'object' &&
        typeof t.id === 'string' &&
        typeof t.text === 'string' &&
        typeof t.category === 'string' &&
        typeof t.createdAt === 'number'
    );
    return list.length > 0 ? list : DEFAULT_COMMENT_TEMPLATES;
  } catch {
    return DEFAULT_COMMENT_TEMPLATES;
  }
};

export const addCommentTemplate = async (
  text: string,
  category: CommentCategory = 'custom'
): Promise<CommentTemplate[]> => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return getCommentTemplates();
  const list = await getCommentTemplates();
  if (list.some((t) => t.text === trimmed)) return list;
  const entry: CommentTemplate = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: trimmed,
    category,
    createdAt: Date.now(),
  };
  const next = [entry, ...list];
  await AsyncStorage.setItem(COMMENT_TPL_KEY, JSON.stringify(next));
  return next;
};

export const removeCommentTemplate = async (id: string): Promise<CommentTemplate[]> => {
  const list = await getCommentTemplates();
  const next = list.filter((t) => t.id !== id);
  if (next.length === 0) {
    await AsyncStorage.setItem(COMMENT_TPL_KEY, JSON.stringify(DEFAULT_COMMENT_TEMPLATES));
    return DEFAULT_COMMENT_TEMPLATES;
  }
  await AsyncStorage.setItem(COMMENT_TPL_KEY, JSON.stringify(next));
  return next;
};

export const resetCommentTemplates = async (): Promise<CommentTemplate[]> => {
  await AsyncStorage.setItem(COMMENT_TPL_KEY, JSON.stringify(DEFAULT_COMMENT_TEMPLATES));
  return DEFAULT_COMMENT_TEMPLATES;
};

export type IdeaTagsMap = Record<string, string[]>;

export const getAllIdeaTags = async (): Promise<IdeaTagsMap> => {
  try {
    const raw = await AsyncStorage.getItem(IDEA_TAGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: IdeaTagsMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && Array.isArray(v)) {
        out[k] = v.filter((t): t is string => typeof t === 'string');
      }
    }
    return out;
  } catch {
    return {};
  }
};

export const getIdeaTags = async (idea: string): Promise<string[]> => {
  const all = await getAllIdeaTags();
  return all[idea] ?? [];
};

export const addIdeaTag = async (idea: string, tag: string): Promise<string[]> => {
  const clean = tag.trim().replace(/^#/, '').toLowerCase();
  if (clean.length === 0) return getIdeaTags(idea);
  const all = await getAllIdeaTags();
  const existing = all[idea] ?? [];
  if (existing.includes(clean)) return existing;
  const next = [...existing, clean];
  all[idea] = next;
  await AsyncStorage.setItem(IDEA_TAGS_KEY, JSON.stringify(all));
  return next;
};

export const removeIdeaTag = async (idea: string, tag: string): Promise<string[]> => {
  const all = await getAllIdeaTags();
  const existing = all[idea] ?? [];
  const next = existing.filter((t) => t !== tag);
  if (next.length === 0) {
    delete all[idea];
  } else {
    all[idea] = next;
  }
  await AsyncStorage.setItem(IDEA_TAGS_KEY, JSON.stringify(all));
  return next;
};

export const setIdeaTags = async (idea: string, tags: string[]): Promise<string[]> => {
  const clean = Array.from(new Set(tags.map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean)));
  const all = await getAllIdeaTags();
  if (clean.length === 0) {
    delete all[idea];
  } else {
    all[idea] = clean;
  }
  await AsyncStorage.setItem(IDEA_TAGS_KEY, JSON.stringify(all));
  return clean;
};

export const getAllUniqueTags = async (): Promise<string[]> => {
  const all = await getAllIdeaTags();
  const set = new Set<string>();
  for (const tags of Object.values(all)) for (const t of tags) set.add(t);
  return Array.from(set).sort();
};

export type IdeaCollection = {
  id: string;
  name: string;
  description?: string;
  color: string;
  ideas: string[];
  createdAt: number;
  updatedAt: number;
};

export const COLLECTION_COLORS = ['#7c5cff', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#ef4444', '#14b8a6', '#a855f7'];

export const getCollections = async (): Promise<IdeaCollection[]> => {
  try {
    const raw = await AsyncStorage.getItem(COLLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is IdeaCollection =>
        c &&
        typeof c === 'object' &&
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        typeof c.color === 'string' &&
        Array.isArray(c.ideas) &&
        c.ideas.every((i: unknown): i is string => typeof i === 'string') &&
        typeof c.createdAt === 'number' &&
        typeof c.updatedAt === 'number'
    );
  } catch {
    return [];
  }
};

export const createCollection = async (
  name: string,
  description?: string,
  color?: string
): Promise<IdeaCollection> => {
  const trimmed = name.trim();
  const list = await getCollections();
  const fallbackColor = COLLECTION_COLORS[list.length % COLLECTION_COLORS.length];
  const entry: IdeaCollection = {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    description: description?.trim() || undefined,
    color: color || fallbackColor,
    ideas: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const next = [entry, ...list];
  await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
  return entry;
};

export const updateCollection = async (
  id: string,
  patch: Partial<Pick<IdeaCollection, 'name' | 'description' | 'color'>>
): Promise<IdeaCollection[]> => {
  const list = await getCollections();
  const next = list.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      name: patch.name?.trim() ?? c.name,
      description: patch.description !== undefined ? patch.description.trim() || undefined : c.description,
      color: patch.color ?? c.color,
      updatedAt: Date.now(),
    };
  });
  await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
  return next;
};

export const deleteCollection = async (id: string): Promise<IdeaCollection[]> => {
  const list = await getCollections();
  const next = list.filter((c) => c.id !== id);
  await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
  return next;
};

export const addIdeaToCollection = async (collectionId: string, idea: string): Promise<IdeaCollection[]> => {
  const list = await getCollections();
  let changed = false;
  const next = list.map((c) => {
    if (c.id !== collectionId) return c;
    if (c.ideas.includes(idea)) return c;
    changed = true;
    return { ...c, ideas: [...c.ideas, idea], updatedAt: Date.now() };
  });
  if (changed) await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
  return next;
};

export const removeIdeaFromCollection = async (collectionId: string, idea: string): Promise<IdeaCollection[]> => {
  const list = await getCollections();
  let changed = false;
  const next = list.map((c) => {
    if (c.id !== collectionId) return c;
    if (!c.ideas.includes(idea)) return c;
    changed = true;
    return { ...c, ideas: c.ideas.filter((i) => i !== idea), updatedAt: Date.now() };
  });
  if (changed) await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
  return next;
};

export const getIdeaCollections = async (idea: string): Promise<IdeaCollection[]> => {
  const list = await getCollections();
  return list.filter((c) => c.ideas.includes(idea));
};

export type DailyCardEntry = {
  date: string;
  idea: string;
  niche: NicheId | null;
};

const DAILY_PROMPTS = [
  'Bugün izleyicilerine nasıl ilham verebilirsin?',
  'Paylaşmak için tek bir gerçek hikâye seç.',
  'En son ne zaman tamamen deneyim yaşadın?',
  'Takipçilerinin en çok ihtiyacı olan şey ne?',
  'İçeriğine küçük bir risk eklemeyi dene.',
  'Sana enerji veren bir anı bugün paylaş.',
  'Bir liste mi, bir soru mu, bir ipucu mu?',
];

const hashSeed = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

export type MoodId = 'energetic' | 'calm' | 'creative' | 'tired' | 'reflective' | 'playful';

export type MoodProfile = {
  id: MoodId;
  emoji: string;
  label: string;
  tagline: string;
  color: string;
  bgColor: string;
  keywords: string[];
  avoid?: string[];
};

export const MOODS: MoodProfile[] = [
  {
    id: 'energetic',
    emoji: '⚡️',
    label: 'Enerjik',
    tagline: 'Hızlı, cesur, aksiyon dolu',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    keywords: ['meydan okuma', 'sıcak', 'aksiyon', 'hızlı', 'enerji', 'güç', 'başarı', 'kazanmak', 'patlama', 'vurucu', 'sert', 'cesur', 'patika'],
  },
  {
    id: 'calm',
    emoji: '🌿',
    label: 'Sakin',
    tagline: 'Yumuşak, minimal, huzurlu',
    color: '#10B981',
    bgColor: '#D1FAE5',
    keywords: ['sakinlik', 'nefes', 'huzur', 'sessiz', 'minimal', 'sade', 'yumuşak', 'dingin', 'sükunet', 'yavaş', 'denge', 'meditasyon'],
  },
  {
    id: 'creative',
    emoji: '🎨',
    label: 'Yaratıcı',
    tagline: 'Deneysel, görsel, sıra dışı',
    color: '#7c5cff',
    bgColor: '#EDE9FE',
    keywords: ['renk', 'tasarım', 'görsel', 'estetik', 'deney', 'farklı', 'sıra dışı', 'oyun', 'renkli', 'stil', 'mood board', 'mockup'],
  },
  {
    id: 'tired',
    emoji: '🌙',
    label: 'Yorgun',
    tagline: 'Kısa, kolay, az efor',
    color: '#6366F1',
    bgColor: '#E0E7FF',
    keywords: ['kolay', 'kısa', 'basit', 'hızlı', 'liste', 'tek', 'minimum', 'kısa ipucu', 'hızlı paylaşım', 'micro'],
  },
  {
    id: 'reflective',
    emoji: '📖',
    label: 'Düşünceli',
    tagline: 'Derin, kişisel, samimi',
    color: '#0EA5E9',
    bgColor: '#E0F2FE',
    keywords: ['derin', 'samimi', 'kişisel', 'itiraf', 'öğren', 'ders', 'soru', 'hayat', 'deneyim', 'geçmiş', 'gelecek', 'düşün'],
  },
  {
    id: 'playful',
    emoji: '🎉',
    label: 'Eğlenceli',
    tagline: 'Komik, eğlenceli, hafif',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    keywords: ['mizah', 'komik', 'eğlenceli', 'caps', 'challenge', 'oyun', 'quiz', 'test', 'komedi', 'havalı', 'absürt'],
  },
];

const MOOD_HISTORY_KEY = '@content-coach/mood-history';

export type MoodSessionEntry = {
  id: string;
  mood: MoodId;
  idea: string;
  niche: NicheId | null;
  pickedAt: number;
};

export const getMoodHistory = async (): Promise<MoodSessionEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(MOOD_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is MoodSessionEntry =>
        e &&
        typeof e === 'object' &&
        typeof e.id === 'string' &&
        typeof e.mood === 'string' &&
        typeof e.idea === 'string' &&
        typeof e.pickedAt === 'number'
    );
  } catch {
    return [];
  }
};

export const addMoodHistory = async (entry: MoodSessionEntry): Promise<MoodSessionEntry[]> => {
  const list = await getMoodHistory();
  const next = [entry, ...list.filter((e) => e.idea !== entry.idea)].slice(0, 60);
  await AsyncStorage.setItem(MOOD_HISTORY_KEY, JSON.stringify(next));
  return next;
};

export const clearMoodHistory = async (): Promise<void> => {
  await AsyncStorage.removeItem(MOOD_HISTORY_KEY);
};

export const scoreIdeaForMood = (idea: string, mood: MoodProfile): number => {
  const lower = idea.toLowerCase();
  let score = 0;
  for (const kw of mood.keywords) {
    if (lower.includes(kw.toLowerCase())) score += 2;
  }
  const wordCount = idea.split(/\s+/).length;
  if (mood.id === 'tired' && wordCount <= 8) score += 2;
  if (mood.id === 'energetic' && lower.includes('!')) score += 1;
  if (mood.id === 'reflective' && wordCount >= 12) score += 1;
  if (mood.id === 'calm' && wordCount <= 10) score += 1;
  if (mood.id === 'playful' && (lower.includes('?') || lower.includes('!'))) score += 1;
  return score;
};

export type MoodMatch = {
  idea: string;
  score: number;
  reason: string;
};

export const pickIdeasForMood = (
  niche: NicheId | null,
  mood: MoodProfile,
  count: number = 6,
  exclude: string[] = []
): MoodMatch[] => {
  let pool: string[] = [];
  if (niche) pool = [...getNichePool(niche)];
  if (pool.length === 0) {
    pool = DAILY_PROMPTS.slice();
  }
  if (pool.length === 0) return [];
  const seen = new Set<string>(exclude.map((e) => e.toLowerCase()));
  const scored = pool
    .filter((idea) => !seen.has(idea.toLowerCase()))
    .map((idea) => {
      const score = scoreIdeaForMood(idea, mood);
      const matched = mood.keywords.filter((kw) => idea.toLowerCase().includes(kw.toLowerCase()));
      const reason = matched.length > 0
        ? `Mood'a uyuyor: ${matched.slice(0, 2).join(', ')}`
        : score > 0
        ? 'Tonu ve uzunluğu uyuyor'
        : 'Genel havuzdan seçildi';
      return { idea, score, reason };
    });
  scored.sort((a, b) => b.score - a.score || hashSeed(`${mood.id}|${a.idea}`) - hashSeed(`${mood.id}|${b.idea}`));
  return scored.slice(0, count);
};

const POMO_HISTORY_KEY = '@content-coach/pomo-history';
const POMO_SETTINGS_KEY = '@content-coach/pomo-settings';

export type PomodoroMode = 'focus' | 'break';

export type PomodoroSettings = {
  focusMinutes: number;
  breakMinutes: number;
  dailyGoal: number;
};

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  dailyGoal: 4,
};

export type PomodoroEntry = {
  id: string;
  mode: PomodoroMode;
  durationMinutes: number;
  idea: string | null;
  niche: NicheId | null;
  completedAt: number;
  dateKey: string;
};

export const getPomodoroSettings = async (): Promise<PomodoroSettings> => {
  try {
    const raw = await AsyncStorage.getItem(POMO_SETTINGS_KEY);
    if (!raw) return DEFAULT_POMODORO_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_POMODORO_SETTINGS;
    const focus = Number(parsed.focusMinutes);
    const breakM = Number(parsed.breakMinutes);
    const goal = Number(parsed.dailyGoal);
    return {
      focusMinutes: focus > 0 && focus <= 90 ? focus : DEFAULT_POMODORO_SETTINGS.focusMinutes,
      breakMinutes: breakM > 0 && breakM <= 30 ? breakM : DEFAULT_POMODORO_SETTINGS.breakMinutes,
      dailyGoal: goal > 0 && goal <= 12 ? goal : DEFAULT_POMODORO_SETTINGS.dailyGoal,
    };
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
};

export const savePomodoroSettings = async (s: PomodoroSettings): Promise<void> => {
  await AsyncStorage.setItem(POMO_SETTINGS_KEY, JSON.stringify(s));
};

export const getPomodoroHistory = async (): Promise<PomodoroEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(POMO_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PomodoroEntry =>
        e &&
        typeof e === 'object' &&
        typeof e.id === 'string' &&
        (e.mode === 'focus' || e.mode === 'break') &&
        typeof e.durationMinutes === 'number' &&
        typeof e.completedAt === 'number' &&
        typeof e.dateKey === 'string'
    );
  } catch {
    return [];
  }
};

export const addPomodoroEntry = async (entry: PomodoroEntry): Promise<PomodoroEntry[]> => {
  const list = await getPomodoroHistory();
  const next = [entry, ...list].slice(0, 500);
  await AsyncStorage.setItem(POMO_HISTORY_KEY, JSON.stringify(next));
  return next;
};

export const clearPomodoroHistory = async (): Promise<void> => {
  await AsyncStorage.removeItem(POMO_HISTORY_KEY);
};

export type PomodoroDayStats = {
  dateKey: string;
  focusCount: number;
  totalFocusMinutes: number;
  goal: number;
  goalAchieved: boolean;
};

export type PomodoroStreakStats = {
  totalFocus: number;
  totalFocusMinutes: number;
  totalSessions: number;
  todayFocus: number;
  todayMinutes: number;
  todayGoal: number;
  todayAchieved: boolean;
  currentStreakDays: number;
  bestStreakDays: number;
  dailyHistory: PomodoroDayStats[];
  bestDay: PomodoroDayStats | null;
  ideasFocusedOn: number;
};

const pomoDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const pomoDateKeyFor = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const getPomodoroStats = async (days: number = 14): Promise<PomodoroStreakStats> => {
  const [history, settings] = await Promise.all([getPomodoroHistory(), getPomodoroSettings()]);
  const today = pomoDateKey();
  const focusEntries = history.filter((e) => e.mode === 'focus');

  const byDay = new Map<string, { count: number; minutes: number }>();
  for (const e of focusEntries) {
    const cur = byDay.get(e.dateKey) ?? { count: 0, minutes: 0 };
    cur.count += 1;
    cur.minutes += e.durationMinutes;
    byDay.set(e.dateKey, cur);
  }

  const dailyHistory: PomodoroDayStats[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = pomoDateKeyFor(d);
    const entry = byDay.get(k) ?? { count: 0, minutes: 0 };
    dailyHistory.push({
      dateKey: k,
      focusCount: entry.count,
      totalFocusMinutes: entry.minutes,
      goal: settings.dailyGoal,
      goalAchieved: entry.count >= settings.dailyGoal,
    });
  }

  const todayEntry = byDay.get(today) ?? { count: 0, minutes: 0 };

  let currentStreak = 0;
  const todayIdx = dailyHistory.length - 1;
  if (todayEntry.count >= settings.dailyGoal) {
    currentStreak = 1;
    for (let i = todayIdx - 1; i >= 0; i--) {
      if (dailyHistory[i].goalAchieved) currentStreak += 1;
      else break;
    }
  } else {
    for (let i = todayIdx - 1; i >= 0; i--) {
      if (dailyHistory[i].goalAchieved) currentStreak += 1;
      else break;
    }
  }

  let bestStreak = 0;
  let running = 0;
  for (const d of dailyHistory) {
    if (d.goalAchieved) {
      running += 1;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }

  const bestDay = dailyHistory.reduce<PomodoroDayStats | null>((best, cur) => {
    if (!best || cur.totalFocusMinutes > best.totalFocusMinutes) return cur;
    return best;
  }, null);

  const ideasFocusedOn = new Set(focusEntries.filter((e) => e.idea).map((e) => e.idea)).size;

  return {
    totalFocus: focusEntries.length,
    totalFocusMinutes: focusEntries.reduce((acc, e) => acc + e.durationMinutes, 0),
    totalSessions: history.length,
    todayFocus: todayEntry.count,
    todayMinutes: todayEntry.minutes,
    todayGoal: settings.dailyGoal,
    todayAchieved: todayEntry.count >= settings.dailyGoal,
    currentStreakDays: currentStreak,
    bestStreakDays: bestStreak,
    dailyHistory,
    bestDay,
    ideasFocusedOn,
  };
};

export type HookStyle = 'question' | 'stat' | 'bold' | 'story' | 'list' | 'contrarian';
export type HookFormat = 'reel' | 'carousel' | 'caption' | 'story' | 'thread';

export type HookTemplate = {
  id: string;
  style: HookStyle;
  format: HookFormat;
  pattern: string;
  example: string;
};

export const HOOK_STYLES: { id: HookStyle; label: string; emoji: string; color: string; bg: string; tagline: string }[] = [
  { id: 'question', label: 'Soru', emoji: '❓', color: '#0EA5E9', bg: '#E0F2FE', tagline: 'Merak uyandıran sorular' },
  { id: 'stat', label: 'İstatistik', emoji: '📊', color: '#8B5CF6', bg: '#F3E8FF', tagline: 'Rakamla dikkat çek' },
  { id: 'bold', label: 'Cesur', emoji: '🔥', color: '#EF4444', bg: '#FEE2E2', tagline: 'Net ve kısa' },
  { id: 'story', label: 'Hikaye', emoji: '📖', color: '#10B981', bg: '#D1FAE5', tagline: 'Kişisel anekdot' },
  { id: 'list', label: 'Liste', emoji: '📋', color: '#F59E0B', bg: '#FEF3C7', tagline: 'Numaralı öğeler' },
  { id: 'contrarian', label: 'İtiraz', emoji: '⚡', color: '#EC4899', bg: '#FCE7F3', tagline: 'Sıra dışı bakış açısı' },
];

export const HOOK_FORMATS: { id: HookFormat; label: string; emoji: string; desc: string }[] = [
  { id: 'reel', label: 'Reel', emoji: '🎬', desc: 'Kısa video açılışı' },
  { id: 'carousel', label: 'Carousel', emoji: '📑', desc: 'Çoklu slayt gönderi' },
  { id: 'caption', label: 'Caption', emoji: '💬', desc: 'Tek paragraf açıklama' },
  { id: 'story', label: 'Story', emoji: '📱', desc: '24 saat içerik' },
  { id: 'thread', label: 'Thread', emoji: '🧵', desc: 'Çoklu tweet' },
];

const HOOK_TEMPLATES: HookTemplate[] = [
  { id: 'q1', style: 'question', format: 'reel', pattern: 'Neden [X] hâlâ [Y] yapıyor?', example: 'Neden çoğu insan hâlâ sabah 5\'te kalkamıyor?' },
  { id: 'q2', style: 'question', format: 'caption', pattern: '[X] mi yoksa [Y] mi?', example: 'Kas mı yoksa dayanıklılık mı önce gelir?' },
  { id: 'q3', style: 'question', format: 'thread', pattern: '[X] hakkında en çok sorulan 5 soru', example: 'Beslenme hakkında en çok sorulan 5 soru' },
  { id: 'q4', style: 'question', format: 'story', pattern: 'Sen olsan [X] mi yapardın?', example: 'Sen olsan hangi programı seçerdin?' },
  { id: 'q5', style: 'question', format: 'carousel', pattern: 'Kaç tanesini biliyordun?', example: 'Kaç tanesini daha önce denedin?' },

  { id: 's1', style: 'stat', format: 'reel', pattern: '%[X] kişi [Y] yapıyor, sen?', example: '%73 kişi yanlış teknikle koşuyor, sen?' },
  { id: 's2', style: 'stat', format: 'caption', pattern: 'Sadece [X] dakikada [Y]', example: 'Sadece 12 dakikada tüm vücut' },
  { id: 's3', style: 'stat', format: 'thread', pattern: '[X] istatistiği: [Y]', example: '2026 verisi: %60\'ımız...' },
  { id: 's4', style: 'stat', format: 'story', pattern: 'İstatistik: [X]', example: 'İstatistik: her 3 kişiden 1\'i...' },
  { id: 's5', style: 'stat', format: 'carousel', pattern: '[X] gerçek + [Y]', example: '5 gerçek + 1 efsane' },

  { id: 'b1', style: 'bold', format: 'reel', pattern: '[X]. Nokta.', example: 'Şeker bağımlılık yapar. Nokta.' },
  { id: 'b2', style: 'bold', format: 'caption', pattern: '[X] yeter. Başka [Y].', example: '1 saat yeter. Başka mazeret yok.' },
  { id: 'b3', style: 'bold', format: 'thread', pattern: '[X] hakkında yalan söylediler', example: 'Kardiyo hakkında yalan söylediler' },
  { id: 'b4', style: 'bold', format: 'story', pattern: 'Dur. [X]?', example: 'Dur. Gerçekten hazır mısın?' },
  { id: 'b5', style: 'bold', format: 'carousel', pattern: 'En kötü [X] hatalar', example: 'En kötü 5 başlangıç hatası' },

  { id: 't1', style: 'story', format: 'reel', pattern: 'Geçen [X] başıma geldi...', example: 'Geçen hafta başıma gelen olay...' },
  { id: 't2', style: 'story', format: 'caption', pattern: 'Bir zamanlar [X] yapıyordum', example: 'Bir zamanlar yanlış formda ağır kaldırıyordum' },
  { id: 't3', style: 'story', format: 'thread', pattern: 'Hikayem: [X]', example: 'Hikayem: 0\'dan 100\'e' },
  { id: 't4', style: 'story', format: 'story', pattern: 'Bunu ilk kez [X] gördüm', example: 'Bunu ilk kez denediğimde...' },
  { id: 't5', style: 'story', format: 'carousel', pattern: '3 adımda [X]', example: '3 adımda alışkanlık kurma' },

  { id: 'l1', style: 'list', format: 'reel', pattern: '[X] yol — en iyisi son', example: '5 yol — en iyisi son' },
  { id: 'l2', style: 'list', format: 'caption', pattern: '[X] küçük [Y], büyük [Z]', example: '3 küçük alışkanlık, büyük değişim' },
  { id: 'l3', style: 'list', format: 'thread', pattern: '[X] numara — sırayla', example: '7 numara — sırayla takip et' },
  { id: 'l4', style: 'list', format: 'story', pattern: 'Bugün [X] adım', example: 'Bugün attığın 4 adım' },
  { id: 'l5', style: 'list', format: 'carousel', pattern: '[X] ipucu — sakla', example: '6 ipucu — sakla paylaş' },

  { id: 'c1', style: 'contrarian', format: 'reel', pattern: '[X] aslında [Y] değil', example: 'Yoğun antrenman aslında zarar değil' },
  { id: 'c2', style: 'contrarian', format: 'caption', pattern: '[X]? Tersi.', example: 'Motivation? Tersi: disiplin.' },
  { id: 'c3', style: 'contrarian', format: 'thread', pattern: '[X] hakkında herkes yanılıyor', example: 'Protein tozu hakkında herkes yanılıyor' },
  { id: 'c4', style: 'contrarian', format: 'story', pattern: '[X] yapma — [Y] yap', example: 'Hata yapma — farklı düşün' },
  { id: 'c5', style: 'contrarian', format: 'carousel', pattern: '[X] mitleri yık', example: '7 diyet mitini yık' },
];

const HOOK_FAVORITES_KEY = '@content-coach/hook-favorites';

export type HookFavorite = {
  id: string;
  text: string;
  style: HookStyle;
  format: HookFormat;
  pattern: string;
  niche: NicheId | null;
  savedAt: number;
};

export const getHookFavorites = async (): Promise<HookFavorite[]> => {
  try {
    const raw = await AsyncStorage.getItem(HOOK_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as HookFavorite[]).filter(
      (h): h is HookFavorite =>
        h &&
        typeof h === 'object' &&
        typeof h.id === 'string' &&
        typeof h.text === 'string' &&
        typeof h.style === 'string' &&
        typeof h.format === 'string' &&
        typeof h.pattern === 'string' &&
        typeof h.savedAt === 'number'
    );
  } catch {
    return [];
  }
};

export const addHookFavorite = async (fav: HookFavorite): Promise<HookFavorite[]> => {
  const list = await getHookFavorites();
  if (list.some((h) => h.text === fav.text && h.style === fav.style && h.format === fav.format)) {
    return list;
  }
  const next = [fav, ...list].slice(0, 200);
  await AsyncStorage.setItem(HOOK_FAVORITES_KEY, JSON.stringify(next));
  return next;
};

export const removeHookFavorite = async (id: string): Promise<HookFavorite[]> => {
  const list = await getHookFavorites();
  const next = list.filter((h) => h.id !== id);
  await AsyncStorage.setItem(HOOK_FAVORITES_KEY, JSON.stringify(next));
  return next;
};

export const isHookFavorited = async (text: string, style: HookStyle, format: HookFormat): Promise<boolean> => {
  const list = await getHookFavorites();
  return list.some((h) => h.text === text && h.style === style && h.format === format);
};

const NICHE_FILLERS: Record<string, string[]> = {
  fitness: ['form', 'set', 'tekrar', 'kardiyo', 'ağırlık', 'kas', 'protein', 'yağ yakma', 'hareket', 'esneme'],
  food: ['tarif', 'malzeme', 'pişirme', 'sos', 'lezzet', 'sağlıklı', 'hızlı', 'pratik', 'mevsimlik', 'taze'],
  tech: ['uygulama', 'özellik', 'ayarlar', 'güncelleme', 'ipucu', 'tutorial', 'kod', 'verim', 'kısayol', 'entegrasyon'],
  fashion: ['kombin', 'parça', 'stil', 'renk', 'aksesuar', 'sezon', 'klasik', 'rahat', 'şık', 'basic'],
  travel: ['rota', 'gezi', 'valiz', 'konaklama', 'lezzet durak', 'manzara', 'gece hayatı', 'bütçe', 'yerel', 'gizli köşe'],
  gaming: ['meta', 'build', 'rotasyon', 'harita', 'karakter', 'patch', 'turnuva', 'xp', 'grind', 'co-op'],
  personal_dev: ['alışkanlık', 'odak', 'rutin', 'motivasyon', 'kitap', 'not', 'plan', 'sabah ritüeli', 'gece rutini', 'hedef'],
  beauty: ['rutin', 'cilt', 'bakım', 'makyaj', 'fondöten', 'maske', 'nemlendirici', 'göz', 'dudak', 'doğal görünüm'],
};

const pickFiller = (niche: NicheId | null, seed: number): string => {
  if (!niche) return 'içerik';
  const fillers = NICHE_FILLERS[niche] ?? NICHE_FILLERS.personal_dev;
  return fillers[seed % fillers.length];
};

export type GeneratedHook = {
  text: string;
  style: HookStyle;
  format: HookFormat;
  pattern: string;
  templateId: string;
};

export const generateHookFromTemplate = (
  template: HookTemplate,
  niche: NicheId | null,
  seedOffset: number
): GeneratedHook => {
  const a = pickFiller(niche, seedOffset);
  const b = pickFiller(niche, seedOffset + 1);
  const c = pickFiller(niche, seedOffset + 2);
  const replacements: Record<string, string> = {
    '[X]': a,
    '[Y]': b,
    '[Z]': c,
  };
  let text = template.pattern;
  for (const key of Object.keys(replacements)) {
    text = text.split(key).join(replacements[key]);
  }
  return {
    text,
    style: template.style,
    format: template.format,
    pattern: template.pattern,
    templateId: template.id,
  };
};

export const generateHooks = (
  niche: NicheId | null,
  style: HookStyle | 'all',
  format: HookFormat | 'all',
  count: number = 30
): GeneratedHook[] => {
  let pool = HOOK_TEMPLATES;
  if (style !== 'all') pool = pool.filter((t) => t.style === style);
  if (format !== 'all') pool = pool.filter((t) => t.format === format);
  if (pool.length === 0) pool = HOOK_TEMPLATES;

  const seedBase = Date.now() % 9973;
  const generated: GeneratedHook[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count * 3 && generated.length < count; i += 1) {
    const t = pool[(seedBase + i * 7) % pool.length];
    const hook = generateHookFromTemplate(t, niche, seedBase + i);
    if (!seen.has(hook.text)) {
      seen.add(hook.text);
      generated.push(hook);
    }
  }
  return generated;
};

export const buildDailyCard = (niche: NicheId | null, date: string = todayKey()): DailyCardEntry => {
  if (niche) {
    const pool = getNichePool(niche);
    if (pool.length > 0) {
      const idx = hashSeed(`${date}|${niche}`) % pool.length;
      return { date, idea: pool[idx], niche };
    }
  }
  const idx = hashSeed(date) % DAILY_PROMPTS.length;
  return { date, idea: DAILY_PROMPTS[idx], niche: null };
};

export const getDailyCard = async (niche: NicheId | null): Promise<DailyCardEntry> => {
  const today = todayKey();
  try {
    const raw = await AsyncStorage.getItem(DAILY_CARD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === today && typeof parsed.idea === 'string') {
        return {
          date: today,
          idea: parsed.idea,
          niche: typeof parsed.niche === 'string' ? (parsed.niche as NicheId) : null,
        };
      }
    }
  } catch {}
  const card = buildDailyCard(niche, today);
  await AsyncStorage.setItem(DAILY_CARD_KEY, JSON.stringify(card));
  return card;
};

export const rerollDailyCard = async (niche: NicheId | null): Promise<DailyCardEntry> => {
  const today = todayKey();
  let next: DailyCardEntry;
  let attempts = 0;
  const current = await getDailyCard(niche);
  do {
    next = buildDailyCard(niche, today);
    attempts += 1;
  } while (next.idea === current.idea && attempts < 5);
  await AsyncStorage.setItem(DAILY_CARD_KEY, JSON.stringify(next));
  return next;
};

export const getDailyCardFlips = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(DAILY_CARD_FLIPS_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
};

export const bumpDailyCardFlip = async (): Promise<number> => {
  const cur = await getDailyCardFlips();
  const next = cur + 1;
  await AsyncStorage.setItem(DAILY_CARD_FLIPS_KEY, String(next));
  return next;
};

export const getRecentQuestions = async (): Promise<RecentQuestion[]> => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_QUESTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecentQuestion[]).filter(
      (q): q is RecentQuestion =>
        q && typeof q === 'object' && typeof q.text === 'string' && typeof q.askedAt === 'number'
    );
  } catch {
    return [];
  }
};

export const addRecentQuestion = async (text: string): Promise<RecentQuestion[]> => {
  const list = await getRecentQuestions();
  const filtered = list.filter((q) => q.text !== text);
  const next: RecentQuestion[] = [{ text, askedAt: Date.now() }, ...filtered].slice(0, RECENT_LIMIT);
  await AsyncStorage.setItem(RECENT_QUESTIONS_KEY, JSON.stringify(next));
  return next;
};

export const clearRecentQuestions = async (): Promise<void> => {
  await AsyncStorage.removeItem(RECENT_QUESTIONS_KEY);
};

export type BackupBundle = {
  version: 1;
  exportedAt: number;
  niche: NicheId | null;
  experience: ExperienceLevel | null;
  goal: ContentGoal | null;
  favorites: string[];
  history: HistoryEntry[];
  done: string[];
  doneToday: { day: string; count: number } | null;
  streak: { count: number; lastDate: string | null };
  copies: CopyEntry[];
  weeklyGoal?: WeeklyGoalTarget;
  weeklyGoalProgress?: WeeklyGoalProgress | null;
  schedule?: ScheduleEntry[];
  commentTemplates?: CommentTemplate[];
  ideaTags?: IdeaTagsMap;
  streakShields?: number;
  lastUsedShieldDate?: string | null;
  collections?: IdeaCollection[];
};

export const importAllData = async (bundle: BackupBundle): Promise<{ ok: boolean; error?: string }> => {
  if (!bundle || bundle.version !== 1) {
    return { ok: false, error: 'Geçersiz yedekleme dosyası' };
  }
  try {
    const ops: Promise<void>[] = [];
    if (bundle.niche) ops.push(setStoredNiche(bundle.niche));
    if (bundle.experience) ops.push(setExperience(bundle.experience));
    if (bundle.goal) ops.push(setGoal(bundle.goal));
    if (Array.isArray(bundle.favorites)) {
      ops.push(AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(bundle.favorites)));
    }
    if (Array.isArray(bundle.history)) {
      ops.push(AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(bundle.history)));
    }
    if (Array.isArray(bundle.done)) {
      ops.push(AsyncStorage.setItem(DONE_KEY, JSON.stringify(bundle.done)));
    }
    if (bundle.streak) {
      ops.push(AsyncStorage.setItem(STREAK_KEY, String(bundle.streak.count)));
      if (bundle.streak.lastDate) ops.push(AsyncStorage.setItem(STREAK_LAST_KEY, bundle.streak.lastDate));
    }
    if (bundle.doneToday) {
      ops.push(AsyncStorage.setItem(DONE_DAY_KEY, JSON.stringify(bundle.doneToday)));
    }
    if (Array.isArray(bundle.copies)) {
      ops.push(AsyncStorage.setItem(COPIES_KEY, JSON.stringify(bundle.copies)));
    }
    if (bundle.weeklyGoal && (bundle.weeklyGoal === 3 || bundle.weeklyGoal === 5 || bundle.weeklyGoal === 7)) {
      ops.push(setWeeklyGoal(bundle.weeklyGoal));
    }
    if (bundle.weeklyGoalProgress) {
      ops.push(AsyncStorage.setItem(WEEKLY_GOAL_PROGRESS_KEY, JSON.stringify(bundle.weeklyGoalProgress)));
    }
    if (Array.isArray(bundle.schedule)) {
      ops.push(AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(bundle.schedule)));
    }
    if (Array.isArray(bundle.commentTemplates)) {
      ops.push(AsyncStorage.setItem(COMMENT_TPL_KEY, JSON.stringify(bundle.commentTemplates)));
    }
    if (bundle.ideaTags && typeof bundle.ideaTags === 'object') {
      ops.push(AsyncStorage.setItem(IDEA_TAGS_KEY, JSON.stringify(bundle.ideaTags)));
    }
    if (typeof bundle.streakShields === 'number') {
      ops.push(AsyncStorage.setItem(STREAK_SHIELDS_KEY, String(bundle.streakShields)));
    }
    if (typeof bundle.lastUsedShieldDate === 'string') {
      ops.push(AsyncStorage.setItem(STREAK_LAST_USED_SHIELD_KEY, bundle.lastUsedShieldDate));
    }
    if (Array.isArray(bundle.collections)) {
      ops.push(AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(bundle.collections)));
    }
    await Promise.all(ops);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
};

export const exportAllData = async (): Promise<BackupBundle> => {
  const [niche, experience, goal, favorites, history, done, streak, doneTodayRaw, copies, weeklyGoal, weeklyGoalProgress, schedule, commentTemplates, ideaTags, streakShields, lastUsedShieldDate, collections] = await Promise.all([
    getStoredNiche(),
    getExperience(),
    getGoal(),
    getFavorites(),
    getHistory(),
    getDoneIdeas(),
    getStreak(),
    AsyncStorage.getItem(DONE_DAY_KEY),
    getRecentCopies(),
    getWeeklyGoal(),
    AsyncStorage.getItem(WEEKLY_GOAL_PROGRESS_KEY),
    getSchedule(),
    getCommentTemplates(),
    getAllIdeaTags(),
    getStreakShields(),
    getLastUsedShieldDate(),
    getCollections(),
  ]);
  let parsedProgress: WeeklyGoalProgress | null = null;
  if (weeklyGoalProgress) {
    try {
      const p = JSON.parse(weeklyGoalProgress);
      if (p && p.weekId && p.target) parsedProgress = p;
    } catch {}
  }
  let doneToday: BackupBundle['doneToday'] = null;
  if (doneTodayRaw) {
    try {
      const parsed = JSON.parse(doneTodayRaw);
      if (parsed && typeof parsed.day === 'string' && typeof parsed.count === 'number') {
        doneToday = parsed;
      }
    } catch {}
  }
  return {
    version: 1,
    exportedAt: Date.now(),
    niche,
    experience,
    goal,
    favorites,
    history,
    done,
    doneToday,
    streak,
    copies,
    weeklyGoal,
    weeklyGoalProgress: parsedProgress,
    schedule,
    commentTemplates,
    ideaTags,
    streakShields,
    lastUsedShieldDate,
    collections,
  };
};

// ---------- Round 55: Content Calendar / Optimal Posting Slots ----------

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type PostingSlot = 'morning' | 'midday' | 'evening' | 'night';

export const POSTING_SLOTS: { id: PostingSlot; label: string; emoji: string; hourRange: string; color: string; bg: string }[] = [
  { id: 'morning', label: 'Sabah', emoji: '🌅', hourRange: '07:00 – 10:00', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'midday', label: 'Öğlen', emoji: '☀️', hourRange: '12:00 – 14:00', color: '#EF4444', bg: '#FEE2E2' },
  { id: 'evening', label: 'Akşam', emoji: '🌆', hourRange: '18:00 – 21:00', color: '#8B5CF6', bg: '#F3E8FF' },
  { id: 'night', label: 'Gece', emoji: '🌙', hourRange: '22:00 – 00:00', color: '#0EA5E9', bg: '#E0F2FE' },
];

export const POSTING_DAYS: { id: DayKey; label: string; short: string }[] = [
  { id: 'mon', label: 'Pazartesi', short: 'Pzt' },
  { id: 'tue', label: 'Salı', short: 'Sal' },
  { id: 'wed', label: 'Çarşamba', short: 'Çar' },
  { id: 'thu', label: 'Perşembe', short: 'Per' },
  { id: 'fri', label: 'Cuma', short: 'Cum' },
  { id: 'sat', label: 'Cumartesi', short: 'Cmt' },
  { id: 'sun', label: 'Pazar', short: 'Paz' },
];

// Her niche için 7 gün × 4 slot için engagement skoru (0-100).
// Spesifik gerekçelerle birlikte.
type SlotScore = { score: number; reason: string };
type DayScores = Record<PostingSlot, SlotScore>;
type NicheScores = Record<DayKey, DayScores>;

const SCORES: Record<string, NicheScores> = {
  fitness: {
    mon: {
      morning: { score: 92, reason: 'Hafta başı motivasyonu + spor salonu yoğunluğu' },
      midday: { score: 64, reason: 'Molada kısa içerik tüketimi' },
      evening: { score: 88, reason: 'Spor sonrası rutin paylaşımı' },
      night: { score: 42, reason: 'Gece az, hazırlık içerikleri' },
    },
    tue: {
      morning: { score: 88, reason: 'Sabah rutini ipuçları' },
      midday: { score: 60, reason: 'Ofis molası tüketimi' },
      evening: { score: 84, reason: 'Spor sonrası içerik' },
      night: { score: 38, reason: 'Düşük etkileşim' },
    },
    wed: {
      morning: { score: 86, reason: 'Orta hafta enerji seviyesi' },
      midday: { score: 70, reason: 'Hızlı tarif/tüyo paylaşımı' },
      evening: { score: 90, reason: 'Peak spor salonu saati' },
      night: { score: 40, reason: 'Uyku öncesi düşük' },
    },
    thu: {
      morning: { score: 84, reason: 'Hafta sonu öncesi planlama' },
      midday: { score: 66, reason: 'Ofis arası' },
      evening: { score: 86, reason: 'Sosyal spor aktivitesi' },
      night: { score: 45, reason: 'Egzersiz playlist dinleme' },
    },
    fri: {
      morning: { score: 78, reason: 'Hafta sonu planı paylaşımı' },
      midday: { score: 72, reason: 'İlham veren kısa içerik' },
      evening: { score: 82, reason: 'Sosyal/eğlence içerikleri' },
      night: { score: 50, reason: 'Cuma gecesi aktif' },
    },
    sat: {
      morning: { score: 80, reason: 'Hafta sonu sabah rutini' },
      midday: { score: 76, reason: 'Açık hava sporu ideal' },
      evening: { score: 70, reason: 'Sosyal medyada düşüş' },
      night: { score: 48, reason: 'Gece kulübü/etkinlik' },
    },
    sun: {
      morning: { score: 82, reason: 'Hafta öncesi motivasyon' },
      midday: { score: 74, reason: 'Brunch + paylaşım' },
      evening: { score: 68, reason: 'Yarına hazırlık' },
      night: { score: 44, reason: 'Huzurlu içerikler' },
    },
  },
  food: {
    mon: {
      morning: { score: 74, reason: 'Kahvaltı ipuçları' },
      midday: { score: 88, reason: 'Öğle yemeği kararı anı' },
      evening: { score: 80, reason: 'Akşam yemeği planlama' },
      night: { score: 50, reason: 'Gece atıştırmalık' },
    },
    tue: {
      morning: { score: 70, reason: 'Hızlı kahvaltı tarifleri' },
      midday: { score: 90, reason: 'Ofis öğle yemeği' },
      evening: { score: 84, reason: 'Aile sofrası' },
      night: { score: 48, reason: 'Atıştırmalık saatleri' },
    },
    wed: {
      morning: { score: 72, reason: 'Sağlıklı başlangıç' },
      midday: { score: 92, reason: 'En yoğun öğle trafiği' },
      evening: { score: 86, reason: 'Yemek pişirme paylaşımı' },
      night: { score: 52, reason: 'Tarif keşfi' },
    },
    thu: {
      morning: { score: 68, reason: 'Kahvaltı trendi' },
      midday: { score: 86, reason: 'Hızlı tarif videosu' },
      evening: { score: 82, reason: 'Akşam yemeği içerikleri' },
      night: { score: 46, reason: 'Gece tarif' },
    },
    fri: {
      morning: { score: 64, reason: 'Brunch kültürü' },
      midday: { score: 80, reason: 'Dışarıda yemek' },
      evening: { score: 88, reason: 'Sosyal yemek keyfi' },
      night: { score: 58, reason: 'Gece yemeği çekimi' },
    },
    sat: {
      morning: { score: 78, reason: 'Brunch pazarı' },
      midday: { score: 94, reason: 'HAFTA PEAK – brunch/öğle' },
      evening: { score: 86, reason: 'Aile/arkadaş yemeği' },
      night: { score: 60, reason: 'Gece atıştırmalık' },
    },
    sun: {
      morning: { score: 80, reason: 'Pazar kahvaltısı' },
      midday: { score: 90, reason: 'Aile yemeği' },
      evening: { score: 84, reason: 'Hafta öncesi planlama' },
      night: { score: 54, reason: 'Saklanmış tarif' },
    },
  },
  tech: {
    mon: {
      morning: { score: 84, reason: 'Kahve + tech haberleri' },
      midday: { score: 70, reason: 'Molada kısa okuma' },
      evening: { score: 78, reason: 'Uzun içerik tüketimi' },
      night: { score: 72, reason: 'Detaylı inceleme' },
    },
    tue: {
      morning: { score: 80, reason: 'Endüstri haberleri' },
      midday: { score: 72, reason: 'Hızlı ipucu' },
      evening: { score: 82, reason: 'Tutorial videosu' },
      night: { score: 76, reason: 'Podcast/sesli içerik' },
    },
    wed: {
      morning: { score: 82, reason: 'Yeni çıkış duyuruları' },
      midday: { score: 76, reason: 'Karşılaştırma yazıları' },
      evening: { score: 88, reason: 'İnceleme videoları peak' },
      night: { score: 80, reason: 'Topluluk tartışması' },
    },
    thu: {
      morning: { score: 78, reason: 'Newsletter özeti' },
      midday: { score: 74, reason: 'Mini haber paylaşımı' },
      evening: { score: 86, reason: 'Derin dalış içerikleri' },
      night: { score: 78, reason: 'Teknik analiz' },
    },
    fri: {
      morning: { score: 76, reason: 'Hafta sonu projesi' },
      midday: { score: 80, reason: 'Hafif içerik + liste' },
      evening: { score: 72, reason: 'Eğlence/hafif içerik' },
      night: { score: 84, reason: 'Gece kodlama yayını' },
    },
    sat: {
      morning: { score: 70, reason: 'Tech haberleri' },
      midday: { score: 76, reason: 'Yan proje paylaşımı' },
      evening: { score: 74, reason: 'Hobi içerikleri' },
      night: { score: 82, reason: 'Açık kaynak katkısı' },
    },
    sun: {
      morning: { score: 72, reason: 'Hafta değerlendirmesi' },
      midday: { score: 78, reason: 'Öğrenme kaynağı' },
      evening: { score: 70, reason: 'Hafif okuma' },
      night: { score: 68, reason: 'Podcast' },
    },
  },
  fashion: {
    mon: {
      morning: { score: 76, reason: 'Ofis kombin ipuçları' },
      midday: { score: 70, reason: 'Hızlı stil paylaşımı' },
      evening: { score: 88, reason: '"Bugün ne giydim" peak' },
      night: { score: 60, reason: 'Trend haberleri' },
    },
    tue: {
      morning: { score: 74, reason: 'Basic kombinler' },
      midday: { score: 68, reason: 'Aksesuar odağı' },
      evening: { score: 86, reason: 'Lookbook paylaşımı' },
      night: { score: 58, reason: 'Stil listesi' },
    },
    wed: {
      morning: { score: 72, reason: 'Hafta ortası ilham' },
      midday: { score: 74, reason: 'Mini kombin ipucu' },
      evening: { score: 90, reason: 'Street style peak' },
      night: { score: 62, reason: 'Moda haberleri' },
    },
    thu: {
      morning: { score: 70, reason: 'Ofis stili' },
      midday: { score: 72, reason: 'Lookbook detayı' },
      evening: { score: 88, reason: 'Sosyal etkinlik' },
      night: { score: 64, reason: 'Yeni koleksiyon' },
    },
    fri: {
      morning: { score: 78, reason: 'Cuma kombinleri' },
      midday: { score: 80, reason: 'Hafta sonu stil' },
      evening: { score: 92, reason: 'Gece çıkışı stili peak' },
      night: { score: 72, reason: 'Trend analizi' },
    },
    sat: {
      morning: { score: 82, reason: 'Brunch kombini' },
      midday: { score: 86, reason: 'Gün içi stil' },
      evening: { score: 88, reason: 'Parti/konser' },
      night: { score: 70, reason: 'Gece paylaşımı' },
    },
    sun: {
      morning: { score: 84, reason: 'Pazar brunch stili' },
      midday: { score: 82, reason: 'Gün boyu ipucu' },
      evening: { score: 78, reason: 'Haftaya hazırlık' },
      night: { score: 56, reason: 'Sakince stil' },
    },
  },
  travel: {
    mon: {
      morning: { score: 82, reason: 'Gezgin motivasyonu' },
      midday: { score: 68, reason: 'Molada rota okuma' },
      evening: { score: 76, reason: 'Günü değerlendirme' },
      night: { score: 64, reason: 'Seyahat planlama' },
    },
    tue: {
      morning: { score: 80, reason: 'Rota önerileri' },
      midday: { score: 70, reason: 'Hızlı gezi listesi' },
      evening: { score: 78, reason: 'Detaylı rehber' },
      night: { score: 70, reason: 'Seyahat podcast' },
    },
    wed: {
      morning: { score: 84, reason: 'Orta hafta kaçış' },
      midday: { score: 74, reason: 'Bütçe ipuçları' },
      evening: { score: 82, reason: 'Fotoğraf düzenleme' },
      night: { score: 72, reason: 'Gezi anıları' },
    },
    thu: {
      morning: { score: 78, reason: 'Hafta sonu planı' },
      midday: { score: 72, reason: 'Uçak bileti tüyosu' },
      evening: { score: 80, reason: 'Restoran/cafe keşfi' },
      night: { score: 68, reason: 'Yorum-cevap' },
    },
    fri: {
      morning: { score: 76, reason: 'Çıkış hazırlığı' },
      midday: { score: 84, reason: 'Yola çıkış anı' },
      evening: { score: 90, reason: 'Varış/otel peak' },
      night: { score: 86, reason: 'Gece şehir turu' },
    },
    sat: {
      morning: { score: 92, reason: 'Tam gün keşif peak' },
      midday: { score: 94, reason: 'Öğle/akşam arası tur' },
      evening: { score: 88, reason: 'Mekan/yemek paylaşımı' },
      night: { score: 84, reason: 'Gece hayatı' },
    },
    sun: {
      morning: { score: 90, reason: 'Brunch + manzara' },
      midday: { score: 88, reason: 'Son keşif' },
      evening: { score: 82, reason: 'Dönüş yolu' },
      night: { score: 70, reason: 'Hafıza tazeleme' },
    },
  },
  gaming: {
    mon: {
      morning: { score: 70, reason: 'Oyun haberleri' },
      midday: { score: 64, reason: 'Hızlı haber' },
      evening: { score: 86, reason: 'Akşam oyunu' },
      night: { score: 92, reason: 'Gece gaming peak' },
    },
    tue: {
      morning: { score: 68, reason: 'Patch/tur paylaşımı' },
      midday: { score: 62, reason: 'Ofis arası' },
      evening: { score: 88, reason: 'Rakipsız oyun' },
      night: { score: 94, reason: 'Yoğun turnuva saatleri' },
    },
    wed: {
      morning: { score: 66, reason: 'Orta hafta düşük' },
      midday: { score: 70, reason: 'Lunch break gaming' },
      evening: { score: 90, reason: 'Yayıncı saati' },
      night: { score: 96, reason: 'Streamer peak' },
    },
    thu: {
      morning: { score: 64, reason: 'Hafif içerik' },
      midday: { score: 68, reason: 'Topluluk paylaşımı' },
      evening: { score: 90, reason: 'Co-op saatleri' },
      night: { score: 96, reason: 'Gece turnuvaları' },
    },
    fri: {
      morning: { score: 72, reason: 'Yeni çıkış' },
      midday: { score: 74, reason: 'Hafta sonu lansmanı' },
      evening: { score: 92, reason: 'Cuma gecesi gaming' },
      night: { score: 98, reason: 'HAFTA PEAK – gece' },
    },
    sat: {
      morning: { score: 80, reason: 'Maraton başlangıcı' },
      midday: { score: 86, reason: 'Gün içi turnuva' },
      evening: { score: 94, reason: 'Akşam yayını' },
      night: { score: 96, reason: 'Gece yayını' },
    },
    sun: {
      morning: { score: 82, reason: 'Pazar turnuvası' },
      midday: { score: 84, reason: 'Lan partisi' },
      evening: { score: 88, reason: 'Hafta sonu finali' },
      night: { score: 80, reason: 'Eski güzel günler' },
    },
  },
  personal_dev: {
    mon: {
      morning: { score: 96, reason: 'HAFTA PEAK – yeni başlangıç' },
      midday: { score: 70, reason: 'Motivasyon molası' },
      evening: { score: 84, reason: 'Kitap/özet paylaşımı' },
      night: { score: 60, reason: 'Yatmadan önce okuma' },
    },
    tue: {
      morning: { score: 90, reason: 'Sabah rutini devam' },
      midday: { score: 68, reason: 'Ofis tüyosu' },
      evening: { score: 80, reason: 'Hafta içi alışkanlık' },
      night: { score: 58, reason: 'Refleksiyon' },
    },
    wed: {
      morning: { score: 88, reason: 'Orta hafta ivmesi' },
      midday: { score: 72, reason: 'Kısa ipucu' },
      evening: { score: 82, reason: 'Pomodoro tüyosu' },
      night: { score: 56, reason: 'Hafif içerik' },
    },
    thu: {
      morning: { score: 86, reason: 'Hafta sonu öncesi' },
      midday: { score: 70, reason: 'Odak tüyosu' },
      evening: { score: 78, reason: 'Kitap kulübü' },
      night: { score: 62, reason: 'Günlük yazımı' },
    },
    fri: {
      morning: { score: 82, reason: 'Hafta değerlendirmesi' },
      midday: { score: 76, reason: 'Hafif motivasyon' },
      evening: { score: 70, reason: 'Sosyal paylaşım' },
      night: { score: 50, reason: 'Eğlence' },
    },
    sat: {
      morning: { score: 78, reason: 'Kendi zamanı' },
      midday: { score: 74, reason: 'Hobi odaklı' },
      evening: { score: 68, reason: 'Sosyal etkinlik' },
      night: { score: 52, reason: 'Hafif içerik' },
    },
    sun: {
      morning: { score: 92, reason: 'Pazar planlaması' },
      midday: { score: 84, reason: 'Hafta öncesi motivasyon' },
      evening: { score: 80, reason: 'Yansıma/hazırlık' },
      night: { score: 64, reason: 'Sakin okuma' },
    },
  },
  beauty: {
    mon: {
      morning: { score: 78, reason: 'Hafta başı makyajı' },
      midday: { score: 66, reason: 'Hızlı rötuş' },
      evening: { score: 84, reason: 'Gece rutini' },
      night: { score: 76, reason: 'Cilt bakımı' },
    },
    tue: {
      morning: { score: 76, reason: 'Günlük look' },
      midday: { score: 68, reason: 'Ara rötuş' },
      evening: { score: 86, reason: 'Makyaj tutorial' },
      night: { score: 78, reason: 'Bakım rutini' },
    },
    wed: {
      morning: { score: 80, reason: 'Orta hafta ilham' },
      midday: { score: 72, reason: 'Mini ipucu' },
      evening: { score: 90, reason: 'GLAM look peak' },
      night: { score: 80, reason: 'Detaylı bakım' },
    },
    thu: {
      morning: { score: 78, reason: 'Sabah rutini' },
      midday: { score: 70, reason: 'Hızlı paylaşım' },
      evening: { score: 88, reason: 'Trend görünüm' },
      night: { score: 76, reason: 'Maske/bakım' },
    },
    fri: {
      morning: { score: 82, reason: 'Cuma look\'u' },
      midday: { score: 78, reason: 'Mini tutorial' },
      evening: { score: 92, reason: 'Gece makyajı peak' },
      night: { score: 74, reason: 'Cilt bakımı' },
    },
    sat: {
      morning: { score: 86, reason: 'Brunch makyajı' },
      midday: { score: 84, reason: 'Özel gün look\'u' },
      evening: { score: 90, reason: 'Parti/hazırlık' },
      night: { score: 72, reason: 'Gece paylaşımı' },
    },
    sun: {
      morning: { score: 88, reason: 'Pazar self-care' },
      midday: { score: 82, reason: 'Bakım rutini' },
      evening: { score: 80, reason: 'Hafta öncesi plan' },
      night: { score: 78, reason: 'Huzur içerik' },
    },
  },
};

// Varsayılan skor (bilinmeyen niche için)
const DEFAULT_NICHE_SCORES: NicheScores = {
  mon: {
    morning: { score: 78, reason: 'Hafta başı enerjisi' },
    midday: { score: 70, reason: 'Molada kısa içerik' },
    evening: { score: 82, reason: 'Akşam kitlesi' },
    night: { score: 58, reason: 'Gece az ama niş' },
  },
  tue: {
    morning: { score: 76, reason: 'Sabah rutini' },
    midday: { score: 70, reason: 'Ofis arası' },
    evening: { score: 80, reason: 'Akşam tüketimi' },
    night: { score: 56, reason: 'Gece düşük' },
  },
  wed: {
    morning: { score: 80, reason: 'Orta hafta ivmesi' },
    midday: { score: 74, reason: 'Ara paylaşımı' },
    evening: { score: 84, reason: 'Peak akşam' },
    night: { score: 60, reason: 'Gece tartışma' },
  },
  thu: {
    morning: { score: 78, reason: 'Hafta sonu öncesi' },
    midday: { score: 72, reason: 'Hızlı paylaşım' },
    evening: { score: 82, reason: 'Sosyal akşam' },
    night: { score: 58, reason: 'Hafif içerik' },
  },
  fri: {
    morning: { score: 76, reason: 'Cuma heyecanı' },
    midday: { score: 78, reason: 'Ofis çıkışı' },
    evening: { score: 86, reason: 'Sosyal akşam' },
    night: { score: 70, reason: 'Gece eğlence' },
  },
  sat: {
    morning: { score: 82, reason: 'Hafta sonu sabahı' },
    midday: { score: 84, reason: 'Gün içi enerjisi' },
    evening: { score: 80, reason: 'Sosyal içerik' },
    night: { score: 72, reason: 'Gece etkinliği' },
  },
  sun: {
    morning: { score: 84, reason: 'Pazar sabahı' },
    midday: { score: 80, reason: 'Aile zamanı' },
    evening: { score: 76, reason: 'Hafta öncesi' },
    night: { score: 58, reason: 'Sakince son' },
  },
};

export type CalendarGrid = { niche: NicheId | null; grid: NicheScores; bestSlot: { day: DayKey; slot: PostingSlot; score: number; reason: string } };

export const getCalendarGrid = (niche: NicheId | null): CalendarGrid => {
  const grid = niche && SCORES[niche] ? SCORES[niche] : DEFAULT_NICHE_SCORES;
  let best: { day: DayKey; slot: PostingSlot; score: number; reason: string } = {
    day: 'mon', slot: 'morning', score: 0, reason: '',
  };
  (Object.keys(grid) as DayKey[]).forEach((day) => {
    (Object.keys(grid[day]) as PostingSlot[]).forEach((slot) => {
      const s = grid[day][slot];
      if (s.score > best.score) {
        best = { day, slot, score: s.score, reason: s.reason };
      }
    });
  });
  return { niche, grid, bestSlot: best };
};

export const getTopThreeSlots = (grid: NicheScores): { day: DayKey; slot: PostingSlot; score: number; reason: string }[] => {
  const all: { day: DayKey; slot: PostingSlot; score: number; reason: string }[] = [];
  (Object.keys(grid) as DayKey[]).forEach((day) => {
    (Object.keys(grid[day]) as PostingSlot[]).forEach((slot) => {
      all.push({ day, slot, score: grid[day][slot].score, reason: grid[day][slot].reason });
    });
  });
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, 3);
};

export const getCalendarInsight = (niche: NicheId | null): string => {
  if (!niche) return 'Bir niş seçtiğinde, o alana özel en iyi paylaşım zamanlarını gösteririm.';
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
  const label = nicheLabels[niche] ?? niche;
  return `${label} nişinde en verimli zamanlar akşam saatleri ve hafta sonu sabahları. Gece içerikleri daha niş ama sadık kitle getirir.`;
};

const CALENDAR_PLAN_KEY = '@content-coach/calendar-plan';

export type CalendarPlanEntry = {
  id: string;
  day: DayKey;
  slot: PostingSlot;
  text: string;
  niche: NicheId | null;
  createdAt: number;
};

export const getCalendarPlan = async (): Promise<CalendarPlanEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_PLAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: any) =>
      e && typeof e.id === 'string' &&
      typeof e.day === 'string' &&
      typeof e.slot === 'string' &&
      typeof e.text === 'string' &&
      typeof e.createdAt === 'number'
    );
  } catch {
    return [];
  }
};

export const addCalendarPlanEntry = async (entry: Omit<CalendarPlanEntry, 'id' | 'createdAt'>): Promise<CalendarPlanEntry[]> => {
  const current = await getCalendarPlan();
  const newEntry: CalendarPlanEntry = {
    ...entry,
    id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const dedup = current.filter((e) => !(e.day === entry.day && e.slot === entry.slot));
  const next = [newEntry, ...dedup].slice(0, 28);
  await AsyncStorage.setItem(CALENDAR_PLAN_KEY, JSON.stringify(next));
  return next;
};

export const removeCalendarPlanEntry = async (id: string): Promise<CalendarPlanEntry[]> => {
  const current = await getCalendarPlan();
  const next = current.filter((e) => e.id !== id);
  await AsyncStorage.setItem(CALENDAR_PLAN_KEY, JSON.stringify(next));
  return next;
};

export const clearCalendarPlan = async (): Promise<void> => {
  await AsyncStorage.removeItem(CALENDAR_PLAN_KEY);
};

// ---------- Round 56: Content Repurposing / Multi-Platform Adaptor ----------
export type PlatformId = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'pinterest' | 'threads' | 'blog';

export const PLATFORMS: {
  id: PlatformId;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  charLimit: number;
  bestFormat: string;
  tagline: string;
}[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', color: '#E1306C', bg: '#FCE7F3', charLimit: 2200, bestFormat: 'Reels + Carousel', tagline: 'Görsel ağırlıklı, hashtag\'li' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: '#000000', bg: '#F3F4F6', charLimit: 2200, bestFormat: 'Kısa video', tagline: '15-60 sn, hook ilk 3 sn' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', color: '#FF0000', bg: '#FEE2E2', charLimit: 5000, bestFormat: 'Long-form + Shorts', tagline: 'SEO başlık, thumbnail kritik' },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0', bg: '#DBEAFE', charLimit: 280, bestFormat: 'Thread', tagline: 'Kısa & keskin, thread kurgu' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', color: '#0A66C2', bg: '#DBEAFE', charLimit: 3000, bestFormat: 'Carousel + Metin', tagline: 'Profesyonel ton, hikaye anlatımı' },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌', color: '#E60023', bg: '#FECDD3', charLimit: 500, bestFormat: 'Dikey Pin', tagline: 'SEO başlık, dikey görsel zorunlu' },
  { id: 'threads', label: 'Threads', emoji: '🧵', color: '#000000', bg: '#F3F4F6', charLimit: 500, bestFormat: 'Kısa metin', tagline: 'Samimi & hızlı, zincir konuşma' },
  { id: 'blog', label: 'Blog / Web', emoji: '📝', color: '#10B981', bg: '#D1FAE5', charLimit: 60000, bestFormat: 'Long-form makale', tagline: 'SEO, başlık + meta description' },
];

export type RepurposeFormat = 'tip' | 'story' | 'listicle' | 'tutorial' | 'opinion' | 'question' | 'myth' | 'quote' | 'news' | 'challenge';

export const REPURPOSE_FORMATS: { id: RepurposeFormat; label: string; emoji: string; hint: string }[] = [
  { id: 'tip', label: 'Hızlı İpucu', emoji: '💡', hint: 'Tek cümle pratik tavsiye' },
  { id: 'story', label: 'Hikaye / Anı', emoji: '📖', hint: 'Kişisel deneyim paylaşımı' },
  { id: 'listicle', label: 'Liste', emoji: '📋', hint: '5-7 maddelik sıralı içerik' },
  { id: 'tutorial', label: 'Nasıl Yapılır', emoji: '🛠️', hint: 'Adım adım eğitim' },
  { id: 'opinion', label: 'Görüş / Tartışma', emoji: '🔥', hint: 'Cesur bir iddia + argüman' },
  { id: 'question', label: 'Soru Sor', emoji: '❓', hint: 'Topluluğu dahil et' },
  { id: 'myth', label: 'Efsane / Mit', emoji: '🚫', hint: 'Yanlış bilinen bir şeyi çürüt' },
  { id: 'quote', label: 'Alıntı', emoji: '💬', hint: 'İlham verici kısa not' },
  { id: 'news', label: 'Haber / Trend', emoji: '📰', hint: 'Sektörden güncel bilgi' },
  { id: 'challenge', label: 'Meydan Okuma', emoji: '🎯', hint: 'İzleyiciyi aksiyona çağır' },
];

type PlatformAdaptation = {
  caption: string;
  hashtags: string[];
  hook: string;
  cta: string;
  formatTip: string;
};

type FormatAdaptations = Record<PlatformId, PlatformAdaptation>;

type RepurposeBase = {
  niche: NicheId | null;
  format: RepurposeFormat;
  topic: string;
  angle: string;
};

const REPURPOSE_HOOK_TEMPLATES: Record<string, string[]> = {
  fitness: [
    'Bu hareketi yanlış yapıyorsun.',
    '30 günde vücudunu değiştiren 3 alışkanlık.',
    'Spor salonunda kimsenin söylemediği gerçek.',
  ],
  food: [
    'Bu malzemeyi çöpe atıyorsun.',
    '5 dakikada cafe tarzı kahvaltı.',
    'Evde herkesin yapabileceği tek tarif.',
  ],
  tech: [
    'Bu ayar telefonunu 2 kat hızlandırır.',
    'AI ile işini 3 saat kısaltan yöntem.',
    'Çoğu kullanıcının bilmediği gizli özellik.',
  ],
  fashion: [
    'Dolabındaki tek parça 10 kombin yaratır.',
    'Moda değil, orantı önemli.',
    'Sokak stilinin 3 altın kuralı.',
  ],
  travel: [
    'Bu rota turistlerin görmediği yerleri gösterir.',
    '3 günde Avrupa\'yı gezmenin formülü.',
    'Ucuz uçmanın 5 gizli yöntemi.',
  ],
  gaming: [
    'Bu ayar FPS\'ini ikiye katlar.',
    'Pro oyuncuların kimseye söylemediği taktik.',
    '5 dakikada rank atlayan strateji.',
  ],
  personal_dev: [
    'Sabah 5 dakika, hayatını değiştirir.',
    'Disiplin mi motivasyon mu? Cevap şaşırtıcı.',
    'Kitap okumaktan 3 kat etkili yöntem.',
  ],
  beauty: [
    'Bu cilt bakım hatası seni yaşlandırıyor.',
    '5 TL\'lik ürün pahalı kremleri sollar.',
    'Makyajın tek bir kuralı her şeyi değiştirir.',
  ],
  _default: [
    'Bunu bilmeyen yok.',
    'Çoğu kişinin atladığı detay.',
    'Sektörün yeni kuralı.',
  ],
};

const HOOK_PICK = (niche: NicheId | null, seed: number): string => {
  const key = niche ?? '_default';
  const list = REPURPOSE_HOOK_TEMPLATES[key] ?? REPURPOSE_HOOK_TEMPLATES._default;
  return list[seed % list.length];
};

const HASHTAGS_BY_NICHE: Record<string, string[]> = {
  fitness: ['#fitness', '#fitlife', '#saglikliyasam', '#antrenman', '#gymlife', '#bodytransformation'],
  food: ['#yemek', '#tarif', '#lezzetli', '#kahvalti', '#evdepişir', '#mutfak'],
  tech: ['#teknoloji', '#ai', '#yazilim', '#verimlilik', '#tech', '#gelecek'],
  fashion: ['#moda', '#stil', '#outfit', '#kombin', '#streetstyle', '#gardrop'],
  travel: ['#seyahat', '#gezi', '#rota', '#seyahatgunlugu', '#dunya', '#tatil'],
  gaming: ['#gaming', '#oyun', '#fps', '#streamer', '#esports', '#gamingsetup'],
  personal_dev: ['#kisiselgelisim', '#motivasyon', '#kitap', '#disiplin', '#hayat', '#gelisim'],
  beauty: ['#guzellik', '#cilbakim', '#makyaj', '#skincare', '#beauty', '#rutin'],
  _default: ['#icerik', '#topluluk', '#kesfet', '#trend', '#paylasim', '#fikir'],
};

const HASHTAG_PICK = (niche: NicheId | null, seed: number, count: number): string[] => {
  const list = (niche && HASHTAGS_BY_NICHE[niche]) || HASHTAGS_BY_NICHE._default;
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const tag = list[(seed + i) % list.length];
    if (!picked.includes(tag)) picked.push(tag);
  }
  return picked;
};

const CAPTION_TEMPLATES: Record<RepurposeFormat, string> = {
  tip: '💡 Kısa ipucu:\n\n{{topic}}\n\n{{hook}}',
  story: '📖 Bugün seninle bir anımı paylaşmak istiyorum.\n\n{{topic}}\n\n{{hook}}',
  listicle: '📋 {{count}} maddelik liste:\n\n{{topic}}\n\n{{hook}}\n\nDetayları aşağıda 👇',
  tutorial: '🛠️ Adım adım:\n\n{{topic}}\n\n{{hook}}\n\nSon adım en önemlisi!',
  opinion: '🔥 Cesur bir iddia:\n\n{{topic}}\n\nKatılıyor musun? Yorumlarda tartışalım.',
  question: '❓ Sana bir soru:\n\n{{topic}}\n\nCevabını merak ediyorum 👇',
  myth: '🚫 Efsane çürütme:\n\n{{topic}}\n\nGerçek sandığın şey aslında...',
  quote: '💬 "{{topic}}"\n\n{{hook}}',
  news: '📰 Sektörden son gelişme:\n\n{{topic}}\n\n{{hook}}',
  challenge: '🎯 Bugün meydan okuma zamanı:\n\n{{topic}}\n\nBunu yapabilirsen yorumlarda görelim!',
};

const FILL_TEMPLATE = (template: string, topic: string, hook: string, count?: number): string => {
  return template
    .replace('{{topic}}', topic)
    .replace('{{hook}}', hook)
    .replace('{{count}}', String(count ?? 5));
};

const PLATFORM_CTA: Record<PlatformId, string> = {
  instagram: 'Kaydet & paylaş 🔖',
  tiktok: 'Takip et, daha fazlası gelsin 🔔',
  youtube: 'Beğen & abone ol 🙏',
  twitter: 'RT ile destek ol 💙',
  linkedin: 'Ağında paylaş, değer katsın 🔗',
  pinterest: 'Panoya kaydet 📌',
  threads: 'Yorumda buluşalım 💬',
  blog: 'Mail aboneliğiyle devamını kaçırma 📬',
};

const PLATFORM_FORMAT_TIP: Record<PlatformId, string> = {
  instagram: '9:16 Reels + caption ilk satırda hook. Carousel kullanıyorsan ilk frame\'e değer koy.',
  tiktok: 'İlk 3 saniye kritik, dikey çekim, captions ekle. Ses trendlerinden birini kullan.',
  youtube: 'Thumbnail\'de yüz + 3 kelime, başlıkta anahtar kelime. Shorts için 60 sn altı.',
  twitter: 'Tweet zincirinde ilk twit tek başına anlamlı olsun. 1/ 2/ 3/ numaraları kullan.',
  linkedin: 'İlk satır gri çubuk kaybolur, dikkat çekici bir açılış kullan. 1200 kelimeden kısa tut.',
  pinterest: '1000x1500 dikey görsel, başlıkta anahtar kelime, açıklamada 2-3 hashtag.',
  threads: 'Samimi bir ton, kısa cümleler, zincir halinde devam et. Soru ile bitir.',
  blog: 'H2 başlıklar, 150-180 kelime paragraf, iç/dış link, meta description 155 karakter.',
};

const PLATFORM_HASHTAG_COUNT: Record<PlatformId, number> = {
  instagram: 8,
  tiktok: 5,
  youtube: 4,
  twitter: 2,
  linkedin: 4,
  pinterest: 3,
  threads: 3,
  blog: 3,
};

export type RepurposeOutput = {
  id: string;
  niche: NicheId | null;
  format: RepurposeFormat;
  topic: string;
  createdAt: number;
  adaptations: FormatAdaptations;
};

const PSEUDO_RANDOM = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export const buildRepurposePack = (
  niche: NicheId | null,
  format: RepurposeFormat,
  topic: string,
  angle: string,
  seedBase = Date.now()
): RepurposeOutput => {
  const topicResolved = topic.trim() || 'Konu belirtilmedi';
  const seed = seedBase % 9973;
  const hook = HOOK_PICK(niche, seed);
  const count = 5 + Math.floor(PSEUDO_RANDOM(seed + 1) * 4);

  const adaptations = {} as FormatAdaptations;
  PLATFORMS.forEach((p, idx) => {
    const platformSeed = seed + idx * 17;
    const template = CAPTION_TEMPLATES[format];
    const captionRaw = FILL_TEMPLATE(template, topicResolved, hook, count);
    const charLimit = p.charLimit;
    const caption = captionRaw.length > charLimit ? captionRaw.slice(0, charLimit - 3) + '...' : captionRaw;
    adaptations[p.id] = {
      caption,
      hashtags: HASHTAG_PICK(niche, platformSeed, PLATFORM_HASHTAG_COUNT[p.id]),
      hook,
      cta: PLATFORM_CTA[p.id],
      formatTip: PLATFORM_FORMAT_TIP[p.id],
    };
  });

  return {
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    niche,
    format,
    topic: topicResolved,
    createdAt: Date.now(),
    adaptations,
  };
};

const REPURPOSE_PACK_KEY = '@content-coach/repurpose-pack';

export type SavedRepurposePack = RepurposeOutput & { angle: string };

export const saveRepurposePack = async (pack: RepurposeOutput, angle: string): Promise<SavedRepurposePack[]> => {
  const current = await getRepurposePacks();
  const saved: SavedRepurposePack = { ...pack, angle };
  const next = [saved, ...current].slice(0, 12);
  await AsyncStorage.setItem(REPURPOSE_PACK_KEY, JSON.stringify(next));
  return next;
};

export const getRepurposePacks = async (): Promise<SavedRepurposePack[]> => {
  try {
    const raw = await AsyncStorage.getItem(REPURPOSE_PACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: any): e is SavedRepurposePack =>
        e &&
        typeof e.id === 'string' &&
        typeof e.topic === 'string' &&
        typeof e.format === 'string' &&
        e.adaptations &&
        typeof e.adaptations === 'object'
    );
  } catch {
    return [];
  }
};

export const removeRepurposePack = async (id: string): Promise<SavedRepurposePack[]> => {
  const current = await getRepurposePacks();
  const next = current.filter((p) => p.id !== id);
  await AsyncStorage.setItem(REPURPOSE_PACK_KEY, JSON.stringify(next));
  return next;
};

export const clearRepurposePacks = async (): Promise<void> => {
  await AsyncStorage.removeItem(REPURPOSE_PACK_KEY);
};

// ---------- Round 57: Content Series Builder ----------
export type SeriesArc = 'educational' | 'myth_busting' | 'story_journey' | 'step_by_step' | 'case_study' | 'countdown' | 'challenge';

export const SERIES_ARCS: { id: SeriesArc; label: string; emoji: string; hint: string; color: string; bg: string }[] = [
  { id: 'educational', label: 'Eğitim Serisi', emoji: '🎓', hint: 'Temelden ileriye kavramlar', color: '#0EA5E9', bg: '#E0F2FE' },
  { id: 'myth_busting', label: 'Efsane Yıkma', emoji: '🚫', hint: 'Yanlış bilinenleri çürüt', color: '#EC4899', bg: '#FCE7F3' },
  { id: 'story_journey', label: 'Yolculuk Hikayesi', emoji: '🗺️', hint: 'Başlangıç → dönüşüm', color: '#10B981', bg: '#D1FAE5' },
  { id: 'step_by_step', label: 'Adım Adım', emoji: '🪜', hint: 'Sıralı pratik rehber', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'case_study', label: 'Vaka Analizi', emoji: '🔬', hint: 'Somut örneklerle öğret', color: '#8B5CF6', bg: '#F3E8FF' },
  { id: 'countdown', label: 'Geri Sayım', emoji: '⏳', hint: 'X adım / gün / ipucu', color: '#EF4444', bg: '#FEE2E2' },
  { id: 'challenge', label: 'Meydan Okuma', emoji: '🎯', hint: '7/30 günlük aksiyon', color: '#6366F1', bg: '#E0E7FF' },
];

export type EpisodeFormat = 'reel' | 'carousel' | 'caption' | 'thread' | 'story' | 'video' | 'blog';

export const EPISODE_FORMATS: { id: EpisodeFormat; label: string; emoji: string }[] = [
  { id: 'reel', label: 'Reels', emoji: '🎬' },
  { id: 'carousel', label: 'Carousel', emoji: '📑' },
  { id: 'caption', label: 'Caption', emoji: '💬' },
  { id: 'thread', label: 'Thread', emoji: '🧵' },
  { id: 'story', label: 'Story', emoji: '📱' },
  { id: 'video', label: 'Long video', emoji: '🎥' },
  { id: 'blog', label: 'Blog', emoji: '📝' },
];

export type Episode = {
  index: number;
  title: string;
  hook: string;
  format: EpisodeFormat;
  beat: string;
  deliverable: string;
  cta: string;
  cliffhanger: string;
};

type SeriesNicheContent = {
  episodeTitles: string[];
  beatPatterns: string[];
  deliverablePatterns: string[];
};

const SERIES_CONTENT: Record<SeriesArc, Record<string, SeriesNicheContent>> = {
  educational: {
    fitness: {
      episodeTitles: [
        'Protein ihtiyacını nasıl hesaplarsın?',
        'Antrenman split\'ini doğru kurmak',
        'Dinlenme günlerinin bilimi',
        'HIIT vs Steady State: Hangisi sana göre?',
        'İlerleme ölçümünde 3 altın metrik',
        'Supplement kafanı temizleyen kural',
        'Seriyi birleştiren 7 günlük plan',
      ],
      beatPatterns: [
        'Sektörde en çok yanlış anlaşılan kavramı düzelt',
        'Bilimsel veri + günlük uygulama dengesi kur',
        'Topluluktan gelen 3 sık soruyu cevapla',
        'Karşılaştırma tablosu ile somutlaştır',
        'Ölçüm yöntemini ve takip aracını tanıt',
        'Sık yapılan hatayı örnek üzerinden göster',
        'Tüm seriyi tek bir aksiyon planında birleştir',
      ],
      deliverablePatterns: [
        'PDF hesaplama tablosu',
        'Split seçim anketi',
        'Dinlenme günü checklist\'i',
        'Karşılaştırma infografiği',
        'Ölçüm defteri şablonu',
        'Supplement kontrol listesi',
        '7 günlük PDF plan',
      ],
    },
    food: {
      episodeTitles: [
        'Mutfaktaki 5 temel teknik',
        'Tek malzemeyle 3 farklı yemek',
        'Baharat çiftlerini öğren',
        '10 dakikada sağlıklı kahvaltı',
        'Buzdolabındaki artıkları dönüştür',
        'Sezonda ucuz alışveriş listesi',
        'Serinin özeti: 7 günlük menü',
      ],
      beatPatterns: [
        'Teknik bilgi + pratik uygulama',
        'Varyasyon önerisi ile yaratıcılığı tetikle',
        'Lezzet eşleştirmelerini haritala',
        'Zaman kısıtlı senaryolar için plan',
        'Sıfır atık mutfak konsepti',
        'Maliyet hesaplama + pazar karşılaştırma',
        'Tüm haftayı kapsayan menü planı',
      ],
      deliverablePatterns: [
        'Teknik PDF',
        'Tarif kartları',
        'Baharat eşleştirme posteri',
        'Hızlı kahvaltı listesi',
        'Atık dönüşüm rehberi',
        'Alışveriş listesi',
        'Haftalık menü PDF',
      ],
    },
    tech: {
      episodeTitles: [
        'Yapay zeka ile 10 kat hızlanan iş akışı',
        'Prompt mühendisliğinin ABC\'si',
        'Ücretsiz araçlarla MVP kurma',
        'Verimlilik için 5 gizli ayar',
        'Kod review\'de unutulan 3 prensip',
        'Otomasyonu başlatan ilk adım',
        'Seriyi bağlayan çalışma şablonu',
      ],
      beatPatterns: [
        'Konsept → demo → tekrar',
        'Karşılaştırmalı tablo ile seçim kolaylaştır',
        'Adım adım ekran görüntüleri',
        'Senaryo bazlı: yeni başlayan / ileri',
        'Kod parçacıkları + açıklama',
        'Önce/sonra ile etkiyi kanıtla',
        'Toplulukla paylaşılan tek şablon',
      ],
      deliverablePatterns: [
        'Prompt koleksiyonu',
        'Karşılaştırma tablosu',
        'MVP checklist\'i',
        'Ayar seti kılavuzu',
        'Review şablonu',
        'İlk otomasyon planı',
        'Çalışma şablonu',
      ],
    },
    fashion: {
      episodeTitles: [
        'Renk eşleştirmenin 3 altın kuralı',
        'Dolabını 33 parçaya indir',
        '5 parçayla 30 kombin',
        'Sezon geçişinde katmanlama',
        'Aksesuar seçiminde oran',
        'Outfit fotoğrafında ışık & açı',
        '7 günlük gardırop kapsülü',
      ],
      beatPatterns: [
        'Kural + görsel örnek',
        'Sayısal indirgeme vaadi',
        'Kombin matrisini görselleştir',
        'Mevsim geçişi için geçiş formülleri',
        'Oran + proporsiyon dersleri',
        'Fotoğraf tüyoları (ışık/kadro)',
        'Kapsül kombinasyonlarını paketle',
      ],
      deliverablePatterns: [
        'Renk paleti PDF',
        '33 parça listesi',
        'Kombin matris şablonu',
        'Katmanlama görseli',
        'Aksesuar oran kılavuzu',
        'Çekim rehberi',
        '7 günlük kapsül PDF',
      ],
    },
    travel: {
      episodeTitles: [
        'Rotayı 24 saatte planlamak',
        'Ucuz uçmanın 5 gizli yöntemi',
        'Konaklama bütçesini yarıya indir',
        'Yerel lezzet haritası çıkarmak',
        'Fotoğraf için en iyi ışık saatleri',
        'Çantada olmazsa olmaz 10 eşya',
        '7 günlük Avrupa rotası',
      ],
      beatPatterns: [
        'Planlama şablonu + örnek rota',
        'Adım adım karşılaştırma',
        'Bütçe dağılımı + araç listesi',
        'Yerel rehberlerle röportaj',
        'Işık & mevsim takvimi',
        'Paketleme listesi + ağırlık kontrolü',
        'Tüm rotayı tek PDF\'te topla',
      ],
      deliverablePatterns: [
        'Rota planlama şablonu',
        'Uçuş karşılaştırma listesi',
        'Konaklama bütçe tablosu',
        'Lezzet haritası',
        'Işık takvimi',
        'Paketleme listesi',
        '7 günlük rota PDF',
      ],
    },
    gaming: {
      episodeTitles: [
        'Aim\'ini 7 günde geliştir',
        'Sensitivity ayarının matematiği',
        'Rank atlamak için 3 mental taktik',
        'Ekipman seçiminde bütçe dağılımı',
        'Stream setup\'a giriş',
        'Turnuvaya hazırlık planı',
        'Topluluk yönetiminin ABC\'si',
      ],
      beatPatterns: [
        'Egzersiz + ölçüm',
        'Hesaplama + uygulama',
        'Mental antrenman + tekrar',
        'Bütçe + performans dengesi',
        'Kurulum + ekipman listesi',
        'Hazırlık rutini + kontrol listesi',
        'Topluluk stratejisi',
      ],
      deliverablePatterns: [
        'Aim training programı',
        'Sensitivity hesaplayıcı',
        'Mental antrenman rehberi',
        'Ekipman bütçe tablosu',
        'Setup rehberi',
        'Turnuva hazırlık listesi',
        'Topluluk yönetim şablonu',
      ],
    },
    personal_dev: {
      episodeTitles: [
        'Sabah rutini nasıl inşa edilir',
        'Disiplin mi motivasyon mu?',
        'Hedef belirleme çerçevesi',
        'Odaklanma için 3 teknik',
        'Kitap okumayı alışkanlığa çevir',
        'Geri bildirim kültürü',
        '7 günlük dönüşüm planı',
      ],
      beatPatterns: [
        'Adım adım kurulum',
        'Karşılaştırmalı analiz',
        'Çerçeve sun + uygulama örneği',
        'Teknik + pratik örnek',
        'Alışkanlık tasarım prensipleri',
        'Geri bildirim alma/verme örüntüleri',
        'Haftalık aksiyon planı',
      ],
      deliverablePatterns: [
        'Sabah rutini PDF',
        'Karar çerçevesi',
        'Hedef şablonu',
        'Odaklanma tekniği kartları',
        'Okuma alışkanlığı planı',
        'Geri bildirim formu',
        '7 günlük plan',
      ],
    },
    beauty: {
      episodeTitles: [
        'Cilt tipini doğru tanımla',
        '10 adımlık rutin mi 3 adım yeter mi?',
        'Aktif içerik eşleştirme',
        'Güneş korumanın gerçek değeri',
        'Makyajda oran & renk teorisi',
        'Bütçeye göre rutin alternatifleri',
        '7 günlük cilt bakım planı',
      ],
      beatPatterns: [
        'Teşhis + çözüm',
        'Adım sayısı karşılaştırması',
        'İçerik uyumu tablosu',
        'SPF gerçekleri + uygulama',
        'Renk eşleştirme + yüz şekli',
        'Fiyat/performans kıyası',
        'Haftalık bakım takvimi',
      ],
      deliverablePatterns: [
        'Cilt tipi anketi',
        'Rutin karşılaştırma tablosu',
        'İçerik uyum haritası',
        'SPF rehberi',
        'Makyaj oran kılavuzu',
        'Alternatif ürün listesi',
        '7 günlük bakım planı',
      ],
    },
    _default: {
      episodeTitles: [
        'Konunun temelleri',
        'Sık yapılan 3 hata',
        'İlk uygulama adımı',
        'Ara vaka çalışması',
        'İleri seviye teknik',
        'Topluluktan gelen sorular',
        'Serinin özeti & aksiyon planı',
      ],
      beatPatterns: [
        'Kavramsal giriş + örnek',
        'Hata listesi + düzeltme',
        'Pratik adım adım rehber',
        'Somut örnek üzerinden analiz',
        'İleri teknik + ipucu',
        'Soru-cevap bölümü',
        'Özet + aksiyon planı',
      ],
      deliverablePatterns: [
        'Temel kavram PDF',
        'Hata listesi',
        'Adım adım rehber',
        'Vaka analizi',
        'İleri teknik kartları',
        'Soru-cevap arşivi',
        'Aksiyon planı',
      ],
    },
  },
  myth_busting: {
    fitness: {
      episodeTitles: [
        '"Ağır kaldırma kadınları erkeğe çevirir" efsanesi',
        'Yağ yakımı için uzun kardio mu?',
        'Gece yemekleri kilo aldırır mı?',
        'Protein tozu böbreklere zararlı mı?',
        'Spot reduction mümkün mü?',
        'Sadece squat ile tüm vücut?',
        'Serinin özeti: gerçekler ve efsaneler',
      ],
      beatPatterns: [
        'İddia → bilimsel cevap → pratik öneri',
        'Çalışma referansı + karşılaştırma',
        'Yaygın inanış + gerçek veri',
        'Bilimsel makale özeti + çeviri',
        'Meta-analiz sonuçları',
        'Antrenman programı etkinliği',
        'Tüm efsaneleri liste + özet',
      ],
      deliverablePatterns: [
        'Bilimsel referans listesi',
        'Karşılaştırma tablosu',
        'Beslenme zamanlama rehberi',
        'Protein güvenlik raporu',
        'Spot reduction infografiği',
        'Squat varyasyonları',
        'Efsane/gerçek listesi',
      ],
    },
    food: {
      episodeTitles: [
        '"5 öğün küçük ye" efsanesi',
        'Karbonhidrat gerçekten düşman mı?',
        'Detoks ürünleri işe yarar mı?',
        'Organik her zaman daha mı iyi?',
        'Süt gerçekten kemikleri güçlendirir mi?',
        'Yağsız ürünler sağlıklı mı?',
        'Tüm efsanelerin özeti',
      ],
      beatPatterns: [
        'İddia → bilimsel kanıt → uygulama',
        'Çalışma özeti + sonuç',
        'Endüstri iddiası + gerçek',
        'Etiket okuma + karşılaştırma',
        'Beslenme kılavuzu referansı',
        'Yağ/karbonhidrat oranı analizi',
        'Tüm listeyi tek tabloda topla',
      ],
      deliverablePatterns: [
        'Öğün sıklığı rehberi',
        'Karbonhidrat tablosu',
        'Detoks gerçekleri',
        'Organik ürün karşılaştırması',
        'Süt alternatifleri tablosu',
        'Yağ analizi tablosu',
        'Efsane özet listesi',
      ],
    },
    tech: {
      episodeTitles: [
        '"Mac daha güvenli" efsanesi',
        'İnternette gizli kalmak mümkün mü?',
        'Daha fazla RAM her zaman hız kazandırır mı?',
        'Şarjda telefonu kullanmak zararlı mı?',
        'VPN her şeyi çözer mi?',
        '5G sağlığa zararlı mı?',
        'Efsanelerin özeti',
      ],
      beatPatterns: [
        'İddia → teknik analiz → uygulama',
        'Güvenlik modeli karşılaştırması',
        'Veri akışı + takip analizi',
        'Donanım benchmark testi',
        'Batarya kimyası açıklaması',
        'VPN sınırları analizi',
        'Sağlık referansları + sonuç',
      ],
      deliverablePatterns: [
        'Güvenlik karşılaştırması',
        'Takip önleme rehberi',
        'Donanım benchmark',
        'Batarya rehberi',
        'VPN sınırları tablosu',
        '5G bilimsel veri',
        'Efsane özet listesi',
      ],
    },
    fashion: {
      episodeTitles: [
        '"Logolu = kaliteli" efsanesi',
        'Siyah her zaman zayıf gösterir mi?',
        'Daha pahalı = daha kaliteli mi?',
        'Trend takip etmek zorunlu mu?',
        'Beden tek bir markaya bağlı mı?',
        'Fast fashion sürdürülebilir olabilir mi?',
        'Moda efsanelerinin özeti',
      ],
      beatPatterns: [
        'İddia → kalite kontrol → sonuç',
        'Optik yanılgı + gerçek',
        'Malzeme/konstrüksiyon analizi',
        'Trend psikolojisi',
        'Beden tablosu karşılaştırma',
        'Sürdürülebilirlik raporu',
        'Efsane listesi + sonuç',
      ],
      deliverablePatterns: [
        'Kalite kontrol listesi',
        'Renk illüzyonu rehberi',
        'Fiyat/kalite tablosu',
        'Trend filtresi',
        'Beden dönüşüm tablosu',
        'Sürdürülebilirlik skoru',
        'Efsane özeti',
      ],
    },
    travel: {
      episodeTitles: [
        '"Erken rezervasyon her zaman ucuz" efsanesi',
        'Hostel = tehlikeli mi?',
        'Yerel restoranlar pahalıdır mı?',
        'Turistler hep kandırılır mı?',
        'Seyahat sigortası gereksiz mi?',
        'Kruvaziyer gerçekten değer mi?',
        'Seyahat efsanelerinin özeti',
      ],
      beatPatterns: [
        'İddia → fiyat analizi → sonuç',
        'Güvenlik istatistikleri',
        'Fiyat karşılaştırması',
        'Lokal tecrübe analizi',
        'Sigorta kapsamı tablosu',
        'Maliyet/fayda analizi',
        'Efsane listesi',
      ],
      deliverablePatterns: [
        'Rezervasyon zamanlama tablosu',
        'Hostel güvenlik rehberi',
        'Restoran fiyat listesi',
        'Turist tuzakları rehberi',
        'Sigorta karşılaştırma tablosu',
        'Kruvaziyer analizi',
        'Efsane özeti',
      ],
    },
    gaming: {
      episodeTitles: [
        '"Aynı oyunu oynamak beceri kazandırır" efsanesi',
        'Yüksek FPS her zaman önemli mi?',
        'Pro oyuncular doğal yetenek mi?',
        'Oyun bağımlılık kaç saat?',
        'Premium üyelik şart mı?',
        'Yayıncılık zenginleştirir mi?',
        'Oyun efsanelerinin özeti',
      ],
      beatPatterns: [
        'İddia → istatistik → sonuç',
        'FPS etkisi benchmark',
        'Yetenek vs pratik analizi',
        'Sağlık/psikoloji verisi',
        'Üyelik fayda/maliyet',
        'Kazanç analizi',
        'Liste + özet',
      ],
      deliverablePatterns: [
        'Pratik etki tablosu',
        'FPS benchmark',
        'Yetenek analizi',
        'Oyun süresi rehberi',
        'Üyelik karşılaştırması',
        'Kazanç gerçekleri',
        'Efsane özeti',
      ],
    },
    personal_dev: {
      episodeTitles: [
        '"Multitasking üretkenliği artırır" efsanesi',
        'Sadece 10 bin saat kuralı mı?',
        'Sabah 5\'te kalkmak şart mı?',
        'Her gün kitap okumalı mıyım?',
        'Hedefler yazılmalı mı?',
        'Pozitif düşünce her zaman iyi mi?',
        'Kişisel gelişim efsaneleri özeti',
      ],
      beatPatterns: [
        'İddia → bilişsel araştırma → uygulama',
        'Uzmanlık literatürü analizi',
        'Uyku/ürünlük araştırması',
        'Okuma etkinliği verisi',
        'Hedef yazma deneyleri',
        'Pozitif psikoloji + sınırları',
        'Liste + aksiyon planı',
      ],
      deliverablePatterns: [
        'Multitasking analizi',
        'Uzmanlık gerçekleri',
        'Uyku verisi',
        'Okuma stratejileri',
        'Hedef çerçevesi',
        'Pozitif düşünce rehberi',
        'Efsane özeti',
      ],
    },
    beauty: {
      episodeTitles: [
        '"Yağsız ürünler daha iyi" efsanesi',
        'Pahalı krem her zaman daha mı etkili?',
        'Cilt temizleyicileri sık kullanılmalı mı?',
        'SPF\'e ihtiyaç gerçekten var mı?',
        'Makyaj cildi bozar mı?',
        'Doğal içerik = güvenli mi?',
        'Güzellik efsanelerinin özeti',
      ],
      beatPatterns: [
        'İddia → dermatoloji verisi → uygulama',
        'Fiyat/performans analizi',
        'Cilt bariyeri bilimi',
        'UV etki istatistikleri',
        'Komedojenik analiz',
        'İçerik güvenlik skoru',
        'Liste + özet',
      ],
      deliverablePatterns: [
        'Yağ analizi tablosu',
        'Krem karşılaştırması',
        'Temizleyici rehberi',
        'SPF rehberi',
        'Komedojenik liste',
        'İçerik güvenlik tablosu',
        'Efsane özeti',
      ],
    },
    _default: {
      episodeTitles: [
        'Yaygın inanış #1',
        'Yaygın inanış #2',
        'Yaygın inanış #3',
        'Yaygın inanış #4',
        'Yaygın inanış #5',
        'Yaygın inanış #6',
        'Tüm efsanelerin özeti',
      ],
      beatPatterns: [
        'İddia → veri → sonuç',
        'Referans + karşılaştırma',
        'Sektör analizi',
        'Bilimsel kaynak',
        'Uzman görüşü',
        'Kullanıcı deneyimi',
        'Liste + özet',
      ],
      deliverablePatterns: [
        'İddia analizi',
        'Referans listesi',
        'Sektör raporu',
        'Bilimsel kaynak',
        'Uzman röportajı',
        'Deneyim arşivi',
        'Efsane özeti',
      ],
    },
  },
  story_journey: {
    fitness: {
      episodeTitles: [
        'Nereden başladım: 80 kilo + yorgunluk',
        'İlk 30 günde ne değişti?',
        'Spor salonunda yaşadığım en utanç verici an',
        'Plateau\'yu nasıl aştım?',
        'Sakatlıktan öğrendiğim 3 ders',
        'Bugünkü rutine nasıl ulaştım?',
        'Bu yolculuğun 7 önemli çıkarımı',
      ],
      beatPatterns: [
        'Başlangıç durumunu samimi anlat',
        'Somut değişimleri paylaş',
        'Duygusal an + öğrenilen ders',
        'Zorlu dönemi gerçekçi anlat',
        'Gerçek engelleri göster',
        'Mevcut rutini + felsefeyi paylaş',
        'Çıkarımları liste + davet',
      ],
      deliverablePatterns: [
        'Başlangıç selfisi + not',
        '30 günlük karşılaştırma',
        'Hikaye kartı',
        'Plateau aşma rehberi',
        'Sakatlık önleme listesi',
        'Rutin şablonu',
        '7 çıkarım posteri',
      ],
    },
    food: {
      episodeTitles: [
        'Çocukluğumda mutfak: annemin elinde',
        'İlk yemek blogu denemem',
        'Başarısız tariflerin arkasındaki hikaye',
        'Yeme alışkanlığımı değiştiren olay',
        'Restoran açma hayalim',
        'Şimdiki mutfak ritüelim',
        'Bu yolculuğun 7 lezzet çıkarımı',
      ],
      beatPatterns: [
        'Çocukluk anısı + duygu',
        'Deneme + öğrenme',
        'Hata + ders',
        'Dönüm noktası olayı',
        'Hayal + gerçek',
        'Günlük ritüel',
        'Çıkarımlar + davet',
      ],
      deliverablePatterns: [
        'Çocukluk tarifi',
        'Blog başlangıç hikayesi',
        'Hata defteri',
        'Dönüm noktası infografiği',
        'Restoran konsepti',
        'Ritüel rehberi',
        'Çıkarım posteri',
      ],
    },
    tech: {
      episodeTitles: [
        'İlk bilgisayarım: 14 yaşında',
        'Bootcamp\'e giriş hikayem',
        'İlk projemde yaşadığım hata',
        'Startup fikrimin doğuşu',
        'Başarısız lansman ve dersleri',
        'Şimdiki çalışma ritüelim',
        '7 kariyer çıkarımı',
      ],
      beatPatterns: [
        'Çocukluk ilhamı',
        'Öğrenme yolculuğu',
        'Somut hata + ders',
        'Fikir doğuşu',
        'Başarısızlık + çıkarım',
        'Mevcut pratik',
        'Çıkarımlar listesi',
      ],
      deliverablePatterns: [
        'İlk proje arşivi',
        'Bootcamp defterim',
        'Hata analizi',
        'Startup fikir haritası',
        'Lansman sonrası rapor',
        'Çalışma ritüeli',
        'Çıkarım posteri',
      ],
    },
    fashion: {
      episodeTitles: [
        'İlk moda anım: annemin dolabı',
        'Stilimi bulma sürecim',
        'En sevdiğim gardırop hatası',
        'Vücut tipimi kabul ettiğim gün',
        'Minimalizme geçiş hikayem',
        'Şimdiki stil felsefem',
        '7 stil çıkarımı',
      ],
      beatPatterns: [
        'Çocukluk ilhamı',
        'Arama süreci',
        'Hata + ders',
        'Dönüm noktası',
        'Felsefe değişimi',
        'Mevcut stil',
        'Çıkarımlar',
      ],
      deliverablePatterns: [
        'İlham panosu',
        'Stil yolculuğu zaman çizelgesi',
        'Hata defteri',
        'Vücut tipi rehberi',
        'Minimal gardırop listesi',
        'Stil felsefesi manifestosu',
        'Çıkarım posteri',
      ],
    },
    travel: {
      episodeTitles: [
        'İlk solo seyahatim',
        'Kaybolduğum şehir ve kazandığım dersler',
        'En zorlu yolculuğum',
        'Yerel halkla kurduğum bağ',
        'Bir ülkenin beni değiştiren yanı',
        'Şimdi nasıl seyahat ediyorum?',
        '7 seyahat çıkarımı',
      ],
      beatPatterns: [
        'İlk solo deneyim',
        'Zorluk + öğrenme',
        'Fiziksel/zihinsel engel',
        'İnsan bağı',
        'Dönüştürücü an',
        'Mevcut yaklaşım',
        'Çıkarımlar',
      ],
      deliverablePatterns: [
        'Solo seyahat rehberi',
        'Kaybolma rehberi',
        'Zorluk çözüm listesi',
        'Yerel bağ kurma rehberi',
        'Dönüşüm haritası',
        'Seyahat felsefesi',
        'Çıkarım posteri',
      ],
    },
    gaming: {
      episodeTitles: [
        'İlk oyun konsolum ve başlangıç',
        'İlk turnuvaya katılışım',
        'En büyük mağlubiyetim',
        'Ekip arkadaşlarımla kurduğum takım',
        'Yayıncılığa geçiş kararım',
        'Şimdiki oyun ritüelim',
        '7 oyun çıkarımı',
      ],
      beatPatterns: [
        'Çocukluk nostaljisi',
        'İlk ciddi deneyim',
        'Duygusal an',
        'Takım dinamikleri',
        'Kariyer kararı',
        'Günlük pratik',
        'Çıkarımlar',
      ],
      deliverablePatterns: [
        'Oyun geçmişi zaman çizelgesi',
        'Turnuva anıları',
        'Mağlubiyet analizi',
        'Takım değerleri manifestosu',
        'Yayıncılık karar rehberi',
        'Oyun rutini',
        'Çıkarım posteri',
      ],
    },
    personal_dev: {
      episodeTitles: [
        'Hayatımın en karanlık dönemi',
        'Dönüşümü başlatan kitap/olay',
        'İlk mikro alışkanlık denemem',
        'Sosyal çevremi nasıl değiştirdim?',
        'Mentor bulma hikayem',
        'Şimdiki günlük ritüelim',
        '7 dönüşüm çıkarımı',
      ],
      beatPatterns: [
        'Vulnerability + dürüstlük',
        'Tetikleyici olay',
        'Küçük başlangıç',
        'Çevre değişimi',
        'Mentorluk ilişkisi',
        'Mevcut pratik',
        'Çıkarımlar + davet',
      ],
      deliverablePatterns: [
        'Dönüşüm hikayesi',
        'Kitap listesi',
        'Mikro alışkanlık tablosu',
        'Çevre değerlendirme formu',
        'Mentor seçim rehberi',
        'Ritüel planı',
        'Çıkarım posteri',
      ],
    },
    beauty: {
      episodeTitles: [
        'Cilt sorunumun başladığı dönem',
        'Dermatolog ziyaretim ve öğrendiklerim',
        'Rutin oluşturma sürecim',
        'Makyajla barışma hikayem',
        'İçerik okumayı öğrenmek',
        'Şimdiki bakım felsefem',
        '7 cilt bakım çıkarımı',
      ],
      beatPatterns: [
        'Sorun + duygu',
        'Uzman desteği',
        'Deneme yanılma',
        'Öz kabul',
        'Eğitim süreci',
        'Mevcut felsefe',
        'Çıkarımlar',
      ],
      deliverablePatterns: [
        'Cilt geçmişi',
        'Uzman notları',
        'Rutin karşılaştırması',
        'Makyaj hikayesi',
        'İçerik okuma kılavuzu',
        'Bakım felsefesi',
        'Çıkarım posteri',
      ],
    },
    _default: {
      episodeTitles: [
        'Yolculuğumun başlangıcı',
        'İlk öğrendiğim ders',
        'En zorlandığım an',
        'Değişimi tetikleyen olay',
        'Çevremden aldığım destek',
        'Şimdiki rutinim',
        'Bu yolculuğun 7 çıkarımı',
      ],
      beatPatterns: [
        'Samimi başlangıç',
        'İlk ders',
        'Engel + öğrenme',
        'Dönüm noktası',
        'Destek ve ilham',
        'Mevcut pratik',
        'Çıkarımlar',
      ],
      deliverablePatterns: [
        'Başlangıç hikayesi',
        'İlk ders notu',
        'Engel çözümü',
        'Dönüm noktası haritası',
        'Destek ağı görseli',
        'Pratik rehberi',
        'Çıkarım posteri',
      ],
    },
  },
  step_by_step: {
    fitness: {
      episodeTitles: [
        'Adım 1: Hedefini netleştir',
        'Adım 2: Seviyeni doğru ölç',
        'Adım 3: Haftalık planı kur',
        'Adım 4: Doğru formu öğren',
        'Adım 5: İlk ayın takibini yap',
        'Adım 6: Plateau\'da strateji değiştir',
        'Adım 7: Alışkanlığı kalıcı kıl',
      ],
      beatPatterns: [
        'Net hedefe dair soru seti',
        'Test + sonuç yorumlama',
        'Haftalık split önerisi',
        'Video demo + ipucu',
        'Ölçüm + geri bildirim',
        'Adaptasyon stratejisi',
        'Sürdürülebilirlik formülü',
      ],
      deliverablePatterns: [
        'Hedef worksheet',
        'Seviye testi',
        'Haftalık plan PDF',
        'Form kontrol listesi',
        'Takip defteri',
        'Adaptasyon kartları',
        'Sürdürülebilirlik planı',
      ],
    },
    food: {
      episodeTitles: [
        'Adım 1: Mutfağını gözden geçir',
        'Adım 2: Temel malzemeleri listele',
        'Adım 3: 5 kolay tarifi öğren',
        'Adım 4: Haftalık menü kur',
        'Adım 5: Market alışveriş rutini oluştur',
        'Adım 6: Atık yönetimi başlat',
        'Adım 7: Konuk menüsü hazırla',
      ],
      beatPatterns: [
        'Mutfak envanteri',
        'Alışveriş listesi şablonu',
        'Tarif kartları + video',
        'Haftalık menü planı',
        'Market rotasyonu',
        'Atık dönüşüm reçetesi',
        'Konuk planı + sunum',
      ],
      deliverablePatterns: [
        'Mutfak envanteri',
        'Alışveriş listesi',
        'Tarif kartları',
        'Haftalık menü',
        'Market planı',
        'Atık rehberi',
        'Konuk menüsü',
      ],
    },
    tech: {
      episodeTitles: [
        'Adım 1: Problemi tanımla',
        'Adım 2: Araç setini kur',
        'Adım 3: Minimum viable çözüm inşa et',
        'Adım 4: Test et ve ölç',
        'Adım 5: Otomasyon ekle',
        'Adım 6: Yayınla ve ölçeklendir',
        'Adım 7: Sürdürülebilir bakım planı',
      ],
      beatPatterns: [
        'Problem ifadesi şablonu',
        'Araç kurulum rehberi',
        'MVP geliştirme adımları',
        'Test senaryoları + metrikler',
        'Otomasyon akış diyagramı',
        'Yayınlama checklist\'i',
        'Bakım rutini',
      ],
      deliverablePatterns: [
        'Problem şablonu',
        'Araç kurulum kılavuzu',
        'MVP rehberi',
        'Test planı',
        'Otomasyon akışı',
        'Yayınlama listesi',
        'Bakım rutini',
      ],
    },
    fashion: {
      episodeTitles: [
        'Adım 1: Vücut tipini analiz et',
        'Adım 2: Renk paletini belirle',
        'Adım 3: Kapsül parçaları seç',
        'Adım 4: Kombin matrisi kur',
        'Adım 5: Aksesuar stratejisi belirle',
        'Adım 6: Mevsim geçiş gardırobunu hazırla',
        'Adım 7: Stil rutinini kalıcı kıl',
      ],
      beatPatterns: [
        'Vücut analiz formu',
        'Renk paleti oluşturma',
        'Kapsül parça listesi',
        'Kombin matrisi şablonu',
        'Aksesuar seçim rehberi',
        'Mevsim geçiş planı',
        'Stil rutini',
      ],
      deliverablePatterns: [
        'Vücut tipi formu',
        'Renk paleti',
        'Kapsül listesi',
        'Kombin matrisi',
        'Aksesuar rehberi',
        'Mevsim planı',
        'Stil rutini',
      ],
    },
    travel: {
      episodeTitles: [
        'Adım 1: Hedef ülkeyi seç',
        'Adım 2: Bütçeyi belirle',
        'Adım 3: Uçuş ve konaklama ara',
        'Adım 4: Günlük planı oluştur',
        'Adım 5: Yerel deneyimleri ekle',
        'Adım 6: Güvenlik kontrol listesini hazırla',
        'Adım 7: Seyahat sonrası öğrenimleri topla',
      ],
      beatPatterns: [
        'Ülke seçim matrisi',
        'Bütçe dağılımı tablosu',
        'Fiyat karşılaştırma aracı',
        'Günlük plan şablonu',
        'Yerel deneyim listesi',
        'Güvenlik checklist\'i',
        'Seyahat defteri',
      ],
      deliverablePatterns: [
        'Ülke seçim tablosu',
        'Bütçe planı',
        'Rezervasyon şablonu',
        'Günlük plan',
        'Deneyim listesi',
        'Güvenlik listesi',
        'Seyahat defteri',
      ],
    },
    gaming: {
      episodeTitles: [
        'Adım 1: Oyun profilini tanımla',
        'Adım 2: Donanım kontrolü yap',
        'Adım 3: Temel ayarları kur',
        'Adım 4: İlk 10 saatini harca',
        'Adım 5: Toplulukla bağ kur',
        'Adım 6: Turnuva hazırlığı yap',
        'Adım 7: Yayıncılık/atölye başlat',
      ],
      beatPatterns: [
        'Profil anketi',
        'Donanım kontrolü listesi',
        'Ayar rehberi',
        'İlk 10 saat görevleri',
        'Topluluk bağlantı rehberi',
        'Turnuva hazırlık planı',
        'Yayıncılık başlangıç planı',
      ],
      deliverablePatterns: [
        'Profil anketi',
        'Donanım listesi',
        'Ayar rehberi',
        'Görev listesi',
        'Topluluk rehberi',
        'Turnuva planı',
        'Yayıncılık planı',
      ],
    },
    personal_dev: {
      episodeTitles: [
        'Adım 1: Vizyonunu yaz',
        'Adım 2: Mevcut durumunu analiz et',
        'Adım 3: Çekirdek alışkanlıkları seç',
        'Adım 4: Tetikleyici/ödül sistemi kur',
        'Adım 5: İlk 30 günü takip et',
        'Adım 6: Geri bildirim döngüsü oluştur',
        'Adım 7: Sistemi ölçeklendir',
      ],
      beatPatterns: [
        'Vizyon egzersizi',
        'Analiz çerçevesi',
        'Alışkanlık seçim rehberi',
        'Tetikleyici/ödül tasarımı',
        'Takip sistemi',
        'Geri bildirim formu',
        'Ölçeklendirme planı',
      ],
      deliverablePatterns: [
        'Vizyon şablonu',
        'Analiz formu',
        'Alışkanlık tablosu',
        'Sistem tasarımı',
        'Takip defteri',
        'Geri bildirim formu',
        'Ölçeklendirme planı',
      ],
    },
    beauty: {
      episodeTitles: [
        'Adım 1: Cilt tipini belirle',
        'Adım 2: Temizleyici seç',
        'Adım 3: Nemlendirici + SPF rutini kur',
        'Adım 4: Serum/layer ekle',
        'Adım 5: Haftalık bakım ekle',
        'Adım 6: Makyaj rutini belirle',
        'Adım 7: Cilt bakım takibi başlat',
      ],
      beatPatterns: [
        'Cilt tipi anketi',
        'Temizleyici seçim tablosu',
        'SPF rehberi',
        'Serum katmanlama',
        'Haftalık bakım takvimi',
        'Makyaj rutini',
        'Takip defteri',
      ],
      deliverablePatterns: [
        'Cilt anketi',
        'Temizleyici tablosu',
        'SPF rehberi',
        'Serum tablosu',
        'Bakım takvimi',
        'Makyaj rutini',
        'Cilt takip defteri',
      ],
    },
    _default: {
      episodeTitles: [
        'Adım 1: Hedefini netleştir',
        'Adım 2: Mevcut durumunu analiz et',
        'Adım 3: Temel kurulumu yap',
        'Adım 4: İlk uygulamayı başlat',
        'Adım 5: Sonuçları ölç',
        'Adım 6: İyileştirmeleri uygula',
        'Adım 7: Sistemi kalıcı kıl',
      ],
      beatPatterns: [
        'Hedef worksheet',
        'Analiz çerçevesi',
        'Kurulum rehberi',
        'Başlangıç planı',
        'Ölçüm sistemi',
        'İyileştirme döngüsü',
        'Kalıcılık formülü',
      ],
      deliverablePatterns: [
        'Hedef worksheet',
        'Analiz formu',
        'Kurulum rehberi',
        'Plan şablonu',
        'Ölçüm defteri',
        'İyileştirme kartları',
        'Sürdürülebilirlik planı',
      ],
    },
  },
  case_study: {
    fitness: {
      episodeTitles: [
        'Vaka: Ofis çalışanı 6 ayda -12 kilo',
        'Vaka: Yeni annenin postpartum dönüşü',
        'Vaka: 50+ yaş grubunda güçlenme',
        'Vaka: Maraton koşusunun arkasındaki rutin',
        'Vaka: Sakatlıktan geri dönüş hikayesi',
        'Vaka: Spor salonu fobisini yenen biri',
        'Vaka: Topluluk programı başarısı',
      ],
      beatPatterns: [
        'Profil + hedef + başlangıç durumu',
        'Süreç + uygulanan program',
        'Engelleri aşma + sonuçlar',
        'Uzun vadeli rutin + ipuçları',
        'Hata + düzeltme + final sonuç',
        'Duygusal katmanı + gerçek veri',
        'Çıkarım + topluluk çağrısı',
      ],
      deliverablePatterns: [
        'Profil kartı',
        'Program planı',
        'Engel çözüm listesi',
        'Rutin şablonu',
        'Hata-defter analizi',
        'Duygusal yol haritası',
        'Topluluk posteri',
      ],
    },
    food: {
      episodeTitles: [
        'Vaka: Aylık bütçeyi 40% azaltan aile',
        'Vaka: Catering\'i eve taşıyan çift',
        'Vaka: Öğrencinin 7 günlük menüsü',
        'Vaka: Glutensiz yaşama geçiş',
        'Vaka: Vegan 1 yıl deneyimi',
        'Vaka: Yerel üretici desteği modeli',
        'Vaka: Topluluk menüsü projesi',
      ],
      beatPatterns: [
        'Profil + bütçe analizi',
        'Süreç + tarif dönüşümü',
        'Zaman + maliyet dengesi',
        'Kısıt + alternatif çözümler',
        'Deneyim + öğrenimler',
        'Topluluk + etki',
        'Çıkarım + davet',
      ],
      deliverablePatterns: [
        'Bütçe analizi',
        'Tarif dönüşüm kartları',
        'Menü planı',
        'Alternatif tablosu',
        'Deneyim raporu',
        'Topluluk modeli',
        'Çıkarım posteri',
      ],
    },
    tech: {
      episodeTitles: [
        'Vaka: Solo geliştiricinin SaaS yolculuğu',
        'Vaka: Kurumsal ekibin dönüşümü',
        'Vaka: Açık kaynağa geçiş hikayesi',
        'Vaka: Bootcamp\'ten işe geçiş',
        'Vaka: No-code ile MVP kuran girişimci',
        'Vaka: Kurum içi AI entegrasyonu',
        'Vaka: Topluluk projesinin başarısı',
      ],
      beatPatterns: [
        'Profil + problem',
        'Çözüm + teknik kararlar',
        'Metrikler + ölçüm',
        'Süreç + dersler',
        'Etki + sonuçlar',
        'Kurumsal ölçek + risk',
        'Çıkarım + topluluk',
      ],
      deliverablePatterns: [
        'Profil kartı',
        'Çözüm mimarisi',
        'Metrik paneli',
        'Süreç akışı',
        'Etki raporu',
        'Risk değerlendirme',
        'Çıkarım posteri',
      ],
    },
    fashion: {
      episodeTitles: [
        'Vaka: 6 ayda 33 parçalık kapsüle geçiş',
        'Vaka: Sürdürülebilir marka geçişi',
        'Vaka: Plus-size stil dönüşümü',
        'Vaka: Renk analizi ile gardırop yenilenmesi',
        'Vaka: İkinci el gardırop projesi',
        'Vaka: Mevsim geçiş koleksiyonu',
        'Vaka: Stil topluluğu kurma',
      ],
      beatPatterns: [
        'Profil + başlangıç',
        'Süreç + seçim kriterleri',
        'Sonuç + etki',
        'Renk + vücut analizi',
        'Atık azaltma + sonuç',
        'Mevsim + adaptasyon',
        'Topluluk modeli',
      ],
      deliverablePatterns: [
        'Profil kartı',
        'Seçim çerçevesi',
        'Etki raporu',
        'Renk analizi',
        'Atık ölçümü',
        'Mevsim planı',
        'Topluluk rehberi',
      ],
    },
    travel: {
      episodeTitles: [
        'Vaka: 30 günde 5 ülke gezisi',
        'Vaka: Bütçeyle Japonya turu',
        'Vaka: Aile dostu Avrupa rotası',
        'Vaka: Solo kadın seyahat deneyimi',
        'Vaka: Workation modeli (Lizbon)',
        'Vaka: Slow travel örneği',
        'Vaka: Yerel toplulukla seyahat',
      ],
      beatPatterns: [
        'Profil + rota',
        'Maliyet + optimizasyon',
        'Aile dinamikleri',
        'Güvenlik + planlama',
        'Workation sistemi',
        'Slow yaklaşımı',
        'Yerel etki',
      ],
      deliverablePatterns: [
        'Rota haritası',
        'Bütçe tablosu',
        'Aile planı',
        'Güvenlik rehberi',
        'Workation planı',
        'Slow rehberi',
        'Yerel rehberi',
      ],
    },
    gaming: {
      episodeTitles: [
        'Vaka: Silver\'dan Gold\'a 90 gün',
        'Vaka: Indie oyun geliştiricisinin ilk çıkışı',
        'Vaka: Esports takımı oluşturma',
        'Vaka: 0\'dan 10K takipçiye yayıncı',
        'Vaka: Speedrun dünya rekoru denemesi',
        'Vaka: Mod topluluğu başarısı',
        'Vaka: Oyun-mentorluk programı',
      ],
      beatPatterns: [
        'Profil + başlangıç',
        'Süreç + strateji',
        'Takım + dinamikler',
        'Büyüme + veri',
        'Disiplin + performans',
        'Topluluk + etki',
        'Mentorluk modeli',
      ],
      deliverablePatterns: [
        'Profil kartı',
        'Strateji planı',
        'Takım manifestosu',
        'Büyüme raporu',
        'Antrenman defteri',
        'Topluluk modeli',
        'Mentorluk rehberi',
      ],
    },
    personal_dev: {
      episodeTitles: [
        'Vaka: 1 yılda 1 kitap alışkanlığı',
        'Vaka: Sabah 5 rutinine geçiş',
        'Vaka: Yeni kariyere 6 ayda geçiş',
        'Vaka: Sağlık dönüşümü: kilo + uyku + stres',
        'Vaka: Freelance\'a güvenli geçiş',
        'Vaka: Sosyal anksiyeteden komfor zonesuna',
        'Vaka: Mentorluk zinciri kuran kişi',
      ],
      beatPatterns: [
        'Profil + başlangıç',
        'Süreç + strateji',
        'Plan + uygulama',
        'Sağlık verisi + ölçüm',
        'Mali + risk planı',
        'Psikolojik katman',
        'Topluluk + paylaşım',
      ],
      deliverablePatterns: [
        'Profil kartı',
        'Strateji planı',
        'Kariyer planı',
        'Sağlık raporu',
        'Mali plan',
        'Refah ölçümü',
        'Mentorluk rehberi',
      ],
    },
    beauty: {
      episodeTitles: [
        'Vaka: Akne sonrası cilt onarımı',
        'Vaka: Hassas cilt için minimal rutin',
        'Vaka: 40+ cilt bakım dönüşümü',
        'Vaka: Hormonal cilt döngüsü takibi',
        'Vaka: Makyajdan doğal görünüme geçiş',
        'Vaka: Dermatolog destekli rutin',
        'Vaka: Topluluk bakım alışkanlığı',
      ],
      beatPatterns: [
        'Profil + sorun',
        'Rutin + evrim',
        'Yaş + adaptasyon',
        'Hormonal takvim',
        'Görünüm + felsefe',
        'Uzman + süreç',
        'Topluluk + davet',
      ],
      deliverablePatterns: [
        'Profil kartı',
        'Rutin evrimi',
        'Yaş rehberi',
        'Hormonal takvim',
        'Görünüm haritası',
        'Uzman süreci',
        'Topluluk rehberi',
      ],
    },
    _default: {
      episodeTitles: [
        'Vaka: Sıfırdan başlayan biri',
        'Vaka: Engeli aşan proje',
        'Vaka: 90 günde dönüşüm',
        'Vaka: 1 yıllık sürdürülebilir sonuç',
        'Vaka: Topluluk projesinin etkisi',
        'Vaka: Risk alıp kazanan biri',
        'Vaka: Öğretilen derslerin paketi',
      ],
      beatPatterns: [
        'Profil + bağlam',
        'Süreç + kararlar',
        'Kısa vadeli sonuçlar',
        'Uzun vadeli etki',
        'Topluluk etkisi',
        'Risk + ödül',
        'Çıkarım + ders',
      ],
      deliverablePatterns: [
        'Profil kartı',
        'Karar günlüğü',
        'Kısa vadeli rapor',
        'Uzun vadeli rapor',
        'Topluluk etkisi',
        'Risk değerlendirme',
        'Çıkarım posteri',
      ],
    },
  },
  countdown: {
    fitness: {
      episodeTitles: [
        'Gün 1: Vücut analizini yap',
        'Gün 2: Hedefini yaz',
        'Gün 3: Antrenman planını hazırla',
        'Gün 4: Beslenme temellerini kur',
        'Gün 5: İlk antrenmanı yap',
        'Gün 6: Takip sistemini kur',
        'Gün 7: 7 günlük değerlendirme',
      ],
      beatPatterns: [
        'Sayısal veri toplama',
        'Net ifade yazma',
        'Plan oluşturma',
        'Sistem kurma',
        'İlk aksiyon',
        'Ölçüm başlatma',
        'Değerlendirme + devam kararı',
      ],
      deliverablePatterns: [
        'Vücut ölçüm formu',
        'Hedef kartı',
        'Haftalık plan',
        'Beslenme listesi',
        'Antrenman günlüğü',
        'Takip defteri',
        'Haftalık rapor',
      ],
    },
    food: {
      episodeTitles: [
        'Gün 1: Mutfağı temizle',
        'Gün 2: Temel malzemeleri al',
        'Gün 3: 3 kolay tarifi öğren',
        'Gün 4: Alışveriş planı kur',
        'Gün 5: Market listesini dene',
        'Gün 6: Yeni bir tarif pişir',
        'Gün 7: Haftalık menüyü gözden geçir',
      ],
      beatPatterns: [
        'Fiziksel hazırlık',
        'Alışveriş aksiyonu',
        'Öğrenme + pratik',
        'Sistem kurma',
        'Gerçek dünya testi',
        'Yeni uygulama',
        'Gözden geçirme',
      ],
      deliverablePatterns: [
        'Mutfak temizlik listesi',
        'Alışveriş listesi',
        'Tarif kartları',
        'Market planı',
        'Market test raporu',
        'Yeni tarif defteri',
        'Haftalık gözden geçirme',
      ],
    },
    tech: {
      episodeTitles: [
        'Gün 1: Çalışma alanını kur',
        'Gün 2: Araçları indir',
        'Gün 3: İlk kod satırını yaz',
        'Gün 4: Bir bug çöz',
        'Gün 5: Versiyon kontrolünü başlat',
        'Gün 6: Bir paylaşım yap',
        'Gün 7: Haftalık değerlendirme',
      ],
      beatPatterns: [
        'Ortam kurulumu',
        'Araç kurulumu',
        'İlk aksiyon',
        'Problem çözme',
        'Sistem kurma',
        'Toplulukla paylaşım',
        'Değerlendirme + devam',
      ],
      deliverablePatterns: [
        'Ortam kurulum rehberi',
        'Araç indirme listesi',
        'İlk kod şablonu',
        'Bug çözüm defteri',
        'Git kurulum rehberi',
        'Paylaşım taslağı',
        'Haftalık rapor',
      ],
    },
    fashion: {
      episodeTitles: [
        'Gün 1: Gardırobunu fotoğrafla',
        'Gün 2: Renklerini analiz et',
        'Gün 3: 5 temel parça seç',
        'Gün 4: Yeni bir kombin dene',
        'Gün 5: Aksesuar ekle',
        'Gün 6: Çekim yap',
        'Gün 7: 7 günlük stil günlüğü',
      ],
      beatPatterns: [
        'Görsel envanter',
        'Analiz',
        'Seçim + sadeleştirme',
        'Yaratıcı uygulama',
        'Detaylandırma',
        'Paylaşım',
        'Gözden geçirme',
      ],
      deliverablePatterns: [
        'Gardırop fotoğraf listesi',
        'Renk analizi',
        '5 parça listesi',
        'Kombin defteri',
        'Aksesuar öneri kartı',
        'Çekim rehberi',
        'Stil günlüğü',
      ],
    },
    travel: {
      episodeTitles: [
        'Gün 1: Hedef ülkeyi seç',
        'Gün 2: Bütçeyi belirle',
        'Gün 3: Uçuşları araştır',
        'Gün 4: Konaklama ayarla',
        'Gün 5: Günlük planı çıkar',
        'Gün 6: Yerel deneyim ekle',
        'Gün 7: Son kontrol listesi',
      ],
      beatPatterns: [
        'Karar verme',
        'Mali plan',
        'Rezervasyon araştırma',
        'Konaklama',
        'Planlama',
        'Deneyim ekleme',
        'Son kontrol',
      ],
      deliverablePatterns: [
        'Ülke seçim tablosu',
        'Bütçe dağılımı',
        'Uçuş listesi',
        'Konaklama listesi',
        'Günlük plan',
        'Deneyim listesi',
        'Son kontrol listesi',
      ],
    },
    gaming: {
      episodeTitles: [
        'Gün 1: Oyun profilini kur',
        'Gün 2: Ayarları optimize et',
        'Gün 3: İlk 5 maçı oyna',
        'Gün 4: Bir hile kodunu öğren',
        'Gün 5: Toplulukla tanış',
        'Gün 6: Bir ipucu paylaş',
        'Gün 7: Haftalık gelişim raporu',
      ],
      beatPatterns: [
        'Profil kurma',
        'Teknik optimizasyon',
        'Pratik',
        'Öğrenme',
        'Sosyal bağ',
        'Paylaşım',
        'Değerlendirme',
      ],
      deliverablePatterns: [
        'Profil ayarları',
        'Optimizasyon rehberi',
        'Maç günlüğü',
        'Hile kodu defteri',
        'Topluluk rehberi',
        'Paylaşım taslağı',
        'Gelişim raporu',
      ],
    },
    personal_dev: {
      episodeTitles: [
        'Gün 1: Vizyonunu yaz',
        'Gün 2: Mevcut alışkanlıkları listele',
        'Gün 3: İlk mikro alışkanlığı seç',
        'Gün 4: Tetikleyici tasarla',
        'Gün 5: 30 dakikalık odaklanma dene',
        'Gün 6: Birinden geri bildirim al',
        'Gün 7: Haftalık değerlendirme',
      ],
      beatPatterns: [
        'Vizyon',
        'Analiz',
        'Seçim',
        'Tasarım',
        'Pratik',
        'Geri bildirim',
        'Değerlendirme',
      ],
      deliverablePatterns: [
        'Vizyon kartı',
        'Alışkanlık listesi',
        'Mikro alışkanlık tablosu',
        'Tetikleyici tasarımı',
        'Odaklanma günlüğü',
        'Geri bildirim formu',
        'Haftalık rapor',
      ],
    },
    beauty: {
      episodeTitles: [
        'Gün 1: Cilt tipini belirle',
        'Gün 2: Temizleyici seç',
        'Gün 3: Nemlendirici dene',
        'Gün 4: SPF rutini başlat',
        'Gün 5: Yeni bir serum ekle',
        'Gün 6: Haftalık maske uygula',
        'Gün 7: Cilt takibini gözden geçir',
      ],
      beatPatterns: [
        'Analiz',
        'Seçim',
        'Uygulama',
        'Sistem kurma',
        'Genişletme',
        'Bakım',
        'Değerlendirme',
      ],
      deliverablePatterns: [
        'Cilt anketi',
        'Temizleyici tablosu',
        'Nemlendirici rehberi',
        'SPF rutini',
        'Serum tablosu',
        'Maske takvimi',
        'Cilt takip defteri',
      ],
    },
    _default: {
      episodeTitles: [
        'Gün 1: Hazırlık',
        'Gün 2: Kurulum',
        'Gün 3: İlk uygulama',
        'Gün 4: Geri bildirim al',
        'Gün 5: İyileştir',
        'Gün 6: Paylaş',
        'Gün 7: Değerlendir',
      ],
      beatPatterns: [
        'Hazırlık',
        'Kurulum',
        'Pratik',
        'Geri bildirim',
        'İyileştirme',
        'Paylaşım',
        'Değerlendirme',
      ],
      deliverablePatterns: [
        'Hazırlık listesi',
        'Kurulum rehberi',
        'Pratik günlüğü',
        'Geri bildirim formu',
        'İyileştirme kartları',
        'Paylaşım taslağı',
        'Haftalık rapor',
      ],
    },
  },
  challenge: {
    fitness: {
      episodeTitles: [
        'Gün 1: 10.000 adım',
        'Gün 2: 30 dakika yürüyüş',
        'Gün 3: 15 dakika evde antrenman',
        'Gün 4: 8 bardak su',
        'Gün 5: Şeker yok',
        'Gün 6: 7 saat uyku',
        'Gün 7: Öğrenilenleri paylaş',
      ],
      beatPatterns: [
        'Sayısal hedef',
        'Zamanlı hedef',
        'Mekan bağımsız hedef',
        'Hidrasyon',
        'Diyet kuralı',
        'Uyku düzeni',
        'Paylaşım + yansıtma',
      ],
      deliverablePatterns: [
        'Adım sayacı',
        'Yürüyüş planı',
        'Ev antrenman rehberi',
        'Su takip kartı',
        'Şeker listesi',
        'Uyku günlüğü',
        'Yansıtma raporu',
      ],
    },
    food: {
      episodeTitles: [
        'Gün 1: Ev yemeği',
        'Gün 2: Yeni bir tarif',
        'Gün 3: 5 renkli tabak',
        'Gün 4: Atık sıfır günü',
        'Gün 5: Lokal pazar alışverişi',
        'Gün 6: Su hedefi',
        'Gün 7: Fotoğraf günü',
      ],
      beatPatterns: [
        'Eylem kuralı',
        'Öğrenme',
        'Çeşitlilik',
        'Sürdürülebilirlik',
        'Topluluk',
        'Sağlık',
        'Paylaşım',
      ],
      deliverablePatterns: [
        'Ev yemeği listesi',
        'Yeni tarif defteri',
        'Renkli tabak rehberi',
        'Atık günlüğü',
        'Pazar listesi',
        'Su takip kartı',
        'Fotoğraf panosu',
      ],
    },
    tech: {
      episodeTitles: [
        'Gün 1: 30 dakika öğren',
        'Gün 2: Bir bug çöz',
        'Gün 3: Bir açık kaynağa katkı yap',
        'Gün 4: 1 saat kesintisiz odak',
        'Gün 5: Bir blog yazısı yaz',
        'Gün 6: Bir konferans izle',
        'Gün 7: Toplulukla paylaş',
      ],
      beatPatterns: [
        'Öğrenme zamanı',
        'Pratik',
        'Topluluk katkısı',
        'Odaklanma',
        'Yazılı ifade',
        'İlham',
        'Paylaşım',
      ],
      deliverablePatterns: [
        'Öğrenme günlüğü',
        'Bug defteri',
        'Katkı rehberi',
        'Odaklanma zamanlayıcı',
        'Blog taslağı',
        'Konferans notu',
        'Paylaşım kartı',
      ],
    },
    fashion: {
      episodeTitles: [
        'Gün 1: Gardırop elemeleri',
        'Gün 2: 1 yeni kombin dene',
        'Gün 3: Aksesuar odaklı gün',
        'Gün 4: Sadece 1 renk paleti kullan',
        'Gün 5: Vintage/ikinci el alışveriş',
        'Gün 6: Selfie çekim',
        'Gün 7: Toplulukla paylaş',
      ],
      beatPatterns: [
        'Sadeleştirme',
        'Yaratıcılık',
        'Detaylandırma',
        'Disiplin',
        'Sürdürülebilirlik',
        'Öz ifade',
        'Paylaşım',
      ],
      deliverablePatterns: [
        'Eleme listesi',
        'Kombin defteri',
        'Aksesuar panosu',
        'Renk paleti',
        'Alışveriş listesi',
        'Selfie rehberi',
        'Paylaşım taslağı',
      ],
    },
    travel: {
      episodeTitles: [
        'Gün 1: Yeni yer keşfet',
        'Gün 2: Yerel lezzet dene',
        'Gün 3: Yürüyerek şehir turu',
        'Gün 4: Yerel etkinlik bul',
        'Gün 5: Fotoğraf günü',
        'Gün 6: Yerel ile röportaj',
        'Gün 7: Günlük yaz',
      ],
      beatPatterns: [
        'Keşif',
        'Damak tadı',
        'Aktif tur',
        'Topluluk',
        'Görsel ifade',
        'Bağ kurma',
        'Yazılı kayıt',
      ],
      deliverablePatterns: [
        'Keşif listesi',
        'Lezzet günlüğü',
        'Yürüyüş haritası',
        'Etkinlik listesi',
        'Fotoğraf rehberi',
        'Röportaj soruları',
        'Günlük taslağı',
      ],
    },
    gaming: {
      episodeTitles: [
        'Gün 1: Yeni bir oyun dene',
        'Gün 2: Bir meydan okuma tamamla',
        'Gün 3: Bir rehber yayınla',
        'Gün 4: Bir yayıncı izle',
        'Gün 5: Bir turnuvaya katıl',
        'Gün 6: Ekip kur',
        'Gün 7: Toplulukla paylaş',
      ],
      beatPatterns: [
        'Keşif',
        'Meydan okuma',
        'Öğretim',
        'İlham',
        'Rekabet',
        'İşbirliği',
        'Paylaşım',
      ],
      deliverablePatterns: [
        'Oyun listesi',
        'Meydan okuma listesi',
        'Rehber taslağı',
        'Yayıncı listesi',
        'Turnuva listesi',
        'Ekip manifestosu',
        'Paylaşım kartı',
      ],
    },
    personal_dev: {
      episodeTitles: [
        'Gün 1: 5 dakika meditasyon',
        'Gün 2: Bir günlük sayfası yaz',
        'Gün 3: 30 dakika kitap oku',
        'Gün 4: Birinden öğren',
        'Gün 5: 30 dakika yürüyüş',
        'Gün 6: Bir iyilik yap',
        'Gün 7: Haftalık değerlendirme',
      ],
      beatPatterns: [
        'Farkındalık',
        'Yazılı ifade',
        'Bilgi',
        'Sosyal öğrenme',
        'Fiziksel hareket',
        'Empati',
        'Yansıtma',
      ],
      deliverablePatterns: [
        'Meditasyon rehberi',
        'Günlük şablonu',
        'Okuma listesi',
        'Soru listesi',
        'Yürüyüş planı',
        'İyilik günlüğü',
        'Haftalık rapor',
      ],
    },
    beauty: {
      episodeTitles: [
        'Gün 1: Temizleyici rutini',
        'Gün 2: Nemlendirici değişimi',
        'Gün 3: SPF uygulaması',
        'Gün 4: Maske günü',
        'Gün 5: Dudak bakımı',
        'Gün 6: Makyajsız gün',
        'Gün 7: Fotoğraf karşılaştırması',
      ],
      beatPatterns: [
        'Temel bakım',
        'Ürün değişimi',
        'Koruma',
        'Ek bakım',
        'Detay bakım',
        'Öz kabul',
        'Görsel takip',
      ],
      deliverablePatterns: [
        'Temizleyici rehberi',
        'Nemlendirici tablosu',
        'SPF rehberi',
        'Maske takvimi',
        'Dudak bakım rehberi',
        'Makyajsız gün rehberi',
        'Fotoğraf panosu',
      ],
    },
    _default: {
      episodeTitles: [
        'Gün 1: Yeni bir alışkanlık başlat',
        'Gün 2: Küçük bir adım at',
        'Gün 3: Birinden öğren',
        'Gün 4: Bir şey paylaş',
        'Gün 5: Bir risk al',
        'Gün 6: Bir iyilik yap',
        'Gün 7: Haftayı değerlendir',
      ],
      beatPatterns: [
        'Başlangıç',
        'Aksiyon',
        'Öğrenme',
        'Paylaşım',
        'Cesaret',
        'Empati',
        'Yansıtma',
      ],
      deliverablePatterns: [
        'Alışkanlık tablosu',
        'Adım günlüğü',
        'Öğrenme notu',
        'Paylaşım taslağı',
        'Risk değerlendirme',
        'İyilik günlüğü',
        'Haftalık rapor',
      ],
    },
  },
};

const SERIES_HOOKS: Record<string, string[]> = {
  educational: [
    'Bilmen gereken ilk şey:',
    'Çoğu kişi bu temeli atlıyor.',
    'Adım adım göstereceğim.',
  ],
  myth_busting: [
    'Yıllardır sana yalan söylediler.',
    'İşte gerçek:',
    'Efsane mi gerçek mi? Kanıtlayalım.',
  ],
  story_journey: [
    'Başlangıçta kimse inanmıyordu.',
    'İşte yolculuğum:',
    'Dönüşümün arkasındaki hikaye.',
  ],
  step_by_step: [
    'İlk adım çok basit.',
    'Bugün başlayacaksın.',
    'Sana 7 net adım.',
  ],
  case_study: [
    'Gerçek bir hikaye.',
    'İşte kanıtlanmış yöntem:',
    'Sıfırdan zirveye.',
  ],
  countdown: [
    'Bugün 1. gün.',
    'Hazır mısın?',
    'Sadece 7 gün.',
  ],
  challenge: [
    '7 gün boyunca benimle.',
    'Bugünkü meydan okuma:',
    'Bunu yapabilecek misin?',
  ],
  _default: [
    'Bu seriye hoş geldin.',
    'Hazırsan başlayalım.',
    'İşte plan:',
  ],
};

const SERIES_CLIFFHANGERS = [
  'Yarın daha derine ineceğiz.',
  'Sıradaki bölümde sürpriz konuk.',
  'Bir sonraki adım kritik.',
  'Bunu okuduysan hazırsın.',
  'Devamı gelecek.',
  'Bölüm sonunda tek bir soru.',
  'Bir sonraki günde final.',
];

const SERIES_CTAS = [
  'Kaydet, bir daha lazım olacak.',
  'Yorumda deneyimini paylaş.',
  'Paylaş, bir arkadaşın da öğrensin.',
  'Seriye abone ol.',
  'Hangi bölümü istersin?',
  'Bugün adım at.',
];

const PSEUDO_RANDOM_R57 = (seed: number) => {
  const x = Math.sin(seed * 1.7) * 10000;
  return x - Math.floor(x);
};

export type ContentSeries = {
  id: string;
  niche: NicheId | null;
  arc: SeriesArc;
  topic: string;
  audience: string;
  episodes: Episode[];
  seriesHook: string;
  createdAt: number;
};

export const buildContentSeries = (
  niche: NicheId | null,
  arc: SeriesArc,
  topic: string,
  audience: string,
  episodeCount: number = 7,
  seedBase = Date.now()
): ContentSeries => {
  const nicheKey = niche ?? '_default';
  const arcData = SERIES_CONTENT[arc] ?? SERIES_CONTENT.educational;
  const content = arcData[nicheKey] ?? arcData._default;
  const formats: EpisodeFormat[] = ['reel', 'carousel', 'caption', 'thread', 'story', 'video', 'blog'];
  const seriesHook = (SERIES_HOOKS[arc] ?? SERIES_HOOKS._default)[Math.floor(PSEUDO_RANDOM_R57(seedBase + 5) * 3)];

  const episodes: Episode[] = [];
  for (let i = 0; i < episodeCount; i++) {
    const idx = i % content.episodeTitles.length;
    const seed = seedBase + i * 31;
    episodes.push({
      index: i + 1,
      title: content.episodeTitles[idx],
      hook: (SERIES_HOOKS[arc] ?? SERIES_HOOKS._default)[i % 3],
      format: formats[i % formats.length],
      beat: content.beatPatterns[idx],
      deliverable: content.deliverablePatterns[idx],
      cta: SERIES_CTAS[i % SERIES_CTAS.length],
      cliffhanger: SERIES_CLIFFHANGERS[i % SERIES_CLIFFHANGERS.length],
    });
  }

  return {
    id: `series-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    niche,
    arc,
    topic: topic.trim() || 'Seri konusu',
    audience: audience.trim() || 'Genel kitle',
    episodes,
    seriesHook,
    createdAt: Date.now(),
  };
};

const SERIES_KEY = '@content-coach/content-series';

export const saveContentSeries = async (series: ContentSeries): Promise<ContentSeries[]> => {
  const current = await getContentSeriesList();
  const next = [series, ...current.filter((s) => s.id !== series.id)].slice(0, 12);
  await AsyncStorage.setItem(SERIES_KEY, JSON.stringify(next));
  return next;
};

export const getContentSeriesList = async (): Promise<ContentSeries[]> => {
  try {
    const raw = await AsyncStorage.getItem(SERIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: any): e is ContentSeries =>
        e &&
        typeof e.id === 'string' &&
        typeof e.topic === 'string' &&
        Array.isArray(e.episodes) &&
        e.episodes.length > 0
    );
  } catch {
    return [];
  }
};

export const removeContentSeries = async (id: string): Promise<ContentSeries[]> => {
  const current = await getContentSeriesList();
  const next = current.filter((s) => s.id !== id);
  await AsyncStorage.setItem(SERIES_KEY, JSON.stringify(next));
  return next;
};

export const clearContentSeries = async (): Promise<void> => {
  await AsyncStorage.removeItem(SERIES_KEY);
};

export const getEpisodeCount = (arc: SeriesArc): number => 7;

export const getArcLabel = (arc: SeriesArc): string => SERIES_ARCS.find((a) => a.id === arc)?.label ?? arc;

// ---------- Round 58: Audience Persona Builder ----------
export type PersonaSegment =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'returning'
  | 'casual'
  | 'pro_shopper';

export const PERSONA_SEGMENTS: { id: PersonaSegment; label: string; emoji: string; hint: string; color: string }[] = [
  { id: 'beginner', label: 'Yeni Başlayan', emoji: '🌱', hint: 'Hiç bilgisi yok, temel sorular', color: '#10B981' },
  { id: 'intermediate', label: 'Orta Seviye', emoji: '⚙️', hint: 'Temel bilgisi var, ilerlemek istiyor', color: '#0EA5E9' },
  { id: 'advanced', label: 'İleri Seviye', emoji: '🚀', hint: 'Deneyimli, ince ayar arıyor', color: '#8B5CF6' },
  { id: 'returning', label: 'Dönen Kullanıcı', emoji: '🔁', hint: 'Ara verip geri dönen', color: '#F59E0B' },
  { id: 'casual', label: 'Rahat Tüketici', emoji: '☕', hint: 'Hızlı tüketir, derine inmez', color: '#EC4899' },
  { id: 'pro_shopper', label: 'Pro Alıcı', emoji: '💎', hint: 'Yatırım yapmaya hazır', color: '#EF4444' },
];

export type PersonaAge = 'gen_z' | 'millennial' | 'gen_x' | 'boomer';

export const PERSONA_AGES: { id: PersonaAge; label: string; range: string; emoji: string }[] = [
  { id: 'gen_z', label: 'Gen Z', range: '18-25', emoji: '🎮' },
  { id: 'millennial', label: 'Millennial', range: '26-40', emoji: '💼' },
  { id: 'gen_x', label: 'Gen X', range: '41-55', emoji: '🏡' },
  { id: 'boomer', label: 'Boomer', range: '56+', emoji: '🌳' },
];

export type PersonaGoal = 'learn' | 'buy' | 'connect' | 'entertain' | 'transform' | 'inspire';

export const PERSONA_GOALS: { id: PersonaGoal; label: string; emoji: string }[] = [
  { id: 'learn', label: 'Öğrenmek', emoji: '🎓' },
  { id: 'buy', label: 'Satın Almak', emoji: '🛒' },
  { id: 'connect', label: 'Bağ Kurmak', emoji: '🤝' },
  { id: 'entertain', label: 'Eğlenmek', emoji: '🎉' },
  { id: 'transform', label: 'Dönüşmek', emoji: '🦋' },
  { id: 'inspire', label: 'İlham Almak', emoji: '✨' },
];

export type PersonaTone = 'friendly' | 'expert' | 'casual' | 'motivational' | 'educational' | 'edgy';

export const PERSONA_TONES: { id: PersonaTone; label: string; emoji: string; example: string }[] = [
  { id: 'friendly', label: 'Samimi', emoji: '🤗', example: 'Seninle birlikte öğreniyorum.' },
  { id: 'expert', label: 'Uzman', emoji: '🎓', example: 'Veriler gösteriyor ki...' },
  { id: 'casual', label: 'Rahat', emoji: '☕', example: 'Şimdi anlatayım.' },
  { id: 'motivational', label: 'Motivasyon', emoji: '🔥', example: 'Sen de yapabilirsin.' },
  { id: 'educational', label: 'Eğitici', emoji: '📚', example: 'Önce şunu bil.' },
  { id: 'edgy', label: 'Cesur', emoji: '⚡', example: 'Sektörün yalan söylediği şey.' },
];

export type Persona = {
  id: string;
  niche: NicheId | null;
  name: string;
  age: PersonaAge;
  segment: PersonaSegment;
  goals: PersonaGoal[];
  tone: PersonaTone;
  painPoints: string[];
  desires: string[];
  vocabulary: string[];
  avoidWords: string[];
  preferredFormats: string[];
  hookPattern: string;
  ctaPattern: string;
  bio: string;
  createdAt: number;
};

const PAIN_BY_NICHE: Record<string, string[]> = {
  fitness: ['Motivasyon eksikliği', 'Yanlış teknik', 'Plato', 'Zaman yetersizliği', 'Supplement kafası'],
  food: ['Hızlı tarif eksikliği', 'Malzeme bulamama', 'Sağlıklı tercih', 'Alışveriş planı', 'Atık yönetimi'],
  tech: ['Hangi araç?', 'Bilgi kirliliği', 'Kurulum zorluğu', 'Verimlilik kaybı', 'Güncel kalmak'],
  fashion: ['Beden uyumu', 'Renk seçimi', 'Bütçe', 'Kombin zorluğu', 'Trend takibi'],
  travel: ['Bütçe', 'Zaman', 'Güvenlik', 'Rezervasyon', 'Yerel deneyim'],
  gaming: ['Yükseltme', 'Ekipman', 'Topluluk', 'Rekabet', 'Zaman yönetimi'],
  personal_dev: ['Tutarsızlık', 'Motivasyon', 'Hedef belirsizliği', 'Zaman', 'Ölçüm'],
  beauty: ['Cilt tipi', 'Ürün seçimi', 'Rutin kurma', 'Bütçe', 'İçerik okuma'],
  _default: ['Bilgi eksikliği', 'Motivasyon', 'Zaman', 'Bütçe', 'Net yön bulamama'],
};

const DESIRES_BY_NICHE: Record<string, string[]> = {
  fitness: ['Sürdürülebilir rutin', 'Görünür sonuç', 'Ölçülebilir ilerleme', 'Enerji artışı', 'Özgüven'],
  food: ['Hızlı & lezzetli', 'Sağlıklı tercih', 'Bütçe kontrolü', 'Yeni tatlar', 'Aile memnuniyeti'],
  tech: ['Verimlilik', 'Otomasyon', 'Güncel kalmak', 'Maliyet tasarrufu', 'Yeni beceri'],
  fashion: ['Stil kimliği', 'Doğru parça', 'Minimal gardırop', 'Özgüven', 'Sürdürülebilirlik'],
  travel: ['Keşif', 'Yerel deneyim', 'Bütçe dostu', 'Fotoğraf', 'Kültürel zenginlik'],
  gaming: ['Rekabetçi başarı', 'Topluluk', 'Ekipman yükseltme', 'Turnuva', 'Yayıncılık'],
  personal_dev: ['Net hedef', 'Disiplin', 'İç huzur', 'Verimlilik', 'Pozitif değişim'],
  beauty: ['Sağlıklı cilt', 'Rutin', 'Güven', 'Bütçe uyumu', 'Doğal görünüm'],
  _default: ['Hızlı çözüm', 'Net yön', 'Topluluk', 'İlham', 'Somut sonuç'],
};

const VOCAB_BY_NICHE: Record<string, string[]> = {
  fitness: ['set', 'tekrar', 'split', 'PR', 'protein', 'hidrasyon', 'cardio', 'form'],
  food: ['tarif', 'malzeme', 'pişirme', 'lezzet', 'tabak', 'sos', 'marine', 'sıcaklık'],
  tech: ['kod', 'repo', 'deploy', 'API', 'workflow', 'verimlilik', 'stack', 'CLI'],
  fashion: ['kombin', 'parça', 'kapsül', 'palet', 'aksesuar', 'silüet', 'katman', 'profil'],
  travel: ['rota', 'konaklama', 'bütçe', 'yerel', 'günübirlik', 'valiz', 'pasaport', 'deneyim'],
  gaming: ['rank', 'meta', 'build', 'loadout', 'FPS', 'sensitivity', 'clutch', 'rotation'],
  personal_dev: ['alışkanlık', 'rutin', 'vizyon', 'odak', 'tetikleyici', 'sistem', 'derin çalışma', 'geri bildirim'],
  beauty: ['rutin', 'serum', 'SPF', 'aktif içerik', 'temizleyici', 'tabaka', 'nemlendirici', 'makyaj'],
  _default: ['adım', 'plan', 'sistem', 'rutin', 'hedef', 'sonuç', 'deneyim', 'topluluk'],
};

const AVOID_BY_NICHE: Record<string, string[]> = {
  fitness: ['hızlı sonuç', 'mucize', 'sihir'],
  food: ['diyet yemek', 'sağlıksız'],
  tech: ['kolay yol', 'bedava'],
  fashion: ['moda kuralları', 'herkes giyer'],
  travel: ['turistik', 'aşırı pahalı'],
  gaming: ['hile', 'kolay rank'],
  personal_dev: ['hızlı motivasyon', '10x'],
  beauty: ['mucize krem', 'kimyasal'],
  _default: ['garanti', 'sihirli formül'],
};

const HOOK_PATTERNS: Record<PersonaTone, string> = {
  friendly: 'Selam! Bugün seninle {topic} hakkında konuşacağız. Hazır mısın?',
  expert: 'Araştırmalar gösteriyor ki {topic} konusunda kritik bir nokta var.',
  casual: 'Şöyle bir şey düşündüm: {topic}. Bence önemli.',
  motivational: 'Bugün {topic} ile bir adım atıyorsun. Hadi başlayalım!',
  educational: 'Önce şunu bil: {topic} hakkında en yaygın 3 yanlış.',
  edgy: 'Sektör sana {topic} hakkında yalan söyledi.',
};

const CTA_PATTERNS: Record<PersonaTone, string> = {
  friendly: 'Beğendiysen kaydet, bir arkadaşınla paylaş!',
  expert: 'Daha fazla veri için takipte kal.',
  casual: 'Yorumda düşünceni merak ediyorum.',
  motivational: 'Bugün ilk adımı at. Paylaş, birlikte başaralım.',
  educational: 'Bu seriyi kaydet, sonraki bölümlerde daha derine ineceğiz.',
  edgy: 'Eğer katılıyorsan paylaş. Eğer katılmıyorsan yorumda tartış.',
};

const FORMAT_BY_SEGMENT: Record<PersonaSegment, string[]> = {
  beginner: ['Reels (kısa)', 'Carousel (adım adım)', 'Caption (örnekli)'],
  intermediate: ['Reels (orta uzunluk)', 'Carousel (karşılaştırma)', 'Thread (liste)'],
  advanced: ['Long-form', 'Carousel (derin)', 'Blog'],
  returning: ['Story (hatırlatma)', 'Reels (kısa recap)', 'Caption (merhaba)'],
  casual: ['Reels (eğlenceli)', 'Story', 'Meme caption'],
  pro_shopper: ['Carousel (detaylı)', 'Blog (inceleme)', 'Thread (karşılaştırma)'],
};

const PSEUDO_RANDOM_R58 = (seed: number) => {
  const x = Math.sin(seed * 2.3) * 10000;
  return x - Math.floor(x);
};

export const buildPersona = (
  niche: NicheId | null,
  name: string,
  age: PersonaAge,
  segment: PersonaSegment,
  goals: PersonaGoal[],
  tone: PersonaTone,
  seedBase = Date.now()
): Persona => {
  const nicheKey = niche ?? '_default';
  const seed = seedBase % 9973;

  const pickN = <T,>(arr: T[], n: number, salt: number): T[] => {
    const result: T[] = [];
    const startIdx = Math.floor(PSEUDO_RANDOM_R58(seed + salt) * arr.length);
    for (let i = 0; i < n && i < arr.length; i++) {
      const item = arr[(startIdx + i) % arr.length];
      if (!result.includes(item)) result.push(item);
    }
    return result;
  };

  const painPoints = pickN(PAIN_BY_NICHE[nicheKey] ?? PAIN_BY_NICHE._default, 4, 7);
  const desires = pickN(DESIRES_BY_NICHE[nicheKey] ?? DESIRES_BY_NICHE._default, 4, 13);
  const vocabulary = pickN(VOCAB_BY_NICHE[nicheKey] ?? VOCAB_BY_NICHE._default, 6, 19);
  const avoidWords = pickN(AVOID_BY_NICHE[nicheKey] ?? AVOID_BY_NICHE._default, 3, 31);

  const ageLabel = PERSONA_AGES.find((a) => a.id === age)?.label ?? age;
  const segLabel = PERSONA_SEGMENTS.find((s) => s.id === segment)?.label ?? segment;
  const goalLabels = goals.map((g) => PERSONA_GOALS.find((pg) => pg.id === g)?.label ?? g);

  const bio = `${name}, ${ageLabel} yaş grubunda, ${segLabel.toLowerCase()} seviyede biri. ${goalLabels.join(', ')} arıyor. ${painPoints[0] ?? 'bir sorunu'} ile boğuşuyor, ${desires[0] ?? 'bir hedefe'} ulaşmak istiyor. ${tone === 'friendly' ? 'Samimi ve rahat' : tone === 'expert' ? 'Veri odaklı' : tone === 'edgy' ? 'Cesur ve sorgulayıcı' : 'Destekleyici'} bir tonla içerik tüketiyor.`;

  return {
    id: `persona-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    niche,
    name: name.trim() || 'İdeal Kitle',
    age,
    segment,
    goals,
    tone,
    painPoints,
    desires,
    vocabulary,
    avoidWords,
    preferredFormats: FORMAT_BY_SEGMENT[segment] ?? FORMAT_BY_SEGMENT.intermediate,
    hookPattern: HOOK_PATTERNS[tone],
    ctaPattern: CTA_PATTERNS[tone],
    bio,
    createdAt: Date.now(),
  };
};

const PERSONA_KEY = '@content-coach/persona';

export const savePersona = async (persona: Persona): Promise<Persona[]> => {
  const current = await getPersonaList();
  const next = [persona, ...current.filter((p) => p.id !== persona.id)].slice(0, 8);
  await AsyncStorage.setItem(PERSONA_KEY, JSON.stringify(next));
  return next;
};

export const getPersonaList = async (): Promise<Persona[]> => {
  try {
    const raw = await AsyncStorage.getItem(PERSONA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: any): e is Persona =>
        e &&
        typeof e.id === 'string' &&
        typeof e.name === 'string' &&
        Array.isArray(e.goals)
    );
  } catch {
    return [];
  }
};

export const removePersona = async (id: string): Promise<Persona[]> => {
  const current = await getPersonaList();
  const next = current.filter((p) => p.id !== id);
  await AsyncStorage.setItem(PERSONA_KEY, JSON.stringify(next));
  return next;
};

export const clearPersonas = async (): Promise<void> => {
  await AsyncStorage.removeItem(PERSONA_KEY);
};

export const PERSONA_SEGMENT_LIST = PERSONA_SEGMENTS;
export const PERSONA_AGE_LIST = PERSONA_AGES;
export const PERSONA_GOAL_LIST = PERSONA_GOALS;
export const PERSONA_TONE_LIST = PERSONA_TONES;

// ---------- Round 59: Content Performance Tracker ----------
export type PerfPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'pinterest' | 'threads' | 'blog';

export const PERF_PLATFORMS: { id: PerfPlatform; label: string; emoji: string; color: string }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: '#000000' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', color: '#FF0000' },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌', color: '#E60023' },
  { id: 'threads', label: 'Threads', emoji: '🧵', color: '#000000' },
  { id: 'blog', label: 'Blog', emoji: '📝', color: '#10B981' },
];

export type PerfFormat = 'reel' | 'carousel' | 'caption' | 'thread' | 'story' | 'video' | 'blog' | 'live';

export const PERF_FORMATS: { id: PerfFormat; label: string; emoji: string }[] = [
  { id: 'reel', label: 'Reels', emoji: '🎬' },
  { id: 'carousel', label: 'Carousel', emoji: '📑' },
  { id: 'caption', label: 'Caption', emoji: '💬' },
  { id: 'thread', label: 'Thread', emoji: '🧵' },
  { id: 'story', label: 'Story', emoji: '📱' },
  { id: 'video', label: 'Long video', emoji: '🎥' },
  { id: 'blog', label: 'Blog', emoji: '📝' },
  { id: 'live', label: 'Canlı', emoji: '🔴' },
];

export type PerfOutcome = 'high' | 'medium' | 'low';

export const PERF_OUTCOMES: { id: PerfOutcome; label: string; emoji: string; color: string; bg: string }[] = [
  { id: 'high', label: 'Yüksek performans', emoji: '🚀', color: '#10B981', bg: '#D1FAE5' },
  { id: 'medium', label: 'Orta performans', emoji: '📊', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'low', label: 'Düşük performans', emoji: '🌧', color: '#94A3B8', bg: '#F1F5F9' },
];

export type PerfEntry = {
  id: string;
  niche: NicheId | null;
  platform: PerfPlatform;
  format: PerfFormat;
  topic: string;
  hookText: string;
  outcome: PerfOutcome;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  postedAt: number;
  notes: string;
};

export type PerfInsights = {
  totalPosts: number;
  totalViews: number;
  totalEngagement: number;
  avgEngagementRate: number;
  bestPlatform: PerfPlatform | null;
  bestFormat: PerfFormat | null;
  bestOutcome: PerfOutcome | null;
  bestHookScore: number;
  topTopics: { topic: string; score: number }[];
  platformBreakdown: { platform: PerfPlatform; count: number; totalViews: number; avgEngagement: number }[];
  formatBreakdown: { format: PerfFormat; count: number; avgEngagement: number }[];
  hookPatterns: { pattern: string; count: number; avgScore: number }[];
};

const HOOK_SIGNALS = [
  { pattern: 'sayı ile başlıyor', test: /^\d|^%|^[0-9]/ },
  { pattern: 'soru ile başlıyor', test: /^(ne|neden|nasıl|kim|hangi|kaç|nereye|ne zaman)/i },
  { pattern: '"Yapma" / olumsuz', test: /(yapma|dur|asla|sakın|olmaz|kötü|yanlış|hata)/i },
  { pattern: 'listeleme vaadi', test: /(sırr|adım|ipucu|yöntem|taktik|rehber|liste)/i },
  { pattern: 'kişisel hitap', test: /(sen|siz|senin|seninle)/i },
  { pattern: 'merak boşluğu', test: /(sır|kimse|asla|gizli|şaşırtıcı)/i },
];

const classifyHook = (text: string): string => {
  for (const s of HOOK_SIGNALS) {
    if (s.test.test(text)) return s.pattern;
  }
  return 'genel';
};

export const calcPerfScore = (e: PerfEntry): number => {
  const eng = e.likes + e.comments + e.shares + e.saves;
  if (e.views === 0) return 0;
  const rate = (eng / e.views) * 100;
  if (e.outcome === 'high') return Math.min(100, rate * 12 + 25);
  if (e.outcome === 'medium') return Math.min(100, rate * 8 + 12);
  return Math.min(60, rate * 5);
};

export type PerfStats = {
  totalPosts: number;
  totalViews: number;
  totalEngagement: number;
  avgEngagementRate: number;
  bestPlatform: PerfPlatform | null;
  bestFormat: PerfFormat | null;
  outcomeCounts: Record<PerfOutcome, number>;
  recentTrend: 'up' | 'down' | 'flat';
};

export const calcPerfStats = (entries: PerfEntry[]): PerfStats => {
  if (entries.length === 0) {
    return {
      totalPosts: 0,
      totalViews: 0,
      totalEngagement: 0,
      avgEngagementRate: 0,
      bestPlatform: null,
      bestFormat: null,
      outcomeCounts: { high: 0, medium: 0, low: 0 },
      recentTrend: 'flat',
    };
  }

  const totalPosts = entries.length;
  const totalViews = entries.reduce((a, e) => a + e.views, 0);
  const totalEngagement = entries.reduce(
    (a, e) => a + e.likes + e.comments + e.shares + e.saves,
    0
  );
  const avgEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

  const platformScores: Record<string, { count: number; score: number }> = {};
  const formatScores: Record<string, { count: number; score: number }> = {};
  for (const e of entries) {
    const s = calcPerfScore(e);
    if (!platformScores[e.platform]) platformScores[e.platform] = { count: 0, score: 0 };
    platformScores[e.platform].count++;
    platformScores[e.platform].score += s;
    if (!formatScores[e.format]) formatScores[e.format] = { count: 0, score: 0 };
    formatScores[e.format].count++;
    formatScores[e.format].score += s;
  }

  let bestPlatform: PerfPlatform | null = null;
  let bestPlatformScore = -1;
  for (const [p, v] of Object.entries(platformScores)) {
    const avg = v.score / v.count;
    if (avg > bestPlatformScore) {
      bestPlatformScore = avg;
      bestPlatform = p as PerfPlatform;
    }
  }

  let bestFormat: PerfFormat | null = null;
  let bestFormatScore = -1;
  for (const [f, v] of Object.entries(formatScores)) {
    const avg = v.score / v.count;
    if (avg > bestFormatScore) {
      bestFormatScore = avg;
      bestFormat = f as PerfFormat;
    }
  }

  const outcomeCounts: Record<PerfOutcome, number> = { high: 0, medium: 0, low: 0 };
  for (const e of entries) outcomeCounts[e.outcome]++;

  const sortedByDate = [...entries].sort((a, b) => b.postedAt - a.postedAt);
  const recent = sortedByDate.slice(0, Math.max(2, Math.floor(sortedByDate.length / 3)));
  const recentAvg = recent.reduce((a, e) => a + calcPerfScore(e), 0) / recent.length;
  const olderAvg =
    sortedByDate.length > recent.length
      ? sortedByDate.slice(recent.length).reduce((a, e) => a + calcPerfScore(e), 0) /
        (sortedByDate.length - recent.length)
      : recentAvg;
  const diff = recentAvg - olderAvg;
  const recentTrend: 'up' | 'down' | 'flat' = diff > 5 ? 'up' : diff < -5 ? 'down' : 'flat';

  return {
    totalPosts,
    totalViews,
    totalEngagement,
    avgEngagementRate,
    bestPlatform,
    bestFormat,
    outcomeCounts,
    recentTrend,
  };
};

export const buildPerfInsights = (entries: PerfEntry[]): PerfInsights => {
  const stats = calcPerfStats(entries);
  if (entries.length === 0) {
    return {
      totalPosts: 0,
      totalViews: 0,
      totalEngagement: 0,
      avgEngagementRate: 0,
      bestPlatform: null,
      bestFormat: null,
      bestOutcome: null,
      bestHookScore: 0,
      topTopics: [],
      platformBreakdown: [],
      formatBreakdown: [],
      hookPatterns: [],
    };
  }

  const topicScores: Record<string, { count: number; score: number }> = {};
  for (const e of entries) {
    const key = e.topic.toLowerCase().trim().slice(0, 40);
    if (!key) continue;
    if (!topicScores[key]) topicScores[key] = { count: 0, score: 0 };
    topicScores[key].count++;
    topicScores[key].score += calcPerfScore(e);
  }
  const topTopics = Object.entries(topicScores)
    .map(([topic, v]) => ({ topic, score: v.score / v.count }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const platformMap: Record<string, { count: number; totalViews: number; eng: number }> = {};
  for (const e of entries) {
    if (!platformMap[e.platform]) platformMap[e.platform] = { count: 0, totalViews: 0, eng: 0 };
    platformMap[e.platform].count++;
    platformMap[e.platform].totalViews += e.views;
    platformMap[e.platform].eng += e.likes + e.comments + e.shares + e.saves;
  }
  const platformBreakdown = Object.entries(platformMap).map(([p, v]) => ({
    platform: p as PerfPlatform,
    count: v.count,
    totalViews: v.totalViews,
    avgEngagement: v.totalViews > 0 ? (v.eng / v.totalViews) * 100 : 0,
  }));

  const formatMap: Record<string, { count: number; eng: number; views: number }> = {};
  for (const e of entries) {
    if (!formatMap[e.format]) formatMap[e.format] = { count: 0, eng: 0, views: 0 };
    formatMap[e.format].count++;
    formatMap[e.format].eng += e.likes + e.comments + e.shares + e.saves;
    formatMap[e.format].views += e.views;
  }
  const formatBreakdown = Object.entries(formatMap).map(([f, v]) => ({
    format: f as PerfFormat,
    count: v.count,
    avgEngagement: v.views > 0 ? (v.eng / v.views) * 100 : 0,
  }));

  const hookMap: Record<string, { count: number; score: number }> = {};
  for (const e of entries) {
    const p = classifyHook(e.hookText);
    if (!hookMap[p]) hookMap[p] = { count: 0, score: 0 };
    hookMap[p].count++;
    hookMap[p].score += calcPerfScore(e);
  }
  const hookPatterns = Object.entries(hookMap)
    .map(([pattern, v]) => ({ pattern, count: v.count, avgScore: v.score / v.count }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const bestOutcome: PerfOutcome | null =
    stats.outcomeCounts.high >= stats.outcomeCounts.medium &&
    stats.outcomeCounts.high >= stats.outcomeCounts.low
      ? 'high'
      : stats.outcomeCounts.medium >= stats.outcomeCounts.low
        ? 'medium'
        : 'low';

  const bestHookScore = hookPatterns.length > 0 ? hookPatterns[0].avgScore : 0;

  return {
    totalPosts: stats.totalPosts,
    totalViews: stats.totalViews,
    totalEngagement: stats.totalEngagement,
    avgEngagementRate: stats.avgEngagementRate,
    bestPlatform: stats.bestPlatform,
    bestFormat: stats.bestFormat,
    bestOutcome,
    bestHookScore,
    topTopics,
    platformBreakdown,
    formatBreakdown,
    hookPatterns,
  };
};

const PERF_KEY = '@content-coach/perf-entries';

export const savePerfEntry = async (entry: PerfEntry): Promise<PerfEntry[]> => {
  const current = await getPerfEntries();
  const next = [entry, ...current.filter((e) => e.id !== entry.id)].slice(0, 50);
  await AsyncStorage.setItem(PERF_KEY, JSON.stringify(next));
  return next;
};

export const getPerfEntries = async (): Promise<PerfEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(PERF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: any): e is PerfEntry =>
        e &&
        typeof e.id === 'string' &&
        typeof e.platform === 'string' &&
        typeof e.format === 'string' &&
        typeof e.outcome === 'string' &&
        typeof e.views === 'number'
    );
  } catch {
    return [];
  }
};

export const removePerfEntry = async (id: string): Promise<PerfEntry[]> => {
  const current = await getPerfEntries();
  const next = current.filter((e) => e.id !== id);
  await AsyncStorage.setItem(PERF_KEY, JSON.stringify(next));
  return next;
};

export const clearPerfEntries = async (): Promise<void> => {
  await AsyncStorage.removeItem(PERF_KEY);
};

export const seedPerfDemoData = async (): Promise<PerfEntry[]> => {
  const current = await getPerfEntries();
  if (current.length > 0) return current;

  const platforms: PerfPlatform[] = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'];
  const formats: PerfFormat[] = ['reel', 'carousel', 'caption', 'thread', 'video'];
  const outcomes: PerfOutcome[] = ['high', 'high', 'medium', 'medium', 'low'];
  const hooks = [
    '7 günde vücudun değişsin',
    'Bu malzemeyi çöpe atıyorsun',
    'Yapay zeka ile 10 kat hızlan',
    'Moda değil, orantı önemli',
    'Sabah 5 dakika yeter',
    'Bu cilt bakım hatası seni yaşlandırıyor',
    'Disiplin mi motivasyon mu?',
    'FPS ayarı sırrı',
  ];
  const topics = [
    'Sabah rutini',
    'Tarif ipucu',
    'AI workflow',
    'Stil rehberi',
    'Cilt bakım',
    'Fitness split',
    'Oyun taktiği',
    'Seyahat rotası',
  ];

  const now = Date.now();
  const demo: PerfEntry[] = [];
  for (let i = 0; i < 12; i++) {
    const views = 1000 + Math.floor(Math.random() * 40000);
    const engRate = 0.02 + Math.random() * 0.08;
    const engTotal = Math.floor(views * engRate);
    demo.push({
      id: `perf-demo-${i}-${Math.random().toString(36).slice(2, 6)}`,
      niche: 'fitness',
      platform: platforms[i % platforms.length],
      format: formats[i % formats.length],
      topic: topics[i % topics.length],
      hookText: hooks[i % hooks.length],
      outcome: outcomes[i % outcomes.length],
      views,
      likes: Math.floor(engTotal * 0.7),
      comments: Math.floor(engTotal * 0.1),
      shares: Math.floor(engTotal * 0.1),
      saves: Math.floor(engTotal * 0.1),
      postedAt: now - i * 86400000 * 3,
      notes: '',
    });
  }
  await AsyncStorage.setItem(PERF_KEY, JSON.stringify(demo));
  return demo;
};

// ============================================================================
// ROUND 60 — Idea Bank / Fikir Havuzu
// ============================================================================

export type IdeaStatus = 'raw' | 'developing' | 'ready' | 'used' | 'archived';

export type IdeaAngle = 'tutorial' | 'story' | 'listicle' | 'opinion' | 'myth' | 'tip' | 'question' | 'news';

export type Idea = {
  id: string;
  title: string;
  description: string;
  angle: IdeaAngle;
  status: IdeaStatus;
  tags: string[];
  hookIdea: string;
  format: string;
  estimatedReach: 'low' | 'medium' | 'high' | 'viral';
  priority: 1 | 2 | 3 | 4 | 5;
  notes: string;
  source: 'manual' | 'trending' | 'audience_question' | 'repurpose' | 'series';
  createdAt: number;
  updatedAt: number;
  usedAt: number | null;
};

const IDEA_BANK_KEY = '@content-coach/idea-bank';

export const IDEA_ANGLES: { id: IdeaAngle; label: string; emoji: string; hint: string; color: string }[] = [
  { id: 'tutorial', label: 'Nasıl Yapılır', emoji: '📚', hint: 'Adım adım öğretici', color: '#0EA5E9' },
  { id: 'story', label: 'Hikaye', emoji: '📖', hint: 'Kişisel deneyim', color: '#F59E0B' },
  { id: 'listicle', label: 'Liste', emoji: '📋', hint: '5-10 madde sıralı', color: '#8B5CF6' },
  { id: 'opinion', label: 'Görüş', emoji: '💭', hint: 'Cesur yorum', color: '#EC4899' },
  { id: 'myth', label: 'Miti Yık', emoji: '⚡', hint: 'Yanlış bilinen doğru', color: '#EF4444' },
  { id: 'tip', label: 'Hızlı İpucu', emoji: '💡', hint: 'Tek satırda değer', color: '#10B981' },
  { id: 'question', label: 'Soru', emoji: '❓', hint: 'Topluluk sorusu', color: '#06B6D4' },
  { id: 'news', label: 'Trend/Haber', emoji: '📰', hint: 'Güncel konu', color: '#F97316' },
];

export const IDEA_STATUSES: { id: IdeaStatus; label: string; emoji: string; color: string; bg: string }[] = [
  { id: 'raw', label: 'Ham Fikir', emoji: '🌱', color: '#10B981', bg: '#D1FAE5' },
  { id: 'developing', label: 'Geliştiriliyor', emoji: '🔧', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'ready', label: 'Hazır', emoji: '🎯', color: '#0EA5E9', bg: '#DBEAFE' },
  { id: 'used', label: 'Kullanıldı', emoji: '✅', color: '#8B5CF6', bg: '#EDE9FE' },
  { id: 'archived', label: 'Arşivlendi', emoji: '📦', color: '#64748B', bg: '#F1F5F9' },
];

export const IDEA_REACH: Record<Idea['estimatedReach'], { label: string; emoji: string; color: string }> = {
  low: { label: 'Düşük', emoji: '🌧', color: '#94A3B8' },
  medium: { label: 'Orta', emoji: '⛅', color: '#0EA5E9' },
  high: { label: 'Yüksek', emoji: '☀️', color: '#F59E0B' },
  viral: { label: 'Viral', emoji: '🔥', color: '#EF4444' },
};

const IDEA_PRIORITY_LABEL: Record<number, string> = {
  1: 'Çok düşük',
  2: 'Düşük',
  3: 'Orta',
  4: 'Yüksek',
  5: 'Çok yüksek',
};

export const IDEA_PRIORITY_LABELS = IDEA_PRIORITY_LABEL;

export const IDEA_DEFAULT_TAGS: Record<string, string[]> = {
  fitness: ['squat', 'protein', 'kardiyo', 'motivasyon', 'split', 'form', 'recovery', 'macro'],
  food: ['tarif', 'malzeme', 'sos', 'tatlı', 'vegan', 'hızlı', 'bütçe', 'sunum'],
  tech: ['ai', 'otomasyon', 'kod', 'verimlilik', 'güvenlik', 'workflow', 'mobile', 'cloud'],
  fashion: ['kombin', 'kapsül', 'renk', 'trend', 'bütçe', 'aksesuar', 'sezon', 'stil'],
  beauty: ['cilt', 'rutin', 'serum', 'spf', 'makyaj', 'saç', 'tırnak', 'maske'],
  business: ['satış', 'pazarlama', 'funnel', 'büyüme', 'yatırım', 'liderlik', 'delegasyon', 'marka'],
  travel: ['rota', 'otel', 'restoran', 'vize', 'valiz', 'yerel', 'bütçe', 'macera'],
  gaming: ['meta', 'fps', 'rank', 'build', 'yayıncılık', 'turnuva', 'donanım', 'discord'],
};

const IDEA_DEFAULT_FORMATS = [
  'Reels', 'Carousel', 'Caption', 'Story', 'Thread', 'Video', 'Blog', 'Live',
];

const pickRandom = <T,>(arr: T[], seed: number): T => {
  const item = arr[Math.abs(Math.floor(Math.sin(seed * 7.13) * 1000)) % arr.length];
  return item as T;
};

export const buildIdeaSuggestion = (niche: NicheId, seedBase = Date.now()): {
  title: string;
  description: string;
  hookIdea: string;
  tags: string[];
  angle: IdeaAngle;
  format: string;
  estimatedReach: Idea['estimatedReach'];
} => {
  const tagPool = IDEA_DEFAULT_TAGS[niche] ?? ['içerik', 'fikir', 'planlama', 'analiz', 'taktik', 'sosyal'];
  const tags = Array.from(new Set([pickRandom(tagPool, seedBase), pickRandom(tagPool, seedBase + 1), pickRandom(tagPool, seedBase + 2)]));

  const titleTemplates = [
    `${tags[0]} hakkında bilmen gereken 5 şey`,
    `Sektörde herkesin yanlış yaptığı ${tags[0]} hatası`,
    `${tags[0]}: Sıfırdan zirveye yol haritası`,
    `Bir haftada ${tags[0]} dönüşümü`,
    `${tags[0]} üstadı olmak için 3 kitap/araç`,
  ];
  const title = pickRandom(titleTemplates, seedBase + 3);

  const descTemplates = [
    `Bu fikir ${tags.join(', ')} konularını birleştirip hedef kitleye derin değer katıyor. Düşündüğünden daha fazla etkileşim alabilir.`,
    `Toplulukta ${tags[0]} hakkında sıkça soru alıyorsun. Bunu kapsayan bir içerik takipçi sadakatini artırır.`,
    `Trend olan ${tags[0]} konusunu kendi açından ele al. Farklı bakış açısı öne çıkmana yardım eder.`,
    `Pratik bir liste — ${tags.join(', ')}. Takipçiler kaydetmeyi sever çünkü uygulanabilir.`,
  ];
  const description = pickRandom(descTemplates, seedBase + 5);

  const hookTemplates = [
    `X ile Y arasındaki farkı hiç düşündün mü? İşte cevabı.`,
    `${tags[0]} hakkında tek bir gerçeği bileceksin. Hazır mısın?`,
    `Bu ${tags[0]} taktiği 1 saatte hayatını değiştirebilir.`,
    `Son 30 günde ${tags[0]} konusunda en çok sorulan 3 soru.`,
  ];
  const hookIdea = pickRandom(hookTemplates, seedBase + 7);

  const angle: IdeaAngle = pickRandom(['tutorial', 'story', 'listicle', 'opinion', 'myth', 'tip'], seedBase + 9) as IdeaAngle;
  const format = pickRandom(IDEA_DEFAULT_FORMATS, seedBase + 11);
  const reaches: Idea['estimatedReach'][] = ['low', 'medium', 'high', 'viral'];
  const estimatedReach = pickRandom(reaches, seedBase + 13);

  return { title, description, hookIdea, tags, angle, format, estimatedReach };
};

export const getIdeaBank = async (): Promise<Idea[]> => {
  try {
    const raw = await AsyncStorage.getItem(IDEA_BANK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is Idea =>
        i &&
        typeof i === 'object' &&
        typeof i.id === 'string' &&
        typeof i.title === 'string'
    );
  } catch {
    return [];
  }
};

export const saveIdea = async (idea: Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'usedAt'> & { id?: string }): Promise<Idea[]> => {
  const list = await getIdeaBank();
  const now = Date.now();
  let next: Idea[];
  if (idea.id) {
    next = list.map(x =>
      x.id === idea.id
        ? { ...x, ...idea, id: x.id, updatedAt: now, usedAt: idea.status === 'used' ? x.usedAt ?? now : x.usedAt } as Idea
        : x
    );
  } else {
    const entry: Idea = {
      ...idea,
      id: `idea-${now}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
      usedAt: idea.status === 'used' ? now : null,
    };
    next = [entry, ...list];
  }
  await AsyncStorage.setItem(IDEA_BANK_KEY, JSON.stringify(next));
  return next;
};

export const removeIdea = async (id: string): Promise<Idea[]> => {
  const list = await getIdeaBank();
  const next = list.filter(x => x.id !== id);
  await AsyncStorage.setItem(IDEA_BANK_KEY, JSON.stringify(next));
  return next;
};

export const clearIdeaBank = async (): Promise<void> => {
  await AsyncStorage.removeItem(IDEA_BANK_KEY);
};

export const seedIdeaBankDemo = async (niche: NicheId): Promise<Idea[]> => {
  const current = await getIdeaBank();
  if (current.length > 0) return current;
  const now = Date.now();
  const demoTitles = [
    'Yaz öncesi 12 haftalık program',
    'Sosyal medyada vakit kaybettiren 5 alışkanlık',
    'Evde ekipmansız full body',
    'Yeni başlayanlar için 3 kitap',
    '30 günde kahvaltı rutini',
  ];
  const demo: Idea[] = demoTitles.map((title, i) => {
    const s = buildIdeaSuggestion(niche, now + i);
    return {
      id: `idea-demo-${i}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      description: s.description,
      hookIdea: s.hookIdea,
      angle: s.angle,
      status: i === 0 ? 'ready' : i === 1 ? 'developing' : 'raw',
      tags: s.tags,
      format: s.format,
      estimatedReach: s.estimatedReach,
      priority: ((i % 5) + 1) as Idea['priority'],
      notes: '',
      source: 'manual',
      createdAt: now - i * 3600000,
      updatedAt: now - i * 3600000,
      usedAt: null,
    };
  });
  await AsyncStorage.setItem(IDEA_BANK_KEY, JSON.stringify(demo));
  return demo;
};

// ============================================================================
// ROUND 61 — Content Brief Generator
// ============================================================================

export type BriefPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'blog';

export type BriefFormat = 'reel' | 'carousel' | 'caption' | 'thread' | 'story' | 'video' | 'blog';

export type BriefStage = 'goal' | 'audience' | 'platform' | 'content' | 'distribution';

export type Brief = {
  id: string;
  projectName: string;
  platform: BriefPlatform;
  format: BriefFormat;
  goal: string;
  audience: string;
  hook: string;
  keyMessage: string;
  outline: string[];
  cta: string;
  hashtags: string[];
  visualDirection: string;
  toneNotes: string;
  metrics: string[];
  distributionPlan: string;
  budget: 'low' | 'medium' | 'high';
  deadlineDays: number;
  createdAt: number;
};

const BRIEF_KEY = '@content-coach/briefs';

export const BRIEF_PLATFORMS: { id: BriefPlatform; label: string; emoji: string; color: string; tone: string; tip: string }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', color: '#E1306C', tone: 'görsel ağırlıklı', tip: 'İlk 1.3 sn kritik, açılış frame tek başına anlamlı olmalı' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: '#000000', tone: 'kısa + hızlı', tip: 'Hook ilk 1 sn\'de, döngüsel son (loop) ekle' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', color: '#FF0000', tone: 'derin + uzun', tip: 'Thumbnail + başlık CTR\'ı belirler, 8 dk ideal' },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0', tone: 'keskin + kısa', tip: 'İlk tweet tek cümle, thread\'lerde numaralandır' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', color: '#0A66C2', tone: 'profesyonel', tip: 'İlk 2 satır görünür, hook cümlesi çok önemli' },
  { id: 'blog', label: 'Blog / SEO', emoji: '📝', color: '#10B981', tone: 'uzun + kalıcı', tip: 'H2 alt başlıkları + meta description 155 karakter' },
];

export const BRIEF_FORMATS: { id: BriefFormat; label: string; emoji: string; hint: string }[] = [
  { id: 'reel', label: 'Reels', emoji: '🎬', hint: '15-90 sn dikey video' },
  { id: 'carousel', label: 'Carousel', emoji: '📑', hint: '5-10 slayt eğitici' },
  { id: 'caption', label: 'Caption', emoji: '💬', hint: 'Uzun metin + görsel' },
  { id: 'thread', label: 'Thread', emoji: '🧵', hint: '5-12 tweet sıralı' },
  { id: 'story', label: 'Story', emoji: '📱', hint: '15 sn kısa dikey' },
  { id: 'video', label: 'Long video', emoji: '🎥', hint: '5-15 dakika' },
  { id: 'blog', label: 'Blog', emoji: '📝', hint: '800-1500 kelime SEO' },
];

const BRIEF_GOAL_PRESETS: { id: string; label: string; emoji: string }[] = [
  { id: 'awareness', label: 'Marka bilinirliği', emoji: '📣' },
  { id: 'education', label: 'Eğitim / değer', emoji: '🎓' },
  { id: 'engagement', label: 'Etkileşim / topluluk', emoji: '💬' },
  { id: 'conversion', label: 'Satış / dönüşüm', emoji: '💰' },
  { id: 'trust', label: 'Güven / otorite', emoji: '🤝' },
  { id: 'launch', label: 'Ürün / kampanya lansmanı', emoji: '🚀' },
];

const BRIEF_OUTLINE_TEMPLATES: Record<BriefFormat, string[]> = {
  reel: [
    'Hook (0-3 sn): dikkat çekici açılış',
    'Problem / acı noktası (3-8 sn)',
    'Çözüm / vaat (8-20 sn)',
    'Kanıt / örnek (20-40 sn)',
    'CTA + döngüsel son (son 5 sn)',
  ],
  carousel: [
    'Kapak: çarpıcı başlık + göz alıcı görsel',
    'Problem tanımı (1-2 slayt)',
    'Ana değer / liste (3-7 slayt)',
    'Örnek / kanıt (1-2 slayt)',
    'Son slayt: özet + CTA',
  ],
  caption: [
    'Hook cümlesi (görünür ilk satır)',
    'Hikaye / bağlam (2-3 paragraf)',
    'Ana mesaj + değer',
    'Örnek / vaka',
    'Sonuç + CTA',
  ],
  thread: [
    'Tweet 1: Hook (tek cümle, merak)',
    'Tweet 2-3: Problem veya bağlam',
    'Tweet 4-8: Ana içerik (adım adım veya liste)',
    'Tweet 9-10: Örnek / kanıt',
    'Son tweet: Özet + CTA',
  ],
  story: [
    'Açılış: dikkat çekici görsel/yazı',
    '1-2 frame: bağlam',
    '1 frame: ana mesaj',
    'Poll / quiz ile etkileşim',
    'Son frame: swipe up / link CTA',
  ],
  video: [
    'Cold open (ilk 5 sn)',
    'Thumbnail vaadi + intro (30 sn)',
    'Ana bölüm 1',
    'Ana bölüm 2',
    'Ana bölüm 3',
    'Özet + sonraki adım (CTA)',
  ],
  blog: [
    'SEO başlık (H1) + meta description',
    'Giriş: hook + okuyucuya değer vaadi',
    'Ana bölüm 1 (H2)',
    'Ana bölüm 2 (H2)',
    'Ana bölüm 3 (H2) + örnekler',
    'Sonuç + CTA',
  ],
};

const BRIEF_HASHTAG_POOL: Record<BriefPlatform, string[]> = {
  instagram: ['#içerik', '#pazarlama', '#sosyalmedya', '#reels', '#keşfet', '#türkiye', '#girişim', '#vlog'],
  tiktok: ['#fyp', '#kesfet', '#viral', '#öğren', '#tiktoktaöğren', '#türkiye', '#trend', '#bilgi'],
  youtube: ['#youtube', '#nasıl', '#rehber', '#tutorial', '#vlog', '#türkiye', '#öğren', '#izle'],
  twitter: ['#thread', '#bilgi', '#öğren', '#girişim', '#turkiye', '#sosyalmedya', '#pazarlama', '#content'],
  linkedin: ['#kariyer', '#girişim', '#leadership', '#pazarlama', '#b2b', '#networking', '#türkiye', '#content'],
  blog: ['#seo', '#blog', '#içerik', '#rehber', '#öğren', '#nasıl', '#türkiye', '#pazarlama'],
};

const BRIEF_METRICS_BY_GOAL: Record<string, string[]> = {
  awareness: ['Erişim / impressions', 'Profil ziyareti', 'Kaydetme oranı', 'Paylaşım sayısı'],
  education: ['Kaydetme', 'Tamamlanma oranı', 'Yorumda soru sayısı', 'Pinlenme'],
  engagement: ['Yorum sayısı', 'Beğeni / etkileşim oranı', 'Tag sayısı', 'DM gelen soru'],
  conversion: ['Tıklama oranı (CTR)', 'Satın alma / lead', 'Link tıklaması', 'Reklam dönüşümü'],
  trust: ['Yorum niteliği', 'Mention / tag', 'Basın mention', 'İzleyici geri dönüşü'],
  launch: ['İlk 24 saat erişim', 'Satış / lead', 'Erken yorumlar', 'Web site trafiği'],
};

export const buildBrief = (input: {
  projectName: string;
  platform: BriefPlatform;
  format: BriefFormat;
  goal: string;
  audience: string;
  hook: string;
  cta: string;
  toneNotes?: string;
  visualDirection?: string;
  budget?: Brief['budget'];
  deadlineDays?: number;
}): Omit<Brief, 'id' | 'createdAt'> => {
  const outline = BRIEF_OUTLINE_TEMPLATES[input.format] ?? BRIEF_OUTLINE_TEMPLATES.caption;
  const hashtags = BRIEF_HASHTAG_POOL[input.platform] ?? BRIEF_HASHTAG_POOL.instagram;
  const metrics = BRIEF_METRICS_BY_GOAL[input.goal] ?? BRIEF_METRICS_BY_GOAL.engagement;
  const platformInfo = BRIEF_PLATFORMS.find(p => p.id === input.platform);

  const keyMessage =
    `${input.projectName}: ${input.audience ? input.audience + ' için ' : ''}` +
    `${metrics[0]?.toLowerCase() ?? 'değer'} odaklı, ${platformInfo?.tone ?? 'görsel'} formatta içerik.`;

  const distributionPlan = [
    `${input.platform} ana yayın — ilk 24 saat kritik`,
    `Story / repost ile 48 saat içinde hatırlatma`,
    `Çapraz paylaşım: diğer platformlarda kısa teaser`,
    `3 gün sonra engagement check → yorumlara cevap`,
    `7 gün sonra performans değerlendirmesi`,
  ].join('\n');

  return {
    projectName: input.projectName,
    platform: input.platform,
    format: input.format,
    goal: input.goal,
    audience: input.audience,
    hook: input.hook,
    keyMessage,
    outline,
    cta: input.cta,
    hashtags,
    visualDirection: input.visualDirection || `${input.platform} için optimize edilmiş görsel; marka renkleri ön planda`,
    toneNotes: input.toneNotes || (platformInfo?.tip ?? ''),
    metrics,
    distributionPlan,
    budget: input.budget ?? 'medium',
    deadlineDays: input.deadlineDays ?? 7,
  };
};

export const getBriefList = async (): Promise<Brief[]> => {
  try {
    const raw = await AsyncStorage.getItem(BRIEF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is Brief =>
        b &&
        typeof b === 'object' &&
        typeof b.id === 'string' &&
        typeof b.projectName === 'string'
    );
  } catch {
    return [];
  }
};

export const saveBrief = async (brief: Omit<Brief, 'id' | 'createdAt'>): Promise<Brief[]> => {
  const list = await getBriefList();
  const entry: Brief = {
    ...brief,
    id: `brief-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [entry, ...list].slice(0, 12);
  await AsyncStorage.setItem(BRIEF_KEY, JSON.stringify(next));
  return next;
};

export const removeBrief = async (id: string): Promise<Brief[]> => {
  const list = await getBriefList();
  const next = list.filter(b => b.id !== id);
  await AsyncStorage.setItem(BRIEF_KEY, JSON.stringify(next));
  return next;
};

export const clearBriefs = async (): Promise<void> => {
  await AsyncStorage.removeItem(BRIEF_KEY);
};

export const BRIEF_GOAL_PRESETS_LIST = BRIEF_GOAL_PRESETS;

// ============================================================================
// ROUND 62 — Caption Formulas
// ============================================================================

export type CaptionTone = 'casual' | 'pro' | 'playful' | 'bold' | 'warm';
export type CaptionLength = 'micro' | 'short' | 'medium' | 'long';
export type CaptionGoal = 'engage' | 'educate' | 'sell' | 'inspire' | 'community';

export type CaptionFormula = {
  id: string;
  name: string;
  tone: CaptionTone;
  hook: string;
  body: string;
  cta: string;
  emojiDensity: 'none' | 'low' | 'medium' | 'high';
  createdAt: number;
};

const CAPTION_KEY = '@content-coach/captions';

export const CAPTION_TONES: { id: CaptionTone; label: string; emoji: string; color: string }[] = [
  { id: 'casual', label: 'Günlük / samimi', emoji: '☕', color: '#10B981' },
  { id: 'pro', label: 'Profesyonel', emoji: '💼', color: '#0EA5E9' },
  { id: 'playful', label: 'Eğlenceli', emoji: '🎈', color: '#F472B6' },
  { id: 'bold', label: 'Cesur / keskin', emoji: '⚡', color: '#F59E0B' },
  { id: 'warm', label: 'Sıcak / empatik', emoji: '🌿', color: '#84CC16' },
];

export const CAPTION_LENGTHS: { id: CaptionLength; label: string; hint: string; chars: [number, number] }[] = [
  { id: 'micro', label: 'Mikro', hint: '1-2 cümle', chars: [40, 120] },
  { id: 'short', label: 'Kısa', hint: 'paragraf', chars: [120, 300] },
  { id: 'medium', label: 'Orta', hint: 'hikaye + değer', chars: [300, 700] },
  { id: 'long', label: 'Uzun', hint: 'derin anlatı', chars: [700, 1500] },
];

export const CAPTION_GOALS: { id: CaptionGoal; label: string; emoji: string }[] = [
  { id: 'engage', label: 'Etkileşim', emoji: '💬' },
  { id: 'educate', label: 'Eğitim', emoji: '🎓' },
  { id: 'sell', label: 'Satış', emoji: '💰' },
  { id: 'inspire', label: 'İlham', emoji: '✨' },
  { id: 'community', label: 'Topluluk', emoji: '🤝' },
];

const HOOKS_BY_GOAL: Record<CaptionGoal, string[]> = {
  engage: [
    'Sence hangisi daha doğru?',
    'Bu görüşe katılıyor musun?',
    'Yorumlarda görüşelim:',
    'Sen olsan ne yapardın?',
    'Eğer bunu yaşadıysan, kalp at.',
  ],
  educate: [
    'Bunu bilmek işini kolaylaştırır:',
    '3 şey öğreneceksin, hepsi uygulanabilir.',
    'Sana bir çerçeve vereyim:',
    'Bu bilgi çoğu kişide eksik.',
    'Liste halinde, kaydet:',
  ],
  sell: [
    'Senin için yaptım, çünkü…',
    'Eğer {problem} yaşıyorsan, bu tam sana göre.',
    'İşte sonunda çalışan yöntem:',
    'Sınırlı sayıda, kaçırma:',
    'Önce/sonra — farkı gör:',
  ],
  inspire: [
    'Bir yıl önce bunu hayal bile edemezdim.',
    'Küçük bir karar, büyük bir değişim.',
    'Bazen tek bir cümle yeter.',
    'Unutma: yol, hedef kadar önemli.',
    'Bunu kendime not düşüyorum:',
  ],
  community: [
    'Seninle aynı sayfada olan kaç kişi var?',
    'Birlikte öğreniyoruz — bugünkü konu:',
    'Topluluktan gelen en güzel cevap:',
    'Bu ipucunu birine yolla, ihtiyacı vardır.',
    'Hep birlikte deniyoruz, sonuçları paylaş:',
  ],
};

const BODY_TEMPLATES: Record<CaptionTone, string[]> = {
  casual: [
    'Geçen hafta {topic} ile uğraşırken fark ettim ki… aslında mesele {insight}. Sonra şunu denedim: {action}. Sonuç? {result}.',
    'Bunu herkese söylemiyorum ama {topic} üzerine küçük bir not: {insight}. Yani evet, {action}.',
    'Sokakta yürürken düşündüm: {topic} aslında {insight}. Çoğu kişi {mistake} yapıyor. Ben {action} yapıyorum.',
  ],
  pro: [
    'Veri gösteriyor ki {insight}. Bu yüzden {action} öneriyorum. Ölçülebilir sonuç: {result}.',
    'Çerçeve şu: {insight}. Uygulama adımları — (1) {action}, (2) {action}, (3) {action}.',
    'Şirketler bu hatayı tekrar tekrar yapıyor: {mistake}. Doğru yöntem: {action}.',
  ],
  playful: [
    'Tamam tamam, sakin olun, {topic} hakkında mini bir tiyatro: 🎬 {insight}. Sonra ne mi oldu? {result}.',
    'Plot twist: {insight}. Şimdi ne yapıyoruz? {action}. (Spoiler: işe yarıyor.)',
    'Bir arkadaşım sordu: "{topic} nedir?" Ben de: "{insight}". O da: "{result}".',
  ],
  bold: [
    'Sıcak bakalım: {insight}. Bu doğru değilse, gel yorumda kanıtla.',
    'Popüler görüş: "{mistake}". Gerçek: "{insight}". Tarih: bugün.',
    'Ya {action} yaparsın, ya da {mistake} tekrarlanır. Seçim senin.',
  ],
  warm: [
    'Eğer {topic} sana ağır geliyorsa, yalnız değilsin. Ben de oradan geçtim. Bugün sana küçük bir şey: {insight}.',
    'Yumuşak bir hatırlatma: {insight}. Sen {action} deneyebilirsin, adım adım.',
    'Topluluk olarak {topic} üzerine konuşurken hep şu çıkıyor: {insight}.',
  ],
};

const CTAS_BY_GOAL: Record<CaptionGoal, string[]> = {
  engage: [
    'Yorumda görüşelim 👇',
    'Sana göre hangisi? 👇',
    'Etiketle, birlikte konuşalım.',
    'Kaydet, sonra uygula 🔖',
    'Bir emoji bırak yeter 🙌',
  ],
  educate: [
    'Kaydet, tekrar gel 🔖',
    'Listeyi yakın arkadaşınla paylaş.',
    'Bugün bir tane uygula, farkı hisset.',
    'Daha fazla ipucu için takip et.',
    'Yorumda hangisini denedin yaz.',
  ],
  sell: [
    'Bio’daki linkten incele.',
    'İlk 50 kişiye özel: link profilde.',
    'Detaylar DM’de.',
    'Sepete ekle → profildeki link.',
    'Sınırlı stok, kaçırma.',
  ],
  inspire: [
    'Sen yapabilirsin. Kaydet.',
    'Bunu birine yolla, ihtiyacı vardır.',
    'Bugün başla, yarın teşekkür et.',
    'Hatırla: küçük adım da adımdır.',
    'Paylaş, ilham büyüsün.',
  ],
  community: [
    'Yorumda birlikte yapalım 👇',
    'Seni burada görmek güzel — bir şey ekle.',
    'Hepiniz bu yolculuğun parçasısınız.',
    'Senin deneyimin ne? Yaz bakalım.',
    'Birbirimize iyi geliyoruz — devam.',
  ],
};

const FILLERS = {
  topic: ['içerik üretmek', 'topluluk büyütmek', 'zaman yönetimi', 'tutarlılık', 'yaratıcılık', 'bir işi başlatmak'],
  insight: [
    'küçük adımlar toplamdan daha önemli',
    'süreç, sonuçtan daha değerli',
    'tutarlılık, yetenekten ağır basar',
    'açık ve net olmak, her şeyi değiştirir',
    'sorgulamak, kopyalamaktan iyidir',
  ],
  action: [
    'günde 15 dakika ayır',
    'bir tek şeye odaklan',
    'önce bir taslak çıkar',
    'paylaş, sonra düzelt',
    'takvime not düş',
  ],
  result: [
    'akış başladı',
    'verim iki katına çıktı',
    'izleyici etkileşimi yükseldi',
    'kafam duruldu',
    'içerikler daha kolay çıktı',
  ],
  mistake: [
    'her şeyi aynı anda yapmaya çalışmak',
    'mükemmellik bekleyip başlamamak',
    'veriye bakmadan içgüdüyle hareket etmek',
    'kopyala-yapıştır stratejisi',
    'ölçmeyi ihmal etmek',
  ],
};

const pick = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

const emojiForDensity = (density: CaptionFormula['emojiDensity']): string[] => {
  if (density === 'none') return [];
  const pool = ['✨', '🔥', '🌱', '💡', '🚀', '📌', '💬', '❤️', '🎯', '🌟', '👇'];
  if (density === 'low') return [pick(pool, 1), pick(pool, 4)];
  if (density === 'medium') return [pick(pool, 0), pick(pool, 2), pick(pool, 5), pick(pool, 8)];
  return [pick(pool, 0), pick(pool, 1), pick(pool, 2), pick(pool, 3), pick(pool, 6), pick(pool, 9)];
};

const fillTemplate = (tmpl: string, seed: number): string =>
  tmpl
    .replace('{topic}', pick(FILLERS.topic, seed))
    .replace('{insight}', pick(FILLERS.insight, seed + 1))
    .replace(/\{action\}/g, pick(FILLERS.action, seed + 2))
    .replace('{result}', pick(FILLERS.result, seed + 3))
    .replace('{mistake}', pick(FILLERS.mistake, seed + 4));

export const buildCaption = (input: {
  name?: string;
  tone: CaptionTone;
  length: CaptionLength;
  goal: CaptionGoal;
  topic?: string;
  seed?: number;
}): { name: string; tone: CaptionTone; length: CaptionLength; goal: CaptionGoal; hook: string; body: string; cta: string; emojiDensity: CaptionFormula['emojiDensity']; fullText: string } => {
  const seed = input.seed ?? Date.now();
  const hook = pick(HOOKS_BY_GOAL[input.goal], seed);
  const bodyRaw = pick(BODY_TEMPLATES[input.tone], seed + 7);
  const body = fillTemplate(bodyRaw, seed);
  const cta = pick(CTAS_BY_GOAL[input.goal], seed + 11);

  const densityByLength: Record<CaptionLength, CaptionFormula['emojiDensity']> = {
    micro: 'low',
    short: 'low',
    medium: 'medium',
    long: 'high',
  };
  const density = densityByLength[input.length];

  const emojis = emojiForDensity(density);
  const hookEmoji = emojis[0] ? `${emojis[0]} ` : '';
  const tailEmoji = emojis.length > 1 ? ` ${emojis.slice(1).join(' ')}` : '';
  const finalHook = input.topic ? `${hookEmoji}${input.topic} — ${hook}` : `${hookEmoji}${hook}`;
  const finalBody = `${body}${tailEmoji}`;

  const name =
    input.name ||
    `${input.tone}/${input.length}/${input.goal} — ${new Date(seed).toLocaleDateString('tr-TR')}`;

  const fullText = `${finalHook}\n\n${finalBody}\n\n${cta}`;

  return {
    name,
    tone: input.tone,
    length: input.length,
    goal: input.goal,
    hook: finalHook,
    body: finalBody,
    cta,
    emojiDensity: density,
    fullText,
  };
};

export const getCaptionList = async (): Promise<CaptionFormula[]> => {
  try {
    const raw = await AsyncStorage.getItem(CAPTION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CaptionFormula =>
        c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string'
    );
  } catch {
    return [];
  }
};

export const saveCaption = async (data: Omit<CaptionFormula, 'id' | 'createdAt'>): Promise<CaptionFormula[]> => {
  const list = await getCaptionList();
  const entry: CaptionFormula = {
    ...data,
    id: `caption-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [entry, ...list].slice(0, 20);
  await AsyncStorage.setItem(CAPTION_KEY, JSON.stringify(next));
  return next;
};

export const removeCaption = async (id: string): Promise<CaptionFormula[]> => {
  const list = await getCaptionList();
  const next = list.filter(c => c.id !== id);
  await AsyncStorage.setItem(CAPTION_KEY, JSON.stringify(next));
  return next;
};

export const clearCaptions = async (): Promise<void> => {
  await AsyncStorage.removeItem(CAPTION_KEY);
};

// ============================================================================
// ROUND 63 — Content Scorecard
// ============================================================================

export type ScorePlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'blog';
export type ScoreFormat = 'reel' | 'carousel' | 'caption' | 'thread' | 'story' | 'video' | 'blog';
export type ScoreVerdict = 'flop' | 'ok' | 'hit' | 'viral';

export type ScorecardEntry = {
  id: string;
  title: string;
  platform: ScorePlatform;
  format: ScoreFormat;
  hook: string;
  publishedAt: number;
  metrics: {
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  effortHours: number;
  notes: string;
  createdAt: number;
};

const SCORECARD_KEY = '@content-coach/scorecards';

export const SCORE_PLATFORMS: { id: ScorePlatform; label: string; emoji: string }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { id: 'blog', label: 'Blog / SEO', emoji: '📝' },
];

export const SCORE_FORMATS: { id: ScoreFormat; label: string; emoji: string }[] = [
  { id: 'reel', label: 'Reels', emoji: '🎬' },
  { id: 'carousel', label: 'Carousel', emoji: '📑' },
  { id: 'caption', label: 'Caption', emoji: '💬' },
  { id: 'thread', label: 'Thread', emoji: '🧵' },
  { id: 'story', label: 'Story', emoji: '📱' },
  { id: 'video', label: 'Long video', emoji: '🎥' },
  { id: 'blog', label: 'Blog', emoji: '📝' },
];

const ENGAGEMENT_WEIGHT = {
  reach: 0.15,
  likes: 0.25,
  comments: 0.25,
  shares: 0.2,
  saves: 0.15,
};

export const computeScore = (entry: ScorecardEntry['metrics'], platform: ScorePlatform): number => {
  const reachNorm = Math.min(1, entry.reach / reachBenchmark(platform));
  const likesNorm = Math.min(1, entry.likes / Math.max(1, entry.reach) / likeBenchmark(platform));
  const commentsNorm = Math.min(1, entry.comments / Math.max(1, entry.reach) / commentBenchmark(platform));
  const sharesNorm = Math.min(1, entry.shares / Math.max(1, entry.reach) / shareBenchmark(platform));
  const savesNorm = Math.min(1, entry.saves / Math.max(1, entry.reach) / saveBenchmark(platform));

  const composite =
    reachNorm * ENGAGEMENT_WEIGHT.reach +
    likesNorm * ENGAGEMENT_WEIGHT.likes +
    commentsNorm * ENGAGEMENT_WEIGHT.comments +
    sharesNorm * ENGAGEMENT_WEIGHT.shares +
    savesNorm * ENGAGEMENT_WEIGHT.saves;

  return Math.round(composite * 100);
};

const reachBenchmark = (p: ScorePlatform): number => {
  switch (p) {
    case 'tiktok': return 50000;
    case 'instagram': return 20000;
    case 'youtube': return 15000;
    case 'twitter': return 30000;
    case 'linkedin': return 8000;
    case 'blog': return 5000;
  }
};

const likeBenchmark = (p: ScorePlatform): number => {
  switch (p) {
    case 'tiktok': return 0.08;
    case 'instagram': return 0.06;
    case 'youtube': return 0.04;
    case 'twitter': return 0.03;
    case 'linkedin': return 0.05;
    case 'blog': return 0.02;
  }
};

const commentBenchmark = (p: ScorePlatform): number => {
  switch (p) {
    case 'tiktok': return 0.008;
    case 'instagram': return 0.01;
    case 'youtube': return 0.005;
    case 'twitter': return 0.006;
    case 'linkedin': return 0.008;
    case 'blog': return 0.003;
  }
};

const shareBenchmark = (p: ScorePlatform): number => {
  switch (p) {
    case 'tiktok': return 0.012;
    case 'instagram': return 0.008;
    case 'youtube': return 0.004;
    case 'twitter': return 0.015;
    case 'linkedin': return 0.01;
    case 'blog': return 0.005;
  }
};

const saveBenchmark = (p: ScorePlatform): number => {
  switch (p) {
    case 'tiktok': return 0.02;
    case 'instagram': return 0.04;
    case 'youtube': return 0.0;
    case 'twitter': return 0.0;
    case 'linkedin': return 0.005;
    case 'blog': return 0.0;
  }
};

export const verdictFromScore = (score: number): { id: ScoreVerdict; label: string; emoji: string; color: string; tip: string } => {
  if (score >= 75) {
    return {
      id: 'viral',
      label: 'Viral potansiyel',
      emoji: '🚀',
      color: '#10B981',
      tip: 'Bu formatı tekrarla, hook\'u kaydet. Aynı kanalde 2-3 kez daha dene.',
    };
  }
  if (score >= 50) {
    return {
      id: 'hit',
      label: 'İyi performans',
      emoji: '🎯',
      color: '#22C55E',
      tip: 'CTA veya saatini tweakleyip yeniden dene. Topluluk sinyali güçlü.',
    };
  }
  if (score >= 25) {
    return {
      id: 'ok',
      label: 'Orta',
      emoji: '🌤️',
      color: '#F59E0B',
      tip: 'Hook\'u yeniden yaz, açılış frame\'i değiştir. Tek bir değişiklik yeterli olabilir.',
    };
  }
  return {
    id: 'flop',
    label: 'Düşük etki',
    emoji: '🍂',
    color: '#EF4444',
    tip: 'Hook veya format değiştir. Saatini kontrol et. Enerjiyi başka bir denemeye kaydır.',
  };
};

export const getScorecardList = async (): Promise<ScorecardEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(SCORECARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is ScorecardEntry =>
        s &&
        typeof s === 'object' &&
        typeof s.id === 'string' &&
        typeof s.title === 'string'
    );
  } catch {
    return [];
  }
};

export const saveScorecard = async (entry: Omit<ScorecardEntry, 'id' | 'createdAt'>): Promise<ScorecardEntry[]> => {
  const list = await getScorecardList();
  const full: ScorecardEntry = {
    ...entry,
    id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 60);
  await AsyncStorage.setItem(SCORECARD_KEY, JSON.stringify(next));
  return next;
};

export const removeScorecard = async (id: string): Promise<ScorecardEntry[]> => {
  const list = await getScorecardList();
  const next = list.filter(s => s.id !== id);
  await AsyncStorage.setItem(SCORECARD_KEY, JSON.stringify(next));
  return next;
};

export const clearScorecards = async (): Promise<void> => {
  await AsyncStorage.removeItem(SCORECARD_KEY);
};

// ============================================================================
// ROUND 64 — Hashtag Strategy Builder
// ============================================================================

export type HashtagPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'blog';

export type HashtagLayer = 'core' | 'niche' | 'community' | 'trending' | 'longtail';

export type HashtagPack = {
  id: string;
  niche: string;
  platform: HashtagPlatform;
  topic: string;
  layers: Record<HashtagLayer, string[]>;
  fullList: string[];
  createdAt: number;
};

const HASHTAG_KEY = '@content-coach/hashtag-packs';

export const HASHTAG_PLATFORMS: { id: HashtagPlatform; label: string; emoji: string; cap: number }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', cap: 30 },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', cap: 8 },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', cap: 15 },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', cap: 3 },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', cap: 5 },
  { id: 'blog', label: 'Blog / SEO', emoji: '📝', cap: 5 },
];

const CORE_BY_PLATFORM: Record<HashtagPlatform, string[]> = {
  instagram: ['#içerik', '#sosyalmedya', '#keşfet', '#pazarlama', '#vlog'],
  tiktok: ['#fyp', '#kesfet', '#viral', '#tiktokturkiye'],
  youtube: ['#youtube', '#nasıl', '#rehber', '#izle'],
  twitter: ['#thread', '#bilgi'],
  linkedin: ['#kariyer', '#girişim', '#leadership'],
  blog: ['#blog', '#seo', '#rehber'],
};

const NICHE_POOL: Record<string, string[]> = {
  fitness: ['#fitness', '#sağlıklıyaşam', '#antrenman', '#spor', '#vücutgeliştirme', '#kardiyo', '#beslenme', '#protein', '#crossfit', '#pilates'],
  food: ['#yemek', '#tarif', '#mutfak', '#lezzet', '#pratiktarif', '#tatlı', '#kahvaltı', '#vegan', '#glutensiz'],
  tech: ['#teknoloji', '#yazılım', '#yapayzeka', '#ai', '#programlama', '#startup', '#coding', '#developer', '#ürün'],
  fashion: ['#moda', '#stil', '#kombin', '#outfit', '#modaevi', '#aksesuar', '#streetstyle'],
  travel: ['#seyahat', '#gezi', '#tatil', '#keşif', '#rota', '#backpacker', '#dünya'],
  gaming: ['#oyun', '#gaming', '#streamer', '#espor', '#oyuninceleme', '#valorant', '#csgo'],
  personal_dev: ['#kişiselgelişim', '#üretkenlik', '#kitap', '#motivasyon', '#disiplin', '#hedef'],
  beauty: ['#makyaj', '#ciltbakımı', '#güzellik', '#saçbakımı', '#makeup', '#skincare'],
};

const COMMUNITY_BY_PLATFORM: Record<HashtagPlatform, string[]> = {
  instagram: ['#türkiye', '#istanbul', '#ankara', '#izmir', '#günlük', '#yaşam'],
  tiktok: ['#türkiye', '#istanbul', '#ankara', '#izmir', '#trendleri'],
  youtube: ['#türkiye', '#türk', '#izleyici'],
  twitter: ['#turkiye', '#istanbul'],
  linkedin: ['#türkiye', '#istanbul', '#ankara'],
  blog: ['#türkiye', '#türkçe'],
};

const TRENDING_POOL: Record<HashtagPlatform, string[]> = {
  instagram: ['#reels', '#story', '#canlı', '#çift'],
  tiktok: ['#trend', '#sound', '#dans', '#komedi', '#öğren'],
  youtube: ['#shorts', '#yeni', '#roast'],
  twitter: ['#trend', '#gündem'],
  linkedin: ['#b2b', '#networking', '#kariyergelişim'],
  blog: ['#nasıl', '#ipucu', '#liste'],
};

const LONGTAIL_GENERATORS: Array<(topic: string, niche: string) => string[]> = [
  (t, n) => [`#${slug(t)}-ipuçları`, `#${slug(n)}-rehberi`],
  (t) => [`#${slug(t)}-2025`, `#${slug(t)}-başlangıç`],
  (t, n) => [`#${slug(n)}-topluluğu`, `#${slug(t)}-deneyim`],
];

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);

const pickN = <T,>(arr: T[], n: number, seed: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  let s = Math.abs(seed);
  for (let i = 0; i < n && copy.length > 0; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const idx = s % copy.length;
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
};

export const buildHashtagPack = (input: {
  niche: string;
  platform: HashtagPlatform;
  topic: string;
  seed?: number;
}): HashtagPack => {
  const seed = input.seed ?? Date.now();
  const topic = input.topic.trim();
  const cap = HASHTAG_PLATFORMS.find(p => p.id === input.platform)?.cap ?? 10;

  const nicheList = NICHE_POOL[input.niche] ?? ['#içerik', '#bilgi', '#topluluk'];

  const core = pickN(CORE_BY_PLATFORM[input.platform], 3, seed);
  const nicheLayer = pickN(nicheList, Math.min(5, nicheList.length), seed + 7);
  const community = pickN(COMMUNITY_BY_PLATFORM[input.platform], 2, seed + 13);

  const trending = pickN(TRENDING_POOL[input.platform], 2, seed + 19);

  const longtailSet = new Set<string>();
  LONGTAIL_GENERATORS.forEach((gen, i) => {
    gen(topic || input.niche, input.niche).forEach(h => longtailSet.add(h));
  });
  const longtail = Array.from(longtailSet).slice(0, 4);

  const layers = {
    core,
    niche: nicheLayer,
    community,
    trending,
    longtail,
  };

  const flat: string[] = [];
  (['core', 'niche', 'community', 'trending', 'longtail'] as HashtagLayer[]).forEach(layer => {
    layers[layer].forEach(h => {
      if (!flat.includes(h)) flat.push(h);
    });
  });

  const fullList = flat.slice(0, cap);

  return {
    id: `hashtag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    niche: input.niche,
    platform: input.platform,
    topic,
    layers,
    fullList,
    createdAt: Date.now(),
  };
};

export const getHashtagPackList = async (): Promise<HashtagPack[]> => {
  try {
    const raw = await AsyncStorage.getItem(HASHTAG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (h): h is HashtagPack =>
        h && typeof h === 'object' && typeof h.id === 'string' && typeof h.niche === 'string'
    );
  } catch {
    return [];
  }
};

export const saveHashtagPack = async (pack: Omit<HashtagPack, 'id' | 'createdAt'>): Promise<HashtagPack[]> => {
  const list = await getHashtagPackList();
  const full: HashtagPack = {
    ...pack,
    id: `hashtag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 24);
  await AsyncStorage.setItem(HASHTAG_KEY, JSON.stringify(next));
  return next;
};

export const removeHashtagPack = async (id: string): Promise<HashtagPack[]> => {
  const list = await getHashtagPackList();
  const next = list.filter(h => h.id !== id);
  await AsyncStorage.setItem(HASHTAG_KEY, JSON.stringify(next));
  return next;
};

export const clearHashtagPacks = async (): Promise<void> => {
  await AsyncStorage.removeItem(HASHTAG_KEY);
};

// ============================================================================
// ROUND 65 — Posting Time Heatmap
// ============================================================================

export type PostingPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'blog';

export type TimeCell = {
  day: number;
  hour: number;
  score: number;
  label: string;
};

const POSTING_KEY = '@content-coach/posting-overrides';

export type PostingOverride = {
  platform: PostingPlatform;
  cell: string;
  score: number;
};

const PLATFORM_HOUR_BIAS: Record<PostingPlatform, number[]> = {
  instagram: [0, 0, 0, 0, 0, 0, 2, 5, 8, 9, 7, 7, 6, 6, 6, 7, 8, 9, 9, 8, 6, 4, 3, 1],
  tiktok: [0, 0, 0, 0, 0, 0, 3, 6, 8, 8, 7, 7, 8, 9, 9, 9, 8, 7, 6, 5, 5, 4, 2, 1],
  youtube: [1, 1, 1, 1, 1, 1, 3, 4, 5, 5, 5, 6, 6, 7, 7, 8, 9, 10, 10, 9, 8, 6, 4, 3],
  twitter: [1, 1, 1, 1, 1, 2, 4, 7, 9, 9, 8, 8, 8, 8, 9, 9, 10, 9, 8, 7, 6, 4, 3, 2],
  linkedin: [0, 0, 0, 0, 0, 0, 5, 9, 10, 8, 7, 6, 7, 8, 8, 7, 7, 6, 5, 3, 2, 1, 0, 0],
  blog: [0, 0, 0, 0, 0, 0, 4, 7, 8, 9, 9, 8, 7, 6, 7, 8, 8, 7, 5, 4, 3, 2, 1, 0],
};

const PLATFORM_DAY_BIAS: Record<PostingPlatform, number[]> = {
  instagram: [4, 8, 9, 9, 10, 9, 7],
  tiktok: [6, 8, 8, 9, 9, 9, 7],
  youtube: [7, 8, 9, 9, 10, 9, 8],
  twitter: [9, 10, 10, 10, 10, 9, 8],
  linkedin: [6, 10, 10, 10, 9, 7, 5],
  blog: [9, 10, 9, 9, 9, 7, 6],
};

const SLOT_LABELS: { threshold: number; label: string; emoji: string; color: string; tip: string }[] = [
  { threshold: 14, label: 'Altın saat', emoji: '🌟', color: '#10B981', tip: 'En yüksek etkileşim beklenir. Bu saate planlı içerik koy.' },
  { threshold: 11, label: 'Pozitif pencere', emoji: '🟢', color: '#22C55E', tip: 'İyi performans. Zaten paylaşacaksan, buraya al.' },
  { threshold: 8, label: 'Nötr', emoji: '🟡', color: '#F59E0B', tip: 'Standart. İçerik kalitesi belirleyici olur.' },
  { threshold: 5, label: 'Sakin', emoji: '🟠', color: '#F97316', tip: 'Erişim düşer, ama erken kuş avantajı olabilir.' },
  { threshold: 0, label: 'Uyku', emoji: '⚫', color: '#475569', tip: 'Gece kuşu izleyici kitlesi dışında düşüş. Kaçın.' },
];

export const slotMeta = (score: number) => {
  return SLOT_LABELS.find(s => score >= s.threshold) ?? SLOT_LABELS[SLOT_LABELS.length - 1];
};

export const buildPostingHeatmap = (
  platform: PostingPlatform,
  overrides: PostingOverride[]
): TimeCell[][] => {
  const grid: TimeCell[][] = [];
  for (let day = 0; day < 7; day++) {
    const row: TimeCell[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const baseScore = PLATFORM_DAY_BIAS[platform][day] + PLATFORM_HOUR_BIAS[platform][hour];
      const ov = overrides.find(o => o.platform === platform && o.cell === `${day}-${hour}`);
      const final = Math.max(0, Math.min(20, baseScore + (ov?.score ?? 0)));
      row.push({ day, hour, score: final, label: `${day}-${hour}` });
    }
    grid.push(row);
  }
  return grid;
};

export const getPostingOverrides = async (): Promise<PostingOverride[]> => {
  try {
    const raw = await AsyncStorage.getItem(POSTING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is PostingOverride =>
        o && typeof o === 'object' && typeof o.platform === 'string' && typeof o.cell === 'string'
    );
  } catch {
    return [];
  }
};

export const setPostingOverride = async (ov: PostingOverride): Promise<PostingOverride[]> => {
  const list = await getPostingOverrides();
  const filtered = list.filter(o => !(o.platform === ov.platform && o.cell === ov.cell));
  const next = [...filtered, ov];
  await AsyncStorage.setItem(POSTING_KEY, JSON.stringify(next));
  return next;
};

export const clearPostingOverride = async (platform: PostingPlatform, cell: string): Promise<PostingOverride[]> => {
  const list = await getPostingOverrides();
  const next = list.filter(o => !(o.platform === platform && o.cell === cell));
  await AsyncStorage.setItem(POSTING_KEY, JSON.stringify(next));
  return next;
};

export const currentSlotLive = (platform: PostingPlatform, overrides: PostingOverride[]): { slot: TimeCell; meta: ReturnType<typeof slotMeta>; recommendation: string } => {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const hour = now.getHours();
  const grid = buildPostingHeatmap(platform, overrides);
  const slot = grid[day][hour];
  const meta = slotMeta(slot.score);
  let recommendation = '';
  if (meta.label === 'Altın saat') {
    recommendation = 'Şu an paylaşmak için harika bir pencere.';
  } else if (meta.label === 'Pozitif pencere') {
    recommendation = 'İyi bir an — paylaşım planındaysan şimdi at.';
  } else if (meta.label === 'Nötr') {
    recommendation = 'Standart pencere. İçeriğin kalitesi belirleyici olur.';
  } else if (meta.label === 'Sakin') {
    recommendation = 'Mümkünse 1-2 saat kaydır. Şu an düşük etkileşim beklenir.';
  } else {
    recommendation = 'Gece kuşu penceresi. Erken sabah paylaşımı planla.';
  }
  return { slot, meta, recommendation };
};

// ============================================================================
// ROUND 66 — Content Calendar Mini (Weekly Plan)
// ============================================================================

export type CalendarItemKind = 'idea' | 'brief' | 'caption' | 'manual';

export type CalendarItem = {
  id: string;
  weekStart: number;
  day: number;
  hour: number;
  kind: CalendarItemKind;
  refId: string | null;
  title: string;
  platform: string;
  status: 'planned' | 'drafting' | 'ready' | 'published';
  notes: string;
  createdAt: number;
};

const CALENDAR_KEY = '@content-coach/calendar-mini';

export const CALENDAR_STATUS_META: Record<CalendarItem['status'], { label: string; emoji: string; color: string }> = {
  planned: { label: 'Planlı', emoji: '📌', color: '#94a3b8' },
  drafting: { label: 'Taslak', emoji: '✏️', color: '#F59E0B' },
  ready: { label: 'Hazır', emoji: '✅', color: '#10B981' },
  published: { label: 'Yayında', emoji: '🚀', color: '#0EA5E9' },
};

export const startOfWeek = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.getTime();
};

export const weekDays = (weekStart: number): { ts: number; label: string; short: string; isToday: boolean }[] => {
  const out: { ts: number; label: string; short: string; isToday: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    out.push({
      ts: d.getTime(),
      label: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][i],
      short: d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      isToday: d.getTime() === today.getTime(),
    });
  }
  return out;
};

export const getCalendarList = async (): Promise<CalendarItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CalendarItem =>
        c && typeof c === 'object' && typeof c.id === 'string' && typeof c.title === 'string'
    );
  } catch {
    return [];
  }
};

export const saveCalendarItem = async (item: Omit<CalendarItem, 'id' | 'createdAt'>): Promise<CalendarItem[]> => {
  const list = await getCalendarList();
  const full: CalendarItem = {
    ...item,
    id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 80);
  await AsyncStorage.setItem(CALENDAR_KEY, JSON.stringify(next));
  return next;
};

export const updateCalendarItem = async (id: string, patch: Partial<CalendarItem>): Promise<CalendarItem[]> => {
  const list = await getCalendarList();
  const next = list.map(c => (c.id === id ? { ...c, ...patch, id: c.id, createdAt: c.createdAt } : c));
  await AsyncStorage.setItem(CALENDAR_KEY, JSON.stringify(next));
  return next;
};

export const removeCalendarItem = async (id: string): Promise<CalendarItem[]> => {
  const list = await getCalendarList();
  const next = list.filter(c => c.id !== id);
  await AsyncStorage.setItem(CALENDAR_KEY, JSON.stringify(next));
  return next;
};

export const clearCalendar = async (): Promise<void> => {
  await AsyncStorage.removeItem(CALENDAR_KEY);
};

// ============================================================================
// ROUND 67 — Engagement Rate Calculator
// ============================================================================

export type ErPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'blog';

export type ErEntry = {
  id: string;
  title: string;
  platform: ErPlatform;
  followers: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  createdAt: number;
};

const ER_KEY = '@content-coach/engagement-rate';

export const ER_PLATFORMS: { id: ErPlatform; label: string; emoji: string; goodEr: number; greatEr: number }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', goodEr: 3, greatEr: 6 },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', goodEr: 5, greatEr: 10 },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', goodEr: 2, greatEr: 5 },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', goodEr: 1, greatEr: 3 },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', goodEr: 2, greatEr: 5 },
  { id: 'blog', label: 'Blog / SEO', emoji: '📝', goodEr: 1, greatEr: 3 },
];

export type ErBreakdown = {
  erByFollowers: number;
  erByReach: number;
  likesRate: number;
  commentsRate: number;
  sharesRate: number;
  savesRate: number;
  verdict: 'low' | 'mid' | 'good' | 'great';
  verdictLabel: string;
  verdictEmoji: string;
  verdictColor: string;
  recommendation: string;
};

export const computeEngagement = (entry: Omit<ErEntry, 'id' | 'createdAt' | 'title'>, platform: ErPlatform): ErBreakdown => {
  const meta = ER_PLATFORMS.find(p => p.id === platform) ?? ER_PLATFORMS[0];
  const totalEngagement = entry.likes + entry.comments + entry.shares + entry.saves;
  const erByFollowers = entry.followers > 0 ? (totalEngagement / entry.followers) * 100 : 0;
  const erByReach = entry.reach > 0 ? (totalEngagement / entry.reach) * 100 : 0;
  const likesRate = entry.reach > 0 ? (entry.likes / entry.reach) * 100 : 0;
  const commentsRate = entry.reach > 0 ? (entry.comments / entry.reach) * 100 : 0;
  const sharesRate = entry.reach > 0 ? (entry.shares / entry.reach) * 100 : 0;
  const savesRate = entry.reach > 0 ? (entry.saves / entry.reach) * 100 : 0;

  const score = erByReach;
  let verdict: ErBreakdown['verdict'] = 'low';
  let verdictLabel = 'Düşük';
  let verdictEmoji = '🍂';
  let verdictColor = '#EF4444';
  let recommendation = 'Hook veya görseli değiştir. Saatini kontrol et.';

  if (score >= meta.greatEr * 2) {
    verdict = 'great';
    verdictLabel = 'Mükemmel';
    verdictEmoji = '🌟';
    verdictColor = '#10B981';
    recommendation = 'Bu format/teknik tekrarlanmalı. Hemen bir varyasyonunu planla.';
  } else if (score >= meta.greatEr) {
    verdict = 'good';
    verdictLabel = 'İyi';
    verdictEmoji = '✅';
    verdictColor = '#22C55E';
    recommendation = 'Topluluk sinyali güçlü. CTA veya saatte küçük bir tweak dene.';
  } else if (score >= meta.goodEr) {
    verdict = 'mid';
    verdictLabel = 'Standart';
    verdictEmoji = '🌤️';
    verdictColor = '#F59E0B';
    recommendation = 'Ortalama. Açılış frame\'i veya başlık üzerinde çalış.';
  }

  return {
    erByFollowers,
    erByReach,
    likesRate,
    commentsRate,
    sharesRate,
    savesRate,
    verdict,
    verdictLabel,
    verdictEmoji,
    verdictColor,
    recommendation,
  };
};

export const getErList = async (): Promise<ErEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(ER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ErEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.title === 'string'
    );
  } catch {
    return [];
  }
};

export const saveEr = async (entry: Omit<ErEntry, 'id' | 'createdAt'>): Promise<ErEntry[]> => {
  const list = await getErList();
  const full: ErEntry = {
    ...entry,
    id: `er-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 40);
  await AsyncStorage.setItem(ER_KEY, JSON.stringify(next));
  return next;
};

export const removeEr = async (id: string): Promise<ErEntry[]> => {
  const list = await getErList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(ER_KEY, JSON.stringify(next));
  return next;
};

export const clearEr = async (): Promise<void> => {
  await AsyncStorage.removeItem(ER_KEY);
};

// ============================================================================
// ROUND 68 — Series Tracker
// ============================================================================

export type TrackerStatus = 'active' | 'paused' | 'finished' | 'abandoned';

export type TrackerEp = {
  id: string;
  number: number;
  title: string;
  platform: string;
  status: 'planned' | 'shot' | 'edited' | 'published';
  publishedAt: number | null;
  notes: string;
  createdAt: number;
};

export type SeriesEntry = {
  id: string;
  name: string;
  description: string;
  platform: string;
  format: string;
  totalEpisodes: number;
  cadenceDays: number;
  episodes: TrackerEp[];
  status: TrackerStatus;
  createdAt: number;
};

const TRACKER_KEY = '@content-coach/series-tracker';

export const TRACKER_STATUS_META: Record<TrackerStatus, { label: string; emoji: string; color: string }> = {
  active: { label: 'Aktif', emoji: '🟢', color: '#10B981' },
  paused: { label: 'Duraklatıldı', emoji: '⏸️', color: '#F59E0B' },
  finished: { label: 'Tamamlandı', emoji: '🏁', color: '#6366f1' },
  abandoned: { label: 'Vazgeçildi', emoji: '❌', color: '#EF4444' },
};

export const TRACKER_EP_STATUS_META: Record<TrackerEp['status'], { label: string; emoji: string; color: string }> = {
  planned: { label: 'Planlı', emoji: '📌', color: '#94a3b8' },
  shot: { label: 'Çekildi', emoji: '🎥', color: '#F59E0B' },
  edited: { label: 'Kurgulandı', emoji: '✂️', color: '#0EA5E9' },
  published: { label: 'Yayında', emoji: '🚀', color: '#10B981' },
};

export const getTrackerList = async (): Promise<SeriesEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(TRACKER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SeriesEntry =>
        s && typeof s === 'object' && typeof s.id === 'string' && typeof s.name === 'string'
    );
  } catch {
    return [];
  }
};

export const saveTracker = async (s: Omit<SeriesEntry, 'id' | 'createdAt' | 'episodes'> & { episodes?: TrackerEp[] }): Promise<SeriesEntry[]> => {
  const list = await getTrackerList();
  const full: SeriesEntry = {
    ...s,
    episodes: s.episodes ?? [],
    id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 30);
  await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(next));
  return next;
};

export const updateTracker = async (id: string, patch: Partial<SeriesEntry>): Promise<SeriesEntry[]> => {
  const list = await getTrackerList();
  const next = list.map(s => (s.id === id ? { ...s, ...patch, id: s.id, createdAt: s.createdAt } : s));
  await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(next));
  return next;
};

export const addTrackerEp = async (seriesId: string, ep: Omit<TrackerEp, 'id' | 'createdAt'>): Promise<SeriesEntry[]> => {
  const list = await getTrackerList();
  const next = list.map(s => {
    if (s.id !== seriesId) return s;
    const newEp: TrackerEp = {
      ...ep,
      id: `track-ep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const episodes = [...s.episodes, newEp].sort((a, b) => a.number - b.number);
    return { ...s, episodes };
  });
  await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(next));
  return next;
};

export const updateTrackerEp = async (seriesId: string, episodeId: string, patch: Partial<TrackerEp>): Promise<SeriesEntry[]> => {
  const list = await getTrackerList();
  const next = list.map(s => {
    if (s.id !== seriesId) return s;
    const episodes = s.episodes.map(e =>
      e.id === episodeId ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e
    );
    return { ...s, episodes };
  });
  await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(next));
  return next;
};

export const removeTrackerEp = async (seriesId: string, episodeId: string): Promise<SeriesEntry[]> => {
  const list = await getTrackerList();
  const next = list.map(s => {
    if (s.id !== seriesId) return s;
    return { ...s, episodes: s.episodes.filter(e => e.id !== episodeId) };
  });
  await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(next));
  return next;
};

export const removeTracker = async (id: string): Promise<SeriesEntry[]> => {
  const list = await getTrackerList();
  const next = list.filter(s => s.id !== id);
  await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(next));
  return next;
};

export const clearTracker = async (): Promise<void> => {
  await AsyncStorage.removeItem(TRACKER_KEY);
};

export const trackerProgress = (s: SeriesEntry): { published: number; done: number; percent: number; remainingDays: number } => {
  const published = s.episodes.filter(e => e.status === 'published').length;
  const done = s.episodes.filter(e => e.status === 'published' || e.status === 'edited').length;
  const percent = s.totalEpisodes > 0 ? Math.round((published / s.totalEpisodes) * 100) : 0;
  const remainingDays = Math.max(0, (s.totalEpisodes - published) * s.cadenceDays);
  return { published, done, percent, remainingDays };
};

// ============================================================================
// ROUND 69 — Weekly Theme Planner
// ============================================================================

export type ThemeWeek = {
  id: string;
  weekStart: number;
  theme: string;
  pillar: string;
  days: { day: number; subtopic: string; format: string; hook: string }[];
  notes: string;
  createdAt: number;
};

const THEME_KEY = '@content-coach/weekly-themes';

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const THEME_PILLARS: { id: string; label: string; emoji: string; color: string }[] = [
  { id: 'education', label: 'Eğitim', emoji: '🎓', color: '#0EA5E9' },
  { id: 'story', label: 'Hikaye', emoji: '📖', color: '#F472B6' },
  { id: 'opinion', label: 'Görüş', emoji: '💭', color: '#8B5CF6' },
  { id: 'howto', label: 'Nasıl yapılır', emoji: '🛠️', color: '#10B981' },
  { id: 'fun', label: 'Eğlence', emoji: '🎈', color: '#F59E0B' },
  { id: 'community', label: 'Topluluk', emoji: '🤝', color: '#22C55E' },
  { id: 'behind', label: 'Perde arkası', emoji: '🎬', color: '#EF4444' },
];

const SUBTOPIC_BY_PILLAR: Record<string, string[]> = {
  education: ['kavram açıklaması', 'yanlış bilinen bilgi', 'çerçeve tanıtımı', 'küçük bir ders', 'tarihsel bağlam', 'görsel karşılaştırma', 'özet tekrar'],
  story: ['kişisel deneyim', 'müşteri hikayesi', 'önce-sonra', 'hata itirafı', 'küçük zafer', 'ilham veren an', 'öğrenilen ders'],
  opinion: ['sektör eleştirisi', 'trend tahmini', 'popüler görüşe itiraz', 'kişisel manifesto', 'sıcak konu', 'alternatif bakış', 'tartışma daveti'],
  howto: ['adım adım liste', 'araç/uygulama turu', 'şablon paylaşımı', '5 dakikalık ipucu', 'hata çözümü', 'optimizasyon tüyosu', 'kaynak önerisi'],
  fun: ['mizah skeci', 'quiz/poll', 'topluluk challenge', 'günlük soru', 'beklenmedik itiraf', 'meme/format', 'röportaj tadında'],
  community: ['üye tanıtımı', 'soru-cevap', 'teşekkür/mention', 'geri bildirim turu', 'açık çağrı', 'topluluk kuralı', 'tartışma konusu'],
  behind: ['iş akışı', 'araçlar/stack', 'planlama süreci', 'taslak hali', 'çekim hikayesi', 'düşünce akışı', 'önümüzdeki adım'],
};

const FORMATS = ['Reels', 'Carousel', 'Caption', 'Story', 'Thread', 'Video'];

const HOOK_STARTERS: Record<string, string[]> = {
  education: [
    'Çoğu kişi {topic} hakkında şunu yanlış biliyor:',
    'Sana küçük bir çerçeve: {topic}',
    '{topic} öğrenmenin en hızlı yolu:',
  ],
  story: [
    'Bir yıl önce {topic} ile ilgili hiçbir şey bilmiyordum.',
    '{topic} sırasında yaşadığım en büyük sürpriz:',
    'Bunu herkesle paylaşmamıştım ama {topic} bana şunu öğretti:',
  ],
  opinion: [
    'Popüler görüş: "{topic} kolay". Gerçek:',
    'Sektörde kimse bunu söylemiyor: {topic}',
    '{topic} hakkında radikal bir fikrim var:',
  ],
  howto: [
    '{topic} için adım adım:',
    'Sana 5 dakikada {topic} öğreteyim:',
    '{topic} yaparken herkes şu hatayı yapıyor:',
  ],
  fun: [
    'Bir teste değer mi: {topic}?',
    '{topic} hakkında kimse sormadığı soru:',
    'Bu hafta {topic} — senden ne duymak isterim?',
  ],
  community: [
    'Topluluktan gelen en güzel cevap ({topic}):',
    '{topic} hakkında senin fikrin ne?',
    'Hep birlikte: {topic}',
  ],
  behind: [
    '{topic} perde arkası:',
    'Bunu nasıl yapıyorum: {topic}',
    '{topic} için kullandığım araçlar:',
  ],
};

const pickTheme = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

export const buildWeekTheme = (input: {
  theme: string;
  pillar: string;
  weekStart: number;
  seed?: number;
}): Omit<ThemeWeek, 'id' | 'createdAt'> => {
  const seed = input.seed ?? Date.now();
  const subs = SUBTOPIC_BY_PILLAR[input.pillar] ?? SUBTOPIC_BY_PILLAR.education;
  const hooks = HOOK_STARTERS[input.pillar] ?? HOOK_STARTERS.education;
  const days = Array.from({ length: 7 }, (_, day) => {
    const subtopic = pickTheme(subs, seed + day * 11);
    const format = pickTheme(FORMATS, seed + day * 7 + 3);
    const hookTemplate = pickTheme(hooks, seed + day * 5 + 1);
    const hook = hookTemplate.replace('{topic}', input.theme);
    return { day, subtopic, format, hook };
  });
  return {
    weekStart: input.weekStart,
    theme: input.theme,
    pillar: input.pillar,
    days,
    notes: '',
  };
};

export const getThemeWeekList = async (): Promise<ThemeWeek[]> => {
  try {
    const raw = await AsyncStorage.getItem(THEME_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is ThemeWeek =>
        t && typeof t === 'object' && typeof t.id === 'string' && typeof t.theme === 'string'
    );
  } catch {
    return [];
  }
};

export const saveThemeWeek = async (week: Omit<ThemeWeek, 'id' | 'createdAt'>): Promise<ThemeWeek[]> => {
  const list = await getThemeWeekList();
  const full: ThemeWeek = {
    ...week,
    id: `theme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 24);
  await AsyncStorage.setItem(THEME_KEY, JSON.stringify(next));
  return next;
};

export const removeThemeWeek = async (id: string): Promise<ThemeWeek[]> => {
  const list = await getThemeWeekList();
  const next = list.filter(t => t.id !== id);
  await AsyncStorage.setItem(THEME_KEY, JSON.stringify(next));
  return next;
};

export const clearThemeWeeks = async (): Promise<void> => {
  await AsyncStorage.removeItem(THEME_KEY);
};

export { DAY_NAMES };

// ============================================================================
// ROUND 70 — Bio Optimizer
// ============================================================================

export type BioPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'blog';

export type BioTone = 'pro' | 'casual' | 'bold' | 'playful' | 'warm';

export type BioEntry = {
  id: string;
  niche: string;
  audience: string;
  platform: BioPlatform;
  tone: BioTone;
  bio: string;
  highlights: string[];
  cta: string;
  createdAt: number;
};

const BIO_KEY = '@content-coach/bio';

export const BIO_PLATFORMS: { id: BioPlatform; label: string; emoji: string; cap: number }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', cap: 150 },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', cap: 80 },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', cap: 1000 },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', cap: 160 },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', cap: 220 },
  { id: 'blog', label: 'Blog', emoji: '📝', cap: 250 },
];

export const BIO_TONES: { id: BioTone; label: string; emoji: string; color: string }[] = [
  { id: 'pro', label: 'Profesyonel', emoji: '💼', color: '#0EA5E9' },
  { id: 'casual', label: 'Samimi', emoji: '☕', color: '#10B981' },
  { id: 'bold', label: 'Cesur', emoji: '⚡', color: '#F59E0B' },
  { id: 'playful', label: 'Eğlenceli', emoji: '🎈', color: '#F472B6' },
  { id: 'warm', label: 'Sıcak', emoji: '🌿', color: '#84CC16' },
];

const ROLE_BY_NICHE: Record<string, string[]> = {
  fitness: ['antrenör', 'sağlıklı yaşam rehberi', 'fitness koçu', 'performans uzmanı'],
  food: ['yemek yazarı', 'ev aşçısı', 'lezzet avcısı', 'tarif geliştirici'],
  tech: ['yazılımcı', 'ürün geliştirici', 'teknoloji anlatıcısı', 'AI meraklısı'],
  fashion: ['stil danışmanı', 'moda içerik üreticisi', 'kombin mimarı', 'kapak yüzü'],
  travel: ['gezi yazarı', 'rota tasarımcısı', 'backpacker', 'seyahat rehberi'],
  gaming: ['yayıncı', 'oyun incelemecisi', 'e-spor analisti', 'topluluk kurucusu'],
  personal_dev: ['üretkenlik koçu', 'kitap kurdu', 'disiplin savunucusu', 'öğrenme tasarımcısı'],
  beauty: ['güzellik editörü', 'cilt bakım uzmanı', 'makyaj sanatçısı', 'içerik üreticisi'],
};

const CTA_TEMPLATES: Record<BioTone, string[]> = {
  pro: [
    '📩 İş birliği → DM veya link',
    '🚀 Hizmetler → profildeki link',
    '💼 B2B için: e-posta profilde',
  ],
  casual: [
    '☕ Sohbet için DM açık',
    '💌 Listeme katıl → link',
    '🎁 Bir şey gönderdim → bio\'da',
  ],
  bold: [
    '⏭ Bugün başla → link',
    '🎯 Son şans → profildeki link',
    '🔥 Bir sonraki adım → bio',
  ],
  playful: [
    '🎈 Sürpriz → linke tıkla',
    '🍕 Buluşalım → DM',
    '🎁 Gizli içerik → bio link',
  ],
  warm: [
    '🌿 Birlikte öğrenelim → link',
    '🤝 Topluluğa katıl → bio',
    '☕ Bir fincan kahve sohbeti → DM',
  ],
};

const HIGHLIGHT_BY_NICHE: Record<string, { name: string; emoji: string }[]> = {
  fitness: [
    { name: 'Antrenman', emoji: '💪' },
    { name: 'Tarifler', emoji: '🥗' },
    { name: 'Önce-Sonra', emoji: '✨' },
    { name: 'SSS', emoji: '❓' },
  ],
  food: [
    { name: 'Tarifler', emoji: '🍳' },
    { name: 'Mekanlar', emoji: '📍' },
    { name: 'Malzemeler', emoji: '🛒' },
    { name: 'İpuçları', emoji: '💡' },
  ],
  tech: [
    { name: 'Projeler', emoji: '💻' },
    { name: 'Tutorial', emoji: '🎓' },
    { name: 'Araçlar', emoji: '🛠️' },
    { name: 'SSS', emoji: '❓' },
  ],
  fashion: [
    { name: 'Kombinler', emoji: '👗' },
    { name: 'Alışveriş', emoji: '🛍️' },
    { name: 'Trendler', emoji: '📈' },
    { name: 'İlham', emoji: '✨' },
  ],
  travel: [
    { name: 'Rotalar', emoji: '🗺️' },
    { name: 'Oteller', emoji: '🏨' },
    { name: 'Yeme-İçme', emoji: '🍽️' },
    { name: 'İpuçları', emoji: '💡' },
  ],
  gaming: [
    { name: 'Canlı', emoji: '🎮' },
    { name: 'Rehberler', emoji: '📖' },
    { name: 'Yayınlar', emoji: '🎬' },
    { name: 'Topluluk', emoji: '🛡️' },
  ],
  personal_dev: [
    { name: 'Kitaplar', emoji: '📚' },
    { name: 'İpuçları', emoji: '💡' },
    { name: 'Hedefler', emoji: '🎯' },
    { name: 'SSS', emoji: '❓' },
  ],
  beauty: [
    { name: 'Rutini', emoji: '🌿' },
    { name: 'Ürünler', emoji: '🧴' },
    { name: 'Makyaj', emoji: '💄' },
    { name: 'SSS', emoji: '❓' },
  ],
};

const pickBio = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

export const buildBio = (input: {
  niche: string;
  audience: string;
  platform: BioPlatform;
  tone: BioTone;
  seed?: number;
}): { bio: string; highlights: string[]; cta: string; meta: { platform: BioPlatform; tone: BioTone; niche: string } } => {
  const seed = input.seed ?? Date.now();
  const role = pickBio(ROLE_BY_NICHE[input.niche] ?? ['içerik üreticisi'], seed);
  const cta = pickBio(CTA_TEMPLATES[input.tone] ?? CTA_TEMPLATES.casual, seed + 5);
  const platform = input.platform;
  const tone = input.tone;
  const audienceLine = input.audience.trim() ? `${input.audience.trim()} için ` : '';

  let bio = '';
  switch (tone) {
    case 'pro':
      bio = `${role.charAt(0).toUpperCase() + role.slice(1)} · ${audienceLine}somut değer.\n🎯 Net içerik, az hype.\n${cta}`;
      break;
    case 'casual':
      bio = `${role} 🎈\n${audienceLine}birlikte öğreniyoruz.\n${cta}`;
      break;
    case 'bold':
      bio = `${role.toUpperCase()}.\n${audienceLine}söylediğimi değil, işe yarayanı anlatıyorum.\n${cta}`;
      break;
    case 'playful':
      bio = `${role} 🎉\n${audienceLine}eğlenceli bir not bırakıyorum.\n${cta}`;
      break;
    case 'warm':
      bio = `${role} 🌿\n${audienceLine}yanlarında olmaya çalışıyorum.\n${cta}`;
      break;
  }

  const highlightPool = HIGHLIGHT_BY_NICHE[input.niche] ?? [
    { name: 'Hakkımda', emoji: '👋' },
    { name: 'İçerikler', emoji: '🎬' },
    { name: 'SSS', emoji: '❓' },
    { name: 'İletişim', emoji: '📩' },
  ];
  const highlights = highlightPool.map(h => `${h.emoji} ${h.name}`);

  if (platform === 'linkedin') {
    bio = `${role.charAt(0).toUpperCase() + role.slice(1)} | ${audienceLine}somut içerik.\n${cta}`;
  } else if (platform === 'twitter') {
    bio = `${role}. ${audienceLine}${cta}`.slice(0, 160);
  }

  return { bio, highlights, cta, meta: { platform, tone, niche: input.niche } };
};

export const getBioList = async (): Promise<BioEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(BIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is BioEntry =>
        b && typeof b === 'object' && typeof b.id === 'string' && typeof b.bio === 'string'
    );
  } catch {
    return [];
  }
};

export const saveBio = async (entry: Omit<BioEntry, 'id' | 'createdAt'>): Promise<BioEntry[]> => {
  const list = await getBioList();
  const full: BioEntry = {
    ...entry,
    id: `bio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 16);
  await AsyncStorage.setItem(BIO_KEY, JSON.stringify(next));
  return next;
};

export const removeBio = async (id: string): Promise<BioEntry[]> => {
  const list = await getBioList();
  const next = list.filter(b => b.id !== id);
  await AsyncStorage.setItem(BIO_KEY, JSON.stringify(next));
  return next;
};

export const clearBios = async (): Promise<void> => {
  await AsyncStorage.removeItem(BIO_KEY);
};

// ============================================================================
// ROUND 71 — Hook Bank
// ============================================================================

export type HookCategory = 'curiosity' | 'provocation' | 'number' | 'question' | 'quote' | 'story' | 'howto';

export type HookEntry = {
  id: string;
  category: HookCategory;
  text: string;
  platform: string;
  topic: string;
  strength: 1 | 2 | 3 | 4 | 5;
  used: boolean;
  createdAt: number;
};

const HOOK_KEY = '@content-coach/hook-bank';

export const HOOK_CATEGORIES: { id: HookCategory; label: string; emoji: string; color: string; hint: string }[] = [
  { id: 'curiosity', label: 'Merak', emoji: '🧐', color: '#8B5CF6', hint: 'Eksik bilgi açığı yaratır' },
  { id: 'provocation', label: 'Provokasyon', emoji: '⚡', color: '#EF4444', hint: 'Polarize eder, dikkat çeker' },
  { id: 'number', label: 'Sayı', emoji: '🔢', color: '#0EA5E9', hint: 'Somut vaat, tıklanabilir' },
  { id: 'question', label: 'Soru', emoji: '❓', color: '#F59E0B', hint: 'Cevap verme dürtüsü' },
  { id: 'quote', label: 'Alıntı', emoji: '💬', color: '#10B981', hint: 'Otorite ya da sürpriz' },
  { id: 'story', label: 'Hikaye', emoji: '📖', color: '#F472B6', hint: 'Kişisel bağ kurar' },
  { id: 'howto', label: 'Nasıl', emoji: '🛠️', color: '#22C55E', hint: 'Pratik değer vaadi' },
];

const HOOK_BANK_TEMPLATES: Record<HookCategory, string[]> = {
  curiosity: [
    '{topic} hakkında kimsenin söylemediği şey:',
    '{topic} üzerine 1 detay her şeyi değiştirir:',
    '{topic} sırasında kimse şunu sormadı:',
    'Eğer {topic} yapıyorsan, bu yazıyı kaçırma.',
    '{topic} göründüğü gibi değil.',
  ],
  provocation: [
    '{topic} hakkında yalan söylüyorsun.',
    '{topic} sevenlerin %90\'ı bunu bilmiyor.',
    '{topic} üzerine popüler görüş yanlış.',
    'Sıcak bakalım: {topic} işe yaramıyor.',
    '{topic} üzerine söylediğin her şeyi unut.',
  ],
  number: [
    '7 {topic} tüyosu (en önemli 3. sırada):',
    '3 adımda {topic}:',
    '{topic} için 5 hata (2. en kritik):',
    '12 ayda {topic} — gün gün yol haritası.',
    '5 dakikada {topic} öğren.',
  ],
  question: [
    'Sen olsan {topic} için ne yapardın?',
    'Hangisi daha doğru: A mı B?',
    '{topic} hakkında en çok neyi merak ediyorsun?',
    'Yorumla: {topic} sende işe yarıyor mu?',
    'Neden {topic} hakkında konuşmuyoruz?',
  ],
  quote: [
    '"Asla {topic} yapma" — sözünü hatırlatan var mı?',
    'Bir zamanlar {topic} diyen biri: "…".',
    'Bir mentorum şunu söyledi: {topic}',
    'En sevdiğim {topic} alıntısı:',
    'Sektörün en kısa tanımı: {topic}.',
  ],
  story: [
    '{topic} yüzünden 3 ay kaybettim. Sonra…',
    'Bir müşterim {topic} için bana geldi:',
    '{topic} üzerine küçük bir itiraf:',
    'Tam {topic} diye düşünürken, başıma gelen:',
    'Bir yıl önce {topic} bilmiyordum. Şimdi…',
  ],
  howto: [
    '{topic} nasıl yapılır (adım adım):',
    'Sana {topic} için 3 taktik:',
    '{topic} kolaylaştıran araç listesi:',
    'Bu checklist ile {topic} unutmazsın.',
    '{topic} için şablonu paylaşıyorum.',
  ],
};

const pickHook = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

export const buildHookSuggestions = (input: {
  topic: string;
  category: HookCategory;
  count: number;
  seed?: number;
}): string[] => {
  const seed = input.seed ?? Date.now();
  const templates = HOOK_BANK_TEMPLATES[input.category] ?? HOOK_BANK_TEMPLATES.curiosity;
  const out: string[] = [];
  for (let i = 0; i < input.count; i++) {
    const t = pickHook(templates, seed + i * 13);
    out.push(t.replace(/\{topic\}/g, input.topic.trim() || 'bu konu'));
  }
  return Array.from(new Set(out));
};

export const getHookList = async (): Promise<HookEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(HOOK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (h): h is HookEntry =>
        h && typeof h === 'object' && typeof h.id === 'string' && typeof h.text === 'string'
    );
  } catch {
    return [];
  }
};

export const saveHook = async (entry: Omit<HookEntry, 'id' | 'createdAt'>): Promise<HookEntry[]> => {
  const list = await getHookList();
  const full: HookEntry = {
    ...entry,
    id: `hook-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 80);
  await AsyncStorage.setItem(HOOK_KEY, JSON.stringify(next));
  return next;
};

export const updateHook = async (id: string, patch: Partial<HookEntry>): Promise<HookEntry[]> => {
  const list = await getHookList();
  const next = list.map(h => (h.id === id ? { ...h, ...patch, id: h.id, createdAt: h.createdAt } : h));
  await AsyncStorage.setItem(HOOK_KEY, JSON.stringify(next));
  return next;
};

export const removeHook = async (id: string): Promise<HookEntry[]> => {
  const list = await getHookList();
  const next = list.filter(h => h.id !== id);
  await AsyncStorage.setItem(HOOK_KEY, JSON.stringify(next));
  return next;
};

export const clearHooks = async (): Promise<void> => {
  await AsyncStorage.removeItem(HOOK_KEY);
};

// ============================================================================
// ROUND 72 — Story Script Generator
// ============================================================================

export type StoryMood = 'energetic' | 'calm' | 'dramatic' | 'funny' | 'inspiring';

export type StoryFrame = {
  index: number;
  seconds: string;
  visual: string;
  caption: string;
  audio: string;
};

export type StoryScript = {
  id: string;
  topic: string;
  mood: StoryMood;
  platform: string;
  frames: StoryFrame[];
  totalSeconds: number;
  createdAt: number;
};

const STORY_KEY = '@content-coach/story-scripts';

export const STORY_MOODS: { id: StoryMood; label: string; emoji: string; color: string; music: string }[] = [
  { id: 'energetic', label: 'Enerjik', emoji: '⚡', color: '#F59E0B', music: 'hızlı pop, ritim yüksek' },
  { id: 'calm', label: 'Sakin', emoji: '🌿', color: '#84CC16', music: 'ambient, düşük tempo' },
  { id: 'dramatic', label: 'Dramatik', emoji: '🎭', color: '#8B5CF6', music: 'cinematic, build-up' },
  { id: 'funny', label: 'Komik', emoji: '😂', color: '#F472B6', music: 'komedi sting, cartoon FX' },
  { id: 'inspiring', label: 'İlham', emoji: '✨', color: '#0EA5E9', music: 'epic, korali yükseliş' },
];

const HOOK_OPENERS: Record<StoryMood, string[]> = {
  energetic: ['Bekle, hazır mısın?', 'Şimdi!', 'Gözlerini kaçırma!'],
  calm: ['Sakin ol, bir dakika.', 'Bugün sana bir şey göstermek istiyorum.', 'Beraber bir nefes alalım.'],
  dramatic: ['Bir hata yaptım.', 'Hiç beklemediğim bir şey oldu.', 'Tam o an…'],
  funny: ['Bu olay beni bitirdi.', 'Plot twist geliyor:', 'Önce kendime güldüm, sonra…'],
  inspiring: ['Bunu 1 yıl önce hayal bile edemezdim.', 'Küçük bir not düşmek istedim.', 'Yol boyunca öğrendiğim bir şey:'],
};

const CONFLICT_PROMPTS: Record<StoryMood, string[]> = {
  energetic: [
    'Ama işler ilk denemede patladı.',
    'Hedef: 7 günde dönüşüm.',
    'Süre: 5 dakika — başlıyoruz!',
  ],
  calm: [
    'Bugün biraz durgun hissediyordum.',
    'Eskiden bu soruya cevap veremezdim.',
    'Zihnim çok kalabalıktı.',
  ],
  dramatic: [
    'İlk adımda her şey ters gitti.',
    'Tam pes ediyordum ki…',
    'Telefon titreşti — kötü haber.',
  ],
  funny: [
    'Algoritmayı yanlış anlamışım.',
    'Plan: "kolay olacak". Gerçek: ?',
    'Selfie çekiyordum, yüzüm düştü.',
  ],
  inspiring: [
    'Ama hep bir "dün" vardı — geri dönüşü olmayan.',
    'Cesaret edemediğim 3 şey.',
    'Süre: 30 gün. Şart: her gün.',
  ],
};

const PAYOFF_PROMPTS: Record<StoryMood, string[]> = {
  energetic: [
    'Sonuç: göründüğünden çok daha kolay.',
    'Liste aldım, başardım, ekran görüntüsü aldım.',
    '3 hamlede iş bitti.',
  ],
  calm: [
    '15 dakika sonra: netlik geldi.',
    'Liste çıkardım, nefes aldım.',
    'Sadece küçük bir ritüel yetti.',
  ],
  dramatic: [
    'Ama sonunda kazandım.',
    'Dönüş anı: 17. gün.',
    'Yanlış hesap, doğru sonuç.',
  ],
  funny: [
    'Sonuç: evet, yanlış hashtag.',
    'Sonunda algoritma bana güldü.',
    '5. denemede algoritma beni tanıdı.',
  ],
  inspiring: [
    'Bugün 3 şey öğrendim.',
    'Fark: 1 karar.',
    'Sonuç: küçük bir iyilik.',
  ],
};

const CTA_BY_PLATFORM: Record<string, string[]> = {
  instagram: ['DM\'de "EVET" yaz.', 'Listeme katıl → bio.', 'Kaydet, sonra uygula.'],
  tiktok: ['Yorumda "DEVAM" yaz.', 'Beğen, paylaş.', 'Profil linkine tıkla.'],
  youtube: ['Altyazıdaki linke tıkla.', 'Abone ol, bildirim aç.', 'Sonraki bölüm yarın.'],
  twitter: ['RT ile destekle.', 'Yanıtla ne düşünüyorsun.', 'Listede daha fazlası var.'],
  linkedin: ['Bağlantı kur, DM at.', 'Makaleyi paylaş.', 'Yorumda deneyimini yaz.'],
  blog: ['Newsletter\'a abone ol.', 'Yorum bırak.', 'İlgili yazı: link.'],
};

const AUDIO_BY_MOOD: Record<StoryMood, string[]> = {
  energetic: ['upbeat drop', 'hi-hat loop', 'kick + clap pattern'],
  calm: ['lo-fi piano', 'soft pad', 'nature ambience'],
  dramatic: ['cinematic boom', 'rising strings', 'sub bass hit'],
  funny: ['comedy pizzicato', 'wah-wah trombon', 'cartoon spring'],
  inspiring: ['epic choir pad', 'building synth', 'triumphant horn'],
};

const pickStory = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

export const buildStoryScript = (input: {
  topic: string;
  mood: StoryMood;
  platform: string;
  seed?: number;
}): { frames: StoryFrame[]; totalSeconds: number; meta: { topic: string; mood: StoryMood; platform: string } } => {
  const seed = input.seed ?? Date.now();
  const topic = input.topic.trim() || 'bu konu';

  const opener = pickStory(HOOK_OPENERS[input.mood], seed);
  const conflict = pickStory(CONFLICT_PROMPTS[input.mood], seed + 5);
  const payoff = pickStory(PAYOFF_PROMPTS[input.mood], seed + 9);
  const cta = pickStory(CTA_BY_PLATFORM[input.platform] ?? CTA_BY_PLATFORM.instagram, seed + 13);
  const audioBase = pickStory(AUDIO_BY_MOOD[input.mood], seed + 17);

  const frames: StoryFrame[] = [
    {
      index: 1,
      seconds: '0-3 sn',
      visual: `Yakın plan, yüze zoom; metin overlay: "${topic.toUpperCase()}"`,
      caption: opener,
      audio: `${audioBase} başlar`,
    },
    {
      index: 2,
      seconds: '3-7 sn',
      visual: 'Hızlı geçiş, hikaye anlatımı (2-3 frame)',
      caption: conflict,
      audio: 'müzik devam, tempo sabit',
    },
    {
      index: 3,
      seconds: '7-12 sn',
      visual: 'Çözüm/sonuç görseli, ürün/sonuç ekranı',
      caption: payoff,
      audio: 'müzik yükselişe geçer',
    },
    {
      index: 4,
      seconds: '12-15 sn',
      visual: 'Logo + CTA butonu overlay',
      caption: cta,
      audio: 'müzik son vuruş, fade out',
    },
  ];

  return { frames, totalSeconds: 15, meta: { topic, mood: input.mood, platform: input.platform } };
};

export const getStoryList = async (): Promise<StoryScript[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is StoryScript =>
        s && typeof s === 'object' && typeof s.id === 'string' && Array.isArray(s.frames)
    );
  } catch {
    return [];
  }
};

export const saveStoryScript = async (s: Omit<StoryScript, 'id' | 'createdAt'>): Promise<StoryScript[]> => {
  const list = await getStoryList();
  const full: StoryScript = {
    ...s,
    id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 30);
  await AsyncStorage.setItem(STORY_KEY, JSON.stringify(next));
  return next;
};

export const removeStoryScript = async (id: string): Promise<StoryScript[]> => {
  const list = await getStoryList();
  const next = list.filter(s => s.id !== id);
  await AsyncStorage.setItem(STORY_KEY, JSON.stringify(next));
  return next;
};

export const clearStoryScripts = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORY_KEY);
};

// ============================================================================
// ROUND 73 — Trend Radar
// ============================================================================

export type TrendPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'blog';

export type TrendLifecycle = 'rising' | 'peak' | 'fading' | 'evergreen';

export type TrendEntry = {
  id: string;
  topic: string;
  niche: string;
  platform: TrendPlatform;
  hook: string;
  lifecycle: TrendLifecycle;
  opportunityScore: number;
  spottedAt: number;
  expiresAt: number;
  notes: string;
  createdAt: number;
};

const TREND_KEY = '@content-coach/trend-radar';

export const TREND_PLATFORMS: { id: TrendPlatform; label: string; emoji: string; color: string }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: '#000000' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', color: '#FF0000' },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
  { id: 'blog', label: 'Blog / SEO', emoji: '📝', color: '#10B981' },
];

export const TREND_LIFECYCLE_META: Record<TrendLifecycle, { label: string; emoji: string; color: string; lifespan: number; tip: string }> = {
  rising: { label: 'Yükselişte', emoji: '🚀', color: '#10B981', lifespan: 14, tip: 'İlk girenlerden ol. Hook\'u hemen kurgula.' },
  peak: { label: 'Zirve', emoji: '🔥', color: '#F59E0B', lifespan: 7, tip: 'Pencerenin tam ortasındasın. Bugün paylaş.' },
  fading: { label: 'Sönüyor', emoji: '🍂', color: '#F97316', lifespan: 5, tip: 'Trend dönüşüyle (twist) farklılaştır, yoksa geç.' },
  evergreen: { label: 'Evergreen', emoji: '🌲', color: '#22C55E', lifespan: 365, tip: 'Yıl boyunca kullanılabilir. Zamanlama esnek.' },
};

const NICHE_TRENDS: Record<string, { topic: string; hook: string; lifecycle: TrendLifecycle }[]> = {
  fitness: [
    { topic: '75 Hard challenge', hook: '75 günde 5 alışkanlık — işe yarıyor mu?', lifecycle: 'evergreen' },
    { topic: '10K adım hedefi', hook: 'Günde 10K adım — gerçekten gerekli mi?', lifecycle: 'evergreen' },
    { topic: 'Yeni GLUTE programı', hook: 'Sadece 4 haftada kalça transformasyonu', lifecycle: 'rising' },
    { topic: 'Protein ihtiyacı', hook: 'Protein gerçekten kas yapar mı?', lifecycle: 'peak' },
  ],
  food: [
    { topic: '10 dk akşam yemeği', hook: '10 dakikada akşam yemeği — 3 malzeme', lifecycle: 'evergreen' },
    { topic: 'Yüksek proteinli kahvaltı', hook: '30g protein, 5 dakikada hazır', lifecycle: 'peak' },
    { topic: 'Yerli malı haftası', hook: 'Yerli üretici listesi (bu hafta)', lifecycle: 'fading' },
    { topic: 'Airfryer tarifleri', hook: 'Airfryer\'da çıtır tavuk — 12 dakika', lifecycle: 'rising' },
  ],
  tech: [
    { topic: 'Yapay zeka ajanları', hook: 'AI ajanları: 2025\'in en büyük kaybı mı?', lifecycle: 'peak' },
    { topic: 'Cursor vs Copilot', hook: 'Cursor mı Copilot mu? Birebir karşılaştırma', lifecycle: 'rising' },
    { topic: 'RSS geri dönüşü', hook: 'RSS neden tekrar trend?', lifecycle: 'rising' },
    { topic: 'İndie hacking', hook: 'Tek kişilik SaaS: 1K MRR gerçekçi mi?', lifecycle: 'evergreen' },
  ],
  fashion: [
    { topic: 'Mevsimlik kapsül gardırop', hook: '30 parça, 90 kombin — kapsül gardırop', lifecycle: 'evergreen' },
    { topic: 'Yerli marka spotlight', hook: 'Yerli marka: 3 yeni keşif', lifecycle: 'rising' },
    { topic: 'Sneaker trendleri', hook: '2025 sneaker radarı', lifecycle: 'peak' },
    { topic: 'Vintage geri dönüşü', hook: 'Vintage neden tekrar pop?', lifecycle: 'rising' },
  ],
  travel: [
    { topic: 'Yurt içi gizli cevherler', hook: 'Bu köyü kimse bilmiyor', lifecycle: 'evergreen' },
    { topic: 'Bütçe seyahat ipuçları', hook: '500 TL ile hafta sonu kaçamağı', lifecycle: 'evergreen' },
    { topic: 'Sonbahar rotaları', hook: 'Sonbaharda gidilecek 5 yer', lifecycle: 'fading' },
    { topic: 'Yeni vize kolaylığı', hook: 'Bu ülke vizeyi kaldırdı (güncel)', lifecycle: 'peak' },
  ],
  gaming: [
    { topic: 'Indie game öne çıkanlar', hook: 'Bu hafta çıkan 3 indie oyun', lifecycle: 'rising' },
    { topic: 'Yeni sezon tier list', hook: 'Meta değişti — yeni tier list', lifecycle: 'peak' },
    { topic: 'Eski oyun nostaljisi', hook: 'X oyunu geri dönüyor', lifecycle: 'rising' },
    { topic: 'Live service eleştirisi', hook: 'Live service neden tüketiciyi yoruyor', lifecycle: 'evergreen' },
  ],
  personal_dev: [
    { topic: 'AI ile öğrenme', hook: 'Yapay zeka ile 2 kat hızlı öğren', lifecycle: 'peak' },
    { topic: 'Sabah rutini mistikleri', hook: '4 saatlik rutin gerçekten gerekli mi?', lifecycle: 'evergreen' },
    { topic: 'Kitap özetleri', hook: 'Bu ay okuduğum 3 kitap — özet', lifecycle: 'evergreen' },
    { topic: 'Hedef sistemi 2025', hook: '12 haftalık yıl sistemi nasıl işler?', lifecycle: 'rising' },
  ],
  beauty: [
    { topic: 'Skin cycling', hook: '4 günde 1 döngü: skin cycling', lifecycle: 'peak' },
    { topic: 'Yerli marka spotlight', hook: 'Yerli cilt bakım markası öne çıkanlar', lifecycle: 'rising' },
    { topic: 'Makyajsız gün', hook: 'Makyajsız günler için bakım', lifecycle: 'evergreen' },
    { topic: 'Retinol gerçekleri', hook: 'Retinol: 3 sır', lifecycle: 'evergreen' },
  ],
};

const PLATFORM_BIAS: Record<TrendPlatform, Partial<Record<TrendLifecycle, number>>> = {
  instagram: { rising: 1.1, peak: 1.0, fading: 0.7, evergreen: 0.9 },
  tiktok: { rising: 1.4, peak: 1.2, fading: 0.5, evergreen: 0.6 },
  youtube: { rising: 1.0, peak: 1.1, fading: 0.8, evergreen: 1.2 },
  twitter: { rising: 1.2, peak: 1.0, fading: 0.6, evergreen: 0.8 },
  linkedin: { rising: 1.0, peak: 0.9, fading: 0.7, evergreen: 1.1 },
  blog: { rising: 0.8, peak: 0.7, fading: 0.9, evergreen: 1.3 },
};

const pickTrend = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

export const buildTrendSuggestions = (input: {
  niche: string;
  platform: TrendPlatform;
  count: number;
  seed?: number;
}): Omit<TrendEntry, 'id' | 'createdAt'>[] => {
  const seed = input.seed ?? Date.now();
  const pool = NICHE_TRENDS[input.niche] ?? [];
  const genericFallback: typeof pool = [
    { topic: 'Sektör güncellemesi', hook: 'Bu hafta sektörde ne değişti?', lifecycle: 'evergreen' },
    { topic: 'Soru-cevap turu', hook: 'Topluluk soruları, dürüst cevaplar', lifecycle: 'evergreen' },
  ];
  const source = pool.length > 0 ? pool : genericFallback;
  const out: Omit<TrendEntry, 'id' | 'createdAt'>[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < input.count * 2 && out.length < input.count; i++) {
    const t = pickTrend(source, seed + i * 7);
    if (seen.has(t.topic)) continue;
    seen.add(t.topic);
    const meta = TREND_LIFECYCLE_META[t.lifecycle];
    const platformMult = PLATFORM_BIAS[input.platform][t.lifecycle] ?? 1;
    const baseScore = t.lifecycle === 'peak' ? 80 : t.lifecycle === 'rising' ? 65 : t.lifecycle === 'evergreen' ? 55 : 35;
    const score = Math.round(Math.min(100, Math.max(0, baseScore * platformMult)));
    const spottedAt = Date.now();
    const expiresAt = spottedAt + meta.lifespan * 24 * 60 * 60 * 1000;
    out.push({
      topic: t.topic,
      niche: input.niche,
      platform: input.platform,
      hook: t.hook,
      lifecycle: t.lifecycle,
      opportunityScore: score,
      spottedAt,
      expiresAt,
      notes: '',
    });
  }
  return out;
};

export const getTrendList = async (): Promise<TrendEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(TREND_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is TrendEntry =>
        t && typeof t === 'object' && typeof t.id === 'string' && typeof t.topic === 'string'
    );
  } catch {
    return [];
  }
};

export const saveTrend = async (entry: Omit<TrendEntry, 'id' | 'createdAt'>): Promise<TrendEntry[]> => {
  const list = await getTrendList();
  const full: TrendEntry = {
    ...entry,
    id: `trend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 60);
  await AsyncStorage.setItem(TREND_KEY, JSON.stringify(next));
  return next;
};

export const updateTrend = async (id: string, patch: Partial<TrendEntry>): Promise<TrendEntry[]> => {
  const list = await getTrendList();
  const next = list.map(t => (t.id === id ? { ...t, ...patch, id: t.id, createdAt: t.createdAt } : t));
  await AsyncStorage.setItem(TREND_KEY, JSON.stringify(next));
  return next;
};

export const removeTrend = async (id: string): Promise<TrendEntry[]> => {
  const list = await getTrendList();
  const next = list.filter(t => t.id !== id);
  await AsyncStorage.setItem(TREND_KEY, JSON.stringify(next));
  return next;
};

export const clearTrends = async (): Promise<void> => {
  await AsyncStorage.removeItem(TREND_KEY);
};

export const trendDaysLeft = (t: TrendEntry): number => {
  const ms = t.expiresAt - Date.now();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
};

// ============================================================================
// ROUND 74 — Competitor Teardown
// ============================================================================

export type CompetitorTier = 'direct' | 'adjacent' | 'aspirational';
export type CompetitorStrength = 'hook' | 'format' | 'cadence' | 'community' | 'monetization';
export type CompetitorEntry = {
  id: string;
  handle: string;
  niche: string;
  platform: TrendPlatform;
  tier: CompetitorTier;
  followers: number;
  postsPerWeek: number;
  topStrength: CompetitorStrength;
  weakness: string;
  stealableHook: string;
  stealableFormat: string;
  notes: string;
  createdAt: number;
};

const COMPETITOR_KEY = '@content-coach/competitor-teardown';

export const COMPETITOR_TIERS: Record<CompetitorTier, { label: string; emoji: string; color: string; tip: string }> = {
  direct: { label: 'Doğrudan rakip', emoji: '🥊', color: '#EF4444', tip: 'Aynı hedef kitle, benzer içerik. Kazanmak için farklılaştırma şart.' },
  adjacent: { label: 'Yan komşu', emoji: '🤝', color: '#F59E0B', tip: 'Farklı niş ama aynı kitle. Çapraz işbirliği fırsatı.' },
  aspirational: { label: 'Hedef/örnek alınan', emoji: '⭐', color: '#8B5CF6', tip: 'Uzun vadede ulaşmak istediğin seviye. Formatları incele.' },
};

export const COMPETITOR_STRENGTHS: Record<CompetitorStrength, { label: string; emoji: string; tip: string }> = {
  hook: { label: 'Hook / açılış', emoji: '🎯', tip: 'İlk 3 saniye çok kritik. Aynı yapıyı kendi nişine uyarla.' },
  format: { label: 'Format / paket', emoji: '🎬', tip: 'Seri formatı, tekrar eden şablon. Şablonu kopyala, içeriği değiştir.' },
  cadence: { label: 'Kadans / tutarlılık', emoji: '📅', tip: 'Haftalık paylaşım düzeni. Sen de benzer düzene otur.' },
  community: { label: 'Topluluk', emoji: '👥', tip: 'DM, yorum, canlı yayın. Topluluk sadakatini öğren.' },
  monetization: { label: 'Monetizasyon', emoji: '💰', tip: 'Satış hunisi, fiyatlandırma, ürün. Kendi modeline taşı.' },
};

const TIER_FOLLOWER_BIAS: Record<CompetitorTier, [number, number]> = {
  direct: [1000, 50000],
  adjacent: [5000, 100000],
  aspirational: [50000, 1000000],
};

export const buildCompetitorInsights = (input: {
  handle: string;
  niche: string;
  platform: TrendPlatform;
  tier: CompetitorTier;
  topStrength: CompetitorStrength;
}): Omit<CompetitorEntry, 'id' | 'createdAt'> => {
  const [min, max] = TIER_FOLLOWER_BIAS[input.tier];
  const range = max - min;
  const seed = input.handle.length + input.handle.charCodeAt(0);
  const followers = Math.round(min + (seed % range));
  const postsPerWeek = input.tier === 'direct' ? 5 + (seed % 4) : input.tier === 'adjacent' ? 3 + (seed % 3) : 2 + (seed % 2);
  const weaknessPool = [
    'Aşırı satış dili — topluluk yorulmuş',
    'Görsel tutarsız, feed bütünlüğü yok',
    'Video uzunluğu çok fazla, hook zayıf',
    'Caption\'da CTA eksik',
    'Hashtag stratejisi tekdüze',
    'Etkileşim oranı düşmüş (tahmini)',
    'Hikaye/Story kullanımı zayıf',
    'Yanıt süresi uzun, DM\'ler boş',
  ];
  const hookPool = [
    'Karşılaştırma açılışı: "X mi Y mi?"',
    'Negatif hook: "Yapma bunu..."',
    'Sayı + vaat: "3 adımda..."',
    'Önce-sonra patlaması',
    'Soru ile başlayıp cevapla bitirme',
    'Hızlı liste: "5 şey..."',
    'Mitos yıkımı: "X sandım ama..."',
    'Yürekten itiraf / günah çıkarma',
  ];
  const formatPool = [
    'Bölünmüş ekran (split screen) karşılaştırma',
    'Talking-head + B-roll',
    'Üstten çekim (top-down) masa videosu',
    'POV: senaryo',
    'Carousel: 8 slayt, son CTA',
    'Sesli metin + sinematik B-roll',
    'Yeşil ekran efendi + arka plan',
    'Ekran kaydı + zoom-in',
  ];
  return {
    handle: input.handle,
    niche: input.niche,
    platform: input.platform,
    tier: input.tier,
    followers,
    postsPerWeek,
    topStrength: input.topStrength,
    weakness: weaknessPool[seed % weaknessPool.length],
    stealableHook: hookPool[seed % hookPool.length],
    stealableFormat: formatPool[seed % formatPool.length],
    notes: '',
  };
};

export const getCompetitorList = async (): Promise<CompetitorEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(COMPETITOR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is CompetitorEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.handle === 'string'
    );
  } catch {
    return [];
  }
};

export const saveCompetitor = async (entry: Omit<CompetitorEntry, 'id' | 'createdAt'>): Promise<CompetitorEntry[]> => {
  const list = await getCompetitorList();
  const full: CompetitorEntry = {
    ...entry,
    id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 50);
  await AsyncStorage.setItem(COMPETITOR_KEY, JSON.stringify(next));
  return next;
};

export const updateCompetitor = async (id: string, patch: Partial<CompetitorEntry>): Promise<CompetitorEntry[]> => {
  const list = await getCompetitorList();
  const next = list.map(c => (c.id === id ? { ...c, ...patch, id: c.id, createdAt: c.createdAt } : c));
  await AsyncStorage.setItem(COMPETITOR_KEY, JSON.stringify(next));
  return next;
};

export const removeCompetitor = async (id: string): Promise<CompetitorEntry[]> => {
  const list = await getCompetitorList();
  const next = list.filter(c => c.id !== id);
  await AsyncStorage.setItem(COMPETITOR_KEY, JSON.stringify(next));
  return next;
};

export const clearCompetitors = async (): Promise<void> => {
  await AsyncStorage.removeItem(COMPETITOR_KEY);
};

// ============================================================================
// ROUND 75 — Content Audit
// ============================================================================

export type AuditPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'blog';
export type AuditVerdict = 'kill' | 'pivot' | 'double_down' | 'spike';
export type AuditDimension = 'format' | 'topic' | 'length' | 'cta' | 'hook';
export type AuditEntry = {
  id: string;
  title: string;
  platform: AuditPlatform;
  niche: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  publishedAt: number;
  formatTag: string;
  topicTag: string;
  verdict: AuditVerdict;
  score: number;
  reasoning: string;
  notes: string;
  createdAt: number;
};

const AUDIT_KEY = '@content-coach/content-audit';

export const AUDIT_PLATFORMS: { id: AuditPlatform; label: string; emoji: string; color: string }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: '#000000' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', color: '#FF0000' },
  { id: 'twitter', label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
  { id: 'blog', label: 'Blog / SEO', emoji: '📝', color: '#10B981' },
];

export const AUDIT_VERDICTS: Record<AuditVerdict, { label: string; emoji: string; color: string; tip: string }> = {
  kill: { label: 'Öldür', emoji: '🪦', color: '#EF4444', tip: 'Bu format konuyla uyuşmuyor. Farklıla, bırak ya da test et.' },
  pivot: { label: 'Pivot', emoji: '🔄', color: '#F97316', tip: 'Konu doğru ama sunum yanlış. Format/hook değiştir.' },
  double_down: { label: 'İki katına çıkar', emoji: '🚀', color: '#10B981', tip: 'İşe yarıyor. Aynı formattan seri üret, kadansı artır.' },
  spike: { label: 'Spike / test', emoji: '⚡', color: '#F59E0B', tip: 'Yüksek potansiyel ama tek örnek yeterli değil. 3 içerik daha dene.' },
};

export const AUDIT_DIMENSIONS: Record<AuditDimension, { label: string; emoji: string }> = {
  format: { label: 'Format', emoji: '🎬' },
  topic: { label: 'Konu', emoji: '💡' },
  length: { label: 'Uzunluk', emoji: '⏱️' },
  cta: { label: 'CTA', emoji: '📣' },
  hook: { label: 'Hook', emoji: '🪝' },
};

const PLATFORM_NORMS: Record<AuditPlatform, { reach: number; like: number; comment: number; share: number; save: number }> = {
  instagram: { reach: 1000, like: 50, comment: 5, share: 3, save: 8 },
  tiktok: { reach: 5000, like: 200, comment: 15, share: 20, save: 10 },
  youtube: { reach: 1500, like: 80, comment: 12, share: 5, save: 4 },
  twitter: { reach: 800, like: 20, comment: 3, share: 8, save: 2 },
  linkedin: { reach: 600, like: 30, comment: 6, share: 4, save: 5 },
  blog: { reach: 400, like: 0, comment: 4, share: 1, save: 3 },
};

const calcScore = (
  reach: number,
  likes: number,
  comments: number,
  shares: number,
  saves: number,
  platform: AuditPlatform
): number => {
  const n = PLATFORM_NORMS[platform];
  const reachRatio = Math.min(2, reach / Math.max(1, n.reach));
  const likeRatio = Math.min(2, likes / Math.max(1, n.like));
  const commentRatio = Math.min(2, comments / Math.max(1, n.comment));
  const shareRatio = Math.min(2, shares / Math.max(1, n.share));
  const saveRatio = Math.min(2, saves / Math.max(1, n.save));
  const weighted = reachRatio * 0.15 + likeRatio * 0.25 + commentRatio * 0.2 + shareRatio * 0.25 + saveRatio * 0.15;
  return Math.round(Math.min(100, weighted * 50));
};

const verdictFromAuditScore = (s: number): AuditVerdict => {
  if (s >= 75) return 'double_down';
  if (s >= 50) return 'spike';
  if (s >= 30) return 'pivot';
  return 'kill';
};

const VERDICT_REASON: Record<AuditVerdict, string[]> = {
  kill: [
    'Reach normun altında — format/kanal uyumsuzluğu olabilir',
    'Etkileşim oranı çok düşük, izleyici bağlanmıyor',
    'Hook dikkat çekmiyor, swipe/skip oranı yüksek olabilir',
  ],
  pivot: [
    'Konu ilgi çekiyor ama format izleyiciyle buluşmuyor',
    'CTA zayıf — beğeni var ama aksiyon yok',
    'İlk 3 saniye hook çok yumuşak, retention düşük',
  ],
  spike: [
    'Sayılar tek başına kanıt değil, ama olumlu sinyal var',
    'Benzer içerik 2-3 kez daha test et, ortaya çıksın',
    'Format iyi tepki alıyor, konuyu biraz daha oyna',
  ],
  double_down: [
    'Tüm metriklerde normun üstünde — seri üretim zamanı',
    'Topluluk bu formatta etkileşim gösteriyor',
    'Yüksek share/save: paylaşılabilir değer kanıtlandı',
  ],
};

export const buildAudit = (input: {
  title: string;
  platform: AuditPlatform;
  niche: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  publishedAt: number;
  formatTag: string;
  topicTag: string;
}): Omit<AuditEntry, 'id' | 'createdAt'> => {
  const score = calcScore(input.reach, input.likes, input.comments, input.shares, input.saves, input.platform);
  const verdict = verdictFromAuditScore(score);
  const pool = VERDICT_REASON[verdict];
  const seed = input.title.length + input.title.charCodeAt(0) + Math.round(input.reach / 100);
  const reasoning = pool[seed % pool.length];
  return {
    title: input.title,
    platform: input.platform,
    niche: input.niche,
    reach: input.reach,
    likes: input.likes,
    comments: input.comments,
    shares: input.shares,
    saves: input.saves,
    publishedAt: input.publishedAt,
    formatTag: input.formatTag,
    topicTag: input.topicTag,
    verdict,
    score,
    reasoning,
    notes: '',
  };
};

export const getAuditList = async (): Promise<AuditEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is AuditEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.title === 'string'
    );
  } catch {
    return [];
  }
};

export const saveAudit = async (entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<AuditEntry[]> => {
  const list = await getAuditList();
  const full: AuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 80);
  await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(next));
  return next;
};

export const updateAudit = async (id: string, patch: Partial<AuditEntry>): Promise<AuditEntry[]> => {
  const list = await getAuditList();
  const next = list.map(a => (a.id === id ? { ...a, ...patch, id: a.id, createdAt: a.createdAt } : a));
  await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(next));
  return next;
};

export const removeAudit = async (id: string): Promise<AuditEntry[]> => {
  const list = await getAuditList();
  const next = list.filter(a => a.id !== id);
  await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(next));
  return next;
};

export const clearAudits = async (): Promise<void> => {
  await AsyncStorage.removeItem(AUDIT_KEY);
};

// ============================================================================
// ROUND 76 — Repurpose Matrix
// ============================================================================

export type RepurposeSource = 'reel' | 'long_video' | 'podcast' | 'blog' | 'carousel' | 'tweet_thread' | 'live';
export type RepurposeTarget = 'short_reel' | 'carousel' | 'tweet' | 'thread' | 'blog_post' | 'quote_card' | 'story' | 'newsletter' | 'linkedin_post' | 'short_video';
export type RepurposeEntry = {
  id: string;
  sourceType: RepurposeSource;
  topic: string;
  hook: string;
  keyQuote: string;
  cta: string;
  plans: RepurposeTargetPlan[];
  notes: string;
  createdAt: number;
};

export type RepurposeTargetPlan = {
  target: RepurposeTarget;
  format: string;
  hook: string;
  effort: 'low' | 'medium' | 'high';
  priority: number;
};

const REPURPOSE_MATRIX_KEY = '@content-coach/repurpose-matrix';

export const REPURPOSE_SOURCES: Record<RepurposeSource, { label: string; emoji: string; color: string }> = {
  reel: { label: 'Reel / Short', emoji: '🎞️', color: '#E1306C' },
  long_video: { label: 'Uzun Video', emoji: '🎬', color: '#FF0000' },
  podcast: { label: 'Podcast', emoji: '🎙️', color: '#8B5CF6' },
  blog: { label: 'Blog yazısı', emoji: '📝', color: '#10B981' },
  carousel: { label: 'Carousel', emoji: '📚', color: '#F59E0B' },
  tweet_thread: { label: 'Tweet thread', emoji: '🧵', color: '#1D9BF0' },
  live: { label: 'Canlı yayın', emoji: '📡', color: '#EF4444' },
};

export const REPURPOSE_TARGETS: Record<RepurposeTarget, { label: string; emoji: string; color: string }> = {
  short_reel: { label: 'Kısa Reel', emoji: '🎞️', color: '#E1306C' },
  carousel: { label: 'Carousel', emoji: '📚', color: '#F59E0B' },
  tweet: { label: 'Tek tweet', emoji: '🐦', color: '#1D9BF0' },
  thread: { label: 'Thread', emoji: '🧵', color: '#0EA5E9' },
  blog_post: { label: 'Blog yazısı', emoji: '📝', color: '#10B981' },
  quote_card: { label: 'Alıntı kartı', emoji: '💬', color: '#A855F7' },
  story: { label: 'Story / Reel kısa', emoji: '📱', color: '#EC4899' },
  newsletter: { label: 'Newsletter', emoji: '📧', color: '#6366F1' },
  linkedin_post: { label: 'LinkedIn post', emoji: '💼', color: '#0A66C2' },
  short_video: { label: 'YouTube Short', emoji: '▶️', color: '#FF0000' },
};

const SOURCE_TARGETS: Record<RepurposeSource, RepurposeTarget[]> = {
  reel: ['short_reel', 'quote_card', 'tweet', 'carousel', 'story'],
  long_video: ['short_reel', 'thread', 'blog_post', 'quote_card', 'newsletter', 'short_video'],
  podcast: ['quote_card', 'thread', 'blog_post', 'newsletter', 'linkedin_post', 'short_video'],
  blog: ['carousel', 'thread', 'newsletter', 'linkedin_post', 'tweet'],
  carousel: ['tweet', 'thread', 'blog_post', 'newsletter', 'quote_card'],
  tweet_thread: ['thread', 'blog_post', 'carousel', 'linkedin_post', 'newsletter'],
  live: ['short_reel', 'thread', 'quote_card', 'blog_post', 'newsletter'],
};

const FORMAT_TEMPLATES: Record<RepurposeTarget, string[]> = {
  short_reel: [
    'Konunun 1 ana fikri — 30sn talking head + B-roll',
    'En çarpıcı 15 saniye — baştan sona',
    'Carousel\'ın en iyi 3 slaytını hızlı geçişle',
  ],
  carousel: [
    '8 slayt: 1 başlık, 6 içerik, 1 CTA',
    '5 slaytlık mini-list formatı',
    'Before/after 2 slayt + 5 ipucu',
  ],
  tweet: [
    'Tek tweet — ana hook + link/reply için CTA',
    'Alıntı tweet — quote card görseliyle',
    'Yorum olarak yanıtlanabilir mini-soru',
  ],
  thread: [
    '7 tweetlik thread — 1 hook, 5 madde, 1 özet',
    '5 tweetlik "neden/sonuç" akışı',
    '10 tweet — adım adım playbook',
  ],
  blog_post: [
    '1200 kelime — H2/H3 ile SEO uyumlu',
    '800 kelime — quick read formatı',
    '1500 kelime — derin dalış + örnekler',
  ],
  quote_card: [
    'Koyu zemin üstüne büyük punto — 1 cümle',
    'Yazar + kitap kaynaklı quote',
    'Marka renkleri + minimal tasarım',
  ],
  story: [
    '3 kare: soru, ipucu, CTA swipe up',
    '5 kare: mini-tutorial',
    'Anket + sonuç paylaşımı',
  ],
  newsletter: [
    'Konu + 3 link + 1 CTA — 250 kelime',
    'Haftalık özet — featured içerik',
    'Personal note + ana içerik — 400 kelime',
  ],
  linkedin_post: [
    'Personal story + lesson — 200 kelime',
    'Liste formatı + carousel linki',
    'Soru ile açılan hook + 3 maddelik insight',
  ],
  short_video: [
    '60sn — ana fikir + örnek',
    '30sn — hızlı liste',
    '45sn — problem/solution/result',
  ],
};

const EFFORT_MAP: Record<RepurposeTarget, 'low' | 'medium' | 'high'> = {
  short_reel: 'high',
  carousel: 'high',
  tweet: 'low',
  thread: 'medium',
  blog_post: 'high',
  quote_card: 'low',
  story: 'low',
  newsletter: 'medium',
  linkedin_post: 'low',
  short_video: 'high',
};

export const buildRepurposeMatrix = (input: {
  sourceType: RepurposeSource;
  topic: string;
  hook: string;
  keyQuote: string;
  cta: string;
}): Omit<RepurposeEntry, 'id' | 'createdAt'> => {
  const targets = SOURCE_TARGETS[input.sourceType];
  const plans: RepurposeTargetPlan[] = targets.map((t, idx) => {
    const formats = FORMAT_TEMPLATES[t];
    const seed = input.topic.length + idx * 3 + (input.keyQuote?.length ?? 0);
    const format = formats[seed % formats.length];
    const effort = EFFORT_MAP[t];
    const priority = effort === 'low' ? 5 - idx * 0.3 : effort === 'medium' ? 4 - idx * 0.3 : 3 - idx * 0.3;
    const hook =
      t === 'quote_card'
        ? `"${input.keyQuote.slice(0, 80)}"`
        : t === 'short_reel' || t === 'short_video'
        ? input.hook
        : input.topic;
    return {
      target: t,
      format,
      hook,
      effort,
      priority: Math.round(priority * 10) / 10,
    };
  });
  plans.sort((a, b) => b.priority - a.priority);
  return {
    sourceType: input.sourceType,
    topic: input.topic,
    hook: input.hook,
    keyQuote: input.keyQuote,
    cta: input.cta,
    plans,
    notes: '',
  };
};

export const getRepurposeList = async (): Promise<RepurposeEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(REPURPOSE_MATRIX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RepurposeEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.topic === 'string'
    );
  } catch {
    return [];
  }
};

export const saveRepurpose = async (entry: Omit<RepurposeEntry, 'id' | 'createdAt'>): Promise<RepurposeEntry[]> => {
  const list = await getRepurposeList();
  const full: RepurposeEntry = {
    ...entry,
    id: `repurpose-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 40);
  await AsyncStorage.setItem(REPURPOSE_MATRIX_KEY, JSON.stringify(next));
  return next;
};

export const updateRepurpose = async (id: string, patch: Partial<RepurposeEntry>): Promise<RepurposeEntry[]> => {
  const list = await getRepurposeList();
  const next = list.map(r => (r.id === id ? { ...r, ...patch, id: r.id, createdAt: r.createdAt } : r));
  await AsyncStorage.setItem(REPURPOSE_MATRIX_KEY, JSON.stringify(next));
  return next;
};

export const removeRepurpose = async (id: string): Promise<RepurposeEntry[]> => {
  const list = await getRepurposeList();
  const next = list.filter(r => r.id !== id);
  await AsyncStorage.setItem(REPURPOSE_MATRIX_KEY, JSON.stringify(next));
  return next;
};

export const clearRepurposes = async (): Promise<void> => {
  await AsyncStorage.removeItem(REPURPOSE_MATRIX_KEY);
};

// ============================================================================
// ROUND 77 — Caption Length Optimizer
// ============================================================================

export type LenOptPlatform = 'instagram' | 'tiktok' | 'twitter' | 'linkedin' | 'youtube' | 'facebook';
export type LenOptGoal = 'reach' | 'engagement' | 'saves' | 'shares';
export type LenOptRange = 'micro' | 'short' | 'medium' | 'long' | 'essay';
export type LenOptEntry = {
  id: string;
  caption: string;
  platform: LenOptPlatform;
  goal: LenOptGoal;
  recommended: LenOptRange;
  currentRange: LenOptRange;
  charCount: number;
  wordCount: number;
  lineCount: number;
  emojiCount: number;
  hashtagCount: number;
  urlCount: number;
  questionCount: number;
  score: number;
  feedback: string[];
  improvedCaption: string;
  notes: string;
  createdAt: number;
};

const LENOPT_KEY = '@content-coach/caption-length';

export const LENOPT_PLATFORMS: Record<LenOptPlatform, { label: string; emoji: string; color: string; charLimit: number; sweetSpot: LenOptRange }> = {
  instagram: { label: 'Instagram', emoji: '📸', color: '#E1306C', charLimit: 2200, sweetSpot: 'medium' },
  tiktok: { label: 'TikTok', emoji: '🎵', color: '#000000', charLimit: 2200, sweetSpot: 'short' },
  twitter: { label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0', charLimit: 280, sweetSpot: 'micro' },
  linkedin: { label: 'LinkedIn', emoji: '💼', color: '#0A66C2', charLimit: 3000, sweetSpot: 'long' },
  youtube: { label: 'YouTube', emoji: '▶️', color: '#FF0000', charLimit: 1000, sweetSpot: 'medium' },
  facebook: { label: 'Facebook', emoji: '👍', color: '#1877F2', charLimit: 5000, sweetSpot: 'short' },
};

export const LENOPT_GOALS: Record<LenOptGoal, { label: string; emoji: string; tip: string }> = {
  reach: { label: 'Reach / gösterim', emoji: '👁️', tip: 'Kısa, hızlı tüketilen. Çok uzun olursa scroll edilir.' },
  engagement: { label: 'Engagement (yorum/beğeni)', emoji: '💬', tip: 'Soru içeren, kişisel. Orta uzunluk ideal.' },
  saves: { label: 'Saves (kaydetme)', emoji: '🔖', tip: 'Bilgi içerikli, listeli. Uzun ve değerli.' },
  shares: { label: 'Shares (paylaşım)', emoji: '↗️', tip: 'Duygusal tetikleyici, kısa-orta. Reaksiyon uyandıran.' },
};

export const LENOPT_RANGES: Record<LenOptRange, { label: string; min: number; max: number; emoji: string; color: string }> = {
  micro: { label: 'Mikro', min: 1, max: 80, emoji: '⚡', color: '#22D3EE' },
  short: { label: 'Kısa', min: 81, max: 300, emoji: '📝', color: '#10B981' },
  medium: { label: 'Orta', min: 301, max: 800, emoji: '📄', color: '#F59E0B' },
  long: { label: 'Uzun', min: 801, max: 1500, emoji: '📚', color: '#F97316' },
  essay: { label: 'Essay', min: 1501, max: 9999, emoji: '🧾', color: '#8B5CF6' },
};

const rangeForChar = (n: number, platform: LenOptPlatform): LenOptRange => {
  if (n <= 80) return 'micro';
  if (n <= 300) return 'short';
  if (n <= 800) return 'medium';
  if (n <= 1500) return 'long';
  return 'essay';
};

const PLATFORM_GOAL_TARGET: Record<LenOptPlatform, Partial<Record<LenOptGoal, LenOptRange>>> = {
  instagram: { reach: 'short', engagement: 'medium', saves: 'long', shares: 'short' },
  tiktok: { reach: 'micro', engagement: 'short', saves: 'medium', shares: 'short' },
  twitter: { reach: 'micro', engagement: 'micro', saves: 'micro', shares: 'micro' },
  linkedin: { reach: 'long', engagement: 'long', saves: 'essay', shares: 'medium' },
  youtube: { reach: 'medium', engagement: 'medium', saves: 'long', shares: 'medium' },
  facebook: { reach: 'short', engagement: 'short', saves: 'medium', shares: 'short' },
};

const rangeRank = (r: LenOptRange): number => {
  const order: LenOptRange[] = ['micro', 'short', 'medium', 'long', 'essay'];
  return order.indexOf(r);
};

export const buildCaptionOptim = (input: {
  caption: string;
  platform: LenOptPlatform;
  goal: LenOptGoal;
}): Omit<LenOptEntry, 'id' | 'createdAt'> => {
  const caption = input.caption;
  const trimmed = caption.trim();
  const charCount = trimmed.length;
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const lineCount = trimmed.split(/\n/).length;
  const emojiCount = (trimmed.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
  const hashtagCount = (trimmed.match(/#[\wğüşıöçĞÜŞİÖÇ]+/g) ?? []).length;
  const urlCount = (trimmed.match(/https?:\/\/\S+/g) ?? []).length;
  const questionCount = (trimmed.match(/\?/g) ?? []).length;

  const platformMeta = LENOPT_PLATFORMS[input.platform];
  const currentRange = rangeForChar(charCount, input.platform);
  const target = PLATFORM_GOAL_TARGET[input.platform][input.goal] ?? platformMeta.sweetSpot;
  const recommended = target ?? platformMeta.sweetSpot;

  const feedback: string[] = [];
  const diff = rangeRank(currentRange) - rangeRank(recommended);
  if (diff < -1) feedback.push(`Çok kısa. ${LENOPT_RANGES[recommended].label} aralığına uzat.`);
  if (diff > 1) feedback.push(`Çok uzun. ${LENOPT_RANGES[recommended].label} aralığına kısalt.`);
  if (emojiCount === 0 && (input.platform === 'instagram' || input.platform === 'tiktok')) {
    feedback.push('Emoji ekle — dikkat çeker, okunabilirliği artırır.');
  }
  if (emojiCount > 10) feedback.push('Emoji çok fazla. 3-5 idealdir, sadeleştir.');
  if (hashtagCount > 8 && input.platform === 'instagram') feedback.push('Hashtag 8\'den fazla — spam riski. 3-5 hedef.');
  if (hashtagCount === 0 && (input.platform === 'instagram' || input.platform === 'tiktok')) {
    feedback.push('Hashtag eksik. 3-5 tane ekle.');
  }
  if (urlCount > 0 && input.platform === 'instagram') feedback.push('Instagram link caption\'da düşürür. Bio\'ya koy.');
  if (input.goal === 'engagement' && questionCount === 0) feedback.push('Soru ekle — yorum alma ihtimalini artırır.');
  if (input.goal === 'saves' && !/[0-9]\s*[•\.\-]/.test(caption) && charCount < 300) {
    feedback.push('Listeli/numaralı format saves için daha iyi çalışır.');
  }
  if (lineCount < 2 && charCount > 200) feedback.push('Paragraf kır — uzun duvar metin gözü yorar.');
  if (feedback.length === 0) feedback.push('✅ Caption formatı hedefe uygun görünüyor.');

  const rangeMatch = rangeRank(currentRange) === rangeRank(recommended) ? 1 : Math.max(0, 1 - Math.abs(diff) * 0.3);
  const formatBonus = (emojiCount > 0 && emojiCount <= 5 ? 0.15 : 0) + (lineCount >= 2 && lineCount <= 8 ? 0.15 : 0) + (questionCount >= 1 && input.goal === 'engagement' ? 0.15 : 0);
  const score = Math.round(Math.min(100, (rangeMatch * 70 + formatBonus * 100)));

  let improvedCaption = trimmed;
  if (diff < 0) {
    improvedCaption = `${trimmed}\n\n— Devamı için takip et.`;
  } else if (diff > 0) {
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    improvedCaption = sentences.slice(0, Math.min(3, sentences.length)).join(' ');
  }

  return {
    caption: trimmed,
    platform: input.platform,
    goal: input.goal,
    recommended,
    currentRange,
    charCount,
    wordCount,
    lineCount,
    emojiCount,
    hashtagCount,
    urlCount,
    questionCount,
    score,
    feedback,
    improvedCaption,
    notes: '',
  };
};

export const getLenOptList = async (): Promise<LenOptEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(LENOPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LenOptEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.caption === 'string'
    );
  } catch {
    return [];
  }
};

export const saveLenOpt = async (entry: Omit<LenOptEntry, 'id' | 'createdAt'>): Promise<LenOptEntry[]> => {
  const list = await getLenOptList();
  const full: LenOptEntry = {
    ...entry,
    id: `lenopt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 60);
  await AsyncStorage.setItem(LENOPT_KEY, JSON.stringify(next));
  return next;
};

export const updateLenOpt = async (id: string, patch: Partial<LenOptEntry>): Promise<LenOptEntry[]> => {
  const list = await getLenOptList();
  const next = list.map(e => (e.id === id ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e));
  await AsyncStorage.setItem(LENOPT_KEY, JSON.stringify(next));
  return next;
};

export const removeLenOpt = async (id: string): Promise<LenOptEntry[]> => {
  const list = await getLenOptList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(LENOPT_KEY, JSON.stringify(next));
  return next;
};

export const clearLenOpts = async (): Promise<void> => {
  await AsyncStorage.removeItem(LENOPT_KEY);
};

// ============================================================================
// ROUND 78 — Engagement Hook Tester
// ============================================================================

export type HookTesterPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin';
export type HookTesterType = 'curiosity' | 'contrarian' | 'specific' | 'story' | 'list' | 'question' | 'shock' | 'howto';
export type HookTesterEntry = {
  id: string;
  hook: string;
  platform: HookTesterPlatform;
  detectedType: HookTesterType;
  variants: HookTesterVariant[];
  bestVariantId: string;
  notes: string;
  createdAt: number;
};

export type HookTesterVariant = {
  id: string;
  text: string;
  type: HookTesterType;
  score: number;
  reason: string;
};

const HOOKTEST_KEY = '@content-coach/hook-tester';

export const HOOKTEST_PLATFORMS: Record<HookTesterPlatform, { label: string; emoji: string; color: string }> = {
  instagram: { label: 'Instagram', emoji: '📸', color: '#E1306C' },
  tiktok: { label: 'TikTok', emoji: '🎵', color: '#000000' },
  youtube: { label: 'YouTube', emoji: '▶️', color: '#FF0000' },
  twitter: { label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0' },
  linkedin: { label: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
};

export const HOOKTEST_TYPES: Record<HookTesterType, { label: string; emoji: string; tip: string }> = {
  curiosity: { label: 'Merak uyandıran', emoji: '🤔', tip: 'Boşluk bırak, okuyucu tamamlamak istesin.' },
  contrarian: { label: 'Karşıt görüş', emoji: '⚔️', tip: 'Popüler inanışa karşı çık, dikkat çek.' },
  specific: { label: 'Spesifik / sayısal', emoji: '🔢', tip: 'Net rakam ver. "5 adımda" gibi.' },
  story: { label: 'Hikaye / kişisel', emoji: '📖', tip: 'İlk cümlede karakter + olay.' },
  list: { label: 'Liste', emoji: '📋', tip: '"5 şey", "7 yöntem" gibi listeli vaat.' },
  question: { label: 'Soru', emoji: '❓', tip: 'Soru, okuyucuyu cevaba zorlar.' },
  shock: { label: 'Şok / itiraf', emoji: '😱', tip: 'Beklenmedik bilgi veya günah çıkarma.' },
  howto: { label: 'Nasıl yapılır', emoji: '🛠️', tip: 'Adım adım vaadi — net sonuç.' },
};

const detectType = (hook: string): HookTesterType => {
  const lower = hook.toLowerCase().trim();
  if (/^\d+\s/.test(lower) || /\d+\s+(şey|yöntem|adım|tavsiye|ipucu|hata|kitap|gün|saat)/i.test(lower)) return 'list';
  if (/nasıl|how to|adım adım/i.test(lower)) return 'howto';
  if (/\?/.test(lower) || /ne|neden|niçin|kim|hangi|nasıl/i.test(lower.split(' ')[0] ?? '')) return 'question';
  if (/^(hiç|asla|yapma|dur|unut)/i.test(lower) || /yanlış|doğru değil|mit|myth/i.test(lower)) return 'contrarian';
  if (/^\d+$/.test(lower.split(' ')[0] ?? '') || /\d+(\.\d+)?\s*%|\d+\s*(k|m|bin)/i.test(lower)) return 'specific';
  if (/biliyor muydun|sırr|itiraf|günah|hayatımı değiştiren/i.test(lower)) return 'shock';
  if (/^(bir gün|geçen|2 yıl|tam|dün|dün gece)/i.test(lower)) return 'story';
  if (/(sır|gizli|kimse bilmiyor|asla söylemedi)/i.test(lower)) return 'curiosity';
  return 'curiosity';
};

const scoreHook = (hook: string, type: HookTesterType, platform: HookTesterPlatform): { score: number; reason: string } => {
  const reasons: string[] = [];
  let s = 50;

  const len = hook.trim().length;
  if (len < 8) {
    reasons.push('Çok kısa — açılışta daha somut ol');
    s -= 15;
  } else if (len > 90) {
    reasons.push('Çok uzun — ilk cümle kısa olmalı');
    s -= 10;
  } else if (len >= 12 && len <= 60) {
    reasons.push('İdeal uzunluk');
    s += 10;
  }

  if (/!/.test(hook)) {
    s += 3;
    reasons.push('Ünlem dikkat çeker');
  }
  if (/\?/.test(hook)) {
    s += 4;
    reasons.push('Soru, etkileşim ihtimalini artırır');
  }
  if (/\d/.test(hook)) {
    s += 8;
    reasons.push('Sayı somutluk katar');
  }
  if (/[""'']/.test(hook)) {
    s += 2;
  }
  const emojiCount = (hook.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
  if (emojiCount === 1) {
    s += 4;
    reasons.push('Tek emoji açılışta iyi');
  } else if (emojiCount > 2) {
    s -= 6;
    reasons.push('Çok emoji — sadeleştir');
  }
  if (/(secrets|sırr|gizli|kimse bilmiyor|asla)/i.test(hook)) {
    s += 6;
    reasons.push('Merak boşluğu');
  }
  if (/(yapma|dur|unut|yanlış|doğru değil)/i.test(hook)) {
    s += 5;
    reasons.push('Negatif hook dikkat çeker');
  }
  if (type === 'list' && !/^\d+/.test(hook.trim())) {
    s -= 8;
    reasons.push('Liste hook\'u rakamla başlamalı');
  }
  if (type === 'question' && !/\?/.test(hook)) {
    s -= 5;
    reasons.push('Soru işareti eksik');
  }
  if (platform === 'twitter' && len > 240) {
    s -= 15;
    reasons.push('Twitter için çok uzun');
  }
  if (platform === 'tiktok' && len > 80) {
    s -= 8;
    reasons.push('TikTok ilk 3 saniyelik kısmı uzun');
  }
  if (platform === 'linkedin' && len < 20) {
    s -= 5;
    reasons.push('LinkedIn daha düşünülmüş açılış sever');
  }

  s = Math.max(0, Math.min(100, s));
  return { score: s, reason: reasons.length === 0 ? 'Standart format' : reasons.join(' · ') };
};

export const buildHookVariants = (input: {
  hook: string;
  platform: HookTesterPlatform;
}): Omit<HookTesterEntry, 'id' | 'createdAt'> => {
  const original = input.hook.trim();
  const detected = detectType(original);
  const baseScore = scoreHook(original, detected, input.platform);

  const cleaned = original.replace(/^[""'']*/, '').replace(/[""'']*$/, '');

  const variants: { text: string; type: HookTesterType }[] = [
    { text: cleaned, type: detected },
    { text: `${cleaned} — gerçekten mi?`, type: 'curiosity' },
    { text: `Dur. ${cleaned}`, type: 'contrarian' },
    { text: `3 adımda ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}`, type: 'howto' },
    { text: `Biliyor muydun: ${cleaned}`, type: 'shock' },
    { text: `${cleaned} (denedim, sonuçlar şaşırtıcı)`, type: 'story' },
    { text: `5 şey: ${cleaned}`, type: 'list' },
  ];

  const scored: HookTesterVariant[] = variants.map((v, idx) => {
    const r = scoreHook(v.text, v.type, input.platform);
    return {
      id: `v-${idx}`,
      text: v.text,
      type: v.type,
      score: r.score,
      reason: r.reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    hook: original,
    platform: input.platform,
    detectedType: detected,
    variants: scored,
    bestVariantId: best.id,
    notes: '',
  };
};

export const getHookTestList = async (): Promise<HookTesterEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(HOOKTEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HookTesterEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.hook === 'string'
    );
  } catch {
    return [];
  }
};

export const saveHookTest = async (entry: Omit<HookTesterEntry, 'id' | 'createdAt'>): Promise<HookTesterEntry[]> => {
  const list = await getHookTestList();
  const full: HookTesterEntry = {
    ...entry,
    id: `hooktest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 50);
  await AsyncStorage.setItem(HOOKTEST_KEY, JSON.stringify(next));
  return next;
};

export const updateHookTest = async (id: string, patch: Partial<HookTesterEntry>): Promise<HookTesterEntry[]> => {
  const list = await getHookTestList();
  const next = list.map(e => (e.id === id ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e));
  await AsyncStorage.setItem(HOOKTEST_KEY, JSON.stringify(next));
  return next;
};

export const removeHookTest = async (id: string): Promise<HookTesterEntry[]> => {
  const list = await getHookTestList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(HOOKTEST_KEY, JSON.stringify(next));
  return next;
};

export const clearHookTests = async (): Promise<void> => {
  await AsyncStorage.removeItem(HOOKTEST_KEY);
};

// ============================================================================
// ROUND 79 — Content Pillars Planner
// ============================================================================

export type PillarEntry = {
  id: string;
  niche: string;
  pillars: PillarSlot[];
  notes: string;
  createdAt: number;
};

export type PillarSlot = {
  name: string;
  purpose: 'educate' | 'inspire' | 'entertain' | 'sell' | 'connect';
  ratio: number;
  color: string;
  examples: string[];
};

const PILLAR_KEY = '@content-coach/content-pillars';

export const PILLAR_PURPOSES: Record<PillarSlot['purpose'], { label: string; emoji: string; color: string; tip: string }> = {
  educate: { label: 'Eğit / öğret', emoji: '🎓', color: '#6366f1', tip: 'Bilgi ver, topluluk seni kaynak olarak görsün.' },
  inspire: { label: 'İlham ver', emoji: '✨', color: '#F59E0B', tip: 'Motivasyon, başarı hikayesi, dönüşüm anlat.' },
  entertain: { label: 'Eğlendir', emoji: '🎉', color: '#EC4899', tip: 'Mizah, trend, absürt — paylaşılabilir değer.' },
  sell: { label: 'Sat', emoji: '💰', color: '#10B981', tip: 'Ürün/hizmet tanıtımı, sosyal kanıt, CTA.' },
  connect: { label: 'Bağ kur', emoji: '🤝', color: '#0EA5E9', tip: 'DM soruları, topluluk spotlight, kişisel paylaşım.' },
};

const PILLAR_TEMPLATES: { name: string; purpose: PillarSlot['purpose']; examples: string[] }[] = [
  { name: 'İpuçları', purpose: 'educate', examples: ['3 taktik', 'X yapmanın Y yolu', 'Hızlı rehber'] },
  { name: 'Mitos yıkımı', purpose: 'educate', examples: ['Yanlış bilinen X', 'Doğru sanılan Y', 'Mit vs gerçek'] },
  { name: 'İlham verici alıntı', purpose: 'inspire', examples: ['Günlük alıntı', 'Başarı hikayesi', 'Dönüşüm'] },
  { name: 'Behind the scenes', purpose: 'connect', examples: ['Çalışma süreci', 'Ofis/stüdyo', 'Hata/öğrenme'] },
  { name: 'Trend/mizah', purpose: 'entertain', examples: ['Ses trendi', 'Meme format', 'Absürt POV'] },
  { name: 'Müşteri sonucu', purpose: 'sell', examples: ['Önce-sonra', 'Testimonial', 'Sosyal kanıt'] },
  { name: 'Ürün tanıtım', purpose: 'sell', examples: ['Özellik turu', 'Karşılaştırma', 'Demo'] },
  { name: 'Soru-cevap', purpose: 'connect', examples: ['DM soruları', 'Topluluk sorusu', 'Anonim itiraf'] },
  { name: 'Kişisel story', purpose: 'inspire', examples: ['Vlog', 'Günlük hayat', 'Mücadele anı'] },
  { name: 'Quick tip', purpose: 'educate', examples: ['Tek cümle taktik', 'Bugünkü ipucu', 'Mini ders'] },
];

const NICHE_FAVORITES: Record<string, string[]> = {
  fitness: ['İpuçları', 'İlham verici alıntı', 'Müşteri sonucu', 'Mitos yıkımı', 'Trend/mizah'],
  food: ['Quick tip', 'Behind the scenes', 'Mitos yıkımı', 'Trend/mizah', 'Soru-cevap'],
  tech: ['İpuçları', 'Mitos yıkımı', 'Behind the scenes', 'Ürün tanıtım', 'Soru-cevap'],
  fashion: ['İlham verici alıntı', 'Behind the scenes', 'Trend/mizah', 'Müşteri sonucu', 'Kişisel story'],
  travel: ['Kişisel story', 'Quick tip', 'İlham verici alıntı', 'Trend/mizah', 'Behind the scenes'],
  gaming: ['Trend/mizah', 'İpuçları', 'Kişisel story', 'Behind the scenes', 'Mitos yıkımı'],
  personal_dev: ['İlham verici alıntı', 'Quick tip', 'Mitos yıkımı', 'İpuçları', 'Soru-cevap'],
  beauty: ['İpuçları', 'Müşteri sonucu', 'Trend/mizah', 'Behind the scenes', 'Mitos yıkımı'],
};

const BALANCED_PURPOSE_BIAS: PillarSlot['purpose'][] = ['educate', 'educate', 'inspire', 'connect', 'entertain', 'sell'];

export const buildPillars = (input: { niche: string; count?: number }): PillarSlot[] => {
  const count = Math.max(3, Math.min(6, input.count ?? 5));
  const favs = NICHE_FAVORITES[input.niche] ?? [];
  const pool = PILLAR_TEMPLATES.filter(t => favs.includes(t.name));
  const fallbackPool = pool.length >= count ? pool : [...pool, ...PILLAR_TEMPLATES.filter(t => !favs.includes(t.name))];

  const selected = new Set<string>();
  const out: PillarSlot[] = [];
  for (const t of fallbackPool) {
    if (out.length >= count) break;
    if (selected.has(t.name)) continue;
    selected.add(t.name);
    out.push({
      name: t.name,
      purpose: t.purpose,
      ratio: 0,
      color: PILLAR_PURPOSES[t.purpose].color,
      examples: t.examples,
    });
  }

  const equalRatio = Math.round((100 / out.length) * 10) / 10;
  let remainder = 100 - equalRatio * out.length;
  out.forEach((p, idx) => {
    p.ratio = idx === 0 ? equalRatio + remainder : equalRatio;
  });

  return out;
};

export const getPillarList = async (): Promise<PillarEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(PILLAR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PillarEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.niche === 'string'
    );
  } catch {
    return [];
  }
};

export const savePillar = async (entry: Omit<PillarEntry, 'id' | 'createdAt'>): Promise<PillarEntry[]> => {
  const list = await getPillarList();
  const full: PillarEntry = {
    ...entry,
    id: `pillar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 20);
  await AsyncStorage.setItem(PILLAR_KEY, JSON.stringify(next));
  return next;
};

export const updatePillar = async (id: string, patch: Partial<PillarEntry>): Promise<PillarEntry[]> => {
  const list = await getPillarList();
  const next = list.map(e => (e.id === id ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e));
  await AsyncStorage.setItem(PILLAR_KEY, JSON.stringify(next));
  return next;
};

export const removePillar = async (id: string): Promise<PillarEntry[]> => {
  const list = await getPillarList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(PILLAR_KEY, JSON.stringify(next));
  return next;
};

export const clearPillars = async (): Promise<void> => {
  await AsyncStorage.removeItem(PILLAR_KEY);
};

// ============================================================================
// ROUND 80 — Best Post Time Calculator
// ============================================================================

export type BPTPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'facebook';
export type BPTAudience = 'genz' | 'millennial' | 'genx' | 'parents' | 'b2b' | 'students';
export type BPTDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type BPTEntry = {
  id: string;
  platform: BPTPlatform;
  audience: BPTAudience;
  slots: BPTSlot[];
  score: number;
  reasoning: string[];
  notes: string;
  createdAt: number;
};

export type BPTSlot = {
  day: BPTDay;
  hour: number;
  score: number;
  rank: number;
  label: string;
};

const BPT_KEY = '@content-coach/best-post-time';

export const BPT_PLATFORMS: Record<BPTPlatform, { label: string; emoji: string; color: string }> = {
  instagram: { label: 'Instagram', emoji: '📸', color: '#E1306C' },
  tiktok: { label: 'TikTok', emoji: '🎵', color: '#000000' },
  youtube: { label: 'YouTube', emoji: '▶️', color: '#FF0000' },
  twitter: { label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0' },
  linkedin: { label: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
  facebook: { label: 'Facebook', emoji: '👍', color: '#1877F2' },
};

export const BPT_AUDIENCES: Record<BPTAudience, { label: string; emoji: string }> = {
  genz: { label: 'Gen Z (16-25)', emoji: '🧃' },
  millennial: { label: 'Millennial (26-40)', emoji: '☕' },
  genx: { label: 'Gen X (41-56)', emoji: '📺' },
  parents: { label: 'Ebeveynler', emoji: '👨‍👩‍👧' },
  b2b: { label: 'B2B / Profesyonel', emoji: '💼' },
  students: { label: 'Öğrenciler', emoji: '🎓' },
};

const DAY_LABELS: Record<BPTDay, string> = {
  0: 'Paz',
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cmt',
};

const BASE_HOUR_BIAS: Record<number, number> = {
  0: 5, 1: 3, 2: 2, 3: 1, 4: 1, 5: 2, 6: 5, 7: 15,
  8: 30, 9: 45, 10: 50, 11: 55, 12: 70, 13: 60, 14: 50, 15: 45,
  16: 40, 17: 50, 18: 65, 19: 75, 20: 85, 21: 90, 22: 70, 23: 40,
};

const BASE_DAY_BIAS: Record<BPTDay, number> = {
  0: 60, 1: 75, 2: 85, 3: 88, 4: 90, 5: 80, 6: 65,
};

const PLATFORM_HOUR_MULT: Record<BPTPlatform, Partial<Record<number, number>>> = {
  instagram: { 7: 0.7, 12: 1.1, 13: 1.1, 18: 1.15, 19: 1.2, 20: 1.25, 21: 1.2, 22: 1.0 },
  tiktok: { 11: 1.0, 14: 1.05, 18: 1.1, 19: 1.2, 20: 1.3, 21: 1.35, 22: 1.25, 23: 1.1 },
  youtube: { 14: 1.0, 15: 1.05, 16: 1.1, 17: 1.15, 18: 1.15, 19: 1.2, 20: 1.25, 21: 1.2, 22: 1.0 },
  twitter: { 8: 1.1, 9: 1.2, 12: 1.15, 13: 1.1, 17: 1.2, 18: 1.15, 22: 0.7 },
  linkedin: { 8: 1.2, 9: 1.3, 10: 1.25, 11: 1.15, 12: 0.95, 13: 1.1, 14: 1.15, 15: 1.1, 16: 1.05, 17: 0.85 },
  facebook: { 9: 1.1, 12: 1.1, 13: 1.15, 15: 1.2, 19: 1.2, 20: 1.15, 21: 1.05 },
};

const PLATFORM_DAY_MULT: Record<BPTPlatform, Partial<Record<BPTDay, number>>> = {
  instagram: { 2: 1.05, 3: 1.1, 4: 1.05, 5: 1.0, 0: 0.95 },
  tiktok: { 3: 1.1, 4: 1.05, 5: 1.15, 6: 1.1, 0: 0.95 },
  youtube: { 5: 1.15, 6: 1.2, 0: 1.1, 4: 1.0 },
  twitter: { 1: 1.1, 2: 1.15, 3: 1.15, 4: 1.1, 5: 0.95 },
  linkedin: { 1: 1.2, 2: 1.25, 3: 1.25, 4: 1.15, 5: 0.9, 6: 0.6, 0: 0.6 },
  facebook: { 2: 1.05, 3: 1.1, 4: 1.1, 5: 1.05, 0: 0.95 },
};

const AUDIENCE_HOUR_MULT: Record<BPTAudience, Partial<Record<number, number>>> = {
  genz: { 14: 1.05, 15: 1.1, 19: 1.1, 20: 1.2, 21: 1.25, 22: 1.3, 23: 1.15, 0: 0.85 },
  millennial: { 7: 1.05, 12: 1.15, 13: 1.1, 18: 1.1, 19: 1.15, 20: 1.2, 21: 1.2, 22: 1.1 },
  genx: { 8: 1.15, 9: 1.2, 10: 1.15, 12: 1.1, 19: 1.1, 20: 1.1, 21: 1.05, 22: 0.85 },
  parents: { 9: 1.1, 12: 1.1, 13: 1.05, 20: 1.2, 21: 1.25, 22: 1.15, 7: 0.7 },
  b2b: { 8: 1.2, 9: 1.3, 10: 1.25, 11: 1.15, 14: 1.15, 15: 1.15, 16: 1.1, 17: 1.05 },
  students: { 10: 1.05, 14: 1.05, 18: 1.1, 19: 1.15, 20: 1.2, 21: 1.25, 22: 1.25, 23: 1.15, 0: 1.05, 1: 0.85 },
};

export const buildBestPostTimes = (input: {
  platform: BPTPlatform;
  audience: BPTAudience;
}): Omit<BPTEntry, 'id' | 'createdAt'> => {
  const slots: BPTSlot[] = [];
  for (let d = 0 as BPTDay; d <= 6; d = (d + 1) as BPTDay) {
    for (let h = 0; h < 24; h++) {
      const base = BASE_HOUR_BIAS[h] * BASE_DAY_BIAS[d];
      const pMult = PLATFORM_HOUR_MULT[input.platform][h] ?? 1;
      const dMult = PLATFORM_DAY_MULT[input.platform][d] ?? 1;
      const aMult = AUDIENCE_HOUR_MULT[input.audience][h] ?? 1;
      const raw = base * pMult * dMult * aMult;
      const score = Math.round(Math.min(100, raw));
      slots.push({
        day: d,
        hour: h,
        score,
        rank: 0,
        label: '',
      });
    }
  }
  slots.sort((a, b) => b.score - a.score);
  slots.forEach((s, idx) => {
    s.rank = idx + 1;
    s.label = `${DAY_LABELS[s.day]} ${String(s.hour).padStart(2, '0')}:00`;
  });

  const top = slots.slice(0, 10);
  const avgTop = Math.round(top.reduce((s, x) => s + x.score, 0) / top.length);

  const reasoning: string[] = [];
  reasoning.push(`${BPT_PLATFORMS[input.platform].label} için ${BPT_AUDIENCES[input.audience].label} kitlesinin en aktif olduğu saatler.`);
  reasoning.push(`En iyi 10 slot ortalaması: ${avgTop}/100`);
  if (input.platform === 'linkedin') reasoning.push('LinkedIn hafta sonu düşüş gösterir — iş günlerine odaklan.');
  if (input.platform === 'tiktok') reasoning.push('TikTok akşam 19-23 arası zirve yapıyor.');
  if (input.platform === 'instagram') reasoning.push('Instagram öğle (12-13) ve akşam (19-21) çift pik yapar.');
  if (input.audience === 'b2b') reasoning.push('B2B: sabah 8-11 arası iş mail trafiği yoğun, dikkat çekmek için ideal.');
  if (input.audience === 'genz') reasoning.push('Gen Z gece kuşu — 21-00 arası pik.');
  if (input.audience === 'parents') reasoning.push('Ebeveynler çocuk uyuduktan sonra aktif — 20-22.');

  return {
    platform: input.platform,
    audience: input.audience,
    slots: top,
    score: avgTop,
    reasoning,
    notes: '',
  };
};

export const getBPTList = async (): Promise<BPTEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(BPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is BPTEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.platform === 'string'
    );
  } catch {
    return [];
  }
};

export const saveBPT = async (entry: Omit<BPTEntry, 'id' | 'createdAt'>): Promise<BPTEntry[]> => {
  const list = await getBPTList();
  const full: BPTEntry = {
    ...entry,
    id: `bpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 30);
  await AsyncStorage.setItem(BPT_KEY, JSON.stringify(next));
  return next;
};

export const updateBPT = async (id: string, patch: Partial<BPTEntry>): Promise<BPTEntry[]> => {
  const list = await getBPTList();
  const next = list.map(e => (e.id === id ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e));
  await AsyncStorage.setItem(BPT_KEY, JSON.stringify(next));
  return next;
};

export const removeBPT = async (id: string): Promise<BPTEntry[]> => {
  const list = await getBPTList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(BPT_KEY, JSON.stringify(next));
  return next;
};

export const clearBPTs = async (): Promise<void> => {
  await AsyncStorage.removeItem(BPT_KEY);
};

// ============================================================================
// ROUND 81 — Story Sequence Planner
// ============================================================================

export type StorySeqPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin';
export type StorySeqGoal = 'product_launch' | 'announcement' | 'recap' | 'tutorial' | 'testimonial' | 'qna';
export type StorySeqEntry = {
  id: string;
  title: string;
  platform: StorySeqPlatform;
  goal: StorySeqGoal;
  storyArcs: StorySeqFrame[];
  totalDuration: string;
  hooks: string[];
  notes: string;
  createdAt: number;
};

export type StorySeqFrame = {
  index: number;
  duration: number;
  visual: string;
  caption: string;
  transition: 'cut' | 'fade' | 'swipe' | 'zoom' | 'audio_shift';
  purpose: 'hook' | 'context' | 'tension' | 'reveal' | 'cta';
};

const STORYSEQ_KEY = '@content-coach/story-sequence';

export const STORYSEQ_PLATFORMS: Record<StorySeqPlatform, { label: string; emoji: string; color: string }> = {
  instagram: { label: 'Instagram', emoji: '📸', color: '#E1306C' },
  tiktok: { label: 'TikTok', emoji: '🎵', color: '#000000' },
  youtube: { label: 'YouTube', emoji: '▶️', color: '#FF0000' },
  twitter: { label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0' },
  linkedin: { label: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
};

export const STORYSEQ_GOALS: Record<StorySeqGoal, { label: string; emoji: string; tip: string; frames: number }> = {
  product_launch: { label: 'Ürün lansmanı', emoji: '🚀', tip: 'Heyecan → özellik → sonuç → CTA', frames: 5 },
  announcement: { label: 'Duyuru', emoji: '📣', tip: 'Ne değişiyor → neden önemli → ne yapmalı', frames: 4 },
  recap: { label: 'Haftalık özet', emoji: '📋', tip: 'En iyi 3 içerik → öğrenilen → sırada', frames: 4 },
  tutorial: { label: 'Mini tutorial', emoji: '🛠️', tip: 'Problem → adım → sonuç → bonus', frames: 4 },
  testimonial: { label: 'Müşteri hikayesi', emoji: '⭐', tip: 'Önce → keşif → sonuç → yorum', frames: 5 },
  qna: { label: 'Soru-cevap', emoji: '❓', tip: 'Soru → düşünce → cevap → bonus', frames: 4 },
};

export const STORYSEQ_PURPOSE_META: Record<StorySeqFrame['purpose'], { label: string; emoji: string }> = {
  hook: { label: 'Hook', emoji: '🪝' },
  context: { label: 'Bağlam', emoji: '🌐' },
  tension: { label: 'Gerilim', emoji: '⚡' },
  reveal: { label: 'Çözüm', emoji: '💡' },
  cta: { label: 'CTA', emoji: '📣' },
};

export const STORYSEQ_TRANSITIONS: Record<StorySeqFrame['transition'], string> = {
  cut: 'Kesme',
  fade: 'Karartma',
  swipe: 'Kaydırma',
  zoom: 'Zoom-in',
  audio_shift: 'Ses değişimi',
};

const HOOK_POOL: Record<StorySeqGoal, string[]> = {
  product_launch: [
    'Beklediğiniz gün geldi — X artık burada',
    'Bu ürünü neden yaptık? Çünkü...',
    'X ile Y sorununa son',
    'Sonunda — çok istediğiniz şey',
  ],
  announcement: [
    'Büyük haber — X artık Y olacak',
    'Yıllardır istiyordunuz — işte oldu',
    'Yol haritası güncellendi',
    'Şirketimizde yeni bir dönem başlıyor',
  ],
  recap: [
    'Bu hafta neler oldu? İşte 3 önemli şey',
    'Haftanın en iyileri (kaçırma)',
    '7 günde 3 büyük ders',
    'Bu hafta X keşiflerim',
  ],
  tutorial: [
    'X\'i nasıl yaparsın? 4 adımda',
    'Yapamıyorum diyorsun ama aslında...',
    'Yöntem X — hızlı sonuç',
    'Bu ipucu zaman kazandırır',
  ],
  testimonial: [
    'Müşteri Y geldi — X sonuç aldı',
    '3 ay önce Z idi, şimdi...',
    'Hikaye: A noktasından B noktasına',
    'Başarı hikayesi (gerçek)',
  ],
  qna: [
    'En çok sorulan: X — işte cevap',
    'Topluluk soruyor, ben yanıtlıyorum',
    'Soru-Cevap #12 — ilginç gelenler',
    'Bu soruyu hep alıyorum',
  ],
};

const STORYSEQ_TEMPLATE: Record<StorySeqGoal, { purpose: StorySeqFrame['purpose']; duration: number; visualHint: string; captionHint: string }[]> = {
  product_launch: [
    { purpose: 'hook', duration: 3, visualHint: 'Ürünün ilk açı', captionHint: 'Heyecan veren açılış, "beklediğiniz gün geldi"' },
    { purpose: 'context', duration: 4, visualHint: 'Problem görseli veya öncesi', captionHint: 'Hangi sorunu çözüyoruz' },
    { purpose: 'tension', duration: 5, visualHint: 'Özellik turu (zoom-in)', captionHint: '3 ana özellik — kısa tut' },
    { purpose: 'reveal', duration: 4, visualHint: 'Sonuç görseli / demo', captionHint: 'Beklentileri aşan sonuç' },
    { purpose: 'cta', duration: 3, visualHint: 'Logo + link ekranı', captionHint: 'Bugün al, %X indirim' },
  ],
  announcement: [
    { purpose: 'hook', duration: 3, visualHint: 'Büyük harfli başlık', captionHint: 'Büyük haber' },
    { purpose: 'context', duration: 5, visualHint: 'Sebep görseli', captionHint: 'Neden önemli' },
    { purpose: 'reveal', duration: 5, visualHint: 'Detay ekranı', captionHint: 'Değişiklikler' },
    { purpose: 'cta', duration: 3, visualHint: 'Harekete geçirici', captionHint: 'Ne yapmalısın' },
  ],
  recap: [
    { purpose: 'hook', duration: 3, visualHint: 'Haftanın görseli', captionHint: 'Haftanın özeti' },
    { purpose: 'tension', duration: 4, visualHint: '3 içerik kesitleri', captionHint: '3 önemli içerik' },
    { purpose: 'reveal', duration: 4, visualHint: 'Ders grafiği', captionHint: 'Öğrenilenler' },
    { purpose: 'cta', duration: 3, visualHint: 'Gelecek hafta fragman', captionHint: 'Sıradakiler' },
  ],
  tutorial: [
    { purpose: 'hook', duration: 3, visualHint: 'Problem ekranı', captionHint: 'Sorun ne' },
    { purpose: 'context', duration: 4, visualHint: 'Araçlar / malzemeler', captionHint: 'Neye ihtiyacın var' },
    { purpose: 'tension', duration: 6, visualHint: 'Adım adım ekran', captionHint: 'Adım 1, 2, 3...' },
    { purpose: 'cta', duration: 3, visualHint: 'Sonuç + bonus', captionHint: 'Sonuç + ek ipucu' },
  ],
  testimonial: [
    { purpose: 'hook', duration: 3, visualHint: 'Müşteri portre', captionHint: 'Müşteri tanıtımı' },
    { purpose: 'context', duration: 5, visualHint: 'Önce durum', captionHint: 'Başlangıç durumu' },
    { purpose: 'tension', duration: 5, visualHint: 'Keşif anı', captionHint: 'Nasıl keşfetti' },
    { purpose: 'reveal', duration: 5, visualHint: 'Sonuç görseli', captionHint: 'Elde edilen sonuç' },
    { purpose: 'cta', duration: 3, visualHint: 'Müşteri yorumu + CTA', captionHint: 'Sen de dene' },
  ],
  qna: [
    { purpose: 'hook', duration: 3, visualHint: 'Soru metni', captionHint: 'Soruyu göster' },
    { purpose: 'context', duration: 4, visualHint: 'Benzer durumlar', captionHint: 'Neden önemli' },
    { purpose: 'reveal', duration: 5, visualHint: 'Cevap (3 parça)', captionHint: 'Cevap, örnekler' },
    { purpose: 'cta', duration: 3, visualHint: 'Sormaya devam', captionHint: 'Bir sorun daha' },
  ],
};

export const buildStorySeq = (input: {
  title: string;
  platform: StorySeqPlatform;
  goal: StorySeqGoal;
}): Omit<StorySeqEntry, 'id' | 'createdAt'> => {
  const template = STORYSEQ_TEMPLATE[input.goal];
  const arcs: StorySeqFrame[] = template.map((t, idx) => {
    const transitions: StorySeqFrame['transition'][] = ['cut', 'fade', 'swipe', 'zoom', 'audio_shift'];
    const transition = transitions[idx % transitions.length];
    return {
      index: idx,
      duration: t.duration,
      visual: t.visualHint,
      caption: t.captionHint,
      transition,
      purpose: t.purpose,
    };
  });
  const totalSec = arcs.reduce((s, a) => s + a.duration, 0);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const totalDuration = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}sn`;

  const hooks = HOOK_POOL[input.goal];

  return {
    title: input.title,
    platform: input.platform,
    goal: input.goal,
    storyArcs: arcs,
    totalDuration,
    hooks,
    notes: '',
  };
};

export const getStorySeqList = async (): Promise<StorySeqEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORYSEQ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is StorySeqEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.title === 'string'
    );
  } catch {
    return [];
  }
};

export const saveStorySeq = async (entry: Omit<StorySeqEntry, 'id' | 'createdAt'>): Promise<StorySeqEntry[]> => {
  const list = await getStorySeqList();
  const full: StorySeqEntry = {
    ...entry,
    id: `storyseq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 30);
  await AsyncStorage.setItem(STORYSEQ_KEY, JSON.stringify(next));
  return next;
};

export const updateStorySeq = async (id: string, patch: Partial<StorySeqEntry>): Promise<StorySeqEntry[]> => {
  const list = await getStorySeqList();
  const next = list.map(e => (e.id === id ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e));
  await AsyncStorage.setItem(STORYSEQ_KEY, JSON.stringify(next));
  return next;
};

export const removeStorySeq = async (id: string): Promise<StorySeqEntry[]> => {
  const list = await getStorySeqList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(STORYSEQ_KEY, JSON.stringify(next));
  return next;
};

export const clearStorySeqs = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORYSEQ_KEY);
};

// ============================================================================
// ROUND 82 — Comment Reply Bank
// ============================================================================

export type ReplyIntent = 'thank' | 'curiosity' | 'objection' | 'support' | 'spam' | 'criticism';
export type ReplyTone = 'warm' | 'professional' | 'casual' | 'witty' | 'brief';
export type ReplyEntry = {
  id: string;
  comment: string;
  intent: ReplyIntent;
  tone: ReplyTone;
  suggestions: ReplySuggestion[];
  bestId: string;
  notes: string;
  createdAt: number;
};

export type ReplySuggestion = {
  id: string;
  text: string;
  intent: ReplyIntent;
  tone: ReplyTone;
  lengthScore: number;
};

const REPLYBANK_KEY = '@content-coach/comment-reply-bank';

export const REPLYBANK_INTENTS: Record<ReplyIntent, { label: string; emoji: string; color: string; tip: string }> = {
  thank: { label: 'Teşekkür', emoji: '🙏', color: '#10B981', tip: 'Olumlu yorumu ödüllendir, tekrar etkileşim al.' },
  curiosity: { label: 'Merak / soru', emoji: '❓', color: '#6366f1', tip: 'Soru varsa değerli cevap ver, sohbeti derinleştir.' },
  objection: { label: 'İtiraz / şüphe', emoji: '🤔', color: '#F59E0B', tip: 'Saygılı cevap, kanıt/örnek ver. Saldırma.' },
  support: { label: 'Destek / övgü', emoji: '❤️', color: '#EC4899', tip: 'Samimi teşekkür, geri bağlantı kur.' },
  spam: { label: 'Spam / bot', emoji: '🤖', color: '#94a3b8', tip: 'Yanıtlama veya sil. Gereksiz etkileşim sinyal verme.' },
  criticism: { label: 'Eleştiri', emoji: '🪞', color: '#EF4444', tip: 'Özür veya net duruş. Yapıcıysa teşekkür et.' },
};

export const REPLYBANK_TONES: Record<ReplyTone, { label: string; emoji: string; tip: string }> = {
  warm: { label: 'Samimi / sıcak', emoji: '🤗', tip: 'Kişisel, içten. Topluluk hissi.' },
  professional: { label: 'Profesyonel', emoji: '💼', tip: 'Mesafeli, net, bilgisel. B2B uygun.' },
  casual: { label: 'Günlük', emoji: '☕', tip: 'Rahat, emoji\'li, sohbet dili.' },
  witty: { label: 'Esprili', emoji: '😏', tip: 'Hafif mizah, akılda kalıcı. Riske göre.' },
  brief: { label: 'Kısa / net', emoji: '⚡', tip: '1-2 cümle. Zaman kazandırır.' },
};

const REPLY_TEMPLATES: Record<ReplyIntent, Partial<Record<ReplyTone, string[]>>> = {
  thank: {
    warm: [
      'Çok teşekkür ederim, yorumun beni gerçekten mutlu etti ❤️ Daha fazlası için takipte kal!',
      'Seni okumak beni motive ediyor — paylaşımın için sağ ol 💛',
      'Böyle bir topluluk için minnettarım. Seninle büyüyoruz 🙌',
    ],
    casual: [
      'Çok sağ ol! 🙌 Devamı gelecek, takipte kal 👀',
      'Teşekkürler! Beğenmene sevindim 😊',
      'Sağolasın, senin de paylaşımların harika!',
    ],
    professional: [
      'Değerli geri bildiriminiz için teşekkür ederim. Sağlıklı günler dilerim.',
      'Yorumunuz için minnettarım, tekrar görüşmek üzere.',
    ],
    witty: [
      'Bu yorumu çerçeveletip duvara asacağım 😄',
      'Sen komşu apartmana taşınsan mı? Böyle komşu her yerde olsun 🏠',
    ],
    brief: ['Teşekkürler! 🙌', 'Sağol! 💛', 'Çok teşekkür ederim. ❤️'],
  },
  curiosity: {
    warm: [
      'Çok güzel bir soru! Açıkçası X, çünkü Y... Sormaya devam et!',
      'Bunu ben de ilk başta merak ettim. Aslında özetle...',
      'Sorun harika — tam olarak bu yüzden X yaptım. Detay vereyim: ...',
    ],
    casual: [
      'Hahaha iyi soru! Aslında şöyle: ...',
      'Bunu sorduğuna sevindim. Özet: ...',
      'Valla çok mantıklı bir soru. Cevap: ...',
    ],
    professional: [
      'İyi soru. Detaylı açıklama için: ...',
      'Sorunuz için: X, sonuç olarak Y. Teşekkürler.',
    ],
    witty: [
      'Hocam soru zor, kahve içmeden cevap vermem ☕ Ama açıklayayım: ...',
      'Bu soruyu soran kişi kazandı — cevap: ...',
    ],
    brief: ['Kısa cevap: X. Detay için DM atabilirsin.', 'Özet: X. Yorumda sorabilirsin.'],
  },
  objection: {
    warm: [
      'Anlıyorum seni. Açıkçası ben de bu konuda tereddüt ettim başta. Şunu öğrendim: ...',
      'Seni duyuyorum. Farklı bakış açıları önemli. Ben X deneyiminden şunu gördüm: ...',
      'Haklı olabilirsin aslında. Düşüncemi paylaşayım: ...',
    ],
    casual: [
      'Anladım, senin açından mantıklı. Bence denemeye değer çünkü ...',
      'Dürüst olayım, ben de öyle düşünmüştüm. Sonra ...',
    ],
    professional: [
      'Görüşünüz dikkate değer. Çalışmamızda X bulgusu buna ışık tutuyor.',
      'İtirazınız yerinde. Detaylı yanıt için: ...',
    ],
    witty: [
      'Valla haklısın, dünya düz olsaydı sen de haklı olurdun 🌍 Ama deneyim gösteriyor ki ...',
      'Bu itiraz 10 üzerinden 9 — son 1 puan için X\'i dene 😄',
    ],
    brief: ['Haklısın. X örnek verebilir miyim?', 'Düşüncen mantıklı. Şunu da düşün: ...'],
  },
  support: {
    warm: [
      'Bu kadar güzel yorum için teşekkür ederim, beni çok motive ettin 🙏',
      'Senin gibi okurlarla devam etmek harika. Bir sonraki içerik için önerin varsa alayım!',
    ],
    casual: ['Çok sağ ol! 🤩 Yorumun harika', 'Teşekkürler! 🙌'],
    professional: ['Değerli yorumunuz için teşekkür ederim. Sağlıklı günler.'],
    witty: ['Bu yorumu okuyunca 1 günlük enerjim doldu ⚡', 'Kral/kraliçe, teşekkürler 👑'],
    brief: ['Çok sağ ol! ❤️', 'Teşekkürler! 🙏'],
  },
  spam: {
    brief: ['', '', ''],
    casual: ['', ''],
    witty: ['🤖', 'Bot mı acaba?', 'Skip'],
    warm: [],
    professional: [],
  },
  criticism: {
    warm: [
      'Yorumun için teşekkür ederim. Haklı olabilirsin — X konuda daha dikkatli olmaya çalışıyorum.',
      'Geri bildirim değerli. Detaylı düşünceni duymak isterim.',
    ],
    professional: [
      'Eleştiriniz dikkate alınmıştır. Çalışmamızı geliştirmek için not aldım.',
      'Olgunuz hakkında düşüncelerimizi ileteceğim.',
    ],
    casual: [
      'Yorumun için sağ ol, üzerinde düşüneceğim.',
      'Haklı olabilirsin, bakış açını dikkate alıyorum.',
    ],
    witty: ['Yapıcı eleştiri en iyi hediye — teşekkürler 🎁'],
    brief: ['Teşekkürler, not aldım.', 'Düşünceni dikkate alıyorum.'],
  },
};

export const buildReplySuggestions = (input: {
  comment: string;
  intent: ReplyIntent;
  tone: ReplyTone;
}): Omit<ReplyEntry, 'id' | 'createdAt'> => {
  const commentLower = input.comment.toLowerCase().trim();
  const hasQuestion = /\?|ne|neden|nasıl|hangi|kim|nerede/i.test(commentLower);
  const isShort = commentLower.length < 30;
  const hasPraise = /harika|süper|mükemmel|teşekkür|sağol|sevdim|beğendim|tavsiye|başarı/i.test(commentLower);

  const allTemplates = REPLY_TEMPLATES[input.intent];
  const toneTemplates = allTemplates[input.tone] ?? allTemplates.warm ?? ['Teşekkürler!'];

  const otherTones: ReplySuggestion[] = [];
  for (const t of Object.keys(allTemplates) as ReplyTone[]) {
    if (t === input.tone) continue;
    const ts = allTemplates[t] ?? [];
    for (const txt of ts.slice(0, 2)) {
      otherTones.push({
        id: `${t}-${txt.slice(0, 10)}`,
        text: txt,
        intent: input.intent,
        tone: t,
        lengthScore: txt.length,
      });
    }
  }

  const ownSuggestions: ReplySuggestion[] = toneTemplates
    .filter(t => t.length > 0)
    .map((t, idx) => ({
      id: `own-${idx}`,
      text: t,
      intent: input.intent,
      tone: input.tone,
      lengthScore: t.length,
    }));

  const suggestions: ReplySuggestion[] = [...ownSuggestions, ...otherTones.slice(0, 6)];

  let adjusted: ReplySuggestion[] = suggestions;
  if (input.intent === 'curiosity' && !hasQuestion) {
    adjusted = suggestions.filter(s => s.text.length > 0);
  }
  if (input.intent === 'thank' && !hasPraise) {
    adjusted = suggestions.filter(s => s.text.length > 0);
  }

  if (adjusted.length === 0) {
    adjusted = [{ id: 'default', text: 'Teşekkürler!', intent: input.intent, tone: input.tone, lengthScore: 12 }];
  }

  adjusted.sort((a, b) => b.lengthScore - a.lengthScore);
  const best = adjusted[0];

  return {
    comment: input.comment,
    intent: input.intent,
    tone: input.tone,
    suggestions: adjusted,
    bestId: best.id,
    notes: '',
  };
};

export const getReplyBankList = async (): Promise<ReplyEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(REPLYBANK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ReplyEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.comment === 'string'
    );
  } catch {
    return [];
  }
};

export const saveReplyBank = async (entry: Omit<ReplyEntry, 'id' | 'createdAt'>): Promise<ReplyEntry[]> => {
  const list = await getReplyBankList();
  const full: ReplyEntry = {
    ...entry,
    id: `replybank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 60);
  await AsyncStorage.setItem(REPLYBANK_KEY, JSON.stringify(next));
  return next;
};

export const updateReplyBank = async (id: string, patch: Partial<ReplyEntry>): Promise<ReplyEntry[]> => {
  const list = await getReplyBankList();
  const next = list.map(e => (e.id === id ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e));
  await AsyncStorage.setItem(REPLYBANK_KEY, JSON.stringify(next));
  return next;
};

export const removeReplyBank = async (id: string): Promise<ReplyEntry[]> => {
  const list = await getReplyBankList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(REPLYBANK_KEY, JSON.stringify(next));
  return next;
};

export const clearReplyBanks = async (): Promise<void> => {
  await AsyncStorage.removeItem(REPLYBANK_KEY);
};

// ============================================================================
// ROUND 83 — Content Calendar Heatmap
// ============================================================================

export type CCPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'facebook';
export type CCIntensity = 'low' | 'medium' | 'high' | 'viral';
export type CCEntry = {
  id: string;
  date: string;
  platform: CCPlatform;
  topic: string;
  intensity: CCIntensity;
  engagement: number;
  notes: string;
  createdAt: number;
};

const CHEAT_KEY = '@content-coach/calendar-heatmap';

export const CHEAT_PLATFORMS: Record<CCPlatform, { label: string; emoji: string; color: string }> = {
  instagram: { label: 'Instagram', emoji: '📸', color: '#E1306C' },
  tiktok: { label: 'TikTok', emoji: '🎵', color: '#000000' },
  youtube: { label: 'YouTube', emoji: '▶️', color: '#FF0000' },
  twitter: { label: 'Twitter / X', emoji: '🐦', color: '#1D9BF0' },
  linkedin: { label: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
  facebook: { label: 'Facebook', emoji: '👍', color: '#1877F2' },
};

export const CHEAT_INTENSITY_META: Record<CCIntensity, { label: string; emoji: string; color: string; minEngagement: number }> = {
  low: { label: 'Düşük', emoji: '⚪', color: '#475569', minEngagement: 0 },
  medium: { label: 'Orta', emoji: '🟡', color: '#F59E0B', minEngagement: 50 },
  high: { label: 'Yüksek', emoji: '🟢', color: '#10B981', minEngagement: 200 },
  viral: { label: 'Viral', emoji: '🚀', color: '#EF4444', minEngagement: 1000 },
};

export const intensityFromEngagement = (e: number): CCIntensity => {
  if (e >= 1000) return 'viral';
  if (e >= 200) return 'high';
  if (e >= 50) return 'medium';
  return 'low';
};

export const buildCalendarHeatmap = (entries: CCEntry[]): {
  byDay: Record<string, CCEntry[]>;
  byMonth: Record<string, { total: number; viral: number; high: number }>;
  bestDay: string | null;
  bestPlatform: CCPlatform | null;
  streakDays: number;
} => {
  const byDay: Record<string, CCEntry[]> = {};
  entries.forEach(e => {
    if (!byDay[e.date]) byDay[e.date] = [];
    byDay[e.date].push(e);
  });

  const byMonth: Record<string, { total: number; viral: number; high: number }> = {};
  entries.forEach(e => {
    const month = e.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { total: 0, viral: 0, high: 0 };
    byMonth[month].total += 1;
    if (e.intensity === 'viral') byMonth[month].viral += 1;
    if (e.intensity === 'high') byMonth[month].high += 1;
  });

  let bestDay: string | null = null;
  let bestScore = 0;
  Object.entries(byDay).forEach(([day, list]) => {
    const score = list.reduce((s, e) => s + e.engagement, 0);
    if (score > bestScore) {
      bestScore = score;
      bestDay = day;
    }
  });

  const platformCount: Partial<Record<CCPlatform, number>> = {};
  entries.forEach(e => {
    platformCount[e.platform] = (platformCount[e.platform] ?? 0) + 1;
  });
  let bestPlatform: CCPlatform | null = null;
  let bestPlatformCount = 0;
  (Object.entries(platformCount) as [CCPlatform, number][]).forEach(([p, c]) => {
    if (c > bestPlatformCount) {
      bestPlatformCount = c;
      bestPlatform = p;
    }
  });

  const dates = Object.keys(byDay).sort();
  let streak = 0;
  let currentStreak = 0;
  if (dates.length > 0) {
    let prev = new Date(dates[0]);
    dates.forEach(d => {
      const cur = new Date(d);
      const diff = (cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
      if (diff === 1) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
      streak = Math.max(streak, currentStreak);
      prev = cur;
    });
  }

  return { byDay, byMonth, bestDay, bestPlatform, streakDays: streak };
};

export const getCheatList = async (): Promise<CCEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(CHEAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is CCEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.date === 'string'
    );
  } catch {
    return [];
  }
};

export const saveCheat = async (entry: Omit<CCEntry, 'id' | 'createdAt'>): Promise<CCEntry[]> => {
  const list = await getCheatList();
  const full: CCEntry = {
    ...entry,
    id: `cheat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...list].slice(0, 365);
  await AsyncStorage.setItem(CHEAT_KEY, JSON.stringify(next));
  return next;
};

export const updateCheat = async (id: string, patch: Partial<CCEntry>): Promise<CCEntry[]> => {
  const list = await getCheatList();
  const next = list.map(e => (e.id === id ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e));
  await AsyncStorage.setItem(CHEAT_KEY, JSON.stringify(next));
  return next;
};

export const removeCheat = async (id: string): Promise<CCEntry[]> => {
  const list = await getCheatList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(CHEAT_KEY, JSON.stringify(next));
  return next;
};

export const clearCheats = async (): Promise<void> => {
  await AsyncStorage.removeItem(CHEAT_KEY);
};

// === Round 84: Hashtag Clusters ===
export type HClusterPlatform = 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | 'youtube';
export type HClusterIntent = 'reach' | 'niche' | 'community' | 'branded' | 'trending';
export type HClusterEntry = {
  id: string;
  pillar: string;
  platform: HClusterPlatform;
  intent: HClusterIntent;
  tags: string[];
  reach: number;
  createdAt: number;
};

export type HClusterPack = {
  platform: HClusterPlatform;
  intent: HClusterIntent;
  pillar: string;
  tags: string[];
  estReach: number;
};

export const HCLUSTER_KEY = '@content-coach/hashtag-clusters';
export const HCLUSTER_PLATFORMS: { id: HClusterPlatform; label: string; emoji: string; max: number }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', max: 15 },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', max: 6 },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', max: 5 },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦', max: 3 },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', max: 15 },
];

export const HCLUSTER_INTENTS: { id: HClusterIntent; label: string; emoji: string; desc: string }[] = [
  { id: 'reach', label: 'Geniş Erişim', emoji: '🌍', desc: 'Büyük havuz, düşük ilişki' },
  { id: 'niche', label: 'Niş Hedef', emoji: '🎯', desc: 'Az ama ilgili kitle' },
  { id: 'community', label: 'Topluluk', emoji: '🤝', desc: 'Etkileşim ve tartışma' },
  { id: 'branded', label: 'Marka Kimliği', emoji: '🏷️', desc: 'Kendi etiketinle kalıcılık' },
  { id: 'trending', label: 'Trend', emoji: '🔥', desc: 'Anlık fırsat, kısa ömür' },
];

const HCLUSTER_TAGS_BY_INTENT: Record<HClusterIntent, string[]> = {
  reach: ['#viral', '#explore', '#instagood', '#trending', '#fyp', '#keşfet', '#discover', '#today', '#daily', '#share'],
  niche: ['#microcreator', '#solopreneur', '#smallbusiness', '#independenthustle', '#workfromanywhere', '#expertbuilder', '#specialist', '#craftwork'],
  community: ['#communityfirst', '#supportcreators', '#creatorstalk', '#tribe', '#letschat', '#discussion', '#questionoftheday', '#openforum'],
  branded: ['#yourbrandname', '#brandstory', '#bts', '#behindthescenes', '#ourjourney', '#teamus', '#madebyus', '#signatureseries'],
  trending: ['#trendalert', '#newdrop', '#freshfind', '#hotrightnow', '#watchthis', '#onrepeat', '#moodtoday', '#viralnow'],
};

const HCLUSTER_PILLAR_HOOKS: string[] = [
  'productivity', 'mindset', 'storytelling', 'sales', 'education', 'lifestyle',
  'tech', 'design', 'wellness', 'creativity', 'business', 'parenting',
];

export const buildHashtagCluster = (
  pillar: string,
  platform: HClusterPlatform,
  intent: HClusterIntent
): HClusterPack => {
  const max = HCLUSTER_PLATFORMS.find(p => p.id === platform)?.max ?? 10;
  const intentPool = HCLUSTER_TAGS_BY_INTENT[intent];
  const seed = (pillar.length * 31 + platform.length * 17 + intent.length * 11) % 997;
  const count = Math.min(max, 4 + (seed % 5));
  const picked: string[] = [];
  const pillarTag = '#' + pillar.replace(/\s+/g, '').toLowerCase();
  picked.push(pillarTag);
  const seen = new Set<string>([pillarTag.toLowerCase()]);
  for (let i = 0; i < intentPool.length && picked.length < count; i++) {
    const idx = (seed + i * 7) % intentPool.length;
    const t = intentPool[idx];
    if (!seen.has(t.toLowerCase())) {
      picked.push(t);
      seen.add(t.toLowerCase());
    }
  }
  while (picked.length < count) {
    const extra = intentPool[(picked.length * 13 + seed) % intentPool.length];
    if (!seen.has(extra.toLowerCase())) {
      picked.push(extra);
      seen.add(extra.toLowerCase());
    }
  }
  const reachBase = intent === 'reach' ? 12000 : intent === 'niche' ? 1800 : intent === 'community' ? 3200 : intent === 'branded' ? 800 : 24000;
  const platformMult = platform === 'tiktok' ? 1.4 : platform === 'instagram' ? 1.1 : platform === 'youtube' ? 0.9 : platform === 'linkedin' ? 0.7 : 0.95;
  const estReach = Math.round((reachBase * platformMult) * (0.7 + ((seed % 60) / 100)));
  return { platform, intent, pillar, tags: picked, estReach };
};

export const getHClusterList = async (): Promise<HClusterEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(HCLUSTER_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HClusterEntry[];
  } catch {
    return [];
  }
};

export const saveHCluster = async (entry: HClusterEntry): Promise<HClusterEntry[]> => {
  const list = await getHClusterList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(HCLUSTER_KEY, JSON.stringify(next));
  return next;
};

export const removeHCluster = async (id: string): Promise<HClusterEntry[]> => {
  const list = await getHClusterList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(HCLUSTER_KEY, JSON.stringify(next));
  return next;
};

export const clearHClusters = async (): Promise<void> => {
  await AsyncStorage.removeItem(HCLUSTER_KEY);
};

export const suggestHClusterPillars = (): string[] => HCLUSTER_PILLAR_HOOKS.slice(0, 6);

// === Round 85: Evergreen vs Trending Calendar ===
export type ETCType = 'evergreen' | 'trending' | 'hybrid';
export type ETCCadence = 'daily' | '3xweek' | 'weekly' | 'biweekly';
export type ETCEntry = {
  id: string;
  title: string;
  type: ETCType;
  cadence: ETCCadence;
  shelfLifeDays: number;
  trafficPeak: 'morning' | 'noon' | 'evening' | 'night' | 'all-day';
  topic: string;
  notes: string;
  createdAt: number;
};

export type ETCDraft = {
  title: string;
  type: ETCType;
  cadence: ETCCadence;
  shelfLifeDays: number;
  trafficPeak: ETCEntry['trafficPeak'];
  topic: string;
  notes: string;
  ratio: { evergreen: number; trending: number };
  score: number;
};

export const ETC_KEY = '@content-coach/evergreen-trending';
export const ETC_TYPES: { id: ETCType; label: string; emoji: string; desc: string }[] = [
  { id: 'evergreen', label: 'Evergreen', emoji: '🌲', desc: 'Sürekli taze, uzun ömürlü' },
  { id: 'trending', label: 'Trending', emoji: '🔥', desc: 'Anlık dalga, kısa ömür' },
  { id: 'hybrid', label: 'Hibrit', emoji: '🔀', desc: 'Trend + kalıcı temel' },
];

export const ETC_CADENCES: { id: ETCCadence; label: string; perWeek: number }[] = [
  { id: 'daily', label: 'Her gün', perWeek: 7 },
  { id: '3xweek', label: 'Haftada 3', perWeek: 3 },
  { id: 'weekly', label: 'Haftalık', perWeek: 1 },
  { id: 'biweekly', label: '2 haftada 1', perWeek: 0.5 },
];

export const ETC_PEAKS: { id: ETCEntry['trafficPeak']; label: string; emoji: string }[] = [
  { id: 'morning', label: 'Sabah 07-10', emoji: '🌅' },
  { id: 'noon', label: 'Öğle 12-14', emoji: '☀️' },
  { id: 'evening', label: 'Akşam 18-21', emoji: '🌆' },
  { id: 'night', label: 'Gece 22-00', emoji: '🌙' },
  { id: 'all-day', label: 'Tüm gün', emoji: '⏰' },
];

const ETC_TOPIC_HOOKS: { topic: string; type: ETCType }[] = [
  { topic: 'başlangıç rehberi', type: 'evergreen' },
  { topic: 'araç karşılaştırması', type: 'evergreen' },
  { topic: 'SSS yanıtı', type: 'evergreen' },
  { topic: 'müşteri hikayesi', type: 'hybrid' },
  { topic: 'sektör güncellemesi', type: 'trending' },
  { topic: 'haftalık ipucu', type: 'evergreen' },
  { topic: 'tartışma sorusu', type: 'hybrid' },
  { topic: 'sezon kampanyası', type: 'trending' },
  { topic: 'mimari karar', type: 'evergreen' },
  { topic: 'yeni çıkan ürün', type: 'trending' },
  { topic: 'topluluk sorusu', type: 'hybrid' },
  { topic: 'arşiv taraması', type: 'evergreen' },
];

const ETC_TITLE_PREFIX = [
  'Hızlı', 'Kapsamlı', 'Sessiz', 'Gerçek', 'Sade', 'Açık', '7 Dakikada', 'Tek Sayfada', 'Sıfırdan', 'İleri',
];

const ETC_TITLE_SUFFIX = [
  'rehberi', 'listesi', 'karşılaştırması', 'örnekleri', 'şablonu', 'kontrol listesi', 'özeti', 'analizi',
];

export const buildETCDraft = (seed: number, focusTopic?: string): ETCDraft => {
  const topicChoice = focusTopic && focusTopic.trim().length > 0
    ? { topic: focusTopic.trim(), type: 'hybrid' as ETCType }
    : ETC_TOPIC_HOOKS[seed % ETC_TOPIC_HOOKS.length];
  const cadenceChoice = ETC_CADENCES[(seed + 3) % ETC_CADENCES.length];
  const peakChoice = ETC_PEAKS[(seed + 5) % ETC_PEAKS.length].id;
  const isEver = topicChoice.type === 'evergreen';
  const isTrend = topicChoice.type === 'trending';
  const shelf = isEver ? 180 + (seed % 240) : isTrend ? 3 + (seed % 8) : 21 + (seed % 30);
  const ratio = isEver
    ? { evergreen: 0.7 + ((seed % 30) / 100), trending: 0.3 - ((seed % 30) / 100) }
    : isTrend
    ? { evergreen: 0.2 + ((seed % 15) / 100), trending: 0.8 - ((seed % 15) / 100) }
    : { evergreen: 0.5, trending: 0.5 };
  const score = Math.round(
    (isEver ? 78 : isTrend ? 64 : 72) +
    ((seed % 18)) -
    (cadenceChoice.perWeek > 5 ? 8 : 0) +
    (peakChoice === 'all-day' ? 4 : 0)
  );
  const prefix = ETC_TITLE_PREFIX[(seed + 2) % ETC_TITLE_PREFIX.length];
  const suffix = ETC_TITLE_SUFFIX[(seed + 4) % ETC_TITLE_SUFFIX.length];
  const title = `${prefix} ${topicChoice.topic} ${suffix}`.replace(/\s+/g, ' ').trim();
  return {
    title,
    type: topicChoice.type,
    cadence: cadenceChoice.id,
    shelfLifeDays: shelf,
    trafficPeak: peakChoice,
    topic: topicChoice.topic,
    notes: isEver
      ? 'Yıl boyunca güncelleme ile yayında kalabilir.'
      : isTrend
      ? 'Trend süresi kısa; ilk 48 saatte yayınla.'
      : 'Evergreen omurgasına trend detayı ekle.',
    ratio: {
      evergreen: Math.max(0, Math.min(1, ratio.evergreen)),
      trending: Math.max(0, Math.min(1, ratio.trending)),
    },
    score,
  };
};

export const calcETCMix = (entries: ETCEntry[]): { evergreen: number; trending: number } => {
  if (entries.length === 0) return { evergreen: 0.5, trending: 0.5 };
  const total = entries.reduce((s, e) => s + (e.type === 'evergreen' ? 1 : e.type === 'trending' ? 0 : 0.5), 0);
  const ratio = total / entries.length;
  return { evergreen: ratio, trending: 1 - ratio };
};

export const getETCList = async (): Promise<ETCEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(ETC_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ETCEntry[];
  } catch {
    return [];
  }
};

export const saveETC = async (entry: ETCEntry): Promise<ETCEntry[]> => {
  const list = await getETCList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(ETC_KEY, JSON.stringify(next));
  return next;
};

export const removeETC = async (id: string): Promise<ETCEntry[]> => {
  const list = await getETCList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(ETC_KEY, JSON.stringify(next));
  return next;
};

export const clearETCs = async (): Promise<void> => {
  await AsyncStorage.removeItem(ETC_KEY);
};

export const suggestETCTopics = (): string[] => ETC_TOPIC_HOOKS.map(t => t.topic);

// === Round 86: CTA Phrasing Bank ===
export type CTABankPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'threads' | 'general';
export type CTABankGoal = 'comment' | 'save' | 'share' | 'click' | 'follow' | 'dm' | 'buy' | 'watch';
export type CTABankTone = 'soft' | 'neutral' | 'bold' | 'urgent' | 'playful';
export type CTABankEntry = {
  id: string;
  platform: CTABankPlatform;
  goal: CTABankGoal;
  tone: CTABankTone;
  text: string;
  emoji: string;
  ctr: number;
  createdAt: number;
};

export type CTABankSuggestion = {
  text: string;
  emoji: string;
  goal: CTABankGoal;
  tone: CTABankTone;
  reason: string;
  estCtr: number;
};

export const CTAB_KEY = '@content-coach/cta-bank';
export const CTAB_PLATFORMS: { id: CTABankPlatform; label: string; emoji: string }[] = [
  { id: 'general', label: 'Genel', emoji: '✨' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦' },
  { id: 'threads', label: 'Threads', emoji: '🧵' },
];

export const CTAB_GOALS: { id: CTABankGoal; label: string; emoji: string; desc: string }[] = [
  { id: 'comment', label: 'Yorum', emoji: '💬', desc: 'Tartışma başlat' },
  { id: 'save', label: 'Kaydet', emoji: '🔖', desc: 'İçeriği arşivle' },
  { id: 'share', label: 'Paylaş', emoji: '🔁', desc: 'Yayılma' },
  { id: 'click', label: 'Tıkla', emoji: '🔗', desc: 'Bağlantıya yönlendir' },
  { id: 'follow', label: 'Takip', emoji: '➕', desc: 'Yeni takipçi kazan' },
  { id: 'dm', label: 'DM', emoji: '📩', desc: 'Mesajlaşma' },
  { id: 'buy', label: 'Satın Al', emoji: '🛒', desc: 'Doğrudan satış' },
  { id: 'watch', label: 'İzle', emoji: '▶️', desc: 'Video tamamlama' },
];

export const CTAB_TONES: { id: CTABankTone; label: string; emoji: string }[] = [
  { id: 'soft', label: 'Yumuşak', emoji: '🤍' },
  { id: 'neutral', label: 'Nötr', emoji: '🟢' },
  { id: 'bold', label: 'Cesur', emoji: '🔥' },
  { id: 'urgent', label: 'Acil', emoji: '⏰' },
  { id: 'playful', label: 'Eğlenceli', emoji: '🎉' },
];

const CTAB_TEMPLATES: Record<CTABankGoal, Record<CTABankTone, { text: string; emoji: string; reason: string }[]>> = {
  comment: {
    soft: [
      { text: 'Senin en çok işine yarayan hangisi?', emoji: '💭', reason: 'Kişisel yorumu tetikler.' },
      { text: 'Bu konuda ne düşünüyorsun?', emoji: '🤔', reason: 'Açık uçlu, düşük efor.' },
    ],
    neutral: [
      { text: 'Yorumda görüşelim.', emoji: '💬', reason: 'Klasik ve net.' },
      { text: 'Bir yorum bırak, devamını yazayım.', emoji: '✍️', reason: 'Karşılıklı etkileşim vaadi.' },
    ],
    bold: [
      { text: 'Katılıyor musun, katılmıyor musun? Yorumda net ol.', emoji: '⚔️', reason: 'Taraf seçtirir.' },
      { text: 'Aşağıya "BEN" yaz, sana özel hazırlayayım.', emoji: '👇', reason: 'Tek kelimelik eylem.' },
    ],
    urgent: [
      { text: 'Bu soruyu cevaplamazsan içerik yarıda kalır.', emoji: '⏰', reason: 'FOMO tetikler.' },
      { text: 'İlk 30 yoruma özel liste göndereceğim.', emoji: '🎁', reason: 'Hız teşviki.' },
    ],
    playful: [
      { text: 'Tahmin et, cevap sonraki postta 👀', emoji: '🔮', reason: 'Merak bırakır.' },
      { text: 'Yorumda emoji bırak, ruh halini okuyayım.', emoji: '🎨', reason: 'Eğlenceli mikro eylem.' },
    ],
  },
  save: {
    soft: [
      { text: 'İhtiyacın olduğunda dönersin diye kaydet.', emoji: '🔖', reason: 'Fayda odaklı.' },
    ],
    neutral: [
      { text: 'Bunu kaydet, sonra lazım olacak.', emoji: '💾', reason: 'Doğrudan ve net.' },
      { text: 'Kaydet, çünkü tek seferde unutulur.', emoji: '📌', reason: 'Net değer vaadi.' },
    ],
    bold: [
      { text: 'Bunu kaydetmeyen pişman olur.', emoji: '💥', reason: 'Güçlü ifade.' },
      { text: 'Kaydet, başka yerde bulamazsın.', emoji: '🏆', reason: 'Özgünlük vurgusu.' },
    ],
    urgent: [
      { text: 'Hemen kaydet, yarın kaldırabilirim.', emoji: '⏳', reason: 'Süre kısıtı.' },
      { text: 'Ömür boyu arşivin olsun, kaydet.', emoji: '🗄️', reason: 'Kalıcılık vaadi.' },
    ],
    playful: [
      { text: 'Hazine sandığına at: kaydet 🪙', emoji: '🪙', reason: 'Oyunlaştırma.' },
      { text: 'Kaydet, sonra bana teşekkür edersin.', emoji: '😉', reason: 'İçsel espri.' },
    ],
  },
  share: {
    soft: [
      { text: 'İhtiyacı olan birine yolla.', emoji: '🤝', reason: 'Topluluk hissi.' },
    ],
    neutral: [
      { text: 'Tanıdığın birine paylaş.', emoji: '🔁', reason: 'Sade ve net.' },
    ],
    bold: [
      { text: 'Bunu görmesi gereken 3 kişiyi etiketle.', emoji: '🏷️', reason: 'Sayı + eylem.' },
      { text: 'Etiketle, yayılsın.', emoji: '🚀', reason: 'Kısa ve güçlü.' },
    ],
    urgent: [
      { text: 'Hemen birine yolla, akşam kapatıyorum.', emoji: '⏰', reason: 'Aciliyet.' },
    ],
    playful: [
      { text: 'Arkadaşına gönder, yalnız izleme 👀', emoji: '📨', reason: 'Espri + eylem.' },
    ],
  },
  click: {
    soft: [
      { text: 'Detayları bio\'daki bağlantıda.', emoji: '🔗', reason: 'Yumuşak yönlendirme.' },
    ],
    neutral: [
      { text: 'Bio\'daki linke göz at.', emoji: '👉', reason: 'Standart yönlendirme.' },
    ],
    bold: [
      { text: 'Bio\'ya git, tıkla, başla.', emoji: '🎯', reason: 'Net 3 adım.' },
      { text: 'Bağlantıyı aç, gerisini ben hallederim.', emoji: '⚡', reason: 'Güven veren.' },
    ],
    urgent: [
      { text: 'Şimdi tıkla, kontenjan sınırlı.', emoji: '🚨', reason: 'Acil + kıtlık.' },
    ],
    playful: [
      { text: 'Bio\'daki portal seni bekliyor 🌀', emoji: '🌀', reason: 'Oyunlaştırma.' },
    ],
  },
  follow: {
    soft: [
      { text: 'Benzer içerikler için takip et.', emoji: '➕', reason: 'Sade vaat.' },
    ],
    neutral: [
      { text: 'Daha fazlası için takip.', emoji: '✅', reason: 'Net ve kısa.' },
    ],
    bold: [
      { text: 'Takip et, kaçırma.', emoji: '🚨', reason: 'Güçlü uyarı.' },
      { text: 'Bu hesabı takip etmemek hata.', emoji: '❌', reason: 'Ters psikoloji.' },
    ],
    urgent: [
      { text: 'Hemen takip et, yarın adımız değişiyor.', emoji: '⏰', reason: 'Yapay aciliyet.' },
    ],
    playful: [
      { text: 'Ailemize katıl, takip et 🎈', emoji: '🎈', reason: 'Samimi ton.' },
    ],
  },
  dm: {
    soft: [
      { text: 'DM\'den "MERHABA" yaz.', emoji: '📩', reason: 'Düşük efor giriş.' },
    ],
    neutral: [
      { text: 'Detaylar için DM at.', emoji: '✉️', reason: 'Standart yön.' },
    ],
    bold: [
      { text: 'Şimdi DM at, aynı gün dönerim.', emoji: '⚡', reason: 'Hız vaadi.' },
      { text: 'DM\'e "INFO" yaz, dosya yollayayım.', emoji: '📂', reason: 'Belirli anahtar kelime.' },
    ],
    urgent: [
      { text: 'DM\'le, kontenjan bugün bitiyor.', emoji: '⏳', reason: 'Kıtlık.' },
    ],
    playful: [
      { text: 'DM\'den bir kahve ısmarla ☕', emoji: '☕', reason: 'Espri + eylem.' },
    ],
  },
  buy: {
    soft: [
      { text: 'İlgilenenler için bağlantı bio\'da.', emoji: '🔗', reason: 'Yumuşak satış.' },
    ],
    neutral: [
      { text: 'Satın almak için bio\'ya bak.', emoji: '🛍️', reason: 'Net yönlendirme.' },
    ],
    bold: [
      { text: 'Sepete ekle, pişman olmazsın.', emoji: '🛒', reason: 'Güçlü CTA.' },
      { text: 'Şimdi al, ilk 50\'ye özel.', emoji: '🏆', reason: 'Kıtlık + ödül.' },
    ],
    urgent: [
      { text: 'Bugün son, indirim sabaha kadar.', emoji: '⏰', reason: 'Süre baskısı.' },
      { text: 'Kalan 12 adet, kaçırma.', emoji: '🔥', reason: 'Stok aciliyeti.' },
    ],
    playful: [
      { text: 'Kendine hediye al, sonra bana teşekkür et 🎁', emoji: '🎁', reason: 'Pozitif çerçeve.' },
    ],
  },
  watch: {
    soft: [
      { text: 'Videoyu sonuna kadar izle.', emoji: '▶️', reason: 'Sade istek.' },
    ],
    neutral: [
      { text: 'Tamamını izle, kritik bilgi sonda.', emoji: '⏭️', reason: 'Sonuna değer vaadi.' },
    ],
    bold: [
      { text: 'İzle, kapatırsan kaybedersin.', emoji: '🚨', reason: 'Kayıp korkusu.' },
    ],
    urgent: [
      { text: 'Hemen izle, liste kısa süreli.', emoji: '⏱️', reason: 'Hız + kıtlık.' },
    ],
    playful: [
      { text: 'Sonuna kadar izle, sürpriz var 🎬', emoji: '🎬', reason: 'Merak bırakma.' },
    ],
  },
};

export const buildCTASuggestions = (
  platform: CTABankPlatform,
  goal: CTABankGoal,
  tone: CTABankTone
): CTABankSuggestion[] => {
  const pool = CTAB_TEMPLATES[goal][tone];
  const seed = platform.length * 7 + goal.length * 5 + tone.length * 3;
  const platformCtrBoost = platform === 'tiktok' ? 1.25 : platform === 'instagram' ? 1.1 : platform === 'linkedin' ? 0.85 : 1.0;
  const toneCtrBoost = tone === 'bold' ? 1.2 : tone === 'urgent' ? 1.15 : tone === 'soft' ? 0.85 : tone === 'playful' ? 1.05 : 1.0;
  return pool.map((t, i) => {
    const variance = ((seed + i * 11) % 30) / 100;
    const base = 2.4;
    const estCtr = +(base * platformCtrBoost * toneCtrBoost * (0.85 + variance)).toFixed(2);
    return {
      text: t.text,
      emoji: t.emoji,
      goal,
      tone,
      reason: t.reason,
      estCtr,
    };
  });
};

export const getCTABList = async (): Promise<CTABankEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(CTAB_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CTABankEntry[];
  } catch {
    return [];
  }
};

export const saveCTAB = async (entry: CTABankEntry): Promise<CTABankEntry[]> => {
  const list = await getCTABList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(CTAB_KEY, JSON.stringify(next));
  return next;
};

export const removeCTAB = async (id: string): Promise<CTABankEntry[]> => {
  const list = await getCTABList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(CTAB_KEY, JSON.stringify(next));
  return next;
};

export const clearCTABs = async (): Promise<void> => {
  await AsyncStorage.removeItem(CTAB_KEY);
};

// === Round 87: Hook Stopper Library ===
export type HookStopPlatform = 'reels' | 'tiktok' | 'shorts' | 'feed' | 'story' | 'podcast' | 'general';
export type HookStopFormat = 'question' | 'statement' | 'shock' | 'list' | 'story' | 'command' | 'contrast';
export type HookStopEntry = {
  id: string;
  platform: HookStopPlatform;
  format: HookStopFormat;
  text: string;
  stopPower: number;
  createdAt: number;
};

export type HookStopSuggestion = {
  text: string;
  format: HookStopFormat;
  stopPower: number;
  reason: string;
};

export const HSTOP_KEY = '@content-coach/hook-stoppers';
export const HSTOP_PLATFORMS: { id: HookStopPlatform; label: string; emoji: string; window: number }[] = [
  { id: 'reels', label: 'Reels', emoji: '🎬', window: 3 },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', window: 2 },
  { id: 'shorts', label: 'Shorts', emoji: '📱', window: 2 },
  { id: 'feed', label: 'Feed', emoji: '📸', window: 5 },
  { id: 'story', label: 'Story', emoji: '📲', window: 1 },
  { id: 'podcast', label: 'Podcast', emoji: '🎙️', window: 15 },
  { id: 'general', label: 'Genel', emoji: '✨', window: 5 },
];

export const HSTOP_FORMATS: { id: HookStopFormat; label: string; emoji: string; desc: string }[] = [
  { id: 'question', label: 'Soru', emoji: '❓', desc: 'Merak boşluğu yaratır' },
  { id: 'statement', label: 'İddia', emoji: '💬', desc: 'Net bir tez sunar' },
  { id: 'shock', label: 'Şok', emoji: '⚡', desc: 'Beklentiyi kırar' },
  { id: 'list', label: 'Liste', emoji: '🔢', desc: 'Net bir sayı vaat eder' },
  { id: 'story', label: 'Hikaye', emoji: '📖', desc: 'Kısa anekdot ile bağlar' },
  { id: 'command', label: 'Emir', emoji: '👉', desc: 'Direkt eylem ister' },
  { id: 'contrast', label: 'Kontrast', emoji: '⚖️', desc: 'İki zıtlığı kıyaslar' },
];

const HSTOP_TEMPLATES: Record<HookStopFormat, { text: string; reason: string }[]> = {
  question: [
    { text: 'Neden hâlâ para biriktiremiyorsun?', reason: 'Kişisel suçlama + merak.' },
    { text: 'Sabah 5\'te ne yapsan fark yaratır?', reason: 'Ritüel sorusu.' },
    { text: 'Bu hatayı yapmaya devam ediyor musun?', reason: 'Doğrudan hesap sorar.' },
  ],
  statement: [
    { text: 'Sabah rutinin başarısının %80\'ini belirliyor.', reason: 'Güçlü istatistik iddiası.' },
    { text: 'Çoğu içerik üreticisi 3. saniyede kaybediyor.', reason: 'Sektörel gerçeklik.' },
    { text: 'Disiplin motivasyondan daha değerli.', reason: 'Karşıt tez.' },
  ],
  shock: [
    { text: 'Telefonunu ilk 10 dakika açma, hayatın değişsin.', reason: 'Küçük eylem + büyük vaat.' },
    { text: 'Sana 24 saat vereceğim, sonucu göreceksin.', reason: 'Anlaşma formatı.' },
    { text: 'Bu yöntem 2 kat hız kazandırıyor, inanmayabilirsin.', reason: 'Şüphe + kanıt vaadi.' },
  ],
  list: [
    { text: '3 gizli sebep, izlemeye devam et.', reason: 'Sayı + komut.' },
    { text: 'İlk 5 saniyede 5 ipucu.', reason: 'Hız + net değer.' },
    { text: '5 hata, her biri yıllarca süre kaybettirir.', reason: 'Tehdit + sayı.' },
  ],
  story: [
    { text: 'Geçen ay bir müşteri 1 haftada 10K izlenme aldı.', reason: 'Sosyal kanıt.' },
    { text: 'Bir arkadaşım 30 günde 1000 abone oldu, nasıl?', reason: 'Tanıdık hikayesi.' },
    { text: '3 yıl önce 0 takipçiydim, bugün 100K.', reason: 'Dönüşüm hikayesi.' },
  ],
  command: [
    { text: 'Şu an dur, not al.', reason: 'Anında aksiyon.' },
    { text: 'Sesi kapat, sadece oku.', reason: 'Dikkat yönlendirme.' },
    { text: 'Kaydet, çünkü bir daha bulamazsın.', reason: 'Kayıp korkusu.' },
  ],
  contrast: [
    { text: 'Sabah 6 vs 10: Hangisi daha üretken?', reason: 'A/B karşılaştırması.' },
    { text: 'Çalışkan ama yoksul mu, az ama etkili mi?', reason: 'Paradoks seçim.' },
    { text: 'Dakikada içerik üretmek mi, günde 1 tane mi?', reason: 'Yayınlama ritmi karşıtlığı.' },
  ],
};

export const buildHookStoppers = (
  platform: HookStopPlatform,
  format: HookStopFormat
): HookStopSuggestion[] => {
  const pool = HSTOP_TEMPLATES[format];
  const platformWindow = HSTOP_PLATFORMS.find(p => p.id === platform)?.window ?? 5;
  const seed = platform.length * 11 + format.length * 7;
  return pool.map((t, i) => {
    const variance = ((seed + i * 13) % 25) / 100;
    const base = 60;
    const platformMult = platform === 'tiktok' || platform === 'reels' || platform === 'shorts'
      ? 1.1
      : platform === 'story' ? 0.9 : 1.0;
    const formatMult = format === 'shock' ? 1.2 : format === 'question' ? 1.1 : format === 'list' ? 1.05 : format === 'command' ? 1.0 : 0.95;
    const stopPower = Math.min(100, Math.round((base + (variance * 20)) * platformMult * formatMult));
    return {
      text: t.text,
      format,
      stopPower,
      reason: `${t.reason} (${platformWindow}s pencere)`,
    };
  });
};

export const getHStopList = async (): Promise<HookStopEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(HSTOP_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HookStopEntry[];
  } catch {
    return [];
  }
};

export const saveHStop = async (entry: HookStopEntry): Promise<HookStopEntry[]> => {
  const list = await getHStopList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(HSTOP_KEY, JSON.stringify(next));
  return next;
};

export const removeHStop = async (id: string): Promise<HookStopEntry[]> => {
  const list = await getHStopList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(HSTOP_KEY, JSON.stringify(next));
  return next;
};

export const clearHStops = async (): Promise<void> => {
  await AsyncStorage.removeItem(HSTOP_KEY);
};

// === Round 88: Posting Consistency Score ===
export type PCSPost = {
  id: string;
  date: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'threads' | 'pinterest' | 'general';
  cadence: 'daily' | '3xweek' | 'weekly' | 'biweekly';
  createdAt: number;
};

export type PCSScore = {
  totalPosts: number;
  score: number;
  streakDays: number;
  longestStreak: number;
  missedDays: number;
  cadenceFit: number;
  weeklyDistribution: number[];
  recommendation: string;
};

export const PCS_KEY = '@content-coach/posting-consistency';

export const PCS_PLATFORMS: { id: PCSPost['platform']; label: string; emoji: string }[] = [
  { id: 'general', label: 'Genel', emoji: '✨' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦' },
  { id: 'threads', label: 'Threads', emoji: '🧵' },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌' },
];

export const PCS_CADENCES: { id: PCSPost['cadence']; label: string; perWeek: number; ideal: number }[] = [
  { id: 'daily', label: 'Her gün', perWeek: 7, ideal: 7 },
  { id: '3xweek', label: 'Haftada 3', perWeek: 3, ideal: 3 },
  { id: 'weekly', label: 'Haftalık', perWeek: 1, ideal: 1 },
  { id: 'biweekly', label: '2 haftada 1', perWeek: 0.5, ideal: 0.5 },
];

const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const getTodayKey = (): string => dayKey(new Date());

export const calcPostingConsistency = (
  posts: PCSPost[],
  cadence: PCSPost['cadence'],
  windowDays: number = 30
): PCSScore => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (windowDays - 1));
  const inWindow = posts.filter(p => {
    const d = new Date(p.date + 'T00:00:00');
    return d >= start && d <= today;
  });
  const cadenceMeta = PCS_CADENCES.find(c => c.id === cadence);
  const target = (cadenceMeta?.ideal ?? 1) * (windowDays / 7);
  const totalPosts = inWindow.length;
  const cadenceFit = Math.min(100, Math.round((totalPosts / target) * 100));
  const daysWithPosts = new Set(inWindow.map(p => p.date));
  let longestStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = dayKey(d);
    if (daysWithPosts.has(k)) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  let streakDays = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (daysWithPosts.has(dayKey(d))) streakDays += 1;
    else break;
  }
  const missedDays = windowDays - daysWithPosts.size;
  const weeklyDistribution = [0, 0, 0, 0, 0, 0, 0];
  for (const p of inWindow) {
    const d = new Date(p.date + 'T00:00:00');
    const wd = (d.getDay() + 6) % 7;
    weeklyDistribution[wd] = (weeklyDistribution[wd] ?? 0) + 1;
  }
  const totalDist = weeklyDistribution.reduce((s, n) => s + n, 0) || 1;
  const meanDist = totalDist / 7;
  const variance = weeklyDistribution.reduce((s, n) => s + Math.pow(n - meanDist, 2), 0) / 7;
  const stdDev = Math.sqrt(variance);
  const evenness = Math.max(0, 100 - Math.round((stdDev / Math.max(1, meanDist)) * 30));
  const baseScore = (cadenceFit * 0.5) + (Math.min(100, longestStreak * 10) * 0.3) + (evenness * 0.2);
  const score = Math.max(0, Math.min(100, Math.round(baseScore)));
  let recommendation = '';
  if (score >= 80) recommendation = 'Mükemmel ritim! Aynı tempoda devam et.';
  else if (score >= 60) recommendation = 'İyi gidiyorsun, birkaç boş günü doldur.';
  else if (score >= 40) recommendation = 'Tutarsızlık var; belirli günlere sabitle.';
  else recommendation = 'Kritik: düşük tutarlılık. Takvimine geri dön.';
  return {
    totalPosts,
    score,
    streakDays,
    longestStreak,
    missedDays,
    cadenceFit,
    weeklyDistribution,
    recommendation,
  };
};

export const getPCSList = async (): Promise<PCSPost[]> => {
  try {
    const raw = await AsyncStorage.getItem(PCS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PCSPost[];
  } catch {
    return [];
  }
};

export const savePCS = async (entry: PCSPost): Promise<PCSPost[]> => {
  const list = await getPCSList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(PCS_KEY, JSON.stringify(next));
  return next;
};

export const removePCS = async (id: string): Promise<PCSPost[]> => {
  const list = await getPCSList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(PCS_KEY, JSON.stringify(next));
  return next;
};

export const clearPCS = async (): Promise<void> => {
  await AsyncStorage.removeItem(PCS_KEY);
};

export const todayPCSKey = (): string => getTodayKey();

// === Round 89: Reach Estimator ===
export type REPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'threads' | 'pinterest' | 'general';
export type REFormat = 'short-video' | 'long-video' | 'image' | 'carousel' | 'text' | 'story' | 'live' | 'podcast';
export type REFollower = 'nano' | 'micro' | 'mid' | 'macro' | 'mega';

export type REInput = {
  platform: REPlatform;
  format: REFormat;
  followers: number;
  followerTier: REFollower;
  hashtagCount: number;
  quality: number;
  consistencyDays: number;
  hasCollab: boolean;
  hasTrend: boolean;
};

export type REResult = {
  estimatedReach: number;
  estimatedEngagement: number;
  estimatedImpressions: number;
  cpm: number;
  viralProbability: number;
  reachMultiplier: number;
  breakdown: { label: string; value: number; color: string }[];
  rating: 'düşük' | 'orta' | 'iyi' | 'güçlü' | 'viral-potansiyel';
};

export type REEntry = {
  id: string;
  input: REInput;
  result: REResult;
  createdAt: number;
};

export const RE_KEY = '@content-coach/reach-estimator';
export const RE_PLATFORMS: { id: REPlatform; label: string; emoji: string; cpm: number; reachPct: number }[] = [
  { id: 'general', label: 'Genel', emoji: '✨', cpm: 4, reachPct: 0.2 },
  { id: 'instagram', label: 'Instagram', emoji: '📸', cpm: 5, reachPct: 0.25 },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', cpm: 3, reachPct: 0.45 },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', cpm: 8, reachPct: 0.18 },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', cpm: 9, reachPct: 0.12 },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦', cpm: 2, reachPct: 0.15 },
  { id: 'threads', label: 'Threads', emoji: '🧵', cpm: 2, reachPct: 0.18 },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌', cpm: 4, reachPct: 0.3 },
];

export const RE_FORMATS: { id: REFormat; label: string; emoji: string; mult: number }[] = [
  { id: 'short-video', label: 'Kısa Video', emoji: '🎬', mult: 1.4 },
  { id: 'long-video', label: 'Uzun Video', emoji: '📺', mult: 1.1 },
  { id: 'image', label: 'Tek Görsel', emoji: '🖼️', mult: 0.9 },
  { id: 'carousel', label: 'Carousel', emoji: '🎠', mult: 1.15 },
  { id: 'text', label: 'Metin', emoji: '📝', mult: 0.8 },
  { id: 'story', label: 'Story', emoji: '📲', mult: 0.6 },
  { id: 'live', label: 'Canlı Yayın', emoji: '🔴', mult: 1.5 },
  { id: 'podcast', label: 'Podcast', emoji: '🎙️', mult: 0.95 },
];

export const RE_TIERS: { id: REFollower; label: string; range: string; mult: number }[] = [
  { id: 'nano', label: 'Nano (1K altı)', range: '<1K', mult: 2.5 },
  { id: 'micro', label: 'Micro (1-10K)', range: '1-10K', mult: 1.8 },
  { id: 'mid', label: 'Mid (10-100K)', range: '10-100K', mult: 1.0 },
  { id: 'macro', label: 'Macro (100K-1M)', range: '100K-1M', mult: 0.45 },
  { id: 'mega', label: 'Mega (1M+)', range: '1M+', mult: 0.18 },
];

export const estimateReach = (input: REInput): REResult => {
  const platformMeta = RE_PLATFORMS.find(p => p.id === input.platform);
  const formatMeta = RE_FORMATS.find(f => f.id === input.format);
  const tierMeta = RE_TIERS.find(t => t.id === input.followerTier);
  const baseReach = input.followers * (platformMeta?.reachPct ?? 0.2);
  const formatMult = formatMeta?.mult ?? 1;
  const tierMult = tierMeta?.mult ?? 1;
  const qualityMult = 0.5 + (input.quality / 100) * 1.5;
  const consistencyMult = 0.7 + Math.min(1.5, input.consistencyDays / 30) * 0.6;
  const hashtagMult = input.hashtagCount === 0 ? 0.7 : input.hashtagCount <= 3 ? 1.0 : input.hashtagCount <= 8 ? 1.15 : 0.95;
  const collabMult = input.hasCollab ? 1.4 : 1.0;
  const trendMult = input.hasTrend ? 1.6 : 1.0;
  const totalMult = formatMult * tierMult * qualityMult * consistencyMult * hashtagMult * collabMult * trendMult;
  const estimatedReach = Math.round(baseReach * totalMult);
  const estimatedImpressions = Math.round(estimatedReach * 1.4);
  const engagementRate = input.followerTier === 'nano' ? 0.08 : input.followerTier === 'micro' ? 0.05 : input.followerTier === 'mid' ? 0.03 : input.followerTier === 'macro' ? 0.018 : 0.012;
  const engagementBoost = (input.quality / 100) * 0.5 + (input.hasTrend ? 0.3 : 0);
  const estimatedEngagement = Math.round(estimatedReach * (engagementRate + engagementBoost));
  const cpm = platformMeta?.cpm ?? 4;
  const viralProbability = Math.min(95, Math.round(
    (input.hasTrend ? 30 : 0) +
    (input.hasCollab ? 15 : 0) +
    (input.quality / 4) +
    (input.consistencyDays > 14 ? 15 : input.consistencyDays > 5 ? 8 : 0) +
    (input.followerTier === 'nano' || input.followerTier === 'micro' ? 8 : 0)
  ));
  const rating: REResult['rating'] =
    viralProbability >= 70 ? 'viral-potansiyel' :
    viralProbability >= 50 ? 'güçlü' :
    viralProbability >= 30 ? 'iyi' :
    viralProbability >= 15 ? 'orta' : 'düşük';
  const breakdown = [
    { label: 'Format', value: formatMult, color: '#6366f1' },
    { label: 'Tier', value: tierMult, color: '#10b981' },
    { label: 'Kalite', value: qualityMult, color: '#f59e0b' },
    { label: 'Tutarlılık', value: consistencyMult, color: '#8b5cf6' },
    { label: 'Hashtag', value: hashtagMult, color: '#ef4444' },
    { label: 'Collab', value: collabMult, color: '#06b6d4' },
    { label: 'Trend', value: trendMult, color: '#ec4899' },
  ];
  return {
    estimatedReach,
    estimatedEngagement,
    estimatedImpressions,
    cpm,
    viralProbability,
    reachMultiplier: +totalMult.toFixed(2),
    breakdown,
    rating,
  };
};

export const getREList = async (): Promise<REEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(RE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as REEntry[];
  } catch {
    return [];
  }
};

export const saveRE = async (entry: REEntry): Promise<REEntry[]> => {
  const list = await getREList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(RE_KEY, JSON.stringify(next));
  return next;
};

export const removeRE = async (id: string): Promise<REEntry[]> => {
  const list = await getREList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(RE_KEY, JSON.stringify(next));
  return next;
};

export const clearREs = async (): Promise<void> => {
  await AsyncStorage.removeItem(RE_KEY);
};

// === Round 90: Content Remix Switch ===
export type RemixSource = 'reel' | 'long-video' | 'podcast' | 'article' | 'thread' | 'tweet' | 'live' | 'newsletter';
export type RemixTarget = 'reel' | 'short' | 'tiktok' | 'carousel' | 'thread' | 'tweet' | 'story' | 'blog' | 'newsletter' | 'podcast-clip';
export type RemixEntry = {
  id: string;
  source: RemixSource;
  target: RemixTarget;
  title: string;
  angle: string;
  hook: string;
  outline: string[];
  estEffort: number;
  estReach: number;
  createdAt: number;
};

export type RemixPlan = {
  title: string;
  angle: string;
  hook: string;
  outline: string[];
  estEffort: number;
  estReach: number;
};

export const REMIX_KEY = '@content-coach/remix';
export const REMIX_SOURCES: { id: RemixSource; label: string; emoji: string; avgMinutes: number }[] = [
  { id: 'reel', label: 'Reel / Short', emoji: '🎬', avgMinutes: 8 },
  { id: 'long-video', label: 'Uzun Video', emoji: '📺', avgMinutes: 25 },
  { id: 'podcast', label: 'Podcast', emoji: '🎙️', avgMinutes: 35 },
  { id: 'article', label: 'Blog / Makale', emoji: '📰', avgMinutes: 12 },
  { id: 'thread', label: 'Thread', emoji: '🧵', avgMinutes: 6 },
  { id: 'tweet', label: 'Tweet', emoji: '🐦', avgMinutes: 2 },
  { id: 'live', label: 'Canlı Yayın', emoji: '🔴', avgMinutes: 30 },
  { id: 'newsletter', label: 'Newsletter', emoji: '📧', avgMinutes: 18 },
];

export const REMIX_TARGETS: { id: RemixTarget; label: string; emoji: string }[] = [
  { id: 'reel', label: 'Reel', emoji: '🎬' },
  { id: 'short', label: 'YT Short', emoji: '📱' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'carousel', label: 'Carousel', emoji: '🎠' },
  { id: 'thread', label: 'Thread', emoji: '🧵' },
  { id: 'tweet', label: 'Tweet zinciri', emoji: '🐦' },
  { id: 'story', label: 'Story serisi', emoji: '📲' },
  { id: 'blog', label: 'Blog yazısı', emoji: '📰' },
  { id: 'newsletter', label: 'Newsletter', emoji: '📧' },
  { id: 'podcast-clip', label: 'Podcast klip', emoji: '🎙️' },
];

const REMIX_ANGLES: Record<RemixSource, { angle: string; hook: string; outline: string[] }[]> = {
  reel: [
    { angle: 'Ana mesajı çıkar, yeni formatta sun', hook: 'Şunu hiç böyle düşünmemiştin:', outline: ['Hook (3s)', 'Ana fikir (1 cümle)', 'Hızlı kanıt', 'CTA'] },
    { angle: 'Karşıt tez ile aç', hook: 'Sana yalan söylediler:', outline: ['Tez', 'Neden?', 'Alternatif', 'Kapanış'] },
  ],
  'long-video': [
    { angle: 'En değerli 60 saniyeyi kes', hook: 'Bu videonun en kritik anı:', outline: ['Zaman damgası', 'Alıntı', 'Detay', 'CTA'] },
    { angle: 'Bölüm listesi olarak dağıt', hook: 'Tüm önemli anlar:', outline: ['5 başlık', 'Kısa açıklama', 'Hangi bölüm?', 'Takip çağrısı'] },
  ],
  podcast: [
    { angle: 'En viral 90 saniyelik klip', hook: 'Bölümün en çarpıcı cümlesi:', outline: ['Quote', 'Açıklama', 'Tartışma sorusu', 'Dinle çağrısı'] },
    { angle: 'Misafir tavsiyelerini çıkar', hook: 'Misafir şunu önerdi:', outline: ['Tavsiye', 'Neden işe yarar', 'Uygulama', 'Bağlantı'] },
  ],
  article: [
    { angle: '5 maddelik carousel', hook: 'Bu yazının özeti:', outline: ['Madde 1-2', 'Madde 3-4', 'Madde 5', 'Tam metin linki'] },
    { angle: 'Karşıt görüş threadi', hook: 'Yazıdaki ana tez:', outline: ['Tez', 'Karşıt görüş', 'Kanıt', 'Sonuç'] },
  ],
  thread: [
    { angle: 'Her bir tweet\'i ayrı post yap', hook: 'Thread\'in 1. tweeti:', outline: ['Tweet 1', 'Tweet 2', 'Tweet 3', 'Tamamı bağlantıda'] },
    { angle: 'En güçlü alıntıyı quote tweet yap', hook: 'En sevdiğim kısım:', outline: ['Alıntı', 'Yorum', 'Tartışma', 'Yanıt bekle'] },
  ],
  tweet: [
    { angle: 'Aynı fikri 5 farklı açıdan yaz', hook: 'Aynı fikir, 5 form:', outline: ['Versiyon 1', 'Versiyon 2', 'Versiyon 3', 'Versiyon 4', 'Versiyon 5'] },
  ],
  live: [
    { angle: 'Vurguları 60 saniyelik klip yap', hook: 'Yayının bu kısmı herkes konuşuyor:', outline: ['Klip', 'Altyazı', 'Yorum', 'Bağlantı'] },
  ],
  newsletter: [
    { angle: 'En çok tıklanan bölümü blog yap', hook: 'Newsletter\'dan en sevdiğim bölüm:', outline: ['Giriş', 'Ana fikir', 'Örnek', 'Sonuç'] },
  ],
};

const REMIX_TARGET_EFFORT: Record<RemixTarget, number> = {
  reel: 25,
  short: 20,
  tiktok: 20,
  carousel: 30,
  thread: 15,
  tweet: 5,
  story: 10,
  blog: 45,
  newsletter: 35,
  'podcast-clip': 15,
};

const REMIX_TARGET_REACH_MULT: Record<RemixTarget, number> = {
  reel: 1.3,
  short: 1.2,
  tiktok: 1.5,
  carousel: 1.0,
  thread: 0.9,
  tweet: 0.7,
  story: 0.5,
  blog: 0.85,
  newsletter: 0.6,
  'podcast-clip': 1.1,
};

export const buildRemixPlan = (source: RemixSource, target: RemixTarget, customTitle?: string): RemixPlan => {
  const pool = REMIX_ANGLES[source];
  const seed = source.length * 13 + target.length * 11;
  const idx = seed % pool.length;
  const choice = pool[idx];
  const title = customTitle && customTitle.trim().length > 0 ? customTitle.trim() : `${choice.angle} (${target})`;
  const estEffort = REMIX_TARGET_EFFORT[target];
  const estReach = Math.round(1000 * REMIX_TARGET_REACH_MULT[target] * (source === 'long-video' ? 1.2 : source === 'podcast' ? 1.1 : 0.9));
  return {
    title,
    angle: choice.angle,
    hook: choice.hook,
    outline: choice.outline,
    estEffort,
    estReach,
  };
};

export const getRemixList = async (): Promise<RemixEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(REMIX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RemixEntry[];
  } catch {
    return [];
  }
};

export const saveRemix = async (entry: RemixEntry): Promise<RemixEntry[]> => {
  const list = await getRemixList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(REMIX_KEY, JSON.stringify(next));
  return next;
};

export const removeRemix = async (id: string): Promise<RemixEntry[]> => {
  const list = await getRemixList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(REMIX_KEY, JSON.stringify(next));
  return next;
};

export const clearRemixes = async (): Promise<void> => {
  await AsyncStorage.removeItem(REMIX_KEY);
};

// === Round 91: Content Pillar Strength Meter ===
export type PMPillar = 'education' | 'story' | 'sales' | 'inspiration' | 'behind' | 'community' | 'entertainment' | 'news';
export type PMEntry = {
  id: string;
  pillar: PMPillar;
  count: number;
  reach: number;
  engagement: number;
  createdAt: number;
};

export type PMPillarStats = {
  pillar: PMPillar;
  count: number;
  reach: number;
  engagement: number;
  strength: number;
  balance: number;
  recommendation: string;
};

export type PMReport = {
  pillars: PMPillarStats[];
  total: number;
  balance: number;
  dominantPillar: PMPillar | null;
  weakestPillar: PMPillar | null;
  diversity: number;
  recommendation: string;
};

export const PM_KEY = '@content-coach/pillar-meter';
export const PM_PILLARS: { id: PMPillar; label: string; emoji: string; weight: number }[] = [
  { id: 'education', label: 'Eğitim', emoji: '📚', weight: 1.2 },
  { id: 'story', label: 'Hikaye', emoji: '📖', weight: 1.0 },
  { id: 'sales', label: 'Satış', emoji: '🛒', weight: 0.8 },
  { id: 'inspiration', label: 'İlham', emoji: '✨', weight: 0.9 },
  { id: 'behind', label: 'Sahne Arkası', emoji: '🎬', weight: 0.95 },
  { id: 'community', label: 'Topluluk', emoji: '🤝', weight: 1.0 },
  { id: 'entertainment', label: 'Eğlence', emoji: '🎉', weight: 0.85 },
  { id: 'news', label: 'Haber', emoji: '📰', weight: 0.7 },
];

export const calcPillarReport = (entries: PMEntry[]): PMReport => {
  const map: Record<string, PMEntry> = {};
  for (const p of PM_PILLARS) {
    map[p.id] = {
      id: p.id,
      pillar: p.id,
      count: 0,
      reach: 0,
      engagement: 0,
      createdAt: Date.now(),
    };
  }
  for (const e of entries) {
    const cur = map[e.pillar];
    if (cur) {
      cur.count += e.count;
      cur.reach += e.reach;
      cur.engagement += e.engagement;
    }
  }
  const total = entries.reduce((s, e) => s + e.count, 0);
  const totalReach = entries.reduce((s, e) => s + e.reach, 0);
  const totalEng = entries.reduce((s, e) => s + e.engagement, 0);
  const pillars: PMPillarStats[] = PM_PILLARS.map(p => {
    const e = map[p.id];
    const strength = Math.min(100, Math.round((e.count / Math.max(1, total)) * 100 * p.weight + (e.engagement / Math.max(1, totalEng)) * 30));
    const balance = total > 0 ? Math.round((e.count / total) * 100) : 0;
    let recommendation = 'Dengeli katkı sağlıyor.';
    if (balance < 5 && total > 0) recommendation = 'Çok az pay, artır.';
    else if (balance > 40) recommendation = 'Dominant oluyor, çeşitlendir.';
    else if (balance > 25) recommendation = 'Güçlü sütun, koru.';
    return {
      pillar: p.id,
      count: e.count,
      reach: e.reach,
      engagement: e.engagement,
      strength,
      balance,
      recommendation,
    };
  });
  const dominant = pillars.reduce<PMPillarStats | null>((dom, p) => (p.count > 0 && (!dom || p.count > dom.count) ? p : dom), null);
  const nonZero = pillars.filter(p => p.count > 0);
  const weakest = nonZero.length > 0 ? nonZero.reduce<PMPillarStats>((wk, p) => (p.count < wk.count ? p : wk), nonZero[0]) : null;
  const diversity = total > 0 ? Math.round((nonZero.length / PM_PILLARS.length) * 100) : 0;
  let report = '';
  if (total === 0) report = 'Henüz veri yok, içerik girmeye başla.';
  else if (diversity < 30) report = 'Düşük çeşitlilik, yeni sütunlar dene.';
  else if (diversity < 60) report = 'Orta çeşitlilik, 2-3 sütun daha ekleyebilirsin.';
  else if (diversity < 80) report = 'İyi çeşitlilik, dengeyi koru.';
  else report = 'Mükemmel çeşitlilik! Çok yönlü içerik üretiyorsun.';
  return {
    pillars,
    total,
    balance: total > 0 ? 100 - Math.round(Math.max(...pillars.map(p => p.balance)) - Math.min(...pillars.map(p => p.balance))) : 0,
    dominantPillar: dominant?.pillar ?? null,
    weakestPillar: weakest?.pillar ?? null,
    diversity,
    recommendation: report,
  };
};

export const getPMList = async (): Promise<PMEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(PM_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PMEntry[];
  } catch {
    return [];
  }
};

export const savePM = async (entry: PMEntry): Promise<PMEntry[]> => {
  const list = await getPMList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(PM_KEY, JSON.stringify(next));
  return next;
};

export const removePM = async (id: string): Promise<PMEntry[]> => {
  const list = await getPMList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(PM_KEY, JSON.stringify(next));
  return next;
};

export const clearPMs = async (): Promise<void> => {
  await AsyncStorage.removeItem(PM_KEY);
};

// === Round 92: Content Slot Optimizer ===
export type CSOPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'threads' | 'pinterest' | 'general';
export type CSOSlot = 'early-morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'late-night';
export type CSOEntry = {
  id: string;
  platform: CSOPlatform;
  slot: CSOSlot;
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  pillar: string;
  format: string;
  expectedReach: number;
  createdAt: number;
};

export type CSOWeek = {
  mon: CSOSlot[];
  tue: CSOSlot[];
  wed: CSOSlot[];
  thu: CSOSlot[];
  fri: CSOSlot[];
  sat: CSOSlot[];
  sun: CSOSlot[];
};

export type CSOPlan = {
  week: CSOWeek;
  totalSlots: number;
  totalReach: number;
  coverage: number;
  busyDays: number;
  freeDays: number;
  bestSlot: { day: string; slot: CSOSlot; reach: number } | null;
  recommendation: string;
};

export const CSO_KEY = '@content-coach/slot-optimizer';
export const CSO_PLATFORMS: { id: CSOPlatform; label: string; emoji: string }[] = [
  { id: 'general', label: 'Genel', emoji: '✨' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦' },
  { id: 'threads', label: 'Threads', emoji: '🧵' },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌' },
];

export const CSO_SLOTS: { id: CSOSlot; label: string; emoji: string; reach: number }[] = [
  { id: 'early-morning', label: 'Sabah erken 06-08', emoji: '🌅', reach: 700 },
  { id: 'morning', label: 'Sabah 08-11', emoji: '☀️', reach: 1100 },
  { id: 'midday', label: 'Öğle 12-14', emoji: '🍽️', reach: 1300 },
  { id: 'afternoon', label: 'Öğleden sonra 14-17', emoji: '🌤', reach: 900 },
  { id: 'evening', label: 'Akşam 18-21', emoji: '🌆', reach: 1500 },
  { id: 'night', label: 'Gece 21-23', emoji: '🌙', reach: 1000 },
  { id: 'late-night', label: 'Gece geç 23+', emoji: '🛌', reach: 500 },
];

export const CSO_DAYS: { id: CSOEntry['day']; label: string; emoji: string; reachMult: number }[] = [
  { id: 'mon', label: 'Pzt', emoji: '📅', reachMult: 1.0 },
  { id: 'tue', label: 'Sal', emoji: '📅', reachMult: 1.05 },
  { id: 'wed', label: 'Çar', emoji: '📅', reachMult: 1.1 },
  { id: 'thu', label: 'Per', emoji: '📅', reachMult: 1.15 },
  { id: 'fri', label: 'Cum', emoji: '📅', reachMult: 1.2 },
  { id: 'sat', label: 'Cmt', emoji: '🎉', reachMult: 1.25 },
  { id: 'sun', label: 'Paz', emoji: '🌞', reachMult: 0.9 },
];

const CSO_PLATFORM_MULT: Record<CSOPlatform, number> = {
  general: 1.0,
  instagram: 1.05,
  tiktok: 1.4,
  youtube: 1.1,
  linkedin: 0.95,
  twitter: 1.0,
  threads: 1.0,
  pinterest: 0.9,
};

export const buildCSOPlan = (
  entries: CSOEntry[],
  targetPerWeek: number = 5
): CSOPlan => {
  const week: CSOWeek = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  const reachByDaySlot: Record<string, number> = {};
  for (const e of entries) {
    if (week[e.day].length < 3 && !week[e.day].includes(e.slot)) {
      week[e.day].push(e.slot);
      const dayMult = CSO_DAYS.find(d => d.id === e.day)?.reachMult ?? 1;
      const slotBase = CSO_SLOTS.find(s => s.id === e.slot)?.reach ?? 800;
      const platMult = CSO_PLATFORM_MULT[e.platform];
      reachByDaySlot[`${e.day}-${e.slot}`] = Math.round(slotBase * dayMult * platMult);
    }
  }
  let totalSlots = 0;
  let totalReach = 0;
  for (const day of CSO_DAYS) {
    for (const slot of week[day.id]) {
      totalSlots += 1;
      totalReach += reachByDaySlot[`${day.id}-${slot}`] ?? 0;
    }
  }
  const coverage = Math.min(100, Math.round((totalSlots / targetPerWeek) * 100));
  const busyDays = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).filter(d => week[d].length > 0).length;
  const freeDays = 7 - busyDays;
  let bestSlot: CSOPlan['bestSlot'] = null;
  for (const [k, v] of Object.entries(reachByDaySlot)) {
    const [d, s] = k.split('-');
    if (!bestSlot || v > bestSlot.reach) {
      bestSlot = { day: d, slot: s as CSOSlot, reach: v };
    }
  }
  let recommendation = '';
  if (totalSlots === 0) recommendation = 'Henüz slot yok, içerik planlamaya başla.';
  else if (coverage < 60) recommendation = 'Yetersiz plan, haftalık hedefe ulaşmak için slot ekle.';
  else if (coverage > 130) recommendation = 'Aşırı yüklendi, tükenmişliği önlemek için azalt.';
  else if (freeDays >= 4) recommendation = 'Çok boş gün var, kısa içeriklerle doldur.';
  else recommendation = 'Dengeli plan! Hafta boyunca ritim korunuyor.';
  return { week, totalSlots, totalReach, coverage, busyDays, freeDays, bestSlot, recommendation };
};

export const getCSOList = async (): Promise<CSOEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(CSO_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CSOEntry[];
  } catch {
    return [];
  }
};

export const saveCSO = async (entry: CSOEntry): Promise<CSOEntry[]> => {
  const list = await getCSOList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(CSO_KEY, JSON.stringify(next));
  return next;
};

export const removeCSO = async (id: string): Promise<CSOEntry[]> => {
  const list = await getCSOList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(CSO_KEY, JSON.stringify(next));
  return next;
};

export const clearCSOs = async (): Promise<void> => {
  await AsyncStorage.removeItem(CSO_KEY);
};

// === Round 93: Engagement Decay Analyzer ===
export type EDPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'threads' | 'general';
export type EDEntry = {
  id: string;
  platform: EDPlatform;
  day0: number;
  day1: number;
  day3: number;
  day7: number;
  day14: number;
  day30: number;
  contentType: 'reel' | 'tiktok' | 'short' | 'post' | 'thread' | 'video' | 'story';
  createdAt: number;
};

export type EDCurve = {
  platform: EDPlatform;
  contentType: EDEntry['contentType'];
  halfLifeDays: number;
  retention: { d: number; v: number }[];
  decay: 'hızlı' | 'normal' | 'yavaş' | 'kalıcı';
  recommendation: string;
};

export const ED_KEY = '@content-coach/engagement-decay';
export const ED_PLATFORMS: { id: EDPlatform; label: string; emoji: string; baseDecay: number }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📸', baseDecay: 0.85 },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', baseDecay: 0.6 },
  { id: 'youtube', label: 'YouTube', emoji: '▶️', baseDecay: 0.92 },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', baseDecay: 0.88 },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦', baseDecay: 0.7 },
  { id: 'threads', label: 'Threads', emoji: '🧵', baseDecay: 0.75 },
  { id: 'general', label: 'Genel', emoji: '✨', baseDecay: 0.8 },
];

export const ED_CONTENT_TYPES: { id: EDEntry['contentType']; label: string; emoji: string }[] = [
  { id: 'reel', label: 'Reel', emoji: '🎬' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'short', label: 'YT Short', emoji: '📱' },
  { id: 'post', label: 'Post', emoji: '📸' },
  { id: 'thread', label: 'Thread', emoji: '🧵' },
  { id: 'video', label: 'Video', emoji: '📺' },
  { id: 'story', label: 'Story', emoji: '📲' },
];

export const analyzeDecay = (entry: EDEntry): EDCurve => {
  const plat = ED_PLATFORMS.find(p => p.id === entry.platform);
  const base = plat?.baseDecay ?? 0.8;
  const points = [
    { d: 0, v: entry.day0 },
    { d: 1, v: entry.day1 },
    { d: 3, v: entry.day3 },
    { d: 7, v: entry.day7 },
    { d: 14, v: entry.day14 },
    { d: 30, v: entry.day30 },
  ];
  let halfLife = 30;
  for (let i = 0; i < points.length; i++) {
    if (points[i].v <= entry.day0 * 0.5) {
      const prev = i > 0 ? points[i - 1] : points[i];
      const ratio = prev.v > 0 ? (prev.v - entry.day0 * 0.5) / Math.max(1, prev.v - points[i].v) : 0;
      halfLife = +(prev.d + ratio * (points[i].d - prev.d)).toFixed(1);
      break;
    }
  }
  const adjusted = base > 0.85 ? halfLife * 1.2 : base < 0.7 ? halfLife * 0.7 : halfLife;
  let decayLabel: EDCurve['decay'] = 'normal';
  if (adjusted <= 1) decayLabel = 'hızlı';
  else if (adjusted >= 7) decayLabel = 'kalıcı';
  else if (adjusted >= 4) decayLabel = 'yavaş';
  let recommendation = '';
  if (decayLabel === 'hızlı') recommendation = 'Hızlı tüketiliyor; 24 saat içinde yeniden paylaş.';
  else if (decayLabel === 'normal') recommendation = 'Normal akış, 3-5 gün aralıklarla tekrar.';
  else if (decayLabel === 'yavaş') recommendation = 'Kalıcı içerik, daha uzun aralıklarla güncelle.';
  else recommendation = 'Evergreen adayı, haftalarca yayında kalabilir.';
  return {
    platform: entry.platform,
    contentType: entry.contentType,
    halfLifeDays: +adjusted.toFixed(1),
    retention: points,
    decay: decayLabel,
    recommendation,
  };
};

export const getEDList = async (): Promise<EDEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(ED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EDEntry[];
  } catch {
    return [];
  }
};

export const saveED = async (entry: EDEntry): Promise<EDEntry[]> => {
  const list = await getEDList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(ED_KEY, JSON.stringify(next));
  return next;
};

export const removeED = async (id: string): Promise<EDEntry[]> => {
  const list = await getEDList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(ED_KEY, JSON.stringify(next));
  return next;
};

export const clearEDs = async (): Promise<void> => {
  await AsyncStorage.removeItem(ED_KEY);
};

// === Round 94: Title Strength Scorer ===
export type TSPlatform = 'youtube' | 'blog' | 'medium' | 'newsletter' | 'podcast' | 'threads' | 'general';
export type TSGoal = 'ctr' | 'seo' | 'share' | 'curiosity' | 'emotion';
export type TSCheck = {
  id: string;
  rule: string;
  pass: boolean;
  weight: number;
  note: string;
};

export type TSResult = {
  score: number;
  rating: 'zayıf' | 'orta' | 'iyi' | 'güçlü' | 'mükemmel';
  checks: TSCheck[];
  suggestions: string[];
  wordCount: number;
  charCount: number;
  hasNumber: boolean;
  hasEmoji: boolean;
  hasQuestion: boolean;
};

export type TSEntry = {
  id: string;
  title: string;
  platform: TSPlatform;
  goal: TSGoal;
  result: TSResult;
  createdAt: number;
};

export const TS_KEY = '@content-coach/title-scorer';
export const TS_PLATFORMS: { id: TSPlatform; label: string; emoji: string; ideal: number; max: number }[] = [
  { id: 'youtube', label: 'YouTube', emoji: '▶️', ideal: 60, max: 100 },
  { id: 'blog', label: 'Blog', emoji: '📰', ideal: 55, max: 70 },
  { id: 'medium', label: 'Medium', emoji: '✍️', ideal: 50, max: 70 },
  { id: 'newsletter', label: 'Newsletter', emoji: '📧', ideal: 45, max: 70 },
  { id: 'podcast', label: 'Podcast', emoji: '🎙️', ideal: 50, max: 80 },
  { id: 'threads', label: 'Threads', emoji: '🧵', ideal: 40, max: 100 },
  { id: 'general', label: 'Genel', emoji: '✨', ideal: 50, max: 80 },
];

export const TS_GOALS: { id: TSGoal; label: string; emoji: string; desc: string }[] = [
  { id: 'ctr', label: 'CTR', emoji: '👆', desc: 'Tıklama oranı maksimize' },
  { id: 'seo', label: 'SEO', emoji: '🔎', desc: 'Arama motoru uyumu' },
  { id: 'share', label: 'Paylaşım', emoji: '🔁', desc: 'Yayılma potansiyeli' },
  { id: 'curiosity', label: 'Merak', emoji: '🧐', desc: 'Merak boşluğu' },
  { id: 'emotion', label: 'Duygu', emoji: '❤️', desc: 'Duygusal tepki' },
];

const POWER_WORDS = [
  'ücretsiz', 'hızlı', 'sırlar', 'gizli', 'en iyi', 'garantili', 'anında', 'şimdi',
  'yeni', 'kolay', 'basit', 'inandırıcı', 'şaşırtıcı', 'inanılmaz', 'güçlü', 'dahi',
  'gerçek', 'son', 'asla', 'her zaman', 'sadece', 'tüm',
];

export const scoreTitle = (title: string, platform: TSPlatform, goal: TSGoal): TSResult => {
  const t = title.trim();
  const words = t.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const charCount = t.length;
  const pMeta = TS_PLATFORMS.find(p => p.id === platform);
  const ideal = pMeta?.ideal ?? 50;
  const max = pMeta?.max ?? 80;
  const hasNumber = /\d/.test(t);
  const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t);
  const hasQuestion = /[?]/.test(t);
  const hasExclamation = /[!]/.test(t);
  const hasColon = /[:]/.test(t);
  const lowerTitle = t.toLowerCase();
  const hasPower = POWER_WORDS.some(w => lowerTitle.includes(w));
  const hasAllCaps = /[A-ZÇĞİÖŞÜ]{4,}/.test(t);
  const checks: TSCheck[] = [
    {
      id: 'length',
      rule: 'Karakter uzunluğu uygun',
      pass: charCount >= ideal && charCount <= max,
      weight: 15,
      note: `${charCount} karakter · hedef ${ideal}-${max}`,
    },
    {
      id: 'number',
      rule: 'Sayı içeriyor',
      pass: hasNumber,
      weight: 12,
      note: hasNumber ? 'Somut vaad.' : 'Sayı ekle (ör. "5 yöntem").',
    },
    {
      id: 'power',
      rule: 'Güçlü kelime var',
      pass: hasPower,
      weight: 10,
      note: hasPower ? 'Etkili ifade.' : 'Güçlü kelime ekle ("ücretsiz", "hızlı"...).',
    },
    {
      id: 'question',
      rule: goal === 'curiosity' ? 'Soru içeriyor' : 'Soru veya hook',
      pass: hasQuestion || hasExclamation,
      weight: goal === 'curiosity' ? 15 : 8,
      note: hasQuestion ? 'Soru merak yaratıyor.' : hasExclamation ? 'Vurgu iyi.' : 'Soru veya "!" ekle.',
    },
    {
      id: 'colon',
      rule: 'Çift nokta veya pipeline',
      pass: hasColon || /[|]/.test(t),
      weight: 8,
      note: hasColon ? 'Çift nokta taranabilirliği artırır.' : 'Çift nokta ekle (X: Y formatı).',
    },
    {
      id: 'caps',
      rule: 'Tüm caps kötü kullanılmamış',
      pass: !hasAllCaps,
      weight: 5,
      note: hasAllCaps ? 'Aşırı büyük harf spam riski.' : 'Ton doğal.',
    },
    {
      id: 'wordCount',
      rule: 'Kelime sayısı ideal',
      pass: wordCount >= 4 && wordCount <= 14,
      weight: 10,
      note: `${wordCount} kelime · 4-14 hedef`,
    },
  ];
  if (goal === 'emotion') {
    checks.push({
      id: 'emotion',
      rule: 'Duygu / his içeriyor',
      pass: /(!|\?|❤️|💔|🥺|😢|😍|🥰|😡|💪|🔥)/.test(t),
      weight: 12,
      note: 'Duygusal tetikleyici ekle.',
    });
  }
  if (goal === 'seo') {
    checks.push({
      id: 'keyword',
      rule: 'Anahtar kelime başta',
      pass: wordCount > 0 && t[0] === t[0].toLowerCase() && !hasAllCaps,
      weight: 10,
      note: 'Ana anahtar kelimeyi başa al.',
    });
  }
  const maxScore = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter(c => c.pass).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((earned / maxScore) * 100);
  const rating: TSResult['rating'] = score >= 90 ? 'mükemmel' : score >= 75 ? 'güçlü' : score >= 55 ? 'iyi' : score >= 35 ? 'orta' : 'zayıf';
  const suggestions: string[] = [];
  for (const c of checks) {
    if (!c.pass) suggestions.push(c.note);
  }
  if (hasEmoji) suggestions.push('Emoji var; platforma göre test et, aşırıya kaçma.');
  return { score, rating, checks, suggestions, wordCount, charCount, hasNumber, hasEmoji, hasQuestion };
};

export const getTSList = async (): Promise<TSEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(TS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TSEntry[];
  } catch {
    return [];
  }
};

export const saveTS = async (entry: TSEntry): Promise<TSEntry[]> => {
  const list = await getTSList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(TS_KEY, JSON.stringify(next));
  return next;
};

export const removeTS = async (id: string): Promise<TSEntry[]> => {
  const list = await getTSList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(TS_KEY, JSON.stringify(next));
  return next;
};

export const clearTSs = async (): Promise<void> => {
  await AsyncStorage.removeItem(TS_KEY);
};

// === Round 95: Content Velocity Tracker ===
export type CVTPost = {
  id: string;
  date: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'threads' | 'pinterest' | 'general';
  type: 'reel' | 'post' | 'story' | 'tiktok' | 'short' | 'thread' | 'video' | 'podcast' | 'live';
  effortMinutes: number;
  reach: number;
  createdAt: number;
};

export type CVTWeek = {
  weekStart: string;
  posts: number;
  totalMinutes: number;
  totalReach: number;
  velocity: number;
  efficiency: number;
};

export type CVTReport = {
  weeks: CVTWeek[];
  totalPosts: number;
  totalMinutes: number;
  totalReach: number;
  avgVelocity: number;
  avgEfficiency: number;
  bestWeek: CVTWeek | null;
  worstWeek: CVTWeek | null;
  trend: 'artan' | 'sabit' | 'azalan';
  recommendation: string;
};

export const CVT_KEY = '@content-coach/velocity-tracker';
export const CVT_PLATFORMS: { id: CVTPost['platform']; label: string; emoji: string }[] = [
  { id: 'general', label: 'Genel', emoji: '✨' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦' },
  { id: 'threads', label: 'Threads', emoji: '🧵' },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌' },
];

export const CVT_TYPES: { id: CVTPost['type']; label: string; emoji: string; effort: number }[] = [
  { id: 'reel', label: 'Reel', emoji: '🎬', effort: 60 },
  { id: 'post', label: 'Post', emoji: '📸', effort: 25 },
  { id: 'story', label: 'Story', emoji: '📲', effort: 10 },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', effort: 50 },
  { id: 'short', label: 'YT Short', emoji: '📱', effort: 45 },
  { id: 'thread', label: 'Thread', emoji: '🧵', effort: 30 },
  { id: 'video', label: 'Video', emoji: '📺', effort: 120 },
  { id: 'podcast', label: 'Podcast', emoji: '🎙️', effort: 180 },
  { id: 'live', label: 'Canlı', emoji: '🔴', effort: 60 },
];

const weekKey = (d: Date): string => {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const calcVelocity = (posts: CVTPost[]): CVTReport => {
  const weekMap: Record<string, CVTWeek> = {};
  for (const p of posts) {
    const d = new Date(p.date + 'T00:00:00');
    const wk = weekKey(d);
    if (!weekMap[wk]) {
      weekMap[wk] = { weekStart: wk, posts: 0, totalMinutes: 0, totalReach: 0, velocity: 0, efficiency: 0 };
    }
    weekMap[wk].posts += 1;
    weekMap[wk].totalMinutes += p.effortMinutes;
    weekMap[wk].totalReach += p.reach;
  }
  const weeks = Object.values(weekMap).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  for (const w of weeks) {
    w.velocity = +(w.posts / 7).toFixed(2);
    w.efficiency = w.totalMinutes > 0 ? Math.round(w.totalReach / w.totalMinutes) : 0;
  }
  const totalPosts = posts.length;
  const totalMinutes = posts.reduce((s, p) => s + p.effortMinutes, 0);
  const totalReach = posts.reduce((s, p) => s + p.reach, 0);
  const avgVelocity = weeks.length > 0 ? +(weeks.reduce((s, w) => s + w.velocity, 0) / weeks.length).toFixed(2) : 0;
  const avgEfficiency = totalMinutes > 0 ? Math.round(totalReach / totalMinutes) : 0;
  const bestWeek = weeks.length > 0 ? weeks.reduce<CVTWeek>((best, w) => (w.efficiency > best.efficiency ? w : best), weeks[0]) : null;
  const worstWeek = weeks.length > 0 ? weeks.reduce<CVTWeek>((worst, w) => (w.efficiency < worst.efficiency ? w : worst), weeks[0]) : null;
  let trend: CVTReport['trend'] = 'sabit';
  if (weeks.length >= 2) {
    const last = weeks[weeks.length - 1];
    const prev = weeks[weeks.length - 2];
    if (last.velocity > prev.velocity * 1.1) trend = 'artan';
    else if (last.velocity < prev.velocity * 0.9) trend = 'azalan';
  }
  let recommendation = '';
  if (totalPosts === 0) recommendation = 'Henüz veri yok, içerik girmeye başla.';
  else if (trend === 'artan') recommendation = 'Hızlanıyorsun, kaliteyi koru, tükenme.';
  else if (trend === 'azalan') recommendation = 'Yavaşlıyorsun, sebebi ne? Engelleri kaldır.';
  else if (avgVelocity < 0.3) recommendation = 'Çok düşük hız, batch günleri ekle.';
  else if (avgVelocity > 1.5) recommendation = 'Yüksek hız, sürdürülebilirliği test et.';
  else recommendation = 'Stabil hızda gidiyorsun, aynı tempoda devam.';
  return { weeks, totalPosts, totalMinutes, totalReach, avgVelocity, avgEfficiency, bestWeek, worstWeek, trend, recommendation };
};

export const getCVTList = async (): Promise<CVTPost[]> => {
  try {
    const raw = await AsyncStorage.getItem(CVT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CVTPost[];
  } catch {
    return [];
  }
};

export const saveCVT = async (entry: CVTPost): Promise<CVTPost[]> => {
  const list = await getCVTList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(CVT_KEY, JSON.stringify(next));
  return next;
};

export const removeCVT = async (id: string): Promise<CVTPost[]> => {
  const list = await getCVTList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(CVT_KEY, JSON.stringify(next));
  return next;
};

export const clearCVTs = async (): Promise<void> => {
  await AsyncStorage.removeItem(CVT_KEY);
};

// === Round 96: Niche Trend Pulse ===
export type NTPStage = 'seed' | 'rising' | 'peak' | 'declining' | 'evergreen';
export type NTPPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'general';
export type NTPSignal = {
  id: string;
  topic: string;
  niche: string;
  platform: NTPPlatform;
  stage: NTPStage;
  velocity: number;
  lifespanDays: number;
  audience: 'gen-z' | 'millennial' | 'gen-x' | 'boomer' | 'mixed';
  notes: string;
  createdAt: number;
};

export type NTPPulse = {
  topic: string;
  stage: NTPStage;
  stageLabel: string;
  stageColor: string;
  recommendation: string;
  windowStart: number;
  windowEnd: number;
  estPeak: number;
};

export const NTP_KEY = '@content-coach/niche-pulse';
export const NTP_STAGES: { id: NTPStage; label: string; emoji: string; color: string; desc: string }[] = [
  { id: 'seed', label: 'Tohum', emoji: '🌱', color: '#94a3b8', desc: 'Yeni doğan, fırsat penceresi' },
  { id: 'rising', label: 'Yükselişte', emoji: '📈', color: '#10b981', desc: 'Büyüme momentumu' },
  { id: 'peak', label: 'Pik', emoji: '🔥', color: '#ef4444', desc: 'Maksimum ilgi, doyum riski' },
  { id: 'declining', label: 'Düşüşte', emoji: '📉', color: '#f59e0b', desc: 'Trend azalıyor' },
  { id: 'evergreen', label: 'Evergreen', emoji: '🌲', color: '#6366f1', desc: 'Kalıcı konu' },
];

export const NTP_NICHES: { id: string; label: string; emoji: string }[] = [
  { id: 'tech', label: 'Teknoloji', emoji: '💻' },
  { id: 'business', label: 'İş Dünyası', emoji: '💼' },
  { id: 'lifestyle', label: 'Yaşam Tarzı', emoji: '🌿' },
  { id: 'fitness', label: 'Fitness', emoji: '💪' },
  { id: 'food', label: 'Yemek', emoji: '🍽️' },
  { id: 'travel', label: 'Seyahat', emoji: '✈️' },
  { id: 'finance', label: 'Finans', emoji: '💰' },
  { id: 'education', label: 'Eğitim', emoji: '📚' },
  { id: 'art', label: 'Sanat', emoji: '🎨' },
  { id: 'gaming', label: 'Oyun', emoji: '🎮' },
  { id: 'beauty', label: 'Güzellik', emoji: '💄' },
  { id: 'parenting', label: 'Ebeveynlik', emoji: '👶' },
];

export const NTP_AUDIENCES: { id: NTPSignal['audience']; label: string; emoji: string }[] = [
  { id: 'gen-z', label: 'Gen Z', emoji: '🧑‍🎤' },
  { id: 'millennial', label: 'Millennial', emoji: '🧑' },
  { id: 'gen-x', label: 'Gen X', emoji: '👨' },
  { id: 'boomer', label: 'Boomer', emoji: '👴' },
  { id: 'mixed', label: 'Karma', emoji: '🌐' },
];

const STAGE_VELOCITY: Record<NTPStage, number> = {
  seed: 5,
  rising: 35,
  peak: 90,
  declining: 60,
  evergreen: 20,
};

const STAGE_LIFESPAN: Record<NTPStage, number> = {
  seed: 30,
  rising: 21,
  peak: 7,
  declining: 30,
  evergreen: 365,
};

export const calcPulse = (signal: NTPSignal): NTPPulse => {
  const stageMeta = NTP_STAGES.find(s => s.id === signal.stage);
  const velocity = STAGE_VELOCITY[signal.stage] + (signal.velocity ?? 0);
  const lifespan = STAGE_LIFESPAN[signal.stage] + (signal.lifespanDays ?? 0);
  let recommendation = '';
  if (signal.stage === 'seed') recommendation = 'Hızlı gir, erken otorite ol.';
  else if (signal.stage === 'rising') recommendation = 'İçerik üret, momentum\'a bin.';
  else if (signal.stage === 'peak') recommendation = 'Farklılaştır, satışa çevir.';
  else if (signal.stage === 'declining') recommendation = 'Evergreen açıdan tekrar paketle.';
  else recommendation = 'Sürekli içerik kaynağı, sistem kur.';
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  end.setDate(today.getDate() + lifespan);
  return {
    topic: signal.topic,
    stage: signal.stage,
    stageLabel: stageMeta?.label ?? 'Bilinmiyor',
    stageColor: stageMeta?.color ?? '#94a3b8',
    recommendation,
    windowStart: start.getTime(),
    windowEnd: end.getTime(),
    estPeak: velocity,
  };
};

export const getNTPList = async (): Promise<NTPSignal[]> => {
  try {
    const raw = await AsyncStorage.getItem(NTP_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NTPSignal[];
  } catch {
    return [];
  }
};

export const saveNTP = async (entry: NTPSignal): Promise<NTPSignal[]> => {
  const list = await getNTPList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(NTP_KEY, JSON.stringify(next));
  return next;
};

export const removeNTP = async (id: string): Promise<NTPSignal[]> => {
  const list = await getNTPList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(NTP_KEY, JSON.stringify(next));
  return next;
};

export const clearNTPs = async (): Promise<void> => {
  await AsyncStorage.removeItem(NTP_KEY);
};

export const getNicheTopics = (niche: string): string[] => {
  const map: Record<string, string[]> = {
    tech: ['AI araçları', 'yeni çip', 'uygulama inceleme', 'no-code', 'açık kaynak', 'siber güvenlik', 'VR/AR', 'gizlilik'],
    business: ['uzaktan çalışma', 'startup hikayeleri', 'franchise', 'satış teknikleri', 'müşteri deneyimi', 'liderlik'],
    lifestyle: ['minimalizm', 'slow living', 'sabah rutini', 'ev dekorasyon', 'hobi edinme', 'kitap kulübü'],
    fitness: ['fonksiyonel antrenman', 'esneklik', 'mobilite', 'evde spor', 'protein tarifleri', 'uyku hijyeni'],
    food: ['hızlı yemek', 'vegan tarifler', 'airfryer', 'kahve kültürü', 'batch cooking', 'restoran inceleme'],
    travel: ['hafta sonu kaçamağı', 'dijital göçebe', 'budget seyahat', 'gizli cennet', 'yol hikayeleri', 'gastronomi turu'],
    finance: ['yatırım başlangıç', 'bütçe yönetimi', 'pasif gelir', 'kripto', 'emeklilik planı', 'borç yönetimi'],
    education: ['öğrenme teknikleri', 'micro-learning', 'sınav hazırlık', 'eğitim teknolojisi', 'study with me', 'yabancı dil'],
    art: ['dijital illüstrasyon', 'iskelet çizimi', 'NFT', 'tasarım trendleri', 'tipografi', 'portre'],
    gaming: ['speedrun', 'indie oyun', 'esports', 'retro', 'hız koşusu', 'lore'],
    beauty: ['skincare rutinleri', 'makyaj trendleri', 'temiz içerik', 'saç bakımı', 'tırnak sanatı', 'doğal güzellik'],
    parenting: ['ekran süresi', 'oyun temelli öğrenme', 'çocuk gelişimi', 'aile bütçesi', 'hamilelik', 'okul seçimi'],
  };
  return map[niche] ?? ['genel ipucu', 'trend konu', 'soru-cevap', 'başlangıç rehberi'];
};

// === Round 97: Content Quality Radar ===
export type CQDimension = 'clarity' | 'value' | 'originality' | 'engagement' | 'structure' | 'visuals';
export type CQEntry = {
  id: string;
  title: string;
  scores: Record<CQDimension, number>;
  notes: string;
  createdAt: number;
};

export type CQRadar = {
  dimensions: { id: CQDimension; value: number; label: string; emoji: string }[];
  average: number;
  weakest: CQDimension;
  strongest: CQDimension;
  rating: 'düşük' | 'orta' | 'iyi' | 'güçlü' | 'mükemmel';
  recommendation: string;
};

export const CQR_KEY = '@content-coach/quality-radar';
export const CQR_DIMENSIONS: { id: CQDimension; label: string; emoji: string; desc: string }[] = [
  { id: 'clarity', label: 'Netlik', emoji: '🔍', desc: 'Anlaşılırlık, mesaj netliği' },
  { id: 'value', label: 'Değer', emoji: '💎', desc: 'Sağladığı fayda' },
  { id: 'originality', label: 'Özgünlük', emoji: '✨', desc: 'Farklı ve yeni' },
  { id: 'engagement', label: 'Etkileşim', emoji: '💬', desc: 'Tartışma ve tepki' },
  { id: 'structure', label: 'Yapı', emoji: '🏗️', desc: 'Akış ve organizasyon' },
  { id: 'visuals', label: 'Görsel', emoji: '🎨', desc: 'Görsel kalite' },
];

export const calcQualityRadar = (entry: CQEntry): CQRadar => {
  const dims = CQR_DIMENSIONS.map(d => ({
    id: d.id,
    label: d.label,
    emoji: d.emoji,
    value: Math.max(0, Math.min(100, entry.scores[d.id] ?? 0)),
  }));
  const average = Math.round(dims.reduce((s, d) => s + d.value, 0) / dims.length);
  const weakest = dims.reduce<CQDimension>((wk, d) => (d.value < (dims.find(x => x.id === wk)?.value ?? 100) ? d.id : wk), dims[0].id);
  const strongest = dims.reduce<CQDimension>((st, d) => (d.value > (dims.find(x => x.id === st)?.value ?? 0) ? d.id : st), dims[0].id);
  const rating: CQRadar['rating'] = average >= 90 ? 'mükemmel' : average >= 75 ? 'güçlü' : average >= 55 ? 'iyi' : average >= 35 ? 'orta' : 'düşük';
  const weakMeta = CQR_DIMENSIONS.find(d => d.id === weakest);
  let recommendation = '';
  if (rating === 'mükemmel') recommendation = 'Tüm boyutlarda üstün, yayınla.';
  else if (rating === 'güçlü') recommendation = `Çok iyi; sadece ${weakMeta?.label} biraz geliştirilebilir.`;
  else if (rating === 'iyi') recommendation = `İyi temel, ${weakMeta?.label} boyutunu yükselt.`;
  else if (rating === 'orta') recommendation = `${weakMeta?.label} zayıf; önce onu güçlendir.`;
  else recommendation = 'Yayından önce köklü yeniden yazım gerek.';
  return { dimensions: dims, average, weakest, strongest, rating, recommendation };
};

export const getCQRList = async (): Promise<CQEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(CQR_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CQEntry[];
  } catch {
    return [];
  }
};

export const saveCQR = async (entry: CQEntry): Promise<CQEntry[]> => {
  const list = await getCQRList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(CQR_KEY, JSON.stringify(next));
  return next;
};

export const removeCQR = async (id: string): Promise<CQEntry[]> => {
  const list = await getCQRList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(CQR_KEY, JSON.stringify(next));
  return next;
};

export const clearCQRs = async (): Promise<void> => {
  await AsyncStorage.removeItem(CQR_KEY);
};

// === Round 98: Content Brief Builder ===
export type CBBPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'threads' | 'blog' | 'podcast' | 'general';
export type CBBGoal = 'awareness' | 'engagement' | 'conversion' | 'education' | 'community' | 'authority';
export type CBBEntry = {
  id: string;
  topic: string;
  platform: CBBPlatform;
  goal: CBBGoal;
  audience: string;
  pillar: string;
  hook: string;
  outline: string[];
  keyPoints: string[];
  cta: string;
  keywords: string[];
  visuals: string[];
  createdAt: number;
};

export type CBBBrief = {
  topic: string;
  hook: string;
  outline: string[];
  keyPoints: string[];
  cta: string;
  keywords: string[];
  visuals: string[];
  estimatedLength: string;
  difficulty: 'kolay' | 'orta' | 'zor';
  estReach: number;
};

export const CBB_KEY = '@content-coach/brief-builder';
export const CBB_PLATFORMS: { id: CBBPlatform; label: string; emoji: string }[] = [
  { id: 'general', label: 'Genel', emoji: '✨' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { id: 'twitter', label: 'X (Twitter)', emoji: '🐦' },
  { id: 'threads', label: 'Threads', emoji: '🧵' },
  { id: 'blog', label: 'Blog', emoji: '📰' },
  { id: 'podcast', label: 'Podcast', emoji: '🎙️' },
];

export const CBB_GOALS: { id: CBBGoal; label: string; emoji: string; desc: string }[] = [
  { id: 'awareness', label: 'Farkındalık', emoji: '👁️', desc: 'Yeni kitleye ulaş' },
  { id: 'engagement', label: 'Etkileşim', emoji: '💬', desc: 'Yorum, kaydet, paylaş' },
  { id: 'conversion', label: 'Dönüşüm', emoji: '🎯', desc: 'Satış, kayıt, tıklama' },
  { id: 'education', label: 'Eğitim', emoji: '📚', desc: 'Bilgi aktarımı' },
  { id: 'community', label: 'Topluluk', emoji: '🤝', desc: 'Bağ ve aidiyet' },
  { id: 'authority', label: 'Otorite', emoji: '🏆', desc: 'Uzman konumlandır' },
];

const CBB_HOOKS: Record<CBBGoal, string[]> = {
  awareness: [
    'Bunu bilmiyordun, değil mi?',
    'Sana göstereyim:',
    'Yeni keşfim, hemen paylaşayım:',
  ],
  engagement: [
    'Senin en sevdiğin hangisi?',
    'Yorumda görüşelim:',
    'Bu konuda haklı mıyım?',
  ],
  conversion: [
    'Bugün başla, sonuçları gör:',
    'Kaçırma, fırsat kapıda:',
    'Detaylar bio\'da, hemen bak:',
  ],
  education: [
    'Adım adım öğrenelim:',
    'Sana 3 şey öğreteceğim:',
    'İşte herkesin bilmesi gereken:',
  ],
  community: [
    'Seninle bunu konuşmak istedim:',
    'Bu grubun parçası ol:',
    'Hep birlikte daha güçlüyüz:',
  ],
  authority: [
    '10 yıllık tecrübemden:',
    'Sektörde bilinmeyen gerçek:',
    'Uzman gözüyle bak:',
  ],
};

const CBB_OUTLINE: Record<CBBPlatform, string[]> = {
  instagram: ['Hook (3s)', 'Sorun/merak', 'Çözüm anlatımı', 'Kanıt/örnek', 'CTA'],
  tiktok: ['Hook (2s)', 'Hızlı değer', 'Ters köşe', 'Özet', 'CTA'],
  youtube: ['Cold open', 'Bağlam', 'Ana içerik bölüm 1-2-3', 'Özet', 'CTA'],
  linkedin: ['Giriş hikayesi', 'Tez', '3 madde kanıt', 'Sonuç', 'CTA'],
  twitter: ['Tek mesaj', 'Kanıt', 'Tartışma sorusu'],
  threads: ['Açılış', 'Gelişme 1-2', 'Kapanış'],
  blog: ['Giriş', 'Problem', 'Çözüm', 'Örnekler', 'Sonuç'],
  podcast: ['Sohbet açılış', 'Ana konu 1', 'Tartışma', 'Dinleyici sorusu', 'Kapanış'],
  general: ['Giriş', 'Gelişme', 'Sonuç'],
};

const CBB_VISUALS: Record<CBBPlatform, string[]> = {
  instagram: ['B-roll sahneleri', 'Metin overlay', 'Portre çekim', 'Ürün/hizmet görseli'],
  tiktok: ['Yakın plan yüz', 'Hızlı geçişler', 'Ekranda metin', 'Müzik eşliği'],
  youtube: ['B-roll', 'Konuşan kafa', 'Grafik/animasyon', 'Thumbnail çekimi'],
  linkedin: ['Profesyonel fotoğraf', 'Veri grafiği', 'Liste görseli', 'Ofis sahnesi'],
  twitter: ['Tek görsel', 'Quote kartı', 'GIF', 'Meme'],
  threads: ['Görsel anlatım', 'Carousel', 'Basit metin overlay'],
  blog: ['Öne çıkan görsel', 'Ara görseller', 'Bilgi grafiği'],
  podcast: ['Thumbnail', 'Sosyal kart', 'Bölüm quote görseli'],
  general: ['Ana görsel', 'Destekleyici görseller'],
};

const CBB_DIFFICULTY: Record<CBBPlatform, 'kolay' | 'orta' | 'zor'> = {
  instagram: 'orta',
  tiktok: 'kolay',
  youtube: 'zor',
  linkedin: 'orta',
  twitter: 'kolay',
  threads: 'kolay',
  blog: 'zor',
  podcast: 'zor',
  general: 'orta',
};

const CBB_LENGTH: Record<CBBPlatform, string> = {
  instagram: '30-60s video / 5-7 slayt',
  tiktok: '15-60s',
  youtube: '8-15 dakika',
  linkedin: '150-300 kelime',
  twitter: '280 karakter veya 4-7 tweet',
  threads: '4-10 metin bloğu',
  blog: '800-1500 kelime',
  podcast: '20-45 dakika',
  general: '5-10 dakika',
};

const CBB_KEYWORDS_DEFAULT = ['içerik', 'strateji', 'üretici', 'platform', 'izleyici', 'erişim', 'etkileşim', 'kalite', 'zamanlama', 'tutarlılık'];

export const buildContentBrief = (topic: string, platform: CBBPlatform, goal: CBBGoal, audience: string, pillar: string): CBBBrief => {
  const seed = topic.length * 13 + platform.length * 11 + goal.length * 7;
  const hooks = CBB_HOOKS[goal];
  const hook = hooks[seed % hooks.length];
  const outline = CBB_OUTLINE[platform];
  const visuals = CBB_VISUALS[platform];
  const length = CBB_LENGTH[platform];
  const difficulty = CBB_DIFFICULTY[platform];
  const ctaMap: Record<CBBGoal, string> = {
    awareness: 'Takip et, benzer içerikler için.',
    engagement: 'Yorumda düşünceni yaz.',
    conversion: 'Bio\'daki linkten hemen başla.',
    education: 'Kaydet, ihtiyacın olduğunda dön.',
    community: 'Sen de katıl, aşağıya yaz.',
    authority: 'Bültene abone ol, daha fazlası için.',
  };
  const keyPoints = [
    `${audience} için somut fayda açıkla`,
    `${pillar} sütununa bağlı kal`,
    `${goal} hedefini her bölümde hatırla`,
    `Veri/örnek ile destekle`,
  ];
  const keywords = [...CBB_KEYWORDS_DEFAULT, pillar.toLowerCase(), audience.toLowerCase()].slice(0, 8);
  const reachMap: Record<CBBPlatform, number> = {
    general: 800,
    instagram: 1500,
    tiktok: 3500,
    youtube: 2500,
    linkedin: 900,
    twitter: 1100,
    threads: 1000,
    blog: 600,
    podcast: 800,
  };
  return {
    topic,
    hook,
    outline,
    keyPoints,
    cta: ctaMap[goal],
    keywords,
    visuals,
    estimatedLength: length,
    difficulty,
    estReach: reachMap[platform],
  };
};

export const getCBBList = async (): Promise<CBBEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(CBB_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CBBEntry[];
  } catch {
    return [];
  }
};

export const saveCBB = async (entry: CBBEntry): Promise<CBBEntry[]> => {
  const list = await getCBBList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(CBB_KEY, JSON.stringify(next));
  return next;
};

export const removeCBB = async (id: string): Promise<CBBEntry[]> => {
  const list = await getCBBList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(CBB_KEY, JSON.stringify(next));
  return next;
};

export const clearCBBs = async (): Promise<void> => {
  await AsyncStorage.removeItem(CBB_KEY);
};

// === Round 99: Story Arc Generator ===
export type SAGTheme = 'origin' | 'challenge' | 'transformation' | 'failure' | 'discovery' | 'mentor' | 'quest' | 'community';
export type SAGEmotion = 'curiosity' | 'empathy' | 'inspiration' | 'tension' | 'joy' | 'reflection' | 'urgency';
export type SAGEntry = {
  id: string;
  title: string;
  theme: SAGTheme;
  emotion: SAGEmotion;
  hero: string;
  goal: string;
  conflict: string;
  resolution: string;
  lesson: string;
  beats: { phase: string; text: string }[];
  createdAt: number;
};

export type SAGArc = {
  title: string;
  theme: SAGTheme;
  beats: { phase: string; text: string }[];
  hook: string;
  climax: string;
  payoff: string;
  moral: string;
  estEngagement: number;
  intensity: number;
};

export const SAG_KEY = '@content-coach/story-arc';
export const SAG_THEMES: { id: SAGTheme; label: string; emoji: string; desc: string }[] = [
  { id: 'origin', label: 'Başlangıç', emoji: '🌅', desc: 'Nasıl başladım?' },
  { id: 'challenge', label: 'Zorluk', emoji: '⛰️', desc: 'Aştığım engel' },
  { id: 'transformation', label: 'Dönüşüm', emoji: '🦋', desc: 'Eskiden->Şimdi' },
  { id: 'failure', label: 'Başarısızlık', emoji: '💥', desc: 'Düştüğüm an' },
  { id: 'discovery', label: 'Keşif', emoji: '🔍', desc: 'Beklenmedik bulgu' },
  { id: 'mentor', label: 'Mentor', emoji: '🧙', desc: 'Bana yol gösteren' },
  { id: 'quest', label: 'Misyon', emoji: '🎯', desc: 'Peşinde olduğum' },
  { id: 'community', label: 'Topluluk', emoji: '🤝', desc: 'Birlikte başardık' },
];

export const SAG_EMOTIONS: { id: SAGEmotion; label: string; emoji: string }[] = [
  { id: 'curiosity', label: 'Merak', emoji: '🧐' },
  { id: 'empathy', label: 'Empati', emoji: '🤲' },
  { id: 'inspiration', label: 'İlham', emoji: '✨' },
  { id: 'tension', label: 'Gerilim', emoji: '😬' },
  { id: 'joy', label: 'Neşe', emoji: '😄' },
  { id: 'reflection', label: 'Yansıma', emoji: '🤔' },
  { id: 'urgency', label: 'Aciliyet', emoji: '⏰' },
];

const SAG_HOOKS: Record<SAGTheme, string[]> = {
  origin: ['Hiç böyle başlayacağımı düşünmemiştim.', 'Bir gün her şey değişti.', 'Sıfırdan başladım, çünkü...'],
  challenge: ['O an her şey bitmiş gibiydi.', 'En zor günümde ne yaptım?', 'İmkansız dedikleri şeyi yaptım.'],
  transformation: ['Eskiden kim olduğumu hatırlıyor musun?', '1 yılda değiştim, sebebi bu:', 'Hayatımı değiştiren 1 karar:'],
  failure: ['Tüm planlarım çöktü.', 'Hata yaptım, bedeli ağır oldu.', 'Kaybettiğimde öğrendiğim:'],
  discovery: ['Beklemediğim yerde bulduğum:', 'Rastlantı sonucu keşfim:', 'Kimsenin bilmediği şey:'],
  mentor: ['Hayatımı değiştiren kişi:', 'Bana öğreten adam:', 'Bir cümle her şeyi değiştirdi:'],
  quest: ['Peşinde olduğum şey:', 'Yıllarca aradığım cevap:', 'Misyonum ne zaman başladı:'],
  community: ['Birlikte yaptık, başardık.', 'Topluluk bunu başardı:', 'Yalnız değilsin, çünkü:'],
};

const SAG_BEATS: Record<SAGTheme, { phase: string; template: string }[]> = {
  origin: [
    { phase: 'Setup', template: 'Normal hayat: {hero} sıradan bir gün yaşıyor.' },
    { phase: 'Fırsat', template: '{hero} yeni bir yol keşfediyor: {goal}.' },
    { phase: 'Karar', template: 'İlk adımı atıyor.' },
    { phase: 'Dönüşüm', template: '{hero} eski benliğinden sıyrılıyor.' },
    { phase: 'Sonuç', template: 'Yeni kimlik: {resolution}.' },
  ],
  challenge: [
    { phase: 'Setup', template: '{hero} hedefine yaklaşıyor: {goal}.' },
    { phase: 'Engel', template: 'Beklenmedik {conflict} çıkıyor.' },
    { phase: 'Düşüş', template: 'Tüm ilerleme duruyor.' },
    { phase: 'Karar', template: 'Ayağa kalkma anı.' },
    { phase: 'Zafer', template: '{resolution} başarıyla tamamlanıyor.' },
  ],
  transformation: [
    { phase: 'Eski ben', template: 'Bir zamanlar: {hero} farklı biriydi.' },
    { phase: 'Kırılma', template: '{conflict} yüzünden her şey değişti.' },
    { phase: 'Öğrenme', template: 'Yeni bir bakış açısı edindi.' },
    { phase: 'Uygulama', template: 'Adım adım uyguladı.' },
    { phase: 'Yeni ben', template: '{resolution}: {hero} dönüşmüş hali.' },
  ],
  failure: [
    { phase: 'Gurur', template: '{hero} çok özgüvendeydi.' },
    { phase: 'Hata', template: '{conflict} yüzünden düştü.' },
    { phase: 'Sonuç', template: 'Ağır ders: başarısızlık.' },
    { phase: 'Yansıma', template: 'Sessizlik ve özeleştiri.' },
    { phase: 'Ayağa kalkış', template: 'Yeniden başlangıç: {resolution}.' },
  ],
  discovery: [
    { phase: 'Arayış', template: '{hero} {goal} için bir şey arıyordu.' },
    { phase: 'Sapma', template: 'Beklenmedik bir yöne gitti.' },
    { phase: 'Keşif', template: '{conflict} aslında bir fırsattı.' },
    { phase: 'Anlam', template: 'Derin bir içgörüye ulaştı.' },
    { phase: 'Paylaşım', template: '{resolution} yeni bir kapı açtı.' },
  ],
  mentor: [
    { phase: 'Çaresizlik', template: '{hero} yolunu bulamıyordu.' },
    { phase: 'Karşılaşma', template: 'Bir mentor ortaya çıktı.' },
    { phase: 'Ders', template: 'Kritik bir cümle: {lesson}.' },
    { phase: 'Uygulama', template: '{hero} mentorun tavsiyesini uyguladı.' },
    { phase: 'Sonuç', template: '{resolution} mümkün oldu.' },
  ],
  quest: [
    { phase: 'Çağrı', template: '{hero} büyük bir {goal} için çağrıldı.' },
    { phase: 'Hazırlık', template: 'Yola çıkmak için her şeyi bıraktı.' },
    { phase: 'Engeller', template: 'Yolda {conflict} ile karşılaştı.' },
    { phase: 'Dönüm', template: 'Kritik karar anı.' },
    { phase: 'Varış', template: '{resolution}: hedefe ulaştı.' },
  ],
  community: [
    { phase: 'Yalnızlık', template: '{hero} tek başına bir şey başaramıyordu.' },
    { phase: 'Buluşma', template: 'Toplulukla tanıştı.' },
    { phase: 'Birlikte', template: 'Birlikte {goal} için çalıştılar.' },
    { phase: 'Zorluk', template: '{conflict} hep birlikte aşıldı.' },
    { phase: 'Sonuç', template: '{resolution} mümkün oldu.' },
  ],
};

export const buildArc = (theme: SAGTheme, hero: string, goal: string, conflict: string, resolution: string, lesson: string, emotion: SAGEmotion): SAGArc => {
  const seed = theme.length * 13 + emotion.length * 11;
  const hooks = SAG_HOOKS[theme];
  const hook = hooks[seed % hooks.length];
  const beatDefs = SAG_BEATS[theme];
  const beats = beatDefs.map(b => ({
    phase: b.phase,
    text: b.template.replace('{hero}', hero || 'kahraman').replace('{goal}', goal || 'hedef').replace('{conflict}', conflict || 'engel').replace('{resolution}', resolution || 'çözüm').replace('{lesson}', lesson || 'ders'),
  }));
  const climaxBeat = beats[Math.floor(beats.length * 0.6)] ?? beats[beats.length - 1];
  const payoffBeat = beats[beats.length - 1];
  const emotionMult = emotion === 'empathy' ? 1.2 : emotion === 'inspiration' ? 1.15 : emotion === 'curiosity' ? 1.1 : 1.0;
  const estEngagement = Math.round(800 * emotionMult);
  const intensity = Math.min(100, Math.round(60 + (seed % 30) + (emotion === 'tension' ? 10 : 0)));
  return {
    title: `${hero || 'Kahraman'} - ${theme}`,
    theme,
    beats,
    hook,
    climax: climaxBeat.text,
    payoff: payoffBeat.text,
    moral: lesson || 'Her yolculuk değerlidir.',
    estEngagement,
    intensity,
  };
};

export const getSAGList = async (): Promise<SAGEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(SAG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SAGEntry[];
  } catch {
    return [];
  }
};

export const saveSAG = async (entry: SAGEntry): Promise<SAGEntry[]> => {
  const list = await getSAGList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(SAG_KEY, JSON.stringify(next));
  return next;
};

export const removeSAG = async (id: string): Promise<SAGEntry[]> => {
  const list = await getSAGList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(SAG_KEY, JSON.stringify(next));
  return next;
};

export const clearSAGs = async (): Promise<void> => {
  await AsyncStorage.removeItem(SAG_KEY);
};

// === Round 100: Performance Score Card ===
export type PSCDimension = {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  hint: string;
};

export type PSCInput = {
  hook: number;
  emotion: number;
  clarity: number;
  cta: number;
  hashtag: number;
  format: number;
  consistency: number;
  niche: number;
};

export type PSCResult = {
  overall: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  dimensions: { id: string; label: string; emoji: string; score: number; weight: number }[];
  weakest: string;
  strongest: string;
  estReach: number;
  estEngagement: number;
  recommendation: string;
};

export type PSCEntry = {
  id: string;
  title: string;
  overall: number;
  grade: PSCResult['grade'];
  weakest: string;
  scores: PSCInput;
  createdAt: number;
};

export const PSC_KEY = '@content-coach/perf-score';

export const PSC_DIMENSIONS: PSCDimension[] = [
  { id: 'hook', label: 'Hook Gücü', emoji: '🎣', desc: 'İlk 3 saniye', hint: 'Açılışın dikkat çekiyor mu?' },
  { id: 'emotion', label: 'Duygu', emoji: '❤️', desc: 'Duygusal tetikleyici', hint: 'Hissettiriyor mu?' },
  { id: 'clarity', label: 'Netlik', emoji: '🔍', desc: 'Mesaj netliği', hint: 'Ana fark anlaşılıyor mu?' },
  { id: 'cta', label: 'CTA', emoji: '👉', desc: 'Eylem çağrısı', hint: 'Ne yapılacağı belli mi?' },
  { id: 'hashtag', label: 'Hashtag', emoji: '#️⃣', desc: 'Keşfedilebilirlik', hint: 'Doğru etiketler var mı?' },
  { id: 'format', label: 'Format', emoji: '🎬', desc: 'Format uyumu', hint: 'Platforma uygun mu?' },
  { id: 'consistency', label: 'Tutarlılık', emoji: '📅', desc: 'Yayın sıklığı', hint: 'Düzenli mi?' },
  { id: 'niche', label: 'Niş Uyumu', emoji: '🎯', desc: 'Hedef kitle', hint: 'Doğru kitleye mi?' },
];

export const PSC_WEIGHTS: Record<string, number> = {
  hook: 1.5,
  emotion: 1.2,
  clarity: 1.3,
  cta: 1.0,
  hashtag: 0.9,
  format: 1.1,
  consistency: 1.0,
  niche: 1.2,
};

export const calcPSCScore = (input: PSCInput): PSCResult => {
  const dims = PSC_DIMENSIONS.map(d => {
    const score = Math.max(0, Math.min(100, input[d.id as keyof PSCInput]));
    const weight = PSC_WEIGHTS[d.id] ?? 1;
    return { id: d.id, label: d.label, emoji: d.emoji, score, weight };
  });
  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  const weightedSum = dims.reduce((s, d) => s + d.score * d.weight, 0);
  const overall = Math.round(weightedSum / totalWeight);
  const grade: PSCResult['grade'] =
    overall >= 90 ? 'S' : overall >= 80 ? 'A' : overall >= 70 ? 'B' : overall >= 60 ? 'C' : 'D';
  const sorted = [...dims].sort((a, b) => a.score - b.score);
  const weakest = sorted[0].label;
  const strongest = sorted[sorted.length - 1].label;
  const estReach = Math.round(overall * 50);
  const estEngagement = Math.round((overall / 100) * 1500);
  const recommendation =
    grade === 'S' ? 'Yayına hazır, muhteşem!' :
    grade === 'A' ? 'Çok iyi, küçük rötuşlarla.' :
    grade === 'B' ? 'İyi, ama daha çarpıcı olabilir.' :
    grade === 'C' ? 'Geliştirme gerekli.' :
    'Temel unsurları güçlendir.';
  return { overall, grade, dimensions: dims, weakest, strongest, estReach, estEngagement, recommendation };
};

export const getPSCList = async (): Promise<PSCEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(PSC_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PSCEntry[];
  } catch {
    return [];
  }
};

export const savePSC = async (entry: PSCEntry): Promise<PSCEntry[]> => {
  const list = await getPSCList();
  const next = [entry, ...list];
  await AsyncStorage.setItem(PSC_KEY, JSON.stringify(next));
  return next;
};

export const removePSC = async (id: string): Promise<PSCEntry[]> => {
  const list = await getPSCList();
  const next = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(PSC_KEY, JSON.stringify(next));
  return next;
};

export const clearPSCs = async (): Promise<void> => {
  await AsyncStorage.removeItem(PSC_KEY);
};

