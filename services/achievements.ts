import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCommentTemplates,
  getDoneIdeas,
  getFavorites,
  getHistory,
  getSchedule,
  getStoredNiches,
  getStreak,
} from './storage';

const EARNED_KEY = '@content-coach/earned-badges';

export type BadgeId =
  | 'firstIdea'
  | 'streak7'
  | 'ideas100'
  | 'multilingual3'
  | 'speedster'
  | 'goalHunter'
  | 'superUser'
  | 'hookMaster'
  | 'popular'
  | 'globetrotter'
  | 'premium'
  | 'planned'
  | 'commentChamp'
  | 'polyNiche'
  | 'earlyBird';

export type AchievementBadge = {
  id: BadgeId;
  icon: string;
  titleKey: string;
  descKey: string;
  color: string;
  category: 'create' | 'streak' | 'social' | 'premium' | 'global';
};

export const BADGES: AchievementBadge[] = [
  { id: 'firstIdea', icon: '💡', titleKey: 'achievements.firstIdea.title', descKey: 'achievements.firstIdea.desc', color: '#4D96FF', category: 'create' },
  { id: 'ideas100', icon: '💎', titleKey: 'achievements.ideas100.title', descKey: 'achievements.ideas100.desc', color: '#2563EB', category: 'create' },
  { id: 'speedster', icon: '⚡', titleKey: 'achievements.speedster.title', descKey: 'achievements.speedster.desc', color: '#F59E0B', category: 'create' },
  { id: 'earlyBird', icon: '🐣', titleKey: 'achievements.earlyBird.title', descKey: 'achievements.earlyBird.desc', color: '#10B981', category: 'create' },
  { id: 'streak7', icon: '🔥', titleKey: 'achievements.streak7.title', descKey: 'achievements.streak7.desc', color: '#F97316', category: 'streak' },
  { id: 'superUser', icon: '🏆', titleKey: 'achievements.superUser.title', descKey: 'achievements.superUser.desc', color: '#C2410C', category: 'streak' },
  { id: 'goalHunter', icon: '🎯', titleKey: 'achievements.goalHunter.title', descKey: 'achievements.goalHunter.desc', color: '#8B5CF6', category: 'streak' },
  { id: 'hookMaster', icon: '🪝', titleKey: 'achievements.hookMaster.title', descKey: 'achievements.hookMaster.desc', color: '#EC4899', category: 'social' },
  { id: 'popular', icon: '⭐', titleKey: 'achievements.popular.title', descKey: 'achievements.popular.desc', color: '#F59E0B', category: 'social' },
  { id: 'commentChamp', icon: '💬', titleKey: 'achievements.commentChamp.title', descKey: 'achievements.commentChamp.desc', color: '#06B6D4', category: 'social' },
  { id: 'planned', icon: '📅', titleKey: 'achievements.planned.title', descKey: 'achievements.planned.desc', color: '#14B8A6', category: 'social' },
  { id: 'polyNiche', icon: '🌐', titleKey: 'achievements.polyNiche.title', descKey: 'achievements.polyNiche.desc', color: '#6366F1', category: 'global' },
  { id: 'multilingual3', icon: '🗣️', titleKey: 'achievements.multilingual3.title', descKey: 'achievements.multilingual3.desc', color: '#0EA5E9', category: 'global' },
  { id: 'globetrotter', icon: '🌍', titleKey: 'achievements.globetrotter.title', descKey: 'achievements.globetrotter.desc', color: '#84CC16', category: 'global' },
  { id: 'premium', icon: '👑', titleKey: 'achievements.premium.title', descKey: 'achievements.premium.desc', color: '#A855F7', category: 'premium' },
];

export const getEarnedBadges = async (): Promise<BadgeId[]> => {
  try {
    const raw = await AsyncStorage.getItem(EARNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is BadgeId => typeof id === 'string');
  } catch {
    return [];
  }
};

