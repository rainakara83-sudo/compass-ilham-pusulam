import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import tr from './locales/tr.json';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

const LANG_KEY = '@content-coach/language';

export type SupportedLng = 'tr' | 'en' | 'es' | 'de' | 'fr';
export const SUPPORTED_LANGUAGES: { code: SupportedLng; label: string; flag: string }[] = [
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

const SUPPORTED: SupportedLng[] = ['tr', 'en', 'es', 'de', 'fr'];

const isSupported = (lng: string | undefined | null): lng is SupportedLng =>
  typeof lng === 'string' && (SUPPORTED as string[]).includes(lng);

const detectInitialLanguage = (): SupportedLng => {
  try {
    const locales = Localization.getLocales();
    const code = locales?.[0]?.languageCode?.toLowerCase();
    if (isSupported(code)) return code;
  } catch {}
  return 'en';
};

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    tr: { translation: tr },
    en: { translation: en },
    es: { translation: es },
    de: { translation: de },
    fr: { translation: fr },
  },
  lng: detectInitialLanguage(),
  fallbackLng: ['en'],
  fallbackNS: 'translation',
  returnEmptyString: false,
  returnNull: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
});

const ALL_LOCALES: Record<SupportedLng, Record<string, unknown>> = {
  tr: tr as unknown as Record<string, unknown>,
  en: en as unknown as Record<string, unknown>,
  es: es as unknown as Record<string, unknown>,
  de: de as unknown as Record<string, unknown>,
  fr: fr as unknown as Record<string, unknown>,
};

const resolveKey = (obj: Record<string, unknown>, path: string): unknown => {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
};

export const safeT = (
  key: string,
  lng?: string,
  opts?: Record<string, unknown>,
): string => {
  const wantLng = (lng ?? i18n.language ?? 'en').split('-')[0];
  const order: SupportedLng[] = [];
  if (isSupported(wantLng)) order.push(wantLng);
  if (!order.includes('en')) order.push('en');
  if (!order.includes('tr') && wantLng !== 'tr') order.push('tr');
  for (const l of order) {
    const v = resolveKey(ALL_LOCALES[l], key);
    if (typeof v === 'string' && v.length > 0) {
      let out = v;
      if (opts) {
        Object.keys(opts).forEach((k) => {
          out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), String(opts[k]));
        });
      }
      return out;
    }
  }
  return key;
};

export const setAppLanguage = async (lng: SupportedLng) => {
  if (!isSupported(lng)) return;
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(LANG_KEY, lng);
};

export const loadStoredLanguage = async (): Promise<SupportedLng | null> => {
  const v = await AsyncStorage.getItem(LANG_KEY);
  return isSupported(v) ? v : null;
};

export const REMINDER_PRESET_KEYS = ['morning', 'publishTime', 'weeklyPlan', 'eveningCheck'] as const;

export const REMINDER_PRESETS: Record<
  SupportedLng,
  { label: string; title: string; body: string }[]
> = {
  tr: [
    { label: 'Sabah planlaması', title: 'Günaydın! ☀️', body: 'Bugünkü içeriğini planlamayı unutma.' },
    { label: 'Yayın saatim', title: '🎬 Yayın zamanı!', body: 'Bugün içeriğini paylaşmayı unutma.' },
    { label: 'Haftalık plan', title: '📅 Haftayı planla', body: 'Yeni hafta için fikirlerini seç.' },
    { label: 'Akşam kontrolü', title: '🌙 Akşam kontrolü', body: 'Yarınki paylaşımın hazır mı?' },
  ],
  en: [
    { label: 'Morning planning', title: 'Good morning! ☀️', body: "Don't forget to plan today's content." },
    { label: 'Broadcast time', title: '🎬 Broadcast time!', body: "Don't forget to share today's content." },
    { label: 'Weekly plan', title: '📅 Plan your week', body: 'Pick ideas for the new week.' },
    { label: 'Evening check', title: '🌙 Evening check', body: 'Is tomorrow’s post ready?' },
  ],
  es: [
    { label: 'Plan matutino', title: '¡Buenos días! ☀️', body: 'No olvides planificar el contenido de hoy.' },
    { label: 'Mi hora de emisión', title: '🎬 ¡Hora de publicar!', body: 'No olvides compartir el contenido de hoy.' },
    { label: 'Plan semanal', title: '📅 Planifica la semana', body: 'Elige ideas para la nueva semana.' },
    { label: 'Chequeo nocturno', title: '🌙 Chequeo nocturno', body: '¿Está lista la publicación de mañana?' },
  ],
  de: [
    { label: 'Morgenplanung', title: 'Guten Morgen! ☀️', body: 'Vergiss nicht, den heutigen Content zu planen.' },
    { label: 'Meine Sendezeit', title: '🎬 Sendezeit!', body: 'Vergiss nicht, den heutigen Content zu teilen.' },
    { label: 'Wochenplan', title: '📅 Plane die Woche', body: 'Wähle Ideen für die neue Woche.' },
    { label: 'Abendcheck', title: '🌙 Abendcheck', body: 'Ist der morgige Beitrag bereit?' },
  ],
  fr: [
    { label: 'Plan du matin', title: 'Bonjour ! ☀️', body: "N'oublie pas de planifier le contenu du jour." },
    { label: 'Mon heure de diffusion', title: '🎬 Heure de diffusion !', body: "N'oublie pas de partager le contenu du jour." },
    { label: 'Plan hebdomadaire', title: '📅 Planifie ta semaine', body: 'Choisis des idées pour la nouvelle semaine.' },
    { label: 'Vérification du soir', title: '🌙 Vérification du soir', body: 'Le post de demain est-il prêt ?' },
  ],
};

