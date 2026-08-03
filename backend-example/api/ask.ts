// Bu dosya, Content Coach uygulamasının istek atacağı backend proxy örneğidir.
// Next.js (Vercel) ile veya bir Express sunucu ile aynı mantıkla çalıştırabilirsin.
//
// Kurulum:
//   1. next.config.js standart olabilir.
//   2. .env.local içine ANTHROPIC_API_KEY=sk-... koy.
//   3. expo tarafında EXPO_PUBLIC_AI_PROXY_URL=https://<domain>/api/ask ayarla.
//
// NOT: Asla API anahtarını mobil uygulamaya koyma! Hep backend proxy üzerinden geçir.

import type { NextApiRequest, NextApiResponse } from 'next';

const SYSTEM_PROMPT = `Sen bir içerik koçusun. Kullanıcı bir niş (fitness, yemek, teknoloji, moda, seyahat, oyun, kişisel gelişim, güzellik vb.) seçti.
Soru varsa: net, uygulanabilir, kısa Türkçe cevap ver. Örneklerle destekle.
Eğer istek generate_weekly_ideas ise: 3 adet, nişe uygun, ilgi çekici, uygulanabilir içerik fikri üret. JSON formatında { ideas: [..] } döndür.`;

type AskBody = {
  task?: 'generate_weekly_ideas' | 'qa';
  niche?: string;
  question?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = (req.body || {}) as AskBody;
  const niche = body.niche ?? 'general';
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'api_key_missing' });
  }

  try {
    if (body.task === 'generate_weekly_ideas') {
      const userMsg = `Niche: ${niche}. 3 adet özgün içerik fikri üret. Yalnızca JSON { "ideas": ["...", "...", "..."] } döndür.`;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });

      const data = await r.json();
      const text = data?.content?.[0]?.text ?? '';
      let ideas: string[] = [];
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.ideas)) ideas = parsed.ideas;
      } catch {
        const lines = text
          .split('\n')
          .map((l: string) => l.replace(/^[\s\-\d\.\)]+/, '').trim())
          .filter((l: string) => l.length > 8);
        ideas = lines.slice(0, 3);
      }
      return res.status(200).json({ ideas });
    }

    const question = (body.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'empty_question' });

    const messages = [
      ...(body.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: `Niche: ${niche}\nSoru: ${question}` },
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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await r.json();
    const answer = data?.content?.[0]?.text ?? 'Şu an cevap veremiyorum.';
    return res.status(200).json({ answer });
  } catch (e: any) {
    return res.status(500).json({ error: 'server_error', message: e?.message });
  }
}