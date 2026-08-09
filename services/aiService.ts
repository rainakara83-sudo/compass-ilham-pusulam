import { WeeklyIdea, NicheId, pickWeeklyIdeasFromPool, isWeekend, getNichePool } from './contentService';
import { getSmartPoolIdea, getSmartPoolVariants, getSmartPoolResponse, SmartPoolTask } from './smartPoolService';
import { callClaudeDirect, callClaudeDirectRetry, isDirectAIConfigured, DirectLang } from './directAIService';
import i18n from '../i18n';

const currentLang = (): DirectLang => {
  const l = (i18n.language || 'en').split('-')[0];
  if (l === 'tr' || l === 'en' || l === 'es' || l === 'de' || l === 'fr') return l;
  return 'en';
};

export const isPoolFallbackAvailable = (): boolean => currentLang() === 'tr';

export type CallAIResult = {
  source: 'ai' | 'pool' | 'failed';
  text: string;
  usedFallback: boolean;
};

export const callAI = async (
  task: SmartPoolTask,
  niche: NicheId,
  lang?: DirectLang,
  extra?: string
): Promise<CallAIResult> => {
  const lng = lang ?? currentLang();
  try {
    const text = await callClaudeDirectRetry(task as any, niche, lng, extra, 2);
    return { source: 'ai', text, usedFallback: false };
  } catch (e: any) {
    console.error('=== CALL AI FALLBACK ===');
    console.error('Direct AI failed:', e?.message);
    console.warn('Falling back to smart pool');
    if (lng === 'tr') {
      return { source: 'pool', text: getSmartPoolIdea(niche, task, extra), usedFallback: true };
    }
    return { source: 'failed', text: '', usedFallback: false };
  }
};

export type WeekIdeaResult = {
  ideas: WeeklyIdea[];
  usedVariant: 'ai' | 'pool';
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
): Promise<WeekIdeaResult> => {
  if (isDirectAIConfigured()) {
    try {
      const lng = currentLang();
      const raw = await callClaudeDirectRetry('generate_weekly_ideas', niche, lng, undefined, 2);
      const lines = raw
        .split('\n')
        .map((l) => l.replace(/^[\s\-\d\.\)\*]+/, '').trim())
        .filter((l) => l.length > 8)
        .slice(0, 5);
      const fallbackPool = lines.length >= 3 ? lines : [];
      const pool = fallbackPool.length > 0 ? fallbackPool : getNichePool(niche);
      const recent = exclude.slice(0, 5);
      const usedSet = new Set(recent);
      const out: string[] = [];
      const poolCopy = [...pool];
      while (out.length < 5 && poolCopy.length > 0) {
        const idx = Math.floor(Math.random() * poolCopy.length);
        const candidate = poolCopy[idx];
        poolCopy.splice(idx, 1);
        if (!usedSet.has(candidate)) out.push(candidate);
      }
      if (out.length < 5) {
        const remaining = (fallbackPool.length > 0 ? fallbackPool : getNichePool(niche)).filter((p) => !out.includes(p));
        while (out.length < 5 && remaining.length > 0) {
          const idx = Math.floor(Math.random() * remaining.length);
          out.push(remaining[idx]);
          remaining.splice(idx, 1);
        }
      }
      const days: WeeklyIdea['day'][] = isWeekend()
        ? ['monday', 'wednesday', 'friday', 'saturday']
        : ['monday', 'wednesday', 'friday', 'saturday'];
      return {
        ideas: out.slice(0, days.length).map((text, idx) => ({
          day: days[idx] ?? 'monday',
          text,
          source: 'ai' as const,
        })),
        usedVariant: 'ai',
        fallbackUsed: false,
      };
    } catch (e: any) {
      console.error('=== CALL AI FALLBACK ===');
      console.error('Direct AI weekly ideas failed:', e?.message);
      console.warn('Falling back to smart pool');
    }
  }

  if (currentLang() !== 'tr') {
    const days: WeeklyIdea['day'][] = isWeekend()
      ? ['monday', 'wednesday', 'friday', 'saturday']
      : ['monday', 'wednesday', 'friday', 'saturday'];
    return {
      ideas: days.map((d) => ({ day: d, text: '', source: 'ai' as const })),
      usedVariant: 'pool',
      fallbackUsed: true,
    };
  }

  const pool = getNichePool(niche);
  const recent = exclude.slice(0, 5);
  const usedSet = new Set(recent);
  const out: string[] = [];
  const poolCopy = [...pool];
  while (out.length < 5 && poolCopy.length > 0) {
    const idx = Math.floor(Math.random() * poolCopy.length);
    const candidate = poolCopy[idx];
    poolCopy.splice(idx, 1);
    if (!usedSet.has(candidate)) out.push(candidate);
  }
  const days: WeeklyIdea['day'][] = isWeekend()
    ? ['monday', 'wednesday', 'friday', 'saturday']
    : ['monday', 'wednesday', 'friday', 'saturday'];
  return {
    ideas: out.slice(0, days.length).map((text, idx) => ({
      day: days[idx] ?? 'monday',
      text,
      source: 'ai' as const,
    })),
    usedVariant: 'pool',
    fallbackUsed: false,
  };
};

