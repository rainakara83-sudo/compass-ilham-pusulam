import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getStoredNiches } from '../../services/storage';
import { lightColors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { radius } from '../../styles/radius';
import { typography } from '../../styles/typography';
import { shadows } from '../../styles/shadows';
import { CompassLogo, CompassBurst } from '../../components/CompassLogo';

export default function Welcome() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const burstScale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    getStoredNiches().then(() => {
      if (!mounted) return;

      Animated.sequence([
        Animated.parallel([
          Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
          Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
        Animated.timing(subtitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();

      Animated.loop(
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.8, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 1900);
    });

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [burstScale, fade, ringOpacity, ringScale, router, scale, subtitleFade]);

  return (
    <View style={styles.container}>
      <View style={styles.gradientTop} />
      <View style={styles.gradientBottom} />

      <View style={styles.brandRow}>
        <CompassLogo size={36} />
        <Text style={styles.brandText}>Compass</Text>
      </View>

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.ring,
            {
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: burstScale }] }}>
          <CompassBurst size={160} />
        </Animated.View>
        <Animated.Text style={[styles.title, { opacity: fade }]}>
          Hoş geldin!
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: subtitleFade }]}>
          İçerik koçun hazır. Hadi başlayalım 🚀
        </Animated.Text>
        <Animated.View style={[styles.badge, { opacity: subtitleFade }]}>
          <Text style={styles.badgeText}>✨ İLHAM PUSULAN</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.bg,
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: lightColors.primarySoft,
    opacity: 0.5,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: lightColors.secondarySoft,
    opacity: 0.35,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: 60,
  },
  brandText: {
    ...typography.h3,
    color: lightColors.text,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: lightColors.primarySoft,
  },
  title: {
    ...typography.h1,
    fontSize: 30,
    color: lightColors.text,
    marginTop: spacing.xl,
  },
  subtitle: {
    ...typography.body,
    color: lightColors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  badge: {
    marginTop: spacing.xl,
    backgroundColor: lightColors.primarySoft,
    borderColor: lightColors.primary,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...shadows.sm,
  },
  badgeText: {
    ...typography.caption,
    color: lightColors.primary,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
});
