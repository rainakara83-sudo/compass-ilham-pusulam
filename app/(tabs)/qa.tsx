import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import nichesData from '../../data/niches.json';
import { getIdeaBank, Idea, getStoredNiche } from '../../services/storage';
import { NicheId } from '../../services/contentService';
import PlanBadge from '../../components/PlanBadge';

const QUOTES = [
  'Bugün attığın adım, yarınki başarının temeli.',
  'Tutarlılık, motivasyondan daha güçlüdür.',
  'Küçük fikirler büyük topluluklar yaratır.',
  'İlham gelmez — onu sen çağırırsın.',
  'Paylaşmak için mükemmel olmak zorunda değilsin; gerçek olmak yeter.',
  'Bir fikri 7 farklı açıdan anlat, her seferinde yeni bir kitle yakala.',
  'İçeriğin değer ürettiği sürece, zaman seni ödüllendirir.',
  'Vazgeçmek, hiç başlamamış olmaktan daha kötüdür.',
  'Soru sormak, cevap vermekten daha güçlü bir hiledir.',
  'Bugün 1 fikir, yarın 10 içeriğin hammaddesidir.',
  'Senin nişin küçük olabilir; ama etkin büyük olabilir.',
  'Topluluk, sık içerik üretenden değil, değer oluşturandan yanında durur.',
];

const NICHES = nichesData as { id: string; icon: string; color: string }[];

const TIPS = [
  { id: 'fitness', title: 'Hızlı Paylaşım', text: 'Antrenman sonu "ne yaptın?" sorusunu yanıtlayan 1 cümlelik post, en yüksek etkileşimi alır.', emoji: '⚡' },
  { id: 'food', title: 'Görsel Önce', text: 'Tariflerde önce fotoğrafı, sonra malzemeleri ver. Açlık hissi tıklamayı tetikler.', emoji: '🍴' },
  { id: 'tech', title: 'Kısa Karşılaştırma', text: '"X mi Y mi?" formatı yorum almayı 2x artırır. Tarafsız kal, izleyici karar versin.', emoji: '⚖️' },
  { id: 'fashion', title: 'Önce-Sonra', text: 'Aynı kombini 3 farklı ışıkta göster; izleyici "hangisini ben de yapabilirim?" diye sorar.', emoji: '🪞' },
  { id: 'travel', title: 'Pratik Bilgi', text: 'Gideceğin yerin "kaç para, kaç gün, ne yenir" özetini post olarak ver — rehber formatı tutar.', emoji: '🗺' },
  { id: 'gaming', title: 'Highlight Önce', text: 'Videonun en heyecanlı 5 saniyesini ilk frame olarak kullan. İzleyici 5 saniye sonra kalır.', emoji: '🎮' },
  { id: 'personal_dev', title: 'Hatırlanabilir Liste', text: '"3 kitap / 3 alışkanlık / 3 ders" üçlüsü, kitap özetlerinden 3x paylaşılır.', emoji: '📚' },
  { id: 'beauty', title: 'Öncesiz Sonuç Olmaz', text: '5 saniyelik uygulama öncesi/sonrası, ürün incelemesinden 4x fazla kaydetme alır.', emoji: '✨' },
];

