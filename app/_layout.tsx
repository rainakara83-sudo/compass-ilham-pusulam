import React, { useEffect, useRef, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { Animated, Easing, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../i18n';
import { loadStoredLanguage } from '../i18n';
import { getStoredNiche } from '../services/storage';
import { scheduleSnooze } from '../services/notificationService';
import { ThemeProvider } from '../services/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const segments = useSegments();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      await loadStoredLanguage();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const action = resp.actionIdentifier;
      if (action === 'SNOOZE_5') {
        scheduleSnooze(5, { hour: 0, minute: 0 });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!ready) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [ready, pulse]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const niche = await getStoredNiche();
      const inOnboarding = segments[0] === '(onboarding)';
      const segArr: string[] = Array.isArray(segments) ? segments : [];
      const onWelcome = segArr.some(s => s === 'welcome');
      if (!niche && !inOnboarding) {
        router.replace('/(onboarding)/language-select');
      } else if (niche && inOnboarding && !onWelcome) {
        router.replace('/(tabs)');
      }
    })();
  }, [ready, segments]);

  if (!ready) {
    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <Animated.Text style={{ fontSize: 64, transform: [{ scale }], opacity }}>🧭</Animated.Text>
        <Animated.Text style={{ marginTop: 16, fontSize: 22, fontWeight: '800', color: '#111827', opacity }}>
          Compass
        </Animated.Text>
        <Animated.Text style={{ marginTop: 4, fontSize: 13, fontWeight: '500', color: '#6366f1', opacity }}>
          İlham Pusulam
        </Animated.Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}