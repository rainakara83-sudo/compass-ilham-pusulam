import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing } from '../styles/spacing';
import { radius } from '../styles/radius';
import { AchievementBadge } from '../services/achievements';
import { useTheme } from '../services/theme';

type Props = {
  badge: AchievementBadge | null;
  onDismiss: () => void;
};

export default function BadgeToast({ badge, onDismiss }: Props) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const slide = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!badge) return;
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: -120,
          duration: 260,
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, 2800);
    return () => clearTimeout(timer);
  }, [badge, slide, opacity, onDismiss]);

  if (!badge) return null;

  const bg = isDark ? '#1F2937' : '#FFFFFF';
  const fg = isDark ? '#F3F4F6' : '#111827';
  const subFg = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { transform: [{ translateY: slide }], opacity },
      ]}
    >
      <Pressable onPress={onDismiss} style={[styles.card, { backgroundColor: bg, borderColor: badge.color }]}>
        <View style={[styles.iconWrap, { backgroundColor: badge.color }]}>
          <Text style={styles.icon}>{badge.icon}</Text>
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: fg }]}>{t('achievements.toastTitle')}</Text>
          <Text style={[styles.name, { color: badge.color }]}>{t(badge.titleKey)}</Text>
          <Text style={[styles.desc, { color: subFg }]} numberOfLines={1}>
            {t(badge.descKey)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Platform.select({ ios: 56, android: 36, default: 24 }),
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    elevation: 30,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.md,
    ...Platform.select({
      web: { boxShadow: '0 10px 24px rgba(0,0,0,0.18)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
    }),
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 26,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    opacity: 0.8,
  },
  name: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  desc: {
    fontSize: 12,
    fontWeight: '500',
  },
});