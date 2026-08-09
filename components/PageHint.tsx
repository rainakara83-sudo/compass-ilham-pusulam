import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../services/theme';

const DISMISS_PREFIX = '@content-coach/hint-dismissed:';

export type PageHintProps = {
  hintId: string;
  icon?: string;
  title?: string;
  description?: string;
  variant?: 'info' | 'tip' | 'highlight';
  dismissible?: boolean;
};

const VARIANT_META: Record<
  'info' | 'tip' | 'highlight',
  { icon: string; accent: string; lightBg: string; darkBg: string }
> = {
  info: { icon: '💡', accent: '#0EA5E9', lightBg: '#E0F2FE', darkBg: '#0C4A6E' },
  tip: { icon: '✨', accent: '#8B5CF6', lightBg: '#F0E8FA', darkBg: '#3D2E5C' },
  highlight: { icon: '🌟', accent: '#F59E0B', lightBg: '#FEF3C7', darkBg: '#78350F' },
};

export const PageHint: React.FC<PageHintProps> = ({
  hintId,
  icon,
  title,
  description,
  variant = 'info',
  dismissible = true,
}) => {
  const { isDark } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = `${DISMISS_PREFIX}${hintId}`;
    AsyncStorage.getItem(key)
      .then((v) => {
        setDismissed(v === '1');
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [hintId]);

  const onDismiss = useCallback(async () => {
    setDismissed(true);
    try {
      await AsyncStorage.setItem(`${DISMISS_PREFIX}${hintId}`, '1');
    } catch {}
  }, [hintId]);

  if (!ready || dismissed) return null;

  const meta = VARIANT_META[variant];
  const accent = meta.accent;
  const bg = isDark ? meta.darkBg : meta.lightBg;
  const border = accent;
  const titleColor = isDark ? '#FAFCF6' : '#1A1F16';
  const descColor = isDark ? '#FAFCF6' : '#2F3B25';
  const closeBg = isDark ? accent : '#FFFFFF';
  const closeFg = isDark ? '#FAFCF6' : '#1A1F16';

  return (
    <View style={[styles.box, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.row}>
        <View style={[styles.iconBubble, { backgroundColor: isDark ? accent : accent + '22' }]}>
          <Text style={[styles.iconText, { color: isDark ? '#FAFCF6' : accent }]}>
            {icon ?? meta.icon}
          </Text>
        </View>
        <View style={styles.body}>
          {title && <Text style={[styles.title, { color: titleColor }]}>{title}</Text>}
          {description && (
            <Text style={[styles.desc, { color: descColor }]}>{description}</Text>
          )}
        </View>
        {dismissible && (
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            style={[styles.closeBtn, { backgroundColor: closeBg }]}
            accessibilityLabel="Dismiss hint"
          >
            <Text style={[styles.closeTxt, { color: closeFg }]}>✕</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  body: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
    ...Platform.select({ web: { letterSpacing: 0.2 } }),
  },
  desc: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { fontSize: 11, fontWeight: '800' },
});

export default PageHint;