export const getReminderPresets = (): { label: string; title: string; body: string }[] => {
  const cur = (i18n.language || 'en').split('-')[0];
  if (isSupported(cur)) return REMINDER_PRESETS[cur];
  return REMINDER_PRESETS.en;
};

export type IdeaAngleId = 'tutorial' | 'story' | 'listicle' | 'opinion' | 'myth' | 'tip' | 'question' | 'news';
export type IdeaStatusId = 'raw' | 'developing' | 'ready' | 'used' | 'archived';
export type IdeaReachId = 'low' | 'medium' | 'high' | 'viral';

export const IDEA_ANGLE_LABELS: Record<IdeaAngleId, Record<SupportedLng, string>> = {
  tutorial: { tr: 'Nasıl Yapılır', en: 'Tutorial', es: 'Tutorial', de: 'Tutorial', fr: 'Tutoriel' },
  story: { tr: 'Hikaye', en: 'Story', es: 'Historia', de: 'Geschichte', fr: 'Histoire' },
  listicle: { tr: 'Liste', en: 'Listicle', es: 'Lista', de: 'Liste', fr: 'Liste' },
  opinion: { tr: 'Görüş', en: 'Opinion', es: 'Opinión', de: 'Meinung', fr: 'Opinion' },
  myth: { tr: 'Miti Yık', en: 'Myth Buster', es: 'Romper mitos', de: 'Mythos brechen', fr: 'Casseur de mythes' },
  tip: { tr: 'Hızlı İpucu', en: 'Quick Tip', es: 'Consejo rápido', de: 'Schnelltipp', fr: 'Astuce rapide' },
  question: { tr: 'Soru', en: 'Question', es: 'Pregunta', de: 'Frage', fr: 'Question' },
  news: { tr: 'Trend/Haber', en: 'News', es: 'Noticias', de: 'News', fr: 'Actualité' },
};

export const IDEA_ANGLE_HINTS: Record<IdeaAngleId, Record<SupportedLng, string>> = {
  tutorial: { tr: 'Adım adım öğretici', en: 'Step-by-step guide', es: 'Guía paso a paso', de: 'Schritt-für-Schritt-Anleitung', fr: 'Guide étape par étape' },
  story: { tr: 'Kişisel deneyim', en: 'Personal experience', es: 'Experiencia personal', de: 'Persönliche Erfahrung', fr: 'Expérience personnelle' },
  listicle: { tr: '5-10 madde sıralı', es: '5-10 elementos en orden', en: '5-10 items in order', de: '5-10 Punkte in Reihenfolge', fr: '5 à 10 éléments dans l’ordre' },
  opinion: { tr: 'Cesur yorum', en: 'Bold take', es: 'Opinión audaz', de: 'Kühne Meinung', fr: 'Avis audacieux' },
  myth: { tr: 'Yanlış bilinen doğru', en: 'Common misconception', es: 'Concepto erróneo común', de: 'Häufiger Irrtum', fr: 'Idée reçue courante' },
  tip: { tr: 'Tek satırda değer', en: 'Single-line value', es: 'Valor en una línea', de: 'Wert in einer Zeile', fr: 'Valeur en une ligne' },
  question: { tr: 'Topluluk sorusu', en: 'Community question', es: 'Pregunta a la comunidad', de: 'Community-Frage', fr: 'Question à la communauté' },
  news: { tr: 'Güncel konu', en: 'Trending topic', es: 'Tema de actualidad', de: 'Aktuelles Thema', fr: 'Sujet tendance' },
};

export const IDEA_STATUS_LABELS: Record<IdeaStatusId, Record<SupportedLng, string>> = {
  raw: { tr: 'Ham Fikir', en: 'Raw idea', es: 'Idea cruda', de: 'Rohe Idee', fr: 'Idée brute' },
  developing: { tr: 'Geliştiriliyor', en: 'Developing', es: 'En desarrollo', de: 'In Entwicklung', fr: 'En développement' },
  ready: { tr: 'Hazır', en: 'Ready', es: 'Listo', de: 'Bereit', fr: 'Prêt' },
  used: { tr: 'Kullanıldı', en: 'Used', es: 'Usado', de: 'Verwendet', fr: 'Utilisé' },
  archived: { tr: 'Arşivlendi', en: 'Archived', es: 'Archivado', de: 'Archiviert', fr: 'Archivé' },
};

export const IDEA_REACH_LABELS: Record<IdeaReachId, Record<SupportedLng, string>> = {
  low: { tr: 'Düşük', en: 'Low', es: 'Baja', de: 'Niedrig', fr: 'Faible' },
  medium: { tr: 'Orta', en: 'Medium', es: 'Media', de: 'Mittel', fr: 'Moyenne' },
  high: { tr: 'Yüksek', en: 'High', es: 'Alta', de: 'Hoch', fr: 'Élevée' },
  viral: { tr: 'Viral', en: 'Viral', es: 'Viral', de: 'Viral', fr: 'Viral' },
};