export type IdeaVariantResult = {
  variants: string[];
  usedFallback: boolean;
};

export const generateIdeaVariants = async (
  niche: NicheId,
  original: string
): Promise<IdeaVariantResult> => {
  const clean = original.trim();
  if (clean.length === 0) return { variants: [], usedFallback: true };
  if (isDirectAIConfigured()) {
    try {
      const lng = currentLang();
      const raw = await callClaudeDirectRetry('variants', niche, lng, clean, 2);
      const lines = raw
        .split('\n')
        .map((l) => l.replace(/^[\s\-\d\.\)\*]+/, '').trim())
        .filter((l) => l.length > 8 && l !== clean)
        .slice(0, 3);
      if (lines.length > 0) return { variants: lines, usedFallback: false };
    } catch (e: any) {
      console.error('=== CALL AI FALLBACK ===');
      console.error('Direct AI variants failed:', e?.message);
      console.warn('Falling back to smart pool');
    }
  }
  if (currentLang() !== 'tr') {
    return { variants: [], usedFallback: true };
  }
  const variants = getSmartPoolVariants(niche, clean, 3);
  if (variants.length === 0) {
    return { variants: [`${clean} (varyasyon)`, `${clean} (alternatif)`, `${clean} (yorum)`], usedFallback: true };
  }
  return { variants, usedFallback: false };
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

const localeHashtagsTr: Record<NicheId, string[]> = {
  fitness: ['fitness', 'fitnessmotivation', 'workout', 'gym', 'saglikliyasam', 'spor', 'evdetrainman', 'mobilite', 'kardiyo', 'yoga', 'protein', 'kas', 'fitkadin', 'fitbaba', 'vucutgelistirme', 'fonksiyonelantrenman', 'sagliklibeslenme', 'kilo', 'stretching', 'gundelikrutin'],
  food: ['yemek', 'tarif', 'lezzet', 'mutfak', 'pratikyemek', 'kolaytarif', 'kahvalti', 'evdeyemek', 'tatlitarifleri', 'sagliklibeslenme', 'vegan', 'glutensiz', 'gurme', 'restorankultur', 'iftar', 'pratik', 'pratikmenu', 'tatli', 'corba', 'salata', 'fitmenu'],
  tech: ['teknoloji', 'yazilim', 'yapayzeka', 'ai', 'kodlama', 'javascript', 'python', 'webgelistirme', 'mobiluygulama', 'cloud', 'siber', 'startup', 'apple', 'android', 'bilgisayar', 'donanim', 'iot', 'blockchain', 'veribilimi', 'kod'],
  fashion: ['moda', 'stil', 'kombin', 'kombinönerileri', 'trend', 'kıyafet', 'aksesuar', 'modadunyasi', 'streetstyle', 'ootd', 'vintage', 'modedernegi', 'kişiselstil', 'capsulewardrobe', 'basic', 'yazmodasi', 'kismodasi', 'sonbaharstil', 'baharstil', 'elbise'],
  travel: ['seyahat', 'gezi', 'tatil', 'seyahatnotlari', 'gezgin', 'backpacker', 'rota', 'tatilrotalari', 'dunyanin', 'kulturelseyahat', 'dogayeri', 'kamp', 'plaj', 'kayak', 'dalis', 'adventure', 'roadtrip', 'turkiyegezisi', 'avruparotasi', 'uzaktoluyuz', 'rotaönerileri'],
  gaming: ['oyun', 'gaming', 'yayinci', 'streamer', 'twitch', 'youtube', 'espor', 'valorant', 'lol', 'csgo', 'cs2', 'pubg', 'minecraft', 'roblox', 'konsol', 'playstation', 'xbox', 'nintendo', 'oyuninceleme', 'gamergirl'],
  personal_dev: ['kisigelisim', 'uretkenlik', 'alışkanlık', 'kitap', 'kitapönerileri', 'motivasyon', 'hedef', 'rutin', 'sabahrutini', 'hayat', 'vizyon', 'zihniyet', 'mindset', 'notdefteri', 'planlama', 'zamanayönetimi', 'derinodak', 'flow', 'kisiselgelisim', 'disiplin', 'okumalar'],
  beauty: ['makyaj', 'ciltbakim', 'sacbakim', 'guzellik', 'kozmetik', 'cilt', 'nemlendirici', 'serum', 'fondöten', 'maskara', 'ruj', 'gunesbakimi', 'akne', 'dermatoloji', 'skincare', 'makeup', 'guzellikrutin', 'ciltbakimrutini', 'dogalkozmetik', 'kendinyap'],
  astrology: ['astroloji', 'burç', 'burçyorumu', 'yükselen', 'ayburcu', 'venüs', 'mars', 'merkur', 'satürn', 'karmik', 'tarot', 'ruh', 'enerji', 'gezegen', 'burçuyumlusu', 'günlukburç', 'haftalıkburç', 'ayburcuyorumu', 'astroloji', 'dogumharitasi'],
};

