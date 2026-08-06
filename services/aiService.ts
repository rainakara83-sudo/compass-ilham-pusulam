import { WeeklyIdea, NicheId, pickWeeklyIdeasFromPool, pickRandomFromPool, isWeekend, getNichePool } from './contentService';

const RAW_PROXY_URL =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_AI_PROXY_URL) || '';

const FALLBACK_PROXY_URL = 'https://compassv4fixed3.vercel.app/api/ask';

const PROXY_URL = RAW_PROXY_URL && !RAW_PROXY_URL.includes('YOUR_BACKEND_URL')
  ? RAW_PROXY_URL
  : FALLBACK_PROXY_URL;

export const isAIBackendConfigured = (): boolean => PROXY_URL.length > 0;

const DEFAULT_TIMEOUT_MS = 15000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

let lastCalls: number[] = [];

const withinRateLimit = (): boolean => {
  const now = Date.now();
  lastCalls = lastCalls.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (lastCalls.length >= RATE_LIMIT_MAX) return false;
  lastCalls.push(now);
  return true;
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
};

export type AskParams = {
  niche: NicheId;
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
};

export type AskResult = {
  answer: string;
};

export const askAI = async ({ niche, question, history = [] }: AskParams): Promise<AskResult> => {
  if (!PROXY_URL) {
    return {
      answer:
        'AI bağlantısı yapılandırılmamış. Lütfen .env dosyasına geçerli bir EXPO_PUBLIC_AI_PROXY_URL ekleyin ve uygulamayı yeniden başlatın.',
    };
  }
  if (!withinRateLimit()) {
    return { answer: 'Çok sık istek gönderiyorsun. Lütfen 1 dakika sonra tekrar dene.' };
  }
  try {
    const res = await fetchWithTimeout(
      PROXY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, question, history }),
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      return { answer: `Şu an cevap veremiyorum (HTTP ${res.status}). Lütfen tekrar dene.` };
    }

    const data = await res.json();
    return { answer: data.answer ?? '' };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { answer: 'İstek zaman aşımına uğradı. Backend yanıt vermiyor olabilir.' };
    }
    console.warn('askAI error', e);
    return {
      answer: `Bağlantı hatası: ${e?.message ?? 'bilinmeyen hata'}. Backend URL'sini kontrol edin.`,
    };
  }
};

type PromptVariant = {
  id: string;
  label: string;
  build: (niche: NicheId, original?: string) => Record<string, unknown>;
};

const WEEKLY_PROMPTS: PromptVariant[] = [
  {
    id: 'detailed',
    label: 'Detaylı brief',
    build: (niche) => ({
      task: 'generate_weekly_ideas',
      style: 'detailed',
      niche,
      count: 3,
      locale: 'tr-TR',
    }),
  },
  {
    id: 'short',
    label: 'Kısa brief',
    build: (niche) => ({
      task: 'weekly_ideas',
      niche,
      count: 3,
    }),
  },
  {
    id: 'minimal',
    label: 'Minimal istek',
    build: (niche) => ({
      niche,
      ideas: 3,
    }),
  },
];

const tryOnePrompt = async (variant: PromptVariant, niche: NicheId): Promise<string[] | null> => {
  if (!PROXY_URL) return null;
  if (!withinRateLimit()) return null;
  try {
    const res = await fetchWithTimeout(
      PROXY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variant.build(niche)),
      },
      DEFAULT_TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const ideas = extractIdeas(data);
    return ideas.length > 0 ? ideas : null;
  } catch (e) {
    console.warn(`AI prompt "${variant.id}" başarısız`, e);
    return null;
  }
};

const extractIdeas = (data: unknown): string[] => {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.ideas)) {
    return d.ideas.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  }
  if (Array.isArray(d.suggestions)) {
    return d.suggestions.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  }
  if (typeof d.idea === 'string' && d.idea.trim().length > 0) return [d.idea];
  if (typeof d.text === 'string' && d.text.trim().length > 0) return [d.text];
  return [];
};

export type AIGenerateResult = {
  ideas: WeeklyIdea[];
  usedVariant: 'detailed' | 'short' | 'minimal' | 'fallback' | null;
  fallbackUsed: boolean;
};

export const generateWeeklyIdeasWithAI = async (
  niche: NicheId,
  exclude: string[] = []
): Promise<WeeklyIdea[]> => {
  const result = await generateWeeklyIdeasWithAIResult(niche, exclude);
  return result.ideas;
};

export const generateWeeklyIdeasWithAIResult = async (
  niche: NicheId,
  exclude: string[] = []
): Promise<AIGenerateResult> => {
  for (const variant of WEEKLY_PROMPTS) {
    const ideas = await tryOnePrompt(variant, niche);
    if (ideas && ideas.length > 0) {
      const days: WeeklyIdea['day'][] = isWeekend()
        ? ['monday', 'wednesday', 'friday', 'saturday']
        : ['monday', 'wednesday', 'friday'];
      const filtered = exclude.length > 0 ? ideas.filter((t) => !exclude.includes(t)) : ideas;
      const final = (filtered.length > 0 ? filtered : ideas).slice(0, days.length);
      return {
        ideas: final.map((text, idx) => ({
          day: days[idx] ?? 'monday',
          text,
          source: 'ai' as const,
        })),
        usedVariant: variant.id as 'detailed' | 'short' | 'minimal',
        fallbackUsed: false,
      };
    }
  }
  const fallback = smartPoolFallback(niche, exclude);
  return {
    ideas: fallback,
    usedVariant: 'fallback',
    fallbackUsed: true,
  };
};