export const IDEA_PRIORITY_LABELS_I18N: Record<1 | 2 | 3 | 4 | 5, Record<SupportedLng, string>> = {
  1: { tr: 'Çok düşük', en: 'Very Low', es: 'Muy Baja', de: 'Sehr Niedrig', fr: 'Très Faible' },
  2: { tr: 'Düşük', en: 'Low', es: 'Baja', de: 'Niedrig', fr: 'Faible' },
  3: { tr: 'Orta', en: 'Medium', es: 'Media', de: 'Mittel', fr: 'Moyenne' },
  4: { tr: 'Yüksek', en: 'High', es: 'Alta', de: 'Hoch', fr: 'Élevée' },
  5: { tr: 'Çok yüksek', en: 'Very High', es: 'Muy Alta', de: 'Sehr Hoch', fr: 'Très Élevée' },
};

const curLng = (): SupportedLng => {
  const c = (i18n.language || 'en').split('-')[0];
  return isSupported(c) ? c : 'en';
};

export const getAngleLabel = (id: IdeaAngleId): string => IDEA_ANGLE_LABELS[id][curLng()];
export const getAngleHint = (id: IdeaAngleId): string => IDEA_ANGLE_HINTS[id][curLng()];
export const getStatusLabel = (id: IdeaStatusId): string => IDEA_STATUS_LABELS[id][curLng()];
export const getReachLabel = (id: IdeaReachId): string => IDEA_REACH_LABELS[id][curLng()];
export const getPriorityLabel = (p: 1 | 2 | 3 | 4 | 5): string => IDEA_PRIORITY_LABELS_I18N[p][curLng()];

export type DemoIdeaKey = 'fitnessProgram' | 'socialMediaHabits' | 'homeFullBody' | 'starterBooks' | 'breakfastRoutine';

export const DEFAULT_DEMO_IDEA_TITLES: Record<DemoIdeaKey, Record<SupportedLng, string>> = {
  fitnessProgram: {
    tr: 'Yaz öncesi 12 haftalık program',
    en: '12-week pre-summer program',
    es: 'Programa de 12 semanas pre-verano',
    de: '12-Wochen-Sommer-Vorbereitungs-Programm',
    fr: 'Programme pré-été de 12 semaines',
  },
  socialMediaHabits: {
    tr: 'Sosyal medyada vakit kaybettiren 5 alışkanlık',
    en: '5 habits that waste your time on social media',
    es: '5 hábitos que te hacen perder tiempo en redes sociales',
    de: '5 Gewohnheiten, die dir Zeit in sozialen Medien rauben',
    fr: '5 habitudes qui te font perdre du temps sur les réseaux sociaux',
  },
  homeFullBody: {
    tr: 'Evde ekipmansız full body',
    en: 'No-equipment full body at home',
    es: 'Cuerpo completo en casa sin equipamiento',
    de: 'Ganzkörper-Training zuhause ohne Geräte',
    fr: 'Full body à la maison sans équipement',
  },
  starterBooks: {
    tr: 'Yeni başlayanlar için 3 kitap',
    en: '3 books for beginners',
    es: '3 libros para principiantes',
    de: '3 Bücher für Anfänger',
    fr: '3 livres pour débutants',
  },
  breakfastRoutine: {
    tr: '30 günde kahvaltı rutini',
    en: '30-day breakfast routine',
    es: 'Rutina de desayuno de 30 días',
    de: '30-Tage-Frühstücks-Routine',
    fr: 'Routine petit-déjeuner de 30 jours',
  },
};

export const DEMO_IDEA_ORDER: DemoIdeaKey[] = ['fitnessProgram', 'socialMediaHabits', 'homeFullBody', 'starterBooks', 'breakfastRoutine'];

