# Content Coach

React Native + Expo + TypeScript ile geliştirilmiş, niş bazlı haftalık içerik fikri üreten ve hatırlatma yöneten mobil uygulama.

## Özellikler

- 🎯 Niş bazlı onboarding (fitness, yemek, teknoloji, moda, seyahat, oyun, kişisel gelişim, güzellik)
- 📅 Haftalık 3 içerik fikri (Pzt/Çar/Cum) — havuzdan veya AI ile
- ⭐ Favori fikirler — yıldızla, ayrı sekmede listele ve kopyala
- 🔔 Yerel bildirim hatırlatıcıları — düzenleme/silme/test (expo-notifications)
- 🌍 i18n: Türkçe / İngilizce (expo-localization + i18next)
- 🌗 Tema: Açık / Koyu / Sistem (otomatik)
- 💬 Soru-Cevap sohbet ekranı (AI backend proxy üzerinden)
- 📋 Fikirleri tek tuşla kopyala
- 🗂 Geçmiş haftalar AsyncStorage'da otomatik olarak kaydedilir
- 🛠 Tehlikeli bölge: Tüm uygulama verisini sıfırlama

## Kurulum

```bash
cd content-coach
npm install
npx expo start
```

`.env` dosyası:

```
EXPO_PUBLIC_BACKEND_URL=https://YOUR_BACKEND_URL.com
EXPO_PUBLIC_AI_PROXY_URL=https://YOUR_BACKEND_URL.com/api/ask
```

## Proje Yapısı

```
app/
  _layout.tsx                       -> Stack + ThemeProvider + onboarding kontrol
  (onboarding)/niche-select.tsx     -> ilk açılış niş seçimi
  (tabs)/_layout.tsx                -> alt sekme navigasyon
  (tabs)/index.tsx                  -> haftalık içerik fikirleri
  (tabs)/favorites.tsx              -> favoriler
  (tabs)/reminders.tsx              -> hatırlatıcı yönetimi (ekle/düzenle/sil)
  (tabs)/qa.tsx                     -> soru-cevap
  (tabs)/settings.tsx               -> dil + niş + tema + sıfırlama
data/
  niches.json                       -> 8 niş
  content-pool.json                 -> her niş için 30 fikir
locales/
  tr.json, en.json
services/
  contentService.ts                -> havuzdan rastgele seçim
  notificationService.ts            -> expo-notifications wrapper
  aiService.ts                      -> backend proxy'ye fetch
  storage.ts                        -> AsyncStorage niş/favori/geçmiş işlemleri
  theme.tsx                         -> Açık/Koyu/Sistem tema context'i
i18n.ts                             -> i18next yapılandırması
backend-example/                    -> Next.js API proxy örneği
```

## Backend Proxy

AI çağrıları için bir backend gerekir (API anahtarını gizlemek için). `backend-example/` klasörüne bak.

## Test

```bash
npx tsc --noEmit
```