const smartPoolFallback = (niche: NicheId, exclude: string[]): WeeklyIdea[] => {
  const base = pickWeeklyIdeasFromPool(niche, isWeekend());
  if (exclude.length === 0) return base;
  const days: WeeklyIdea['day'][] = ['monday', 'wednesday', 'friday', 'saturday'];
  const result: WeeklyIdea[] = [];
  let dayIdx = 0;
  for (const idea of base) {
    if (!exclude.includes(idea.text)) {
      result.push(idea);
      dayIdx += 1;
    }
  }
  if (result.length < base.length) {
    const usedSet = new Set([...exclude, ...result.map((r) => r.text)]);
    while (result.length < base.length) {
      const next = pickRandomFromPool(niche, Array.from(usedSet));
      if (!next) break;
      result.push({ day: days[dayIdx] ?? 'monday', text: next, source: 'pool' });
      usedSet.add(next);
      dayIdx += 1;
    }
  }
  return result;
};

export const getRateLimitInfo = () => {
  const now = Date.now();
  lastCalls = lastCalls.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  return {
    remaining: Math.max(0, RATE_LIMIT_MAX - lastCalls.length),
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  };
};

export const getAIPromptVariants = () => WEEKLY_PROMPTS.map((p) => ({ id: p.id, label: p.label }));

export type IdeaVariantResult = {
  variants: string[];
  usedFallback: boolean;
};

const VARIANT_PROMPTS: PromptVariant[] = [
  {
    id: 'detailed',
    label: 'Detaylı brief',
    build: (niche, original) => ({
      task: 'generate_idea_variants',
      style: 'detailed',
      niche,
      original,
      count: 3,
      locale: 'tr-TR',
    }),
  },
  {
    id: 'short',
    label: 'Kısa brief',
    build: (niche, original) => ({
      task: 'idea_variants',
      niche,
      original,
      count: 3,
    }),
  },
  {
    id: 'minimal',
    label: 'Minimal istek',
    build: (niche, original) => ({
      niche,
      rephrase: original,
      variants: 3,
    }),
  },
];

const tryVariantPrompt = async (variant: PromptVariant, niche: NicheId, original: string): Promise<string[] | null> => {
  if (!PROXY_URL) return null;
  if (!withinRateLimit()) return null;
  try {
    const res = await fetchWithTimeout(
      PROXY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variant.build(niche, original)),
      },
      DEFAULT_TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const ideas = extractIdeas(data);
    return ideas.length > 0 ? ideas : null;
  } catch (e) {
    console.warn(`Variant prompt "${variant.id}" başarısız`, e);
    return null;
  }
};

const localVariantFallback = (original: string, niche: NicheId): string[] => {
  const pool = getNichePool(niche).filter((p) => p !== original);
  const out: string[] = [];
  for (let i = 0; i < pool.length && out.length < 3; i++) {
    out.push(pool[i]);
  }
  while (out.length < 3) {
    out.push(`${original} (varyasyon ${out.length + 1})`);
  }
  return out;
};

export const generateIdeaVariants = async (niche: NicheId, original: string): Promise<IdeaVariantResult> => {
  const clean = original.trim();
  if (clean.length === 0) return { variants: [], usedFallback: true };
  for (const variant of VARIANT_PROMPTS) {
    const ideas = await tryVariantPrompt(variant, niche, clean);
    if (ideas && ideas.length > 0) {
      const dedup = ideas.filter((v) => v !== clean).slice(0, 3);
      if (dedup.length === 0) continue;
      return { variants: dedup, usedFallback: false };
    }
  }
  return { variants: localVariantFallback(clean, niche), usedFallback: true };
};

export type HashtagCategory = 'genel' | 'nis' | 'uzun' | 'trend';

export type HashtagItem = {
  tag: string;
  category: HashtagCategory;
};

export type HashtagResult = {
  hashtags: HashtagItem[];
  usedFallback: boolean;
};

const HASHTAG_PROMPTS: PromptVariant[] = [
  {
    id: 'detailed',
    label: 'Detaylı brief',
    build: (niche, original) => ({
      task: 'generate_hashtags',
      style: 'detailed',
      niche,
      original,
      count: 15,
      locale: 'tr-TR',
    }),
  },
  {
    id: 'short',
    label: 'Kısa brief',
    build: (niche, original) => ({
      task: 'hashtags',
      niche,
      original,
      count: 15,
    }),
  },
  {
    id: 'minimal',
    label: 'Minimal istek',
    build: (niche, original) => ({
      niche,
      hashtags_for: original,
      count: 15,
    }),
  },
];

