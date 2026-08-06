import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { lightColors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { radius } from '../../styles/radius';
import { typography } from '../../styles/typography';
import { shadows } from '../../styles/shadows';
import { CompassLogo } from '../../components/CompassLogo';
import { NicheImage, getNiche } from '../../components/NicheImage';

type Niche = { id: string; icon: string; color: string; image?: string };

type Slide = {
  key: string;
  icon: string;
  accent: string;
  accentSoft: string;
  title: string;
  body: string;
  badge: string;
  previewNiches?: string[];
};

const SLIDES: Slide[] = [
  {
    key: 'discover',
    icon: '🧭',
    accent: lightColors.primary,
    accentSoft: lightColors.primarySoft,
    title: 'Her hafta yeni ilham',
    body: 'Nişini seç, sana özel 7 günlük içerik planı otomatik hazırlansın.',
    badge: 'KEŞFET',
    previewNiches: ['fitness', 'food', 'tech', 'fashion'],
  },
  {
    key: 'ai',
    icon: '✨',
    accent: lightColors.accent,
    accentSoft: lightColors.accentSoft,
    title: 'AI ile sınırsız fikir',
    body: 'Stuck anında AI\'a sor — 30 farklı açıdan yeni içerik fikirleri üret.',
    badge: 'AI DESTEKLİ',
    previewNiches: ['tech', 'gaming', 'beauty'],
  },
  {
    key: 'plan',
    icon: '📅',
    accent: lightColors.secondary,
    accentSoft: lightColors.secondarySoft,
    title: 'Takvim & hatırlatıcı',
    body: 'İçeriklerini takvime yerleştir, zamanlama önerilerini al, bildirimle hatırlat.',
    badge: 'PLANLAMA',
    previewNiches: ['travel', 'food'],
  },
  {
    key: 'grow',
    icon: '🚀',
    accent: lightColors.success.solid,
    accentSoft: lightColors.success.bg,
    title: 'Streak ile büyü',
    body: 'Tutarlı üret, streak kazan, kalkanlarını biriktir. Performansını analiz et.',
    badge: 'BÜYÜME',
    previewNiches: ['personal_dev', 'fitness'],
  },
];

const { width: SCREEN_W } = Dimensions.get('window');

export default function Intro() {
  const router = useRouter();
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== index) setIndex(i);
  };

  const goNext = () => {
    if (index >= SLIDES.length - 1) {
      router.replace('/(onboarding)/language-select');
      return;
    }
    const next = index + 1;
    listRef.current?.scrollToOffset({ offset: next * SCREEN_W, animated: true });
    setIndex(next);
  };

  const skip = () => router.replace('/(onboarding)/language-select');

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <CompassLogo size={28} />
          <Text style={styles.brandText}>Compass</Text>
        </View>
        <Pressable onPress={skip} hitSlop={10} style={styles.skipBtn}>
          <Text style={styles.skipText}>Atla</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <SlideContent slide={item} />
        )}
      />

      <View style={styles.bottomBar}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                i === index && styles.dotActive,
                i === index && { backgroundColor: SLIDES[index].accent },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: SLIDES[index].accent },
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaText}>
            {isLast ? t('common.continue') : 'Devam'}
          </Text>
          <Text style={styles.ctaArrow}>{isLast ? '🚀' : '›'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SlideContent({ slide }: { slide: Slide }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    scale.setValue(0.6);
    fade.setValue(0);
    ringScale.setValue(0);
    ringOpacity.setValue(0.5);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [fade, ringOpacity, ringScale, scale, slide.key]);

  return (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      <View style={styles.heroWrap}>
        <Animated.View
          style={[
            styles.ring,
            {
              backgroundColor: slide.accentSoft,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.iconBubble,
            {
              backgroundColor: slide.accentSoft,
              borderColor: slide.accent,
              transform: [{ scale }],
              opacity: fade,
            },
          ]}
        >
          <Text style={styles.iconText}>{slide.icon}</Text>
        </Animated.View>
      </View>

      {slide.previewNiches && slide.previewNiches.length > 0 && (
        <Animated.View style={[styles.nichePreviewRow, { opacity: fade }]}>
          {slide.previewNiches.map((id) => {
            const n = getNiche(id);
            if (!n) return null;
            return (
              <View
                key={id}
                style={[
                  styles.nichePreviewItem,
                  { borderColor: n.color, backgroundColor: n.color + '1A' },
                ]}
              >
                <NicheImage nicheId={id} size={48} borderRadius={10} />
                <Text style={styles.nichePreviewLabel} numberOfLines={1}>
                  {id === 'personal_dev' ? 'Kişisel' : id.charAt(0).toUpperCase() + id.slice(1)}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      )}

      <Animated.View style={[styles.textWrap, { opacity: fade }]}>
        <View style={[styles.badge, { backgroundColor: slide.accentSoft, borderColor: slide.accent }]}>
          <Text style={[styles.badgeText, { color: slide.accent }]}>{slide.badge}</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.bg,
  },
  topBar: {
    paddingTop: 56,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandText: {
    ...typography.h3,
    color: lightColors.text,
  },
  skipBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: lightColors.inputBg,
  },
  skipText: {
    ...typography.label,
    color: lightColors.textMuted,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['4xl'],
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  iconBubble: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  iconText: {
    fontSize: 76,
  },
  nichePreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  nichePreviewItem: {
    width: 64,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  nichePreviewImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginBottom: 2,
  },
  nichePreviewIcon: {
    fontSize: 26,
    marginBottom: 2,
  },
  nichePreviewLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2F3E2C',
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1.5,
    marginBottom: spacing.lg,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    ...typography.h1,
    color: lightColors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: lightColors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    paddingTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: lightColors.border,
  },
  dotActive: {
    width: 28,
  },
  cta: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    ...typography.label,
    color: lightColors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaArrow: {
    color: lightColors.textInverse,
    fontSize: 18,
    fontWeight: '700',
  },
});
