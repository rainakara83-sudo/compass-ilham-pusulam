import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useTheme } from '../../services/theme';

const TAB_ICONS: Record<string, string> = {
  index: '🧭',
  explore: '🔍',
  favorites: '★',
  history: '⏱',
  stats: '📊',
  reminders: '🔔',
  qa: '💬',
  profile: '👤',
  calendar: '📅',
  info: 'ℹ️',
  settings: '⚙️',
};

export default function TabsLayout() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { colors, isDark } = useTheme();
  const [lng, setLng] = useState((i18n.language || 'en').split('-')[0]);

  useEffect(() => {
    const handler = (next: string) => {
      const cur = (next || 'en').split('-')[0];
      setLng(cur);
    };
    i18nInstance.on('languageChanged', handler);
    return () => {
      i18nInstance.off('languageChanged', handler);
    };
  }, [i18nInstance]);

  const activeColor = isDark ? '#A8C8FF' : '#2F3B25';
  const activeAccent = isDark ? '#60A5FA' : '#D4836B';
  const inactiveColor = isDark ? '#7A8AA0' : '#6B6B6B';
  const barBg = isDark ? colors.surfaceElevated : '#FAFCF6';
  const borderTopColor = isDark ? colors.border : '#C5D2A0';
  const indicatorColor = isDark ? '#60A5FA' : '#D4836B';

  const renderLabel = (routeName: string, label: string, focused: boolean) => {
    const icon = TAB_ICONS[routeName] ?? '•';
    return (
      <View style={styles.tabItem}>
        <Text
          style={[
            styles.tabIcon,
            {
              color: focused ? activeAccent : inactiveColor,
              fontSize: focused ? 22 : 18,
              transform: focused ? [{ translateY: -2 }] : [{ translateY: 0 }],
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {icon}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: focused ? activeColor : inactiveColor,
              fontWeight: focused ? '700' : '500',
              opacity: focused ? 1 : 0.85,
            },
          ]}
        >
          {label}
        </Text>
        {focused && (
          <View
            style={[
              styles.indicator,
              { backgroundColor: indicatorColor },
            ]}
          />
        )}
      </View>
    );
  };

  const screenOptions = {
    headerShown: false,
    tabBarActiveTintColor: activeColor,
    tabBarInactiveTintColor: inactiveColor,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '500' as const,
      letterSpacing: 0.2,
    },
    tabBarStyle: {
      backgroundColor: barBg,
      borderTopColor,
      borderTopWidth: StyleSheet.hairlineWidth,
      height: Platform.OS === 'web' ? 64 : 60,
      paddingTop: 4,
      paddingBottom: Platform.OS === 'web' ? 8 : 4,
    },
    tabBarItemStyle: {
      paddingVertical: 2,
    },
  };

  return (
    <Tabs key={lng} screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: ({ focused }) => renderLabel('index', t('tabs.home'), focused),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarLabel: ({ focused }) => renderLabel('explore', t('tabs.explore'), focused),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('tabs.favorites'),
          tabBarLabel: ({ focused }) => renderLabel('favorites', t('tabs.favorites'), focused),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarLabel: ({ focused }) => renderLabel('history', t('tabs.history'), focused),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarLabel: ({ focused }) => renderLabel('stats', t('tabs.stats'), focused),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: t('tabs.reminders'),
          tabBarLabel: ({ focused }) => renderLabel('reminders', t('tabs.reminders'), focused),
        }}
      />
      <Tabs.Screen
        name="qa"
        options={{
          title: t('tabs.qa'),
          tabBarLabel: ({ focused }) => renderLabel('qa', t('tabs.qa'), focused),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: ({ focused }) => renderLabel('profile', t('tabs.profile'), focused),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('tabs.calendar'),
          tabBarLabel: ({ focused }) => renderLabel('calendar', t('tabs.calendar'), focused),
        }}
      />
      <Tabs.Screen
        name="info"
        options={{
          title: t('tabs.info'),
          tabBarLabel: ({ focused }) => renderLabel('info', t('tabs.info'), focused),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarLabel: ({ focused }) => renderLabel('settings', t('tabs.settings'), focused),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    minHeight: 48,
    position: 'relative',
  },
  tabIcon: {
    textAlign: 'center',
    lineHeight: 24,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  indicator: {
    position: 'absolute',
    bottom: -6,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 2,
  },
});