export const IDEA_DEFAULT_TAGS_I18N: Record<string, Record<SupportedLng, string[]>> = {
  fitness: {
    tr: ['squat', 'protein', 'kardiyo', 'motivasyon', 'split', 'form', 'recovery', 'macro'],
    en: ['squat', 'protein', 'cardio', 'motivation', 'split', 'form', 'recovery', 'macro'],
    es: ['sentadilla', 'proteína', 'cardio', 'motivación', 'split', 'forma', 'recuperación', 'macro'],
    de: ['kniebeuge', 'protein', 'cardio', 'motivation', 'split', 'form', 'erholung', 'makro'],
    fr: ['squat', 'protéine', 'cardio', 'motivation', 'split', 'forme', 'récupération', 'macro'],
  },
  food: {
    tr: ['tarif', 'malzeme', 'sos', 'tatlı', 'vegan', 'hızlı', 'bütçe', 'sunum'],
    en: ['recipe', 'ingredient', 'sauce', 'dessert', 'vegan', 'quick', 'budget', 'plating'],
    es: ['receta', 'ingrediente', 'salsa', 'postre', 'vegano', 'rápido', 'presupuesto', 'presentación'],
    de: ['rezept', 'zutat', 'soße', 'dessert', 'vegan', 'schnell', 'budget', 'anrichte'],
    fr: ['recette', 'ingrédient', 'sauce', 'dessert', 'vegan', 'rapide', 'budget', 'présentation'],
  },
  tech: {
    tr: ['ai', 'otomasyon', 'kod', 'verimlilik', 'güvenlik', 'workflow', 'mobile', 'cloud'],
    en: ['ai', 'automation', 'code', 'productivity', 'security', 'workflow', 'mobile', 'cloud'],
    es: ['ia', 'automatización', 'código', 'productividad', 'seguridad', 'flujo', 'móvil', 'nube'],
    de: ['ki', 'automatisierung', 'code', 'produktivität', 'sicherheit', 'workflow', 'mobile', 'cloud'],
    fr: ['ia', 'automatisation', 'code', 'productivité', 'sécurité', 'workflow', 'mobile', 'cloud'],
  },
  fashion: {
    tr: ['kombin', 'kapsül', 'renk', 'trend', 'bütçe', 'aksesuar', 'sezon', 'stil'],
    en: ['outfit', 'capsule', 'color', 'trend', 'budget', 'accessory', 'season', 'style'],
    es: ['conjunto', 'cápsula', 'color', 'tendencia', 'presupuesto', 'accesorio', 'temporada', 'estilo'],
    de: ['outfit', 'kapsel', 'farbe', 'trend', 'budget', 'accessoire', 'saison', 'stil'],
    fr: ['tenue', 'capsule', 'couleur', 'tendance', 'budget', 'accessoire', 'saison', 'style'],
  },
  beauty: {
    tr: ['cilt', 'rutin', 'serum', 'spf', 'makyaj', 'saç', 'tırnak', 'maske'],
    en: ['skin', 'routine', 'serum', 'spf', 'makeup', 'hair', 'nails', 'mask'],
    es: ['piel', 'rutina', 'serum', 'spf', 'maquillaje', 'cabello', 'uñas', 'mascarilla'],
    de: ['haut', 'routine', 'serum', 'lsf', 'make-up', 'haar', 'nägel', 'maske'],
    fr: ['peau', 'routine', 'sérum', 'spf', 'maquillage', 'cheveux', 'ongles', 'masque'],
  },
  business: {
    tr: ['satış', 'pazarlama', 'funnel', 'büyüme', 'yatırım', 'liderlik', 'delegasyon', 'marka'],
    en: ['sales', 'marketing', 'funnel', 'growth', 'investment', 'leadership', 'delegation', 'brand'],
    es: ['ventas', 'marketing', 'embudo', 'crecimiento', 'inversión', 'liderazgo', 'delegación', 'marca'],
    de: ['verkauf', 'marketing', 'funnel', 'wachstum', 'investition', 'führung', 'delegation', 'marke'],
    fr: ['vente', 'marketing', 'entonnoir', 'croissance', 'investissement', 'leadership', 'délégation', 'marque'],
  },
  travel: {
    tr: ['rota', 'otel', 'restoran', 'vize', 'valiz', 'yerel', 'bütçe', 'macera'],
    en: ['route', 'hotel', 'restaurant', 'visa', 'luggage', 'local', 'budget', 'adventure'],
    es: ['ruta', 'hotel', 'restaurante', 'visado', 'equipaje', 'local', 'presupuesto', 'aventura'],
    de: ['route', 'hotel', 'restaurant', 'visum', 'gepäck', 'lokal', 'budget', 'abenteuer'],
    fr: ['itinéraire', 'hôtel', 'restaurant', 'visa', 'valise', 'local', 'budget', 'aventure'],
  },
  gaming: {
    tr: ['meta', 'fps', 'rank', 'build', 'yayıncılık', 'turnuva', 'donanım', 'discord'],
    en: ['meta', 'fps', 'rank', 'build', 'streaming', 'tournament', 'hardware', 'discord'],
    es: ['meta', 'fps', 'rango', 'build', 'streaming', 'torneo', 'hardware', 'discord'],
    de: ['meta', 'fps', 'rang', 'build', 'streaming', 'turnier', 'hardware', 'discord'],
    fr: ['meta', 'fps', 'rang', 'build', 'streaming', 'tournoi', 'matériel', 'discord'],
  },
  _default: {
    tr: ['içerik', 'fikir', 'planlama', 'analiz', 'taktik', 'sosyal'],
    en: ['content', 'idea', 'planning', 'analysis', 'tactic', 'social'],
    es: ['contenido', 'idea', 'planificación', 'análisis', 'táctica', 'social'],
    de: ['content', 'idee', 'planung', 'analyse', 'taktik', 'social'],
    fr: ['contenu', 'idée', 'planification', 'analyse', 'tactique', 'social'],
  },
};

const TITLE_TEMPLATES_BY_LANG: Record<SupportedLng, string[]> = {
  tr: [
    '{tag} hakkında bilmen gereken 5 şey',
    'Sektörde herkesin yanlış yaptığı {tag} hatası',
    '{tag}: Sıfırdan zirveye yol haritası',
    'Bir haftada {tag} dönüşümü',
    '{tag} üstadı olmak için 3 kitap/araç',
  ],
  en: [
    '5 things you need to know about {tag}',
    'The {tag} mistake everyone makes',
    '{tag}: A roadmap from zero to top',
    'A {tag} transformation in one week',
    '3 books/tools to master {tag}',
  ],
  es: [
    '5 cosas que debes saber sobre {tag}',
    'El error de {tag} que todos cometen',
    '{tag}: Una ruta de cero a la cima',
    'Una transformación de {tag} en una semana',
    '3 libros/herramientas para dominar {tag}',
  ],
  de: [
    '5 Dinge, die du über {tag} wissen musst',
    'Der {tag}-Fehler, den alle machen',
    '{tag}: Ein Wegweiser von null nach oben',
    'Eine {tag}-Transformation in einer Woche',
    '3 Bücher/Tools, um {tag} zu meistern',
  ],
  fr: [
    '5 choses à savoir sur {tag}',
    "L'erreur {tag} que tout le monde fait",
    '{tag} : une feuille de route de zéro au sommet',
    'Une transformation {tag} en une semaine',
    '3 livres/outils pour maîtriser {tag}',
  ],
};