const localeHashtagsEn: Record<NicheId, string[]> = {
  fitness: ['fitness', 'fitnessmotivation', 'workout', 'gym', 'healthylifestyle', 'sport', 'homeworkout', 'mobility', 'cardio', 'yoga', 'protein', 'muscle', 'fitfam', 'bodybuilding', 'functionalfitness', 'nutrition', 'weightloss', 'stretching', 'dailyroutine'],
  food: ['food', 'recipe', 'cooking', 'kitchen', 'easyrecipe', 'quickmeal', 'breakfast', 'homecooking', 'dessert', 'healthyeating', 'vegan', 'glutenfree', 'gourmet', 'foodie', 'mealprep', 'tasty', 'soup', 'salad', 'fitfood'],
  tech: ['technology', 'software', 'ai', 'coding', 'javascript', 'python', 'webdev', 'mobileapp', 'cloud', 'cyber', 'startup', 'apple', 'android', 'computer', 'hardware', 'iot', 'blockchain', 'datascience', 'code'],
  fashion: ['fashion', 'style', 'outfit', 'ootd', 'trend', 'clothing', 'accessories', 'streetstyle', 'vintage', 'minimalist', 'capsulewardrobe', 'basics', 'summerstyle', 'winterstyle', 'autumnstyle', 'springstyle', 'dress'],
  travel: ['travel', 'trip', 'vacation', 'travelgram', 'wanderlust', 'backpacker', 'route', 'adventure', 'explore', 'culturaltravel', 'nature', 'camping', 'beach', 'ski', 'diving', 'roadtrip', 'europetravel', 'hiddengems'],
  gaming: ['gaming', 'gamer', 'streamer', 'twitch', 'youtube', 'esports', 'valorant', 'lol', 'csgo', 'cs2', 'pubg', 'minecraft', 'roblox', 'console', 'playstation', 'xbox', 'nintendo', 'gamereview', 'gamergirl'],
  personal_dev: ['personaldevelopment', 'productivity', 'habit', 'book', 'bookrecommendation', 'motivation', 'goal', 'routine', 'morningroutine', 'life', 'vision', 'mindset', 'journal', 'planning', 'timemanagement', 'deepwork', 'flow', 'discipline', 'reading'],
  beauty: ['makeup', 'skincare', 'haircare', 'beauty', 'cosmetics', 'skin', 'moisturizer', 'serum', 'foundation', 'mascara', 'lipstick', 'sunscreen', 'acne', 'dermatology', 'naturalbeauty', 'diy'],
  astrology: ['astrology', 'zodiac', 'horoscope', 'rising', 'moon', 'venus', 'mars', 'mercury', 'saturn', 'karmic', 'tarot', 'spirit', 'energy', 'planet', 'compatibility', 'dailyhoroscope', 'weeklyhoroscope', 'birthchart'],
};

const localeHashtags: Record<DirectLang, Record<NicheId, string[]>> = {
  tr: localeHashtagsTr,
  en: localeHashtagsEn,
  es: localeHashtagsEn,
  de: localeHashtagsEn,
  fr: localeHashtagsEn,
};

