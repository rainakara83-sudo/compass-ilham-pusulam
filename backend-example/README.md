# Content Coach Backend (örnek)

Bu, mobil uygulamanın AI servislerine güvenli şekilde erişmesi için kullandığı **proxy** backend örneğidir.

## Neden?

API anahtarını (Anthropic, OpenAI vb.) **asla** mobil uygulamaya gömme. Anahtar halka açık hale gelir. Bunun yerine:

```
[Mobile]  --HTTPS-->  [Bu backend]  --HTTPS-->  [Anthropic API]
                      (API key burada)
```

## Kurulum

```bash
cd backend-example
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Varsayılan olarak `http://localhost:3000` üzerinde çalışır. Uç nokta:

```
POST http://localhost:3000/api/ask
{
  "task": "qa",                  // veya "generate_weekly_ideas"
  "niche": "fitness",
  "question": "...",
  "history": [...]
}
```

## Mobil uygulamada ayarla

`.env` dosyasında:

```
EXPO_PUBLIC_AI_PROXY_URL=https://your-deployed-backend.vercel.app/api/ask
```

Vercel'e deploy etmek için: `vercel` CLI ile bu klasörü ayrı bir proje olarak deploy et.