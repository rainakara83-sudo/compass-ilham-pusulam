// Vercel Serverless Function — AI proxy for Compass
// Endpoint: /api/ask
// Body: { niche, question?, history?, task? }

type VercelRequest = {
  method?: string;
  body: any;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

type AskBody = {
  niche?: string;
  question?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  task?: string;
  count?: number;
  original?: string;
  rephrase?: string;
  variants?: number;
  hashtags_for?: string;
  style?: string;
  locale?: string;
  ideas?: number;
};

const SYSTEM_PROMPT = `Sen Compass — İlham Pusulam için çalışan bir içerik koçusun. Kullanıcı bir niş (fitness, yemek, teknoloji, moda, seyahat, oyun, kişisel gelişim, güzellik, astroloji vb.) seçti.
- Cevaplarını Türkçe, kısa, uygulanabilir ve net yaz.
- Soruya somut örnekler ver (başlık, hook, hashtag).
- Emoji yerine sade, profesyonel bir dil kullan.

Görevler:
1. task=generate_weekly_ideas (veya weekly_ideas / ideas): Nişe uygun 3 özgün, ilgi çekici, uygulanabilir içerik fikri üret. Yalnızca JSON { "ideas": ["...", "...", "..."] } döndür.
2. task=generate_idea_variants (veya idea_variants / rephrase): Verilen fikrin 3 farklı, daha çarpıcı versiyonunu üret. Yalnızca JSON { "ideas": ["...", "...", "..."] } döndür.
3. task=generate_hashtags (veya hashtags): 15 Türkçe hashtag üret, nişle alakalı, kategorilere ayrılmış. Yalnızca JSON { "hashtags": [{"tag":"...","category":"nis|trend|genel|uzun"}, ...] } döndür.
4. Diğer durumlarda (qa): Kullanıcının sorusuna içerik koçu gibi kısa, uygulanabilir cevap ver.`;

const VALID_NICHES = new Set([
  'fitness',
  'food',
  'tech',
  'fashion',
  'travel',
  'gaming',
  'personal_dev',
  'beauty',
  'astrology',
]);

const safeNiche = (n?: string): string => {
  if (!n) return 'general';
  return VALID_NICHES.has(n) ? n : 'general';
};

const extractJson = (text: string): any => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        // fallthrough
      }
    }
    const objMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // fallthrough
      }
    }
    return null;
  }
};

const extractText = (data: any): string => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block && typeof block.text === 'string') return block.text;
    }
  }
  if (typeof data.text === 'string') return data.text;
  if (Array.isArray(data)) {
    return data
      .map((b: any) => (typeof b === 'string' ? b : b?.text ?? ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
};

const callAnthropic = async (
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> => {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`Anthropic ${r.status}: ${errText.slice(0, 200)}`);
  }
  const data = await r.json();
  return extractText(data);
};

const extractIdeas = (parsed: any): string[] => {
  if (!parsed) return [];
  if (Array.isArray(parsed.ideas)) {
    return parsed.ideas.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0);
  }
  if (Array.isArray(parsed.suggestions)) {
    return parsed.suggestions.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0);
  }
  return [];
};