const DESC_TEMPLATES_BY_LANG: Record<SupportedLng, string[]> = {
  tr: [
    'Bu fikir {tags} konularını birleştirip hedef kitleye derin değer katıyor. Düşündüğünden daha fazla etkileşim alabilir.',
    'Toplulukta {tag} hakkında sıkça soru alıyorsun. Bunu kapsayan bir içerik takipçi sadakatini artırır.',
    'Trend olan {tag} konusunu kendi açından ele al. Farklı bakış açısı öne çıkmana yardım eder.',
    'Pratik bir liste — {tags}. Takipçiler kaydetmeyi sever çünkü uygulanabilir.',
  ],
  en: [
    'This idea combines {tags} and adds deep value to your audience. It can drive more engagement than you think.',
    'Your community keeps asking about {tag}. A piece covering this boosts follower loyalty.',
    'Cover the trending topic {tag} from your own angle. A fresh perspective helps you stand out.',
    'A practical list — {tags}. Followers love to save posts they can actually apply.',
  ],
  es: [
    'Esta idea combina {tags} y aporta valor real a tu audiencia. Puede generar más interacción de la que crees.',
    'Tu comunidad pregunta seguido por {tag}. Un contenido que lo cubra aumenta la fidelidad.',
    'Aborda el tema tendencia {tag} desde tu propio ángulo. Una perspectiva fresca te ayuda a destacar.',
    'Una lista práctica — {tags}. A los seguidores les encanta guardar contenido aplicable.',
  ],
  de: [
    'Diese Idee verbindet {tags} und liefert deiner Community echten Mehrwert. Sie kann mehr Interaktion bringen, als du denkst.',
    'Deine Community fragt ständig nach {tag}. Ein Beitrag dazu stärkt die Follower-Treue.',
    'Greif das Trendthema {tag} aus deinem Blickwinkel auf. Eine frische Perspektive hilft dir, hervorzustechen.',
    'Eine praktische Liste — {tags}. Follower speichern gerne Beiträge, die sie anwenden können.',
  ],
  fr: [
    'Cette idée combine {tags} et apporte une vraie valeur à ta communauté. Elle peut générer plus d’interactions que tu ne le penses.',
    'Ta communauté te pose souvent des questions sur {tag}. Un contenu qui couvre le sujet renforce la fidélité.',
    'Aborde le sujet tendance {tag} sous ton propre angle. Un regard frais t’aide à te démarquer.',
    'Une liste pratique — {tags}. Les followers adorent sauvegarder du contenu applicable.',
  ],
};

const HOOK_TEMPLATES_BY_LANG: Record<SupportedLng, string[]> = {
  tr: [
    'X ile Y arasındaki farkı hiç düşündün mü? İşte cevabı.',
    '{tag} hakkında tek bir gerçeği bileceksin. Hazır mısın?',
    'Bu {tag} taktiği 1 saatte hayatını değiştirebilir.',
    'Son 30 günde {tag} konusunda en çok sorulan 3 soru.',
  ],
  en: [
    'Have you ever wondered the difference between X and Y? Here is the answer.',
    'You will know one real thing about {tag}. Ready?',
    'This {tag} trick can change your life in an hour.',
    'The 3 most asked questions about {tag} in the last 30 days.',
  ],
  es: [
    '¿Alguna vez te preguntaste la diferencia entre X e Y? Aquí está la respuesta.',
    'Vas a saber una verdad sobre {tag}. ¿Listo?',
    'Este truco de {tag} puede cambiar tu vida en una hora.',
    'Las 3 preguntas más hechas sobre {tag} en los últimos 30 días.',
  ],
  de: [
    'Hast du dich jemals gefragt, was der Unterschied zwischen X und Y ist? Hier ist die Antwort.',
    'Du wirst eine wahre Sache über {tag} erfahren. Bereit?',
    'Dieser {tag}-Trick kann dein Leben in einer Stunde verändern.',
    'Die 3 meistgestellten Fragen zu {tag} in den letzten 30 Tagen.',
  ],
  fr: [
    'Tu t’es déjà demandé la différence entre X et Y ? Voici la réponse.',
    'Tu vas apprendre une vraie chose sur {tag}. Prêt(e) ?',
    'Cette astuce {tag} peut changer ta vie en une heure.',
    'Les 3 questions les plus posées sur {tag} ces 30 derniers jours.',
  ],
};

const FALLBACK_TEMPLATES = TITLE_TEMPLATES_BY_LANG.en;

const fillTemplate = (tpl: string, vars: Record<string, string>): string => {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? k);
};

export const getDemoIdeaTitle = (key: DemoIdeaKey, lng?: SupportedLng): string =>
  DEFAULT_DEMO_IDEA_TITLES[key][lng ?? curLng()];