export const generateHashtags = async (
  niche: NicheId,
  original: string
): Promise<HashtagResult> => {
  const clean = original.trim();
  if (clean.length === 0) return { hashtags: [], usedFallback: true };
  if (isDirectAIConfigured()) {
    try {
      const lng = currentLang();
      const raw = await callClaudeDirectRetry('hashtags', niche, lng, clean, 2);
      const tokens = raw
        .split(/[\s,\n]+/)
        .map((t) => t.replace(/^[#@]+/, '').trim())
        .filter((t) => t.length >= 3)
        .slice(0, 15);
      const items: HashtagItem[] = [];
      for (const t of tokens) {
        const c = normalizeTag(t);
        if (c) items.push({ tag: c, category: categorize(c) });
        if (items.length >= 15) break;
      }
      if (items.length > 0) return { hashtags: items, usedFallback: false };
    } catch (e: any) {
      console.error('=== CALL AI FALLBACK ===');
      console.error('Direct AI hashtags failed:', e?.message);
      console.warn('Falling back to smart pool');
    }
  }
  const tokens = clean
    .toLowerCase()
    .replace(/[^\wığüşöç\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const general: string[] = [
    'icerikuretici', 'icerikfikir', 'sosyalmedya', 'etkilesim', 'reels', 'instareels',
    'kesfet', 'trend', 'turkiye', 'marka', 'girisimcilik', 'icerik', 'uretici',
  ];
  const longTail = ['türkçeicerik', 'haftalıkiçerik', 'sosyalmedyaipucu', 'icerikureticitips'];
  const set = new Set<string>();
  const out: HashtagItem[] = [];
  for (const t of tokens) {
    const c = normalizeTag(t);
    if (c && !set.has(c)) {
      set.add(c);
      out.push({ tag: c, category: 'uzun' });
    }
  }
  for (const g of general) {
    const c = normalizeTag(g);
    if (c && !set.has(c)) {
      set.add(c);
      out.push({ tag: c, category: categorize(c) });
    }
  }
  const localeList = localeHashtags[currentLang()][niche] ?? [];
  for (const l of localeList) {
    const c = normalizeTag(l);
    if (c && !set.has(c)) {
      set.add(c);
      out.push({ tag: c, category: categorize(c) });
    }
  }
  for (const l of longTail) {
    if (!set.has(l)) {
      set.add(l);
      out.push({ tag: l, category: 'uzun' });
    }
  }
  return { hashtags: out.slice(0, 15), usedFallback: false };
};

export const HASHTAG_CATEGORY_META: Record<HashtagCategory, { icon: string; label: { tr: string; en: string; es: string; de: string; fr: string }; color: string }> = {
  genel: { icon: '🌐', label: { tr: 'Genel', en: 'General', es: 'General', de: 'Allgemein', fr: 'Général' }, color: '#4D96FF' },
  nis: { icon: '🎯', label: { tr: 'Niş', en: 'Niche', es: 'Nicho', de: 'Nische', fr: 'Niche' }, color: '#8B5CF6' },
  uzun: { icon: '📏', label: { tr: 'Uzun kuyruk', en: 'Long tail', es: 'Cola larga', de: 'Long Tail', fr: 'Longue traîne' }, color: '#10B981' },
  trend: { icon: '🔥', label: { tr: 'Trend', en: 'Trend', es: 'Tendencia', de: 'Trend', fr: 'Tendance' }, color: '#EF4444' },
};

export type AskParams = {
  niche: NicheId;
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
};

export type AskResult = {
  answer: string;
};

export const askAI = async ({
  niche,
  question,
  history = [],
}: AskParams): Promise<AskResult> => {
  if (isDirectAIConfigured()) {
    try {
      const lng = currentLang();
      const lastUser = history.filter((h) => h.role === 'user').slice(-1)[0]?.content;
      const ctx = lastUser
        ? `${niche} nişi. Önceki konuşma — Kullanıcı: ${lastUser}. Yeni soru: ${question}`
        : `${niche} nişi. Soru: ${question}`;
      const text = await callClaudeDirectRetry('qa', niche, lng, ctx, 2);
      return { answer: text || 'Cevap alınamadı.' };
    } catch (e: any) {
      console.error('=== CALL AI FALLBACK ===');
      console.error('Direct AI askAI failed:', e?.message);
      console.warn('Falling back to smart pool');
    }
  }
  if (currentLang() !== 'tr') {
    return { answer: '' };
  }
  const lastUser = history.filter((h) => h.role === 'user').slice(-1)[0]?.content;
  const prompt = (lastUser ? `${lastUser} → ${question}` : question).trim();
  const answer = getSmartPoolResponse(niche, prompt);
  return { answer };
};

export const isAIBackendConfigured = (): boolean => isDirectAIConfigured();
export const getRateLimitInfo = () => ({ remaining: 0, limit: 0, windowMs: 0 });
export const getAIPromptVariants = () => [] as { id: string; label: string }[];
