// Local test runner for api/ask.ts — same handler, but invoked via fetch on a local node http server.
// Usage: ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/local-ai-test.ts
import http from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import handler from '../api/ask';

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('method not allowed');
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    let parsed: any = {};
    try {
      parsed = body ? JSON.parse(body) : {};
    } catch {
      parsed = {};
    }
    const vercelReq = { method: 'POST', body: parsed, headers: req.headers as any };
    const headers: Record<string, string> = {};
    const vercelRes = {
      status(code: number) {
        res.statusCode = code;
        return vercelRes;
      },
      json(data: any) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      },
      setHeader(name: string, value: string) {
        headers[name] = value;
        res.setHeader(name, value);
      },
      end() {
        res.end();
      },
    };
    try {
      await handler(vercelReq as any, vercelRes as any);
    } catch (e: any) {
      console.error('handler error:', e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'local_handler_error', message: e?.message }));
    }
  });
});

const PORT = Number(process.env.PORT || 3737);
server.listen(PORT, async () => {
  console.log(`Local AI proxy listening on http://localhost:${PORT}`);
  const sample = JSON.stringify({ task: 'generate_weekly_ideas', niche: 'fitness' });
  try {
    const r = await fetch(`http://localhost:${PORT}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: sample,
    });
    const text = await r.text();
    console.log('Status:', r.status);
    console.log('Response:', text);
  } catch (e: any) {
    console.error('Test request failed:', e?.message);
  } finally {
    server.close();
  }
});