export const pickDemoTitleTemplate = (seed: number, lng?: SupportedLng): string => {
  const l = lng ?? curLng();
  const arr = TITLE_TEMPLATES_BY_LANG[l] ?? FALLBACK_TEMPLATES;
  return arr[Math.abs(Math.floor(Math.sin(seed * 7.13) * 1000)) % arr.length];
};

export const pickDemoDescTemplate = (seed: number, lng?: SupportedLng): string => {
  const l = lng ?? curLng();
  const arr = DESC_TEMPLATES_BY_LANG[l] ?? DESC_TEMPLATES_BY_LANG.en;
  return arr[Math.abs(Math.floor(Math.sin(seed * 7.13) * 1000)) % arr.length];
};

export const pickDemoHookTemplate = (seed: number, lng?: SupportedLng): string => {
  const l = lng ?? curLng();
  const arr = HOOK_TEMPLATES_BY_LANG[l] ?? HOOK_TEMPLATES_BY_LANG.en;
  return arr[Math.abs(Math.floor(Math.sin(seed * 7.13) * 1000)) % arr.length];
};

export const fillDemoTemplate = (tpl: string, vars: Record<string, string>): string => fillTemplate(tpl, vars);

export const getDefaultTagsForNiche = (niche: string, lng?: SupportedLng): string[] => {
  const l = lng ?? curLng();
  const map = IDEA_DEFAULT_TAGS_I18N[niche] ?? IDEA_DEFAULT_TAGS_I18N._default;
  return map[l] ?? map.en;
};