const tryHashtagPrompt = async (variant: PromptVariant, niche: NicheId, original: string): Promise<HashtagItem[] | null> => {
  if (!PROXY_URL) return null;
  if (!withinRateLimit()) return null;
  try {
    const res = await fetchWithTimeout(
      PROXY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variant.build(niche, original)),
      },
      DEFAULT_TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    return extractHashtags(data);
  } catch (e) {
    console.warn(`Hashtag prompt "${variant.id}" başarısız`, e);
    return null;
  }
};

const extractHashtags = (data: unknown): HashtagItem[] => {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const candidates: unknown[] = [];
  if (Array.isArray(d.hashtags)) candidates.push(...d.hashtags);
  if (Array.isArray(d.tags)) candidates.push(...d.tags);
  const out: HashtagItem[] = [];
  for (const item of candidates) {
    if (typeof item === 'string') {
      const clean = normalizeTag(item);
      if (clean) out.push({ tag: clean, category: categorize(clean) });
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const raw = typeof obj.tag === 'string' ? obj.tag : typeof obj.text === 'string' ? obj.text : '';
      const clean = normalizeTag(raw);
      if (clean) {
        const cat = typeof obj.category === 'string' && ['genel', 'nis', 'uzun', 'trend'].includes(obj.category)
          ? (obj.category as HashtagCategory)
          : categorize(clean);
        out.push({ tag: clean, category: cat });
      }
    }
  }
  return out;
};

export const normalizeTag = (raw: string): string => {
  let t = raw.trim().replace(/^[#@]+/, '');
  if (t.length === 0) return '';
  if (!/^[A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]+$/.test(t)) {
    t = t.replace(/[^A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]/g, '');
  }
  return t.toLowerCase();
};

export const categorize = (tag: string): HashtagCategory => {
  if (tag.length >= 14) return 'uzun';
  if (['trend', 'kesfet', 'keşfet', 'viral', 'populer', 'tiktok', 'reels', 'instareels', 'turkiye', 'türkiye'].includes(tag)) return 'trend';
  if (['icerik', 'içerik', 'icerikuretici', 'sosyalmedya', 'etkilesim', 'icerikfikir', 'marka', 'girisimcilik', 'girişimcilik', 'başarı', 'basari', 'üretici', 'uretici'].includes(tag)) return 'genel';
  return 'nis';
};

const localHashtagFallback = (original: string, niche: NicheId): HashtagItem[] => {
  const tokens = original
    .toLowerCase()
    .replace(/[^\wığüşöç\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['için', 'olarak', 'gibi', 'üzerine', 'hakkında', 'kısa', 'uzun', 'yeni'].includes(w))
    .slice(0, 5);
  const nicheSlug = niche.replace(/_/g, '');
  const general: string[] = [
    `${nicheSlug}`,
    'icerikuretici',
    'icerikfikir',
    'sosyalmedya',
    'etkilesim',
    'reels',
    'instareels',
    'kesfet',
    'trend',
    'turkiye',
    'marka',
    'girisimcilik',
    'icerik',
    'uretici',
  ];
  const longTail = ['türkçeicerik', 'haftalıkiçerik', 'sosyalmedyaipucu', 'icerikureticitips'];
  const out: HashtagItem[] = [];
  for (const t of tokens) {
    const c = normalizeTag(t);
    if (c && !out.some((o) => o.tag === c)) out.push({ tag: c, category: 'uzun' });
  }
  for (const g of general) {
    const c = normalizeTag(g);
    if (c && !out.some((o) => o.tag === c)) out.push({ tag: c, category: categorize(c) });
  }
  for (const l of longTail) {
    if (!out.some((o) => o.tag === l)) out.push({ tag: l, category: 'uzun' });
  }
  return out.slice(0, 15);
};

export const generateHashtags = async (niche: NicheId, original: string): Promise<HashtagResult> => {
  const clean = original.trim();
  if (clean.length === 0) return { hashtags: [], usedFallback: true };
  for (const variant of HASHTAG_PROMPTS) {
    const items = await tryHashtagPrompt(variant, niche, clean);
    if (items && items.length > 0) {
      const seen = new Set<string>();
      const dedup: HashtagItem[] = [];
      for (const it of items) {
        if (!seen.has(it.tag)) {
          seen.add(it.tag);
          dedup.push(it);
        }
        if (dedup.length >= 15) break;
      }
      if (dedup.length === 0) continue;
      return { hashtags: dedup, usedFallback: false };
    }
  }
  return { hashtags: localHashtagFallback(clean, niche), usedFallback: true };
};

export const HASHTAG_CATEGORY_META: Record<HashtagCategory, { icon: string; label: string; color: string }> = {
  genel: { icon: '🌐', label: 'Genel', color: '#4D96FF' },
  nis: { icon: '🎯', label: 'Niş', color: '#8B5CF6' },
  uzun: { icon: '📏', label: 'Uzun kuyruk', color: '#10B981' },
  trend: { icon: '🔥', label: 'Trend', color: '#EF4444' },
};