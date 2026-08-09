import contentPool from '../data/content-pool.json';
import i18n from '../i18n';
import { SupportedLng } from '../i18n';
import { getNicheIdeas as getNicheIdeasI18n } from '../data/niche-ideas-i18n';

export type NicheId = keyof typeof contentPool;

export type WeeklyIdea = {
  day: 'monday' | 'wednesday' | 'friday' | 'saturday';
  text: string;
  source: 'pool' | 'ai';
};

const ALL_IDEAS: Record<NicheId, string[]> = contentPool as Record<NicheId, string[]>;

const getCurrentLang = (lang?: SupportedLng): SupportedLng => {
  if (lang) return lang;
  const cur = (i18n.language || 'en').split('-')[0];
  if (cur === 'tr' || cur === 'en' || cur === 'es' || cur === 'de' || cur === 'fr') return cur;
  return 'en';
};

const getPoolForLang = (niche: NicheId, lang?: SupportedLng): string[] => {
  const lng = getCurrentLang(lang);
  if (lng === 'tr') return ALL_IDEAS[niche] ?? [];
  const localized = getNicheIdeasI18n(niche, lng);
  return localized.length > 0 ? localized : (ALL_IDEAS[niche] ?? []);
};

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

export const pickWeeklyIdeasFromPool = (niche: NicheId, weekend: boolean = isWeekend(), lang?: SupportedLng): WeeklyIdea[] => {
  const pool = getPoolForLang(niche, lang);
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

export const getNichePool = (niche: NicheId, lang?: SupportedLng): string[] => {
  return getPoolForLang(niche, lang);
};

export const searchNichePool = (niche: NicheId, query: string, lang?: SupportedLng): string[] => {
  const pool = getPoolForLang(niche, lang);
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  return pool.filter((idea) => idea.toLowerCase().includes(q));
};

export const pickRandomFromPool = (niche: NicheId, exclude: string[] = [], lang?: SupportedLng): string | null => {
  const pool = getPoolForLang(niche, lang).filter((idea) => !exclude.includes(idea));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
};

// ============ Best Posting Time Engine ============
export type SlotLabel = 'morning' | 'noon' | 'evening' | 'night';

export type TimeSlot = {
  start: number; // 0-23 hour
  end: number;   // 0-23 hour
  label: SlotLabel;
  weight: number; // 1-10
};

export const TIME_SLOTS: TimeSlot[] = [
  { start: 6,  end: 12, label: 'morning', weight: 5 },
  { start: 12, end: 18, label: 'noon',    weight: 5 },
  { start: 18, end: 24, label: 'evening', weight: 5 },
  { start: 0,  end: 6,  label: 'night',   weight: 5 },
];

export const NICHE_TIME_WEIGHTS: Record<NicheId, { morning: number; noon: number; evening: number; night: number }> = {
  fitness:       { morning: 9, noon: 7, evening: 10, night: 4 },
  food:          { morning: 7, noon: 10, evening: 9, night: 3 },
  tech:          { morning: 9, noon: 7, evening: 8, night: 5 },
  fashion:       { morning: 6, noon: 10, evening: 10, night: 5 },
  travel:        { morning: 8, noon: 7, evening: 9, night: 5 },
  gaming:        { morning: 5, noon: 8, evening: 10, night: 9 },
  personal_dev:  { morning: 10, noon: 7, evening: 8, night: 6 },
  beauty:        { morning: 7, noon: 8, evening: 10, night: 4 },
  astrology:     { morning: 8, noon: 6, evening: 10, night: 9 },
};

export const NICHE_TIME_BOOST: Record<NicheId, TimeSlot[]> = (() => {
  const out: Record<NicheId, TimeSlot[]> = {} as Record<NicheId, TimeSlot[]>;
  (Object.keys(NICHE_TIME_WEIGHTS) as NicheId[]).forEach((id) => {
    const w = NICHE_TIME_WEIGHTS[id];
    out[id] = TIME_SLOTS.map((s) => ({ ...s, weight: w[s.label] }));
  });
  return out;
})();

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
    const startMin = slot.start * 60;
    const endMin = slot.end === 24 ? 24 * 60 : slot.end * 60;
    for (let m = startMin; m < endMin; m += 15) {
      const diff = m - currentMinutes;
      const adjusted = diff < 0 ? diff + 24 * 60 : diff;
      allCandidates.push({ hour: Math.floor(m / 60), minute: m % 60, slot, minutesUntil: adjusted });
    }
  }
  if (allCandidates.length === 0) {
    const def: TimeSlot = { start: 18, end: 24, label: 'evening', weight: 5 };
    return { hour: 19, minute: 0, slot: def, minutesUntil: 60, isNow: false };
  }
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

export const formatDuration = (minutes: number): string => {
  if (minutes <= 0) return `0 ${i18n.t('home.minuteShort')}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return i18n.t('home.durationMin', { m });
  if (m === 0) return i18n.t('home.durationHrs', { h });
  return i18n.t('home.durationHrsMin', { h, m });
};

export const formatLongDate = (d: Date): string => {
  const lng = (i18n.language || 'en').split('-')[0];
  try {
    return new Intl.DateTimeFormat(lng, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    }).format(d);
  } catch {
    return d.toDateString();
  }
};
