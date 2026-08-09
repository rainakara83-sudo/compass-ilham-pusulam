import nichesData from '../data/niches.json';
import { NicheId } from './contentService';

type NicheWithPrompts = { id: NicheId; aiPrompts?: string[] };
const NICHES = nichesData as NicheWithPrompts[];

const RECENT_KEY_PREFIX = '@content-coach/recent-';
const RECENT_MAX = 5;

const recentCache: Partial<Record<string, string[]>> = {};

const loadRecent = (niche: NicheId): string[] => {
  if (recentCache[niche]) return recentCache[niche]!;
  return [];
};

const pushRecent = (niche: NicheId, idea: string): void => {
  const list = loadRecent(niche);
  const next = [idea, ...list.filter((x) => x !== idea)].slice(0, RECENT_MAX);
  recentCache[niche] = next;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(RECENT_KEY_PREFIX + niche, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
};

const loadRecentFromStorage = (niche: NicheId): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY_PREFIX + niche);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        recentCache[niche] = parsed.slice(0, RECENT_MAX);
      }
    }
  } catch {
    // ignore
  }
};

export const initSmartPoolHistory = (): void => {
  for (const n of NICHES) {
    loadRecentFromStorage(n.id);
  }
};

const getPool = (niche: NicheId): string[] => {
  const n = NICHES.find((x) => x.id === niche);
  if (!n || !Array.isArray(n.aiPrompts) || n.aiPrompts.length === 0) {
    return [];
  }
  return n.aiPrompts;
};

const pickRandom = (pool: string[], exclude: string[]): string | null => {
  const candidates = pool.filter((p) => !exclude.includes(p));
  if (candidates.length === 0) return null;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
};

export type SmartPoolTask = 'idea' | 'hashtag' | 'qa' | 'variant';

export const getSmartPoolIdea = (
  niche: NicheId,
  task: SmartPoolTask = 'idea',
  extra?: string
): string => {
  const pool = getPool(niche);
  if (pool.length === 0) {
    return 'Yakında güzel bir fikirle döneceğim 🌱';
  }
  let recent = loadRecent(niche);
  if (recent.length === 0) loadRecentFromStorage(niche);
  recent = loadRecent(niche);

  let pick = pickRandom(pool, recent);
  if (!pick) {
    pick = pool[Math.floor(Math.random() * pool.length)];
  }
  pushRecent(niche, pick);
  return pick;
};

export const getSmartPoolVariants = (niche: NicheId, original: string, count = 3): string[] => {
  const pool = getPool(niche);
  if (pool.length === 0) return [];
  const filtered = pool.filter((p) => p !== original);
  const out: string[] = [];
  for (let i = 0; i < count && i < filtered.length; i++) {
    const idx = Math.floor(Math.random() * filtered.length);
    const candidate = filtered[idx];
    if (!out.includes(candidate)) out.push(candidate);
    filtered.splice(idx, 1);
  }
  return out;
};

export const getSmartPoolResponse = (niche: NicheId, question: string): string => {
  const pool = getPool(niche);
  if (pool.length === 0) return 'Şu an cevap veremiyorum, ama yeni fikirlerle döneceğim 🌿';
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return `🌟 ${pick}`;
};
