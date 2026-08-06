import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  DailyCardEntry,
  bumpDailyCardFlip,
  getDailyCard,
  getDailyCardFlips,
  rerollDailyCard,
  getStreak,
} from '../services/storage';
import { NicheId } from '../services/contentService';
import niches from '../data/niches.json';

const NICHE_ICONS = (niches as { id: string; icon: string }[]).reduce((acc, n) => {
  acc[n.id] = n.icon;
  return acc;
}, {} as Record<string, string>);

const TURKISH_DAY = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TURKISH_MONTH = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export default function DailyCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ niche?: string }>();
  const initialNiche: NicheId | null = typeof params.niche === 'string' ? (params.niche as NicheId) : null;

  const [card, setCard] = useState<DailyCardEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const [flips, setFlips] = useState(0);
  const [copied, setCopied] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const loadCard = useCallback(async () => {
    const [c, s, f] = await Promise.all([
      getDailyCard(initialNiche),
      getStreak(),
      getDailyCardFlips(),
    ]);
    setCard(c);
    setStreak(s.count);
    setFlips(f);
  }, [initialNiche]);

  useFocusEffect(
    useCallback(() => {
      loadCard();
    }, [loadCard])
  );

  useEffect(() => {
    flipAnim.setValue(0);
    setFlipped(false);
  }, [card]);

  const flip = () => {
    const next = flipped ? 0 : 1;
    setFlipped(!flipped);
    Animated.timing(flipAnim, {
      toValue: next,
      duration: 380,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(async () => {
      const f = await bumpDailyCardFlip();
      setFlips(f);
    });
  };

  const onReroll = async () => {
    const next = await rerollDailyCard(initialNiche);
    setCard(next);
  };

  const onCopy = () => {
    if (!card) return;
    Clipboard.setString(card.idea);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onOpenDetail = () => {
    if (!card) return;
    router.push({
      pathname: '/idea/[text]',
      params: {
        text: encodeURIComponent(card.idea),
        niche: card.niche ?? '',
        source: 'daily',
      },
    });
  };

  if (!card) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  const today = new Date();
  const dateLabel = `${today.getDate()} ${TURKISH_MONTH[today.getMonth()]} ${TURKISH_MONTH[today.getMonth()] ? '' : ''}${today.getFullYear()}, ${TURKISH_DAY[today.getDay()]}`;
  const isPrompt = !card.niche;
  const streakTier = streak >= 30 ? 'gold' : streak >= 7 ? 'fire' : streak >= 3 ? 'warm' : 'cold';
  const tierMeta = {
    gold: { glow: '#F59E0B', label: 'Altın seri', emoji: '🏆' },
    fire: { glow: '#EF4444', label: 'Ateş seri', emoji: '🔥' },
    warm: { glow: '#F97316', label: 'Sıcak seri', emoji: '☀️' },
    cold: { glow: '#3B82F6', label: 'Yeni başlangıç', emoji: '🌱' },
  }[streakTier];

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5001],
    outputRange: [1, 1, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.4999, 0.5],
    outputRange: [0, 0, 1],
  });

  const nicheEntry = (niches as { id: string; color: string }[]).find((n) => n.id === card.niche);
  const nicheColor = nicheEntry?.color ?? '#7c5cff';
  const hexToRgb = (h: string) => {
    const c = h.replace('#', '');
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [nr, ng, nb] = hexToRgb(nicheColor);
  const lightBg = `rgb(${Math.round(nr + (255 - nr) * 0.85)}, ${Math.round(ng + (255 - ng) * 0.85)}, ${Math.round(nb + (255 - nb) * 0.85)})`;
  const midBg = `rgb(${Math.round(nr + (255 - nr) * 0.7)}, ${Math.round(ng + (255 - ng) * 0.7)}, ${Math.round(nb + (255 - nb) * 0.7)})`;
  const darkText = `rgb(${Math.round(nr * 0.35)}, ${Math.round(ng * 0.35)}, ${Math.round(nb * 0.35)})`;
  const frontBg = midBg;
  const backBg = darkText;
  const frontText = darkText;
  const backText = '#FFFFFF';
  const frontBadge = darkText;
  const backBadge = lightBg;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: lightBg }]}>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backTxt}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🌟 Günün Kartı</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.dateLabel}>{dateLabel}</Text>

      <View style={styles.streakRow}>
        <View style={[styles.streakPill, { backgroundColor: tierMeta.glow + '22', borderColor: tierMeta.glow }]}>
          <Text style={styles.streakPillEmoji}>{tierMeta.emoji}</Text>
          <Text style={[styles.streakPillTxt, { color: tierMeta.glow }]}>
            {streak > 0 ? `${streak} gün · ${tierMeta.label}` : 'Bugün başla'}
          </Text>
        </View>
        <View style={styles.flipsPill}>
          <Text style={styles.flipsPillTxt}>🔄 {flips} kez çevrildi</Text>
        </View>
      </View>

      <View style={styles.cardWrapper}>
        <Animated.View
          style={[
            styles.cardFace,
            { transform: [{ rotateY: frontRotate }], opacity: frontOpacity },
          ]}
        >
          <View style={[styles.faceInner, { backgroundColor: frontBg, borderColor: nicheColor }]}>
            <Text style={[styles.faceBadge, { color: frontBadge }]}>{isPrompt ? '💡 GÜNLÜK SORU' : '✨ GÜNÜN İLHAMI'}</Text>
            <Text style={[styles.faceText, { color: frontText }]} numberOfLines={isPrompt ? 5 : 6}>
              {card.idea}
            </Text>
            <Text style={[styles.faceTapHint, { color: frontText, opacity: 0.6 }]}>Çevirmek için karta dokun ↻</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBack,
            { transform: [{ rotateY: backRotate }], opacity: backOpacity },
          ]}
        >
          <View style={[styles.faceInner, { backgroundColor: backBg, borderColor: lightBg }]}>
            <Text style={[styles.faceBadgeBack, { color: backBadge }]}>🎯 NEDEN BU?</Text>
            {card.niche ? (
              <Text style={[styles.faceTextBack, { color: backText }]}>
                Bu fikir senin <Text style={{ fontWeight: '800' }}>{card.niche}</Text> nişinden geldi.
                {'\n\n'}Kısa bir ipucu:
                {'\n'}• İlk 3 saniyede dikkat çekici bir açı dene
                {'\n'}• Paylaşmadan önce 1 cümleyle özetle
                {'\n'}• Takipçilerine soru sor — yorum alsın
              </Text>
            ) : (
              <Text style={[styles.faceTextBack, { color: backText }]}>
                Henüz bir niş seçmedin. Bu yüzden sana bir günlük ilham sorusu gösteriyoruz.
                {'\n\n'}İpucu: Bir niş seç, bu kart o nişin havuzundan öneriler getirsin.
              </Text>
            )}
            <Text style={[styles.faceTapHint, { color: backText, opacity: 0.7 }]}>↩ Geri çevirmek için dokun</Text>
          </View>
        </Animated.View>

        <Pressable style={StyleSheet.absoluteFill} onPress={flip} />
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onCopy} style={[styles.actionBtn, { backgroundColor: nicheColor }]}>
          <Text style={styles.actionBtnTxt}>{copied ? '✓ Kopyalandı' : '⧉ Kopyala'}</Text>
        </Pressable>
        <Pressable onPress={onReroll} style={[styles.actionBtn, { backgroundColor: darkText }]}>
          <Text style={styles.actionBtnTxt}>🎲 Yenisi</Text>
        </Pressable>
        <Pressable
          onPress={onOpenDetail}
          disabled={isPrompt}
          style={[styles.actionBtn, { backgroundColor: midBg, opacity: isPrompt ? 0.4 : 1 }]}
        >
          <Text style={[styles.actionBtnTxt, { color: darkText }]}>Detay ›</Text>
        </Pressable>
      </View>

      {card.niche && (
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>{NICHE_ICONS[card.niche] ?? '✨'}</Text>
          <Text style={styles.metaTxt}>{t(`niches.${card.niche}`, card.niche)} · {card.date}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  backTxt: { fontSize: 16, color: '#374151', fontWeight: '800' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  dateLabel: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  streakRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  streakPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1.5,
  },
  streakPillEmoji: { fontSize: 14, marginRight: 6 },
  streakPillTxt: { fontSize: 12, fontWeight: '800' },
  flipsPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, backgroundColor: 'white',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  flipsPillTxt: { fontSize: 12, color: '#6B7280', fontWeight: '700' },
  cardWrapper: { width: '100%', aspectRatio: 0.72, marginBottom: 18 },
  cardFace: {
    position: 'absolute',
    width: '100%', height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardBack: { position: 'absolute' },
  faceInner: {
    flex: 1,
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  faceInnerBack: { backgroundColor: '#111827' },
  faceBadge: {
    fontSize: 11, fontWeight: '800', color: '#6B7280',
    letterSpacing: 1.5, marginBottom: 18,
  },
  faceBadgeBack: {
    fontSize: 11, fontWeight: '800', color: '#FCD34D',
    letterSpacing: 1.5, marginBottom: 18,
  },
  faceText: {
    fontSize: 20, color: '#111827', fontWeight: '700',
    lineHeight: 28, textAlign: 'center',
  },
  faceTextBack: {
    fontSize: 14, color: '#E5E7EB', fontWeight: '500',
    lineHeight: 22, textAlign: 'left',
  },
  faceTapHint: {
    fontSize: 11, color: '#9CA3AF', fontStyle: 'italic',
    marginTop: 22, textAlign: 'center',
  },
  actions: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  actionBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnCopy: { backgroundColor: '#4D96FF' },
  actionBtnReroll: { backgroundColor: '#8B5CF6' },
  actionBtnDetail: { backgroundColor: '#111827' },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnTxt: { color: 'white', fontWeight: '800', fontSize: 13 },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, gap: 6,
  },
  metaIcon: { fontSize: 14 },
  metaTxt: { fontSize: 11, color: '#9CA3AF', fontWeight: '700' },
});