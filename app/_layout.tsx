import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../i18n';
import { loadStoredLanguage } from '../i18n';
import { scheduleSnooze } from '../services/notificationService';
import { ThemeProvider } from '../services/theme';
import LanguagePicker from '../components/LanguagePicker';
import { lightColors } from '../styles/colors';

const ACTIVE_NICHE_KEY = '@content-coach/active-niche';
const ONBOARDED_KEY = '@content-coach/onboarded';
const IDEA_BANK_KEY = '@content-coach/idea-bank';
const EARNED_BADGES_KEY = '@content-coach/earned-badges';

type Stage = 'loading' | 'language' | 'onboarding' | 'app';

export default function RootLayout() {
  const [stage, setStage] = useState<Stage>('loading');
  const pathname = usePathname();

  useEffect(() => {
    const init = async () => {
      try {
        await loadStoredLanguage();
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        const langFlag =
          typeof window !== 'undefined' && window.localStorage
            ? window.localStorage.getItem('compass_language_selected')
            : null;
        const langStored = await AsyncStorage.getItem('@content-coach/language');

        if (!langFlag && !langStored) {
          setStage('language');
        } else if (!onboarded) {
          setStage('onboarding');
        } else {
          setStage('app');
        }
      } catch {
        setStage('app');
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (stage === 'onboarding' && pathname && (pathname.includes('(tabs)') || pathname.includes('/idea') || pathname.includes('search') || pathname.includes('settings'))) {
      AsyncStorage.getItem(ONBOARDED_KEY).then((v) => {
        if (v) setStage('app');
      });
    }
  }, [pathname, stage]);

  useEffect(() => {
    const debug = async () => {
      try {
        const niche = await AsyncStorage.getItem(ACTIVE_NICHE_KEY);
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        const bank = await AsyncStorage.getItem(IDEA_BANK_KEY);
        const achievements = await AsyncStorage.getItem(EARNED_BADGES_KEY);
        const bankArr = bank ? JSON.parse(bank) : [];
        console.log('=== AsyncStorage Debug ===');
        console.log('stage:', stage);
        console.log('niche:', niche);
        console.log('onboarded:', onboarded);
        console.log('bank length:', Array.isArray(bankArr) ? bankArr.length : 0);
        console.log('achievements:', achievements);
      } catch (e) {
        console.log('AsyncStorage debug failed:', e);
      }
    };
    if (stage !== 'loading') debug();
  }, [stage]);

  useEffect(() => {
    const migrate = async () => {
      try {
        const niche = await AsyncStorage.getItem(ACTIVE_NICHE_KEY);
        if (niche === 'lifestyle') {
          await AsyncStorage.setItem(ACTIVE_NICHE_KEY, 'fashion');
          console.log('Migrated lifestyle → fashion');
        }
        const bank = await AsyncStorage.getItem(IDEA_BANK_KEY);
        if (bank) {
          try {
            const parsed = JSON.parse(bank);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await AsyncStorage.removeItem(IDEA_BANK_KEY);
              console.log('Cleared old idea bank, will reseed on next load');
            }
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        console.log('Migrate failed:', e);
      }
    };
    if (stage === 'app') migrate();
  }, [stage]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const action = resp.actionIdentifier;
      if (action === 'SNOOZE_5') {
        scheduleSnooze(5, { hour: 0, minute: 0 });
      }
    });
    return () => sub.remove();
  }, []);

  if (stage === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={lightColors.primary} size="large" />
      </View>
    );
  }

  if (stage === 'language') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <LanguagePicker onComplete={() => setStage('onboarding')} />
        </ThemeProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {stage === 'onboarding' ? (
            <Stack.Screen name="(onboarding)" />
          ) : (
            <Stack.Screen name="(tabs)" />
          )}
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFCF6',
  },
});