const extractHashtags = (parsed: any): { tag: string; category: string }[] => {
  if (!parsed) return [];
  const candidates: any[] = [];
  if (Array.isArray(parsed.hashtags)) candidates.push(...parsed.hashtags);
  if (Array.isArray(parsed.tags)) candidates.push(...parsed.tags);
  const out: { tag: string; category: string }[] = [];
  for (const item of candidates) {
    if (typeof item === 'string') {
      const clean = item.replace(/^[#@]+/, '').trim();
      if (clean) out.push({ tag: clean.toLowerCase(), category: 'nis' });
    } else if (item && typeof item === 'object') {
      const raw = typeof item.tag === 'string' ? item.tag : typeof item.text === 'string' ? item.text : '';
      const clean = raw.replace(/^[#@]+/, '').trim();
      if (clean) {
        const cat = ['nis', 'trend', 'genel', 'uzun'].includes(item.category) ? item.category : 'nis';
        out.push({ tag: clean.toLowerCase(), category: cat });
      }
    }
  }
  return out;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    return res.status(204).end();
  }

  const body = ((req.body || {}) as AskBody) || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'api_key_missing', message: 'ANTHROPIC_API_KEY env variable is not set on the server.' });
  }

  const niche = safeNiche(body.niche);
  const task = (body.task || '').toLowerCase();

  try {
    if (
      task === 'generate_weekly_ideas' ||
      task === 'weekly_ideas' ||
      task === 'ideas' ||
      (!task && !body.question)
    ) {
      const userMsg = `Niche: ${niche}. 3 adet özgün, uygulanabilir, Türkçe içerik fikri üret. Yalnızca JSON: { "ideas": ["...", "...", "..."] }`;
      const text = await callAnthropic(apiKey, SYSTEM_PROMPT, userMsg, 800);
      const parsed = extractJson(text);
      let ideas = extractIdeas(parsed);
      if (ideas.length === 0) {
        ideas = text
          .split('\n')
          .map((l) => l.replace(/^[\s\-\d\.\)\*]+/, '').trim())
          .filter((l) => l.length > 8 && !l.startsWith('{') && !l.startsWith('['))
          .slice(0, 3);
      }
      return res.status(200).json({ ideas });
    }

    if (
      task === 'generate_idea_variants' ||
      task === 'idea_variants' ||
      task === 'rephrase' ||
      body.rephrase
    ) {
      const original = body.original || body.rephrase || '';
      const userMsg = `Niche: ${niche}. Orijinal fikir: "${original}". Bunu 3 farklı, daha çarpıcı versiyona çevir. Yalnızca JSON: { "ideas": ["...", "...", "..."] }`;
      const text = await callAnthropic(apiKey, SYSTEM_PROMPT, userMsg, 600);
      const parsed = extractJson(text);
      let ideas = extractIdeas(parsed).filter((v) => v.trim() !== original.trim()).slice(0, 3);
      if (ideas.length === 0) {
        ideas = text
          .split('\n')
          .map((l) => l.replace(/^[\s\-\d\.\)\*]+/, '').trim())
          .filter((l) => l.length > 8 && l !== original)
          .slice(0, 3);
      }
      return res.status(200).json({ ideas });
    }

    if (task === 'generate_hashtags' || task === 'hashtags' || body.hashtags_for) {
      const original = body.original || body.hashtags_for || '';
      const count = body.count || 15;
      const userMsg = `Niche: ${niche}. Fikir: "${original}". ${count} adet Türkçe hashtag üret. Her birinin category alanı "nis", "trend", "genel" veya "uzun" olsun. Yalnızca JSON: { "hashtags": [{"tag":"...","category":"..."}, ...] }`;
      const text = await callAnthropic(apiKey, SYSTEM_PROMPT, userMsg, 500);
      const parsed = extractJson(text);
      let hashtags = extractHashtags(parsed).slice(0, count);
      if (hashtags.length === 0) {
        const tokens = original
          .toLowerCase()
          .replace(/[^\wığüşöç\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4)
          .slice(0, 5);
        hashtags = tokens.map((t) => ({ tag: t, category: 'nis' }));
      }
      return res.status(200).json({ hashtags });
    }

    const question = (body.question || '').trim();
    if (!question) {
      return res.status(400).json({ error: 'empty_question' });
    }

    const messages = [
      ...(body.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: `Niche: ${niche}\nSoru: ${question}` },
    ];

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return res.status(502).json({ error: 'anthropic_error', message: errText.slice(0, 200) });
    }

    const data = await r.json();
    const answer = extractText(data) || 'Şu an cevap veremiyorum.';
    return res.status(200).json({ answer });
  } catch (e: any) {
    return res.status(500).json({ error: 'server_error', message: e?.message ?? 'unknown' });
  }
}
