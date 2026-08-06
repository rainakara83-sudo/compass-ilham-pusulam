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

// ============ Best Posting Time Engine ============
export type TimeSlot = {
  start: number; // 0-23 hour
  end: number;   // 0-23 hour
  label: 'morning' | 'noon' | 'evening' | 'night';
  weight: number; // 1-10
};

export const NICHE_TIME_BOOST: Record<NicheId, TimeSlot[]> = {
  fitness: [
    { start: 6, end: 8, label: 'morning', weight: 9 },
    { start: 12, end: 13, label: 'noon', weight: 7 },
    { start: 18, end: 21, label: 'evening', weight: 10 },
  ],
  food: [
    { start: 7, end: 9, label: 'morning', weight: 7 },
    { start: 11, end: 13, label: 'noon', weight: 10 },
    { start: 18, end: 20, label: 'evening', weight: 9 },
  ],
  tech: [
    { start: 9, end: 11, label: 'morning', weight: 9 },
    { start: 14, end: 16, label: 'noon', weight: 7 },
    { start: 17, end: 19, label: 'evening', weight: 8 },
  ],
  fashion: [
    { start: 8, end: 10, label: 'morning', weight: 6 },
    { start: 12, end: 14, label: 'noon', weight: 10 },
    { start: 19, end: 22, label: 'evening', weight: 10 },
  ],
  travel: [
    { start: 7, end: 9, label: 'morning', weight: 8 },
    { start: 13, end: 15, label: 'noon', weight: 7 },
    { start: 20, end: 23, label: 'night', weight: 9 },
  ],
  gaming: [
    { start: 12, end: 14, label: 'noon', weight: 8 },
    { start: 17, end: 20, label: 'evening', weight: 10 },
    { start: 22, end: 24, label: 'night', weight: 9 },
  ],
  personal_dev: [
    { start: 6, end: 9, label: 'morning', weight: 10 },
    { start: 12, end: 13, label: 'noon', weight: 7 },
    { start: 21, end: 23, label: 'night', weight: 8 },
  ],
  beauty: [
    { start: 8, end: 10, label: 'morning', weight: 7 },
    { start: 13, end: 15, label: 'noon', weight: 8 },
    { start: 19, end: 23, label: 'evening', weight: 10 },
  ],
  astrology: [
    { start: 7, end: 9, label: 'morning', weight: 8 },
    { start: 20, end: 23, label: 'evening', weight: 10 },
    { start: 23, end: 24, label: 'night', weight: 9 },
  ],
};

export type BestTime = {
  hour: number;
  minute: number;
  slot: TimeSlot;
  minutesUntil: number;
  isNow: boolean;
};

export const getBestTimeForToday = (niche: NicheId, now: Date = new Date()): BestTime => {
  const slots = NICHE_TIME_BOOST[niche] ?? [];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const allCandidates: { hour: number; minute: number; slot: TimeSlot; minutesUntil: number }[] = [];
  for (const slot of slots) {
    for (let m = slot.start * 60; m <= slot.end * 60 - 15; m += 15) {
      const diff = m - currentMinutes;
      const adjusted = diff < 0 ? diff + 24 * 60 : diff;
      allCandidates.push({ hour: Math.floor(m / 60), minute: m % 60, slot, minutesUntil: adjusted });
    }
  }
  if (allCandidates.length === 0) {
    const def: TimeSlot = { start: 19, end: 21, label: 'evening', weight: 5 };
    return { hour: 19, minute: 0, slot: def, minutesUntil: 60, isNow: false };
  }
  // Pick the soonest candidate whose slot has highest weight near it
  allCandidates.sort((a, b) => {
    const slotScore = b.slot.weight - a.slot.weight;
    if (slotScore !== 0) return slotScore;
    return a.minutesUntil - b.minutesUntil;
  });
  const chosen = allCandidates[0];
  return { ...chosen, isNow: chosen.minutesUntil === 0 };
};

export const formatHHMM = (h: number, m: number): string => {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const formatDurationTR = (minutes: number): string => {
  if (minutes <= 0) return '0 dk';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
};

export const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export const formatLongDate = (d: Date): string => {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${DAY_NAMES[d.getDay()]}`;
};