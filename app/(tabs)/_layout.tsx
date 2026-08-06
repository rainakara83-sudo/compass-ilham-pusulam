import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
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
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore') }} />
      <Tabs.Screen name="favorites" options={{ title: t('tabs.favorites') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
      <Tabs.Screen name="reminders" options={{ title: t('tabs.reminders') }} />
      <Tabs.Screen name="qa" options={{ title: t('tabs.qa') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Takvim' }} />
      <Tabs.Screen name="info" options={{ title: t('tabs.info') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}