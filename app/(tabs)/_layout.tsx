import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

export default function TabsLayout() {
  const { t, i18n: i18nInstance } = useTranslation();
  const [lng, setLng] = useState((i18n.language || 'en').split('-')[0]);

  useEffect(() => {
    const handler = (next: string) => {
      const cur = (next || 'en').split('-')[0];
      setLng(cur);
      console.log('[E3-DIAG] TabsLayout lng changed →', cur);
    };
    i18nInstance.on('languageChanged', handler);
    return () => {
      i18nInstance.off('languageChanged', handler);
    };
  }, [i18nInstance]);

  console.log('[E3-DIAG] TabsLayout render, lng=', lng, 'tabs.home=', t('tabs.home'));

  return (
    <Tabs
      key={lng}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2F3B25',
        tabBarInactiveTintColor: '#E8E4D2',
        tabBarStyle: {
          backgroundColor: '#FAFCF6',
          borderTopColor: '#C5D2A0',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarLabel: t('tabs.home') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore'), tabBarLabel: t('tabs.explore') }} />
      <Tabs.Screen name="favorites" options={{ title: t('tabs.favorites'), tabBarLabel: t('tabs.favorites') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history'), tabBarLabel: t('tabs.history') }} />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats'), tabBarLabel: t('tabs.stats') }} />
      <Tabs.Screen name="reminders" options={{ title: t('tabs.reminders'), tabBarLabel: t('tabs.reminders') }} />
      <Tabs.Screen name="qa" options={{ title: t('tabs.qa'), tabBarLabel: t('tabs.qa') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarLabel: t('tabs.profile') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar'), tabBarLabel: t('tabs.calendar') }} />
      <Tabs.Screen name="info" options={{ title: t('tabs.info'), tabBarLabel: t('tabs.info') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarLabel: t('tabs.settings') }} />
    </Tabs>
  );
}