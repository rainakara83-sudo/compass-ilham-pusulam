import contentPool from '../data/content-pool.json';

export type NicheId = keyof typeof contentPool;

export type WeeklyIdea = {
  day: 'monday' | 'wednesday' | 'friday' | 'saturday';
  text: string;
  source: 'pool' | 'ai';
};

const ALL_IDEAS: Record<NicheId, string[]> = contentPool as Record<NicheId, string[]>;

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const isWeekend = (d: Date = new Date()): boolean => {
  const day = d.getDay();
  return day === 0 || day === 6;
};

export const WEEKEND_BADGE = ['⚡ Bonus', '🎉 Hafta sonu', '✨ Ek fikir'];

export const pickWeeklyIdeasFromPool = (niche: NicheId, weekend: boolean = isWeekend()): WeeklyIdea[] => {
  const pool = ALL_IDEAS[niche] ?? [];
  if (pool.length === 0) return [];
  const shuffled = shuffle(pool);
  const baseCount = 3;
  const weekendCount = weekend ? 1 : 0;
  const picked = shuffled.slice(0, baseCount + weekendCount);
  const days: WeeklyIdea['day'][] = weekend
    ? ['monday', 'wednesday', 'friday', 'saturday']
    : ['monday', 'wednesday', 'friday'];
  return picked.map((text, idx) => ({
    day: days[idx] ?? 'monday',
    text,
    source: 'pool',
  }));
};

export const getNichePool = (niche: NicheId): string[] => {
  return ALL_IDEAS[niche] ?? [];
};

export const searchNichePool = (niche: NicheId, query: string): string[] => {
  const pool = ALL_IDEAS[niche] ?? [];
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  return pool.filter((idea) => idea.toLowerCase().includes(q));
};

export const pickRandomFromPool = (niche: NicheId, exclude: string[] = []): string | null => {
  const pool = (ALL_IDEAS[niche] ?? []).filter((idea) => !exclude.includes(idea));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
};