export const saveEarnedBadge = async (id: BadgeId): Promise<void> => {
  const list = await getEarnedBadges();
  if (list.includes(id)) return;
  const next = [...list, id];
  try {
    await AsyncStorage.setItem(EARNED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('compass_earned_badges', JSON.stringify(next));
    } catch {
      // ignore
    }
  }
};

export type AchievementState = {
  totalIdeas?: number;
  todayIdeas?: number;
  streakDays?: number;
  totalHooks?: number;
  totalFavorites?: number;
  totalCommentTemplates?: number;
  plannedDays?: number;
  totalNiches?: number;
  languagesUsed?: number;
  isPremium?: boolean;
  monthIdeas?: number;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const checkBadge = (id: BadgeId, state: AchievementState): boolean => {
  switch (id) {
    case 'firstIdea':
      return (state.totalIdeas ?? 0) >= 1;
    case 'ideas100':
      return (state.totalIdeas ?? 0) >= 100;
    case 'speedster':
      return (state.todayIdeas ?? 0) >= 10;
    case 'earlyBird':
      return (state.monthIdeas ?? 0) >= 50;
    case 'streak7':
      return (state.streakDays ?? 0) >= 7;
    case 'superUser':
      return (state.streakDays ?? 0) >= 30;
    case 'goalHunter':
      return (state.streakDays ?? 0) >= 5;
    case 'hookMaster':
      return (state.totalHooks ?? 0) >= 50;
    case 'popular':
      return (state.totalFavorites ?? 0) >= 10;
    case 'commentChamp':
      return (state.totalCommentTemplates ?? 0) >= 20;
    case 'planned':
      return (state.plannedDays ?? 0) >= 30;
    case 'polyNiche':
      return (state.totalNiches ?? 0) >= 7;
    case 'multilingual3':
      return (state.languagesUsed ?? 0) >= 3;
    case 'globetrotter':
      return (state.languagesUsed ?? 0) >= 5;
    case 'premium':
      return state.isPremium === true;
    default:
      return false;
  }
};

export const collectAchievementState = async (): Promise<AchievementState> => {
  const [history, favorites, schedule, niches, streak, commentTemplates] = await Promise.all([
    getHistory(),
    getFavorites(),
    getSchedule(),
    getStoredNiches(),
    getStreak(),
    getCommentTemplates(),
  ]);
  const today = todayKey();
  const month = today.slice(0, 7);
  const todayIdeas = history.filter((h) => {
    const ts = typeof h.date === 'number' ? h.date : 0;
    return ts > 0 && new Date(ts).toISOString().slice(0, 10) === today;
  }).length;
  const monthIdeas = history.filter((h) => {
    const ts = typeof h.date === 'number' ? h.date : 0;
    return ts > 0 && new Date(ts).toISOString().slice(0, 7) === month;
  }).length;
  return {
    totalIdeas: history.length,
    todayIdeas,
    monthIdeas,
    streakDays: streak,
    totalFavorites: favorites.length,
    totalCommentTemplates: commentTemplates.length,
    plannedDays: schedule.length,
    totalNiches: niches.length,
  };
};

export const checkAchievements = async (
  partial?: Partial<AchievementState>
): Promise<AchievementBadge[]> => {
  const base = await collectAchievementState();
  const state: AchievementState = { ...base, ...partial };
  const earned = await getEarnedBadges();
  const newly: AchievementBadge[] = [];
  for (const b of BADGES) {
    if (earned.includes(b.id)) continue;
    if (checkBadge(b.id, state)) {
      await saveEarnedBadge(b.id);
      newly.push(b);
    }
  }
  return newly;
};

export const isBadgeEarned = async (id: BadgeId): Promise<boolean> => {
  const earned = await getEarnedBadges();
  return earned.includes(id);
};

export const getEarnedCount = async (): Promise<number> => {
  return (await getEarnedBadges()).length;
};

export const getDoneIdeasCount = async (): Promise<number> => {
  return (await getDoneIdeas()).length;
};