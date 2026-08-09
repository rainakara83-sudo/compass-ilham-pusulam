import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, SupportedLng, setAppLanguage } from '../i18n';
import { spacing } from '../styles/spacing';
import { radius } from '../styles/radius';
import { typography } from '../styles/typography';

const SELECTED_KEY = 'compass_language_selected';

type Props = {
  onComplete: () => void;
};

export default function LanguagePicker({ onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 520,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [fade, slideUp]);

  const pick = async (lng: SupportedLng) => {
    await setAppLanguage(lng);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SELECTED_KEY, '1');
      }
    } catch {
      // ignore
    }
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
      Animated.timing(slideUp, {
        toValue: -20,
        duration: 240,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
    ]).start(() => onComplete());
  };

  const currentLng = (i18n.language || 'en').split('-')[0];

  return (
    <Animated.View
      style={[
        styles.root,
        { opacity: fade, transform: [{ translateY: slideUp }] },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🧭</Text>
          <Text style={styles.logoTitle}>Compass</Text>
          <Text style={styles.logoSub}>İlham Pusulam</Text>
        </View>

        <View style={styles.headerBox}>
          <Text style={styles.badge}>{t('langPicker.welcome')}</Text>
          <Text style={styles.title}>{t('langPicker.chooseLanguage')}</Text>
          <Text style={styles.subtitle}>{t('langPicker.chooseLanguageSub')}</Text>
        </View>

        <View style={styles.list}>
          {SUPPORTED_LANGUAGES.map((lng, idx) => {
            const active = currentLng === lng.code;
            return (
              <Animated.View
                key={lng.code}
                style={{
                  opacity: fade,
                  transform: [
                    {
                      translateY: fade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20 * (idx + 1), 0],
                      }),
                    },
                  ],
                }}
              >
                <Pressable
                  onPress={() => pick(lng.code)}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                    active && styles.cardActive,
                  ]}
                >
                  <Text style={styles.flag}>{lng.flag}</Text>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>
                      {lng.label}
                    </Text>
                    <Text style={styles.cardSub}>
                      {t(`langPicker.code.${lng.code}`)}
                    </Text>
                  </View>
                  <View style={[styles.chevron, active && styles.chevronActive]}>
                    <Text style={[styles.chevronTxt, active && styles.chevronTxtActive]}>›</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Text style={styles.footer}>{t('langPicker.footer')}</Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#5C6B4F',
    zIndex: 10001,
    elevation: 26,
  },
  scrollContent: {
    paddingTop: Platform.select({ ios: 64, android: 44, default: 44 }),
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
  },
  logoBox: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  logoEmoji: {
    fontSize: 80,
    lineHeight: 92,
  },
  logoTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  logoSub: {
    fontSize: 14,
    color: '#FFFFFFCC',
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  badge: {
    ...typography.label,
    color: '#FFFFFFCC',
    fontWeight: '800',
    letterSpacing: 1.6,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.xs,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFFFFFE6',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    maxWidth: 340,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(15, 23, 42, 0.20)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.20,
        shadowRadius: 8,
      },
    }),
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  cardActive: {
    borderColor: '#2F3B25',
    backgroundColor: '#FFFFFF',
  },
  flag: {
    fontSize: 36,
    marginRight: spacing.md,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2F3B25',
  },
  cardTitleActive: {
    color: '#2F3B25',
  },
  cardSub: {
    fontSize: 12,
    color: '#5C6B4F',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(92,107,79,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronActive: {
    backgroundColor: '#2F3B25',
  },
  chevronTxt: {
    color: '#5C6B4F',
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 20,
  },
  chevronTxtActive: {
    color: '#FFFFFF',
  },
  footer: {
    color: '#FFFFFFB3',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