export const DEFAULT_IDEAS_BY_NICHE: Record<string, Record<SupportedLng, string[]>> = {
  food: {
    tr: [
      '30 günde kahvaltı rutini',
      'Hafta sonu için 5 pratik kahvaltı tarifi',
      'Mutfakta olmazsa olmaz 10 alet',
      'Sağlıklı atıştırmalıklar: Canın tatlı çektiğinde 7 alternatif',
      'Tek tencerede 30 dakikada akşam yemeği: Pratik tarif',
    ],
    en: [
      '30-day breakfast routine',
      '5 practical weekend breakfast recipes',
      '10 kitchen essentials',
      'Healthy snacks: 7 alternatives when you crave sweets',
      'One-pot 30-minute dinner: Practical recipe',
    ],
    es: [
      'Rutina de desayuno de 30 días',
      '5 recetas prácticas de desayuno de fin de semana',
      '10 esenciales de cocina',
      'Snacks saludables: 7 alternativas cuando te apetece algo dulce',
      'Cena rápida de 30 minutos en una olla: Receta práctica',
    ],
    de: [
      '30-Tage-Frühstücks-Routine',
      '5 praktische Wochenend-Frühstücks-Rezepte',
      '10 Küchen-Essentials',
      'Gesunde Snacks: 7 Alternativen bei Heißhunger',
      'Eintopf-Abendessen in 30 Minuten: Praktisches Rezept',
    ],
    fr: [
      'Routine petit-déjeuner de 30 jours',
      '5 recettes pratiques de petit-déjeuner du week-end',
      '10 essentiels de cuisine',
      'Collations saines : 7 alternatives quand vous avez envie de sucré',
      'Dîner en 30 min dans une casserole : Recette pratique',
    ],
  },
  fashion: {
    tr: [
      'Sezonun 5 trend parçası',
      'Kapsül gardırop: 30 parçayla sınırsız kombin',
      'Renkler nasıl karıştırılır',
      'Ofis için 10 şık kombin',
      'Moda haftası: En iyi 5 an',
    ],
    en: [
      '5 trending pieces this season',
      'Capsule wardrobe: 30 pieces unlimited combos',
      'How to mix colors',
      '10 stylish office combos',
      'Fashion week: Top 5 moments',
    ],
    es: [
      '5 piezas tendencia esta temporada',
      'Armario cápsula: 30 piezas combinaciones infinitas',
      'Cómo mezclar colores',
      '10 combinaciones elegantes de oficina',
      'Semana de la moda: Los 5 mejores momentos',
    ],
    de: [
      '5 Trendteile dieser Saison',
      'Capsule Wardrobe: 30 Teile unbegrenzte Kombinationen',
      'Farben kombinieren',
      '10 stilvolle Büro-Outfits',
      'Modewoche: Top 5 Momente',
    ],
    fr: [
      '5 pièces tendance cette saison',
      'Garde-robe capsule : 30 pièces combinaisons infinies',
      'Comment mélanger les couleurs',
      '10 combinaisons élégantes de bureau',
      'Semaine de la mode : Top 5 moments',
    ],
  },
  fitness: {
    tr: [
      'Spor rutininizi 4 haftada değiştirin',
      'Evde ekipmansız 5 egzersiz',
      'Kardiyo mu ağırlık mı: Hangisi sizin için?',
      'Squat challenge: 30 günlük plan',
      'Dinlenme günü neden önemli?',
    ],
    en: [
      'Transform your workout routine in 4 weeks',
      '5 no-equipment exercises at home',
      'Cardio or weights: Which one is for you?',
      'Squat challenge: 30-day plan',
      'Why rest days matter',
    ],
    es: [
      'Cambia tu rutina de ejercicios en 4 semanas',
      '5 ejercicios sin equipo en casa',
      'Cardio o pesas: ¿Cuál es para ti?',
      'Reto de sentadillas: Plan de 30 días',
      'Por qué importan los días de descanso',
    ],
    de: [
      'Verändere deine Trainingsroutine in 4 Wochen',
      '5 Übungen ohne Geräte zu Hause',
      'Cardio oder Gewichte: Was passt zu dir?',
      'Kniebeugen-Challenge: 30-Tage-Plan',
      'Warum Ruhetage wichtig sind',
    ],
    fr: [
      'Changez votre routine sportive en 4 semaines',
      '5 exercices sans équipement à la maison',
      'Cardio ou musculation : Lequel est pour vous ?',
      'Défi squats : Plan de 30 jours',
      'Pourquoi les jours de repos sont importants',
    ],
  },
  tech: {
    tr: [
      'AI araçları içerik üretimi nasıl değiştiriyor',
      'Yeni başlayanlar için 5 uygulama',
      'Telefonunuzu içerik stüdyosuna çevirin',
      'SEO 2026: En iyi 5 strateji',
      'Sosyal medya otomasyon rehberi',
    ],
    en: [
      'How AI tools are reshaping content creation',
      '5 apps for beginners',
      'Turn your phone into a content studio',
      'SEO 2026: Top 5 strategies',
      'Social media automation guide',
    ],
    es: [
      'Cómo las herramientas de IA están cambiando la creación de contenido',
      '5 apps para principiantes',
      'Convierte tu móvil en un estudio de contenido',
      'SEO 2026: Las 5 mejores estrategias',
      'Guía de automatización de redes sociales',
    ],
    de: [
      'Wie KI-Tools die Content-Erstellung verändern',
      '5 Apps für Einsteiger',
      'Mach dein Handy zum Content-Studio',
      'SEO 2026: Die 5 besten Strategien',
      'Social-Media-Automatisierung: Leitfaden',
    ],
    fr: [
      'Comment les outils IA transforment la création de contenu',
      '5 applications pour débutants',
      'Transformez votre téléphone en studio de contenu',
      'SEO 2026 : Les 5 meilleures stratégies',
      'Guide d’automatisation des réseaux sociaux',
    ],
  },
  travel: {
    tr: [
      'Balkan turu: 7 günlük plan',
      'Bütçe dostu 5 Avrupa şehri',
      'Yalnız seyahat için 10 ipucu',
      'Çantada olmazsa olmaz 8 eşya',
      'Seyahat fotoğrafçılığı: Başlangıç rehberi',
    ],
    en: [
      'Balkan tour: A 7-day plan',
      '5 budget-friendly European cities',
      '10 tips for solo travel',
      '8 must-have items in your bag',
      'Travel photography: Beginner guide',
    ],
    es: [
      'Tour por los Balcanes: Plan de 7 días',
      '5 ciudades europeas económicas',
      '10 consejos para viajar solo',
      '8 imprescindibles en tu mochila',
      'Fotografía de viaje: Guía para principiantes',
    ],
    de: [
      'Balkan-Rundreise: 7-Tage-Plan',
      '5 budgetfreundliche europäische Städte',
      '10 Tipps für Alleinreisende',
      '8 Must-haves im Gepäck',
      'Reisefotografie: Einsteiger-Guide',
    ],
    fr: [
      'Tour des Balkans : Plan de 7 jours',
      '5 villes européennes à petit budget',
      '10 conseils pour voyager en solo',
      '8 indispensables dans ton sac',
      'Photographie de voyage : Guide débutant',
    ],
  },
  gaming: {
    tr: [
      'Yeni başlayanlar için 5 oyun',
      'Twitch yayıncılığına giriş',
      'Ekipman rehberi: 500₺ yayın seti',
      'Discord topluluk yönetimi',
      'Speedrun temelleri',
    ],
    en: [
      '5 games for beginners',
      'Intro to Twitch streaming',
      'Gear guide: A $50 streaming setup',
      'Discord community management',
      'Speedrun basics',
    ],
    es: [
      '5 juegos para principiantes',
      'Introducción al streaming en Twitch',
      'Guía de equipo: Setup de streaming por 50€',
      'Gestión de comunidad en Discord',
      'Fundamentos de speedrun',
    ],
    de: [
      '5 Spiele für Einsteiger',
      'Einstieg ins Twitch-Streaming',
      'Equipment-Guide: 50€ Streaming-Setup',
      'Discord-Community-Management',
      'Speedrun-Grundlagen',
    ],
    fr: [
      '5 jeux pour débutants',
      'Introduction au streaming sur Twitch',
      'Guide d’équipement : Setup streaming à 50€',
      'Gestion de communauté Discord',
      'Bases du speedrun',
    ],
  },
  personal_dev: {
    tr: [
      'Sabah rutini: 5’er dakika 3 alışkanlık',
      'Hedef belirleme: SMART yöntemi',
      'Okuma alışkanlığı: 30 günlük plan',
      'Zaman yönetimi: Pomodoro',
      'Hafıza teknikleri: 5 yöntem',
    ],
    en: [
      'Morning routine: 3 habits in 5 minutes',
      'Goal setting: The SMART method',
      'Reading habit: A 30-day plan',
      'Time management: Pomodoro',
      'Memory techniques: 5 methods',
    ],
    es: [
      'Rutina matutina: 3 hábitos en 5 minutos',
      'Definir metas: Método SMART',
      'Hábito de lectura: Plan de 30 días',
      'Gestión del tiempo: Pomodoro',
      'Técnicas de memoria: 5 métodos',
    ],
    de: [
      'Morgenroutine: 3 Gewohnheiten in 5 Minuten',
      'Ziele setzen: SMART-Methode',
      'Lese-Gewohnheit: 30-Tage-Plan',
      'Zeitmanagement: Pomodoro',
      'Gedächtnistechniken: 5 Methoden',
    ],
    fr: [
      'Routine matinale : 3 habitudes en 5 minutes',
      'Fixer des objectifs : Méthode SMART',
      'Habitude de lecture : Plan de 30 jours',
      'Gestion du temps : Pomodoro',
      'Techniques de mémoire : 5 méthodes',
    ],
  },
  beauty: {
    tr: [
      'Cilt bakım rutini: 5 adım',
      'Makyaj başlangıç seti',
      'Doğal makyaj trendleri 2026',
      'Saç bakımı: Haftalık plan',
      'Güzellik içerikleri: 5 fikir',
    ],
    en: [
      'Skincare routine: 5 steps',
      'Makeup starter kit',
      'Natural makeup trends 2026',
      'Hair care: Weekly plan',
      'Beauty content: 5 ideas',
    ],
    es: [
      'Rutina de cuidado de la piel: 5 pasos',
      'Kit de maquillaje para empezar',
      'Tendencias de maquillaje natural 2026',
      'Cuidado del cabello: Plan semanal',
      'Contenido de belleza: 5 ideas',
    ],
    de: [
      'Hautpflege-Routine: 5 Schritte',
      'Make-up-Starter-Set',
      'Natürliche Make-up-Trends 2026',
      'Haarpflege: Wochenplan',
      'Beauty-Content: 5 Ideen',
    ],
    fr: [
      'Routine soins de la peau : 5 étapes',
      'Kit de maquillage débutant',
      'Tendances maquillage naturel 2026',
      'Soin des cheveux : Plan hebdomadaire',
      'Contenu beauté : 5 idées',
    ],
  },
  astrology: {
    tr: [
      'Burçlara göre 5 günlük plan',
      'Astroloji içerik fikirleri',
      'Venüs geçişi: 2026 etkileri',
      'Retro dönemler: Rehber',
      'Ay fazları: İçerik fikri',
    ],
    en: [
      '5-day plan by zodiac sign',
      'Astrology content ideas',
      'Venus transit: 2026 effects',
      'Retrograde periods: A guide',
      'Moon phases: Content idea',
    ],
    es: [
      'Plan de 5 días según el signo zodiacal',
      'Ideas de contenido de astrología',
      'Tránsito de Venus: Efectos en 2026',
      'Períodos retrógrados: Guía',
      'Fases lunares: Idea de contenido',
    ],
    de: [
      '5-Tage-Plan nach Sternzeichen',
      'Astrologie-Content-Ideen',
      'Venus-Transit: Wirkungen 2026',
      'Retrograde Phasen: Ein Leitfaden',
      'Mondphasen: Content-Idee',
    ],
    fr: [
      'Plan de 5 jours par signe du zodiaque',
      'Idées de contenu astrologie',
      'Transit de Vénus : Effets en 2026',
      'Périodes rétrogrades : Guide',
      'Phases lunaires : Idée de contenu',
    ],
  },
  lifestyle: {
    tr: [
      'Hafta sonu rutini: 5 adım',
      'Minimal yaşam: 30 eşya challenge',
      'Slow living: Günlük 3 alışkanlık',
      'Lifestyle içerik fikirleri: 10 başlık',
      'Wellness rutinleri: 7 günlük plan',
    ],
    en: [
      'Weekend routine: 5 steps',
      'Minimal life: 30-item challenge',
      'Slow living: 3 daily habits',
      'Lifestyle content ideas: 10 titles',
      'Wellness routines: 7-day plan',
    ],
    es: [
      'Rutina de fin de semana: 5 pasos',
      'Vida minimalista: reto de 30 cosas',
      'Slow living: 3 hábitos diarios',
      'Ideas de contenido de lifestyle: 10 títulos',
      'Rutinas de bienestar: plan de 7 días',
    ],
    de: [
      'Wochenend-Routine: 5 Schritte',
      'Minimalistisches Leben: 30-Dinge-Challenge',
      'Slow Living: 3 tägliche Gewohnheiten',
      'Lifestyle-Inhaltsideen: 10 Titel',
      'Wellness-Routinen: 7-Tage-Plan',
    ],
    fr: [
      'Routine du week-end: 5 étapes',
      'Vie minimaliste : défi 30 objets',
      'Slow living : 3 habitudes quotidiennes',
      'Idées de contenu lifestyle : 10 titres',
      'Routines bien-être : plan 7 jours',
    ],
  },
};

export const getDefaultIdeasByNiche = (niche: string | null | undefined, lng?: SupportedLng): string[] => {
  const l = (lng ?? curLng()) as SupportedLng;
  const key = (niche ?? '').toString().toLowerCase();
  const set = DEFAULT_IDEAS_BY_NICHE[key];
  if (!set || !set[l]) {
    const fallback = DEFAULT_IDEAS_BY_NICHE.food?.[l] ?? DEFAULT_IDEAS_BY_NICHE.food?.en ?? [];
    return fallback.slice(0, 5);
  }
  return set[l] ?? set.en;
};

export default i18n;
