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

const DISMISS_KEY = '@content-coach/pwa-banner-dismissed';

type UAInfo = {
  isIOS: boolean;
  isIPadOS: boolean;
  isSafari: boolean;
  isAndroid: boolean;
  isChrome: boolean;
  isStandalone: boolean;
};

const detectUA = (): UAInfo => {
  if (typeof navigator === 'undefined') {
    return { isIOS: false, isIPadOS: false, isSafari: false, isAndroid: false, isChrome: false, isStandalone: false };
  }
  const ua = navigator.userAgent || '';
  const isIPadOS = /Mac/.test(ua) && (navigator as any).maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPadOS;
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome|CriOS|Edg/.test(ua) && !/Firefox/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Edg|FxiOS|OPR/.test(ua) && !isChrome;
  const isStandalone =
    typeof window !== 'undefined' &&
    ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator as any).standalone === true);
  return { isIOS, isIPadOS, isSafari, isAndroid, isChrome, isStandalone };
};

const isDismissed = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

const setDismissed = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // ignore
  }
};

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PWAInstallBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<UAInfo | null>(null);
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const slideUp = useRef(new Animated.Value(60)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const i = detectUA();
    setInfo(i);
    if (i.isStandalone) return;
    if (isDismissed()) return;
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    setVisible(true);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      dismiss();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [fade, slideUp]);

  const dismiss = () => {
    setDismissed();
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
      Animated.timing(slideUp, {
        toValue: 60,
        duration: 240,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
    ]).start(() => setVisible(false));
  };

  const onAndroidInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // ignore
    }
    setDeferred(null);
    dismiss();
  };

  if (!visible || !info) return null;

  const isIOSDevice = info.isIOS && info.isSafari;
  const isAndroidChrome = info.isAndroid && info.isChrome && deferred && !installed;

  const iosSteps = [
    { icon: '⬆️', title: t('pwa.iosStep1Title'), text: t('pwa.iosStep1') },
    { icon: '➕', title: t('pwa.iosStep2Title'), text: t('pwa.iosStep2') },
    { icon: '🧭', title: t('pwa.iosStep3Title'), text: t('pwa.iosStep3') },
  ];

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity: fade, transform: [{ translateY: slideUp }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeIcon}>📲</Text>
          <Text style={styles.title}>{t('pwa.title')}</Text>
          <Pressable onPress={dismiss} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close">
            <Text style={styles.closeTxt}>×</Text>
          </Pressable>
        </View>

        {isIOSDevice ? (
          <View style={styles.iosStepsContainer}>
            {iosSteps.map((s, idx) => (
              <View key={`ios-step-${idx}`} style={styles.iosStepRow}>
                <View style={styles.iosStepIconBox}>
                  <Text style={styles.iosStepIcon}>{s.icon}</Text>
                </View>
                <View style={styles.iosStepContent}>
                  <Text style={styles.iosStepTitle}>{s.title}</Text>
                  <Text style={styles.iosStepText}>{s.text}</Text>
                </View>
                {idx < iosSteps.length - 1 && <View style={styles.iosStepLine} />}
              </View>
            ))}
            <Text style={styles.iosHint}>{t('pwa.iosHint')}</Text>
          </View>
        ) : isAndroidChrome ? (
          <View style={styles.androidContainer}>
            <Text style={styles.body}>{t('pwa.androidBody')}</Text>
            <Pressable onPress={onAndroidInstall} style={styles.installBtn}>
              <Text style={styles.installBtnTxt}>{t('pwa.installBtn')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.otherContainer}>
            <Text style={styles.body}>{t('pwa.otherBody')}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    padding: spacing.sm,
    paddingBottom: spacing.sm + 16,
    pointerEvents: 'box-none',
  },
  banner: {
    backgroundColor: '#5C6B4F',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#2F3B25',
    ...Platform.select({
      web: { boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.25)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badgeIcon: { fontSize: 18, marginRight: spacing.xs },
  title: {
    flex: 1,
    ...typography.label,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2F3B25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeTxt: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  body: {
    ...typography.caption,
    color: '#FFFFFF',
    lineHeight: 18,
    fontWeight: '500',
  },
  iosStepsContainer: {
    marginTop: spacing.xs,
  },
  iosStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    position: 'relative',
  },
  iosStepIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2F3B25',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  iosStepIcon: {
    fontSize: 20,
  },
  iosStepContent: {
    flex: 1,
    paddingTop: 2,
  },
  iosStepTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 2,
  },
  iosStepText: {
    color: '#FFFFFFE6',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  iosStepLine: {
    position: 'absolute',
    left: 19,
    top: 40,
    width: 2,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  iosHint: {
    color: '#FFFFFFB3',
    fontSize: 11,
    fontWeight: '500',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  androidContainer: {
    marginTop: spacing.xs,
  },
  otherContainer: {
    marginTop: spacing.xs,
  },
  installBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: '#2F3B25',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  installBtnTxt: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