const hashSeed = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export default function InspirationBoardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [query, setQuery] = useState('');
  const [planRefresh, setPlanRefresh] = useState(0);

  const todayKey = new Date().toISOString().slice(0, 10);
  const quoteIdx = hashSeed(todayKey) % QUOTES.length;
  const todayQuote = QUOTES[quoteIdx];

  const fade = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
    (async () => {
      const [bank, storedNiche] = await Promise.all([getIdeaBank(), getStoredNiche()]);
      setIdeas(bank);
      setNiche(storedNiche);
    })();
    setPlanRefresh((x) => x + 1);
  }, [cardScale, fade]);

  const nicheEntry = NICHES.find((n) => n.id === niche);
  const nicheColor = nicheEntry?.color ?? '#2F3B25';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ideas.slice(0, 12);
    return ideas.filter((it) => {
      const hay = `${it.title ?? ''} ${it.description ?? ''} ${it.tags?.join(' ') ?? ''} ${it.angle ?? ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 30);
  }, [ideas, query]);

  const tipsForNiche = useMemo(() => {
    if (!niche) return TIPS.slice(0, 4);
    const own = TIPS.filter((t) => t.id === niche);
    const others = TIPS.filter((t) => t.id !== niche).slice(0, 4 - own.length);
    return [...own, ...others];
  }, [niche]);

  const hexToRgb = (h: string) => {
    const c = h.replace('#', '');
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [nr, ng, nb] = hexToRgb(nicheColor);
  const pastel = `rgb(${Math.round(nr + (255 - nr) * 0.78)}, ${Math.round(ng + (255 - ng) * 0.78)}, ${Math.round(nb + (255 - nb) * 0.78)})`;
  const soft = `rgb(${Math.round(nr + (255 - nr) * 0.55)}, ${Math.round(ng + (255 - ng) * 0.55)}, ${Math.round(nb + (255 - nb) * 0.55)})`;
  const deep = `rgb(${Math.round(nr * 0.4)}, ${Math.round(ng * 0.4)}, ${Math.round(nb * 0.4)})`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: '#5C6B4F' }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.title}>💡 İlham Panosu</Text>
            <PlanBadge size="sm" refreshKey={planRefresh} />
          </View>
          <Text style={styles.subtitle}>Günün ilhamı · fikir arama · hızlı ipuçları</Text>
        </View>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.closeBtn} hitSlop={8}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.heroCard, { backgroundColor: pastel, borderColor: nicheColor, opacity: fade, transform: [{ scale: cardScale }] }]}>
        <Text style={[styles.heroBadge, { color: deep }]}>🌅 GÜNÜN İLHAMI</Text>
        <Text style={[styles.heroQuote, { color: deep }]}>"{todayQuote}"</Text>
        <Text style={[styles.heroDate, { color: deep, opacity: 0.7 }]}>
          {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </Text>
        <View style={styles.dotRow}>
          {QUOTES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === quoteIdx ? { backgroundColor: nicheColor, width: 18 } : { backgroundColor: deep + '33' }]}
            />
          ))}
        </View>
      </Animated.View>

      <View style={styles.searchCard}>
        <Text style={styles.sectionTitle}>🔎 Fikir Ara</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Fikirlerinde ara... (başlık, etiket, açı)"
          placeholderTextColor="#9CA3AF"
          style={[styles.searchInput, { borderColor: nicheColor }]}
        />
        <Text style={styles.searchMeta}>
          {filtered.length} sonuç{filtered.length !== 1 ? '' : ''} · Toplam {ideas.length} fikir
        </Text>
        {filtered.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>
              {ideas.length === 0
                ? 'Henüz fikir bankında içerik yok. Ana sayfada "Akıllı Yenile" ile üret, sonra burada ara.'
                : 'Aramayla eşleşen fikir bulunamadı. Farklı bir kelime dene.'}
            </Text>
            <Pressable onPress={() => router.push('/idea-bank')} style={[styles.emptyBtn, { backgroundColor: nicheColor }]}>
              <Text style={styles.emptyBtnText}>Fikir Bankına Git ›</Text>
            </Pressable>
          </View>
        )}
        {filtered.map((idea) => (
          <Pressable
            key={idea.id}
            onPress={() => router.push({ pathname: '/idea/[text]', params: { text: encodeURIComponent(idea.description ?? idea.title ?? ''), niche: niche ?? '', source: 'bank' } })}
            style={[styles.resultRow, { borderLeftColor: nicheColor }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle} numberOfLines={1}>{idea.title ?? 'Adsız fikir'}</Text>
              <Text style={styles.resultDesc} numberOfLines={2}>{idea.description ?? ''}</Text>
              {idea.tags && idea.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {idea.tags.slice(0, 3).map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: soft }]}>
                      <Text style={[styles.tagText, { color: deep }]}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <Text style={[styles.resultChev, { color: nicheColor }]}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tipsHeader}>
        <Text style={styles.sectionTitle}>⚡ Hızlı İpuçları</Text>
        <Text style={styles.tipsSub}>
          {niche ? `${nicheEntry?.icon ?? ''} ${t(`niches.${niche}`, niche)} için özel ipucu + diğer nişlerden` : 'Tüm nişlerden seçilmiş 4 ipucu'}
        </Text>
      </View>
      <View style={styles.tipsGrid}>
        {tipsForNiche.map((tip) => {
          const tipNiche = NICHES.find((n) => n.id === tip.id);
          const tipColor = tipNiche?.color ?? '#2F3B25';
          return (
            <View key={tip.title} style={[styles.tipCard, { backgroundColor: '#FAFCF6', borderColor: tipColor }]}>
              <View style={[styles.tipBadge, { backgroundColor: tipColor + '22', borderColor: tipColor }]}>
                <Text style={[styles.tipEmoji]}>{tip.emoji}</Text>
              </View>
              <Text style={[styles.tipTitle, { color: tipColor }]}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.text}</Text>
            </View>
          );
        })}
      </View>

      <Pressable onPress={() => router.push('/idea-bank')} style={[styles.cta, { backgroundColor: nicheColor }]}>
        <Text style={styles.ctaText}>💡 Fikir Bankını Aç ›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#FAFCF6' },
  subtitle: { fontSize: 13, color: '#E8E4D2', marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FAFCF6', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, color: '#2F3B25', fontWeight: '800' },
  heroCard: { borderRadius: 22, padding: 22, marginBottom: 18, borderWidth: 2 },
  heroBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  heroQuote: { fontSize: 22, fontWeight: '700', lineHeight: 30, marginBottom: 10 },
  heroDate: { fontSize: 12, fontWeight: '700', marginBottom: 12 },
  dotRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  searchCard: { backgroundColor: '#FAFCF6', borderRadius: 18, padding: 16, marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#2F3B25', marginBottom: 10 },
  searchInput: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#2F3B25' },
  searchMeta: { fontSize: 11, color: '#6B7280', marginTop: 8, marginBottom: 10, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 20 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 18, marginBottom: 12 },
  emptyBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderLeftWidth: 3, backgroundColor: '#F0F4ED', marginBottom: 8, gap: 10 },
  resultTitle: { fontSize: 14, fontWeight: '800', color: '#2F3B25', marginBottom: 2 },
  resultDesc: { fontSize: 12, color: '#374151', lineHeight: 16 },
  resultChev: { fontSize: 22, fontWeight: '300' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '700' },
  tipsHeader: { marginBottom: 10 },
  tipsSub: { fontSize: 11, color: '#E8E4D2', marginTop: -4, marginBottom: 10, fontWeight: '600' },
  tipsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18 },
  tipCard: { width: '48%', padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1.5 },
  tipBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1 },
  tipEmoji: { fontSize: 18 },
  tipTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  tipBody: { fontSize: 11, color: '#374151', lineHeight: 15 },
  cta: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});