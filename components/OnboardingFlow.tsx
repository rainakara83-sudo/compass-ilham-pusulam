import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing } from '../styles/spacing';
import { radius } from '../styles/radius';
import { typography } from '../styles/typography';
import { setOnboarded } from '../services/storage';

type Props = {
  onComplete: () => void;
  onSkip?: () => void;
};

export default function OnboardingFlow({ onComplete, onSkip }: Props) {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slideFade = useRef(new Animated.Value(1)).current;
  const totalSlides = 4;

  const slides = [
    {
      badge: t('onboarding.slide1Badge'),
      title: t('onboarding.slide1Title'),
      subtitle: t('onboarding.slide1Sub'),
      emoji: '🧭',
    },
    {
      badge: t('onboarding.slide2Badge'),
      title: t('onboarding.slide2Title'),
      subtitle: t('onboarding.slide2Sub'),
      emoji: '💪🍳✨👗',
    },
    {
      badge: t('onboarding.slide3Badge'),
      title: t('onboarding.slide3Title'),
      subtitle: t('onboarding.slide3Sub'),
      emoji: '🕒🔥',
    },
    {
      badge: t('onboarding.slide4Badge'),
      title: t('onboarding.slide4Title'),
      subtitle: t('onboarding.slide4Sub'),
      emoji: '🎉',
    },
  ];

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [fade]);

  const animateSlide = () => {
    slideFade.setValue(0.6);
    Animated.timing(slideFade, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  };

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= totalSlides || idx === currentSlide) return;
    setCurrentSlide(idx);
    animateSlide();
  };

  const next = () => {
    if (currentSlide < totalSlides - 1) {
      goTo(currentSlide + 1);
    }
  };

  const back = () => {
    if (currentSlide > 0) {
      goTo(currentSlide - 1);
    }
  };

  const finish = async () => {
    try {
      await setOnboarded();
    } catch {
      // ignore
    }
    if (onSkip) onSkip();
    Animated.timing(fade, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(() => onComplete());
  };

  const s = slides[currentSlide];
  const isLast = currentSlide === totalSlides - 1;

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <View style={styles.topRow}>
        <View style={styles.brandBox}>
          <Text style={styles.brandTxt}>🧭 Compass</Text>
        </View>
        {!isLast && (
          <Pressable onPress={finish} hitSlop={10} style={styles.skipBtn}>
            <Text style={styles.skipTxt}>{t('onboarding.skip')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.slideArea}>
        <Animated.View style={[styles.slideInner, { opacity: slideFade }]}>
          <View style={styles.visual}>
            <View style={styles.visualCircle}>
              <Text style={styles.emojiBig}>{s.emoji}</Text>
            </View>
          </View>
          <View style={styles.textBox}>
            <Text style={styles.badge}>{s.badge}</Text>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.subtitle}>{s.subtitle}</Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.bottomRow}>
        <Pressable
          onPress={back}
          disabled={currentSlide === 0}
          hitSlop={8}
          style={[styles.navBtn, currentSlide === 0 && styles.navBtnDisabled]}
        >
          <Text style={[styles.navTxt, currentSlide === 0 && styles.navTxtDisabled]}>
            {t('onboarding.back')}
          </Text>
        </Pressable>
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <Pressable
              key={`dot-${i}`}
              onPress={() => goTo(i)}
              hitSlop={8}
              style={[styles.dot, i === currentSlide && styles.dotActive]}
            />
          ))}
        </View>
        {isLast ? (
          <Pressable onPress={finish} style={styles.startBtn} hitSlop={6}>
            <Text style={styles.startBtnTxt}>{t('onboarding.start')}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={next} style={styles.navBtn} hitSlop={6}>
            <Text style={styles.navTxt}>{t('onboarding.next')}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#5C6B4F',
    zIndex: 10000,
    elevation: 24,
    paddingTop: Platform.select({ ios: 56, android: 36, default: 36 }),
    paddingBottom: Platform.select({ ios: 36, android: 24, default: 24 }),
    paddingHorizontal: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  brandBox: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  brandTxt: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  skipBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  skipTxt: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  slideArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  visual: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  visualCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBig: {
    fontSize: 96,
    lineHeight: 110,
    textAlign: 'center',
  },
  textBox: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  badge: {
    ...typography.label,
    fontWeight: '800',
    color: '#FFFFFFCC',
    letterSpacing: 1.4,
    marginBottom: spacing.xs,
    fontSize: 13,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: '#FFFFFFE6',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    maxWidth: 360,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  navBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  navBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  navTxt: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  navTxtDisabled: {
    color: 'rgba(255,255,255,0.35)',
  },
  startBtn: {
    backgroundColor: '#2F3B25',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...Platform.select({
      web: { boxShadow: '0 6px 18px rgba(15, 23, 42, 0.35)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
    }),
  },
  startBtnTxt: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});