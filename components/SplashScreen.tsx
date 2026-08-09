import React, { useEffect, useRef } from 'react';
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
import { setOnboarded } from '../services/storage';

type Props = {
  onComplete: () => void;
};

export default function SplashScreen({ onComplete }: Props) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(logoPulse, { toValue: 0, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [fade, logoScale, logoPulse]);

  const handleStart = async () => {
    try {
      await setOnboarded();
    } catch {
      // ignore
    }
    Animated.timing(fade, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(() => onComplete());
  };

  const ringScale = logoPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = logoPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.logoRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <Animated.View style={[styles.logoCircle, { transform: [{ scale: logoScale }] }]}>
            <Text style={styles.logoEmoji}>🧭</Text>
          </Animated.View>
        </View>

        <Text style={styles.title}>{t('splash.title')}</Text>
        <Text style={styles.subtitle}>{t('splash.subtitle')}</Text>
      </View>

      <View style={styles.bottom}>
        <Pressable onPress={handleStart} style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}>
          <Text style={styles.startBtnTxt}>{t('splash.start')}</Text>
        </Pressable>
        <Text style={styles.hint}>{t('splash.hint')}</Text>
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
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  logoCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 96,
    lineHeight: 110,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFFCC',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 340,
    lineHeight: 22,
  },
  bottom: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  startBtn: {
    backgroundColor: '#2F3B25',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    minWidth: 220,
    alignItems: 'center',
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
  startBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  startBtnTxt: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  hint: {
    color: '#FFFFFFAA',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});