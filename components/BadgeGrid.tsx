import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing } from '../styles/spacing';
import { radius } from '../styles/radius';
import { BADGES, BadgeId, getEarnedBadges } from '../services/achievements';
import { useTheme } from '../services/theme';

type Props = {
  onBadgePress?: (badge: typeof BADGES[number], earned: boolean) => void;
};

export default function BadgeGrid({ onBadgePress }: Props) {
  const { t } = useTranslation();
  const { isDark, colors } = useTheme();
  const [earned, setEarned] = useState<BadgeId[]>([]);

  useEffect(() => {
    (async () => {
      setEarned(await getEarnedBadges());
    })();
  }, []);

  const total = BADGES.length;
  const earnedCount = earned.length;
  const earnedSet = new Set(earned);

  const cardBg = isDark ? '#1F2937' : '#FFFFFF';
  const cardBorder = isDark ? '#374151' : '#E5E7EB';
  const fg = isDark ? '#F3F4F6' : '#111827';
  const subFg = isDark ? '#9CA3AF' : '#6B7280';
  const lockedBg = isDark ? '#374151' : '#F3F4F6';
  const lockedFg = isDark ? '#4B5563' : '#9CA3AF';

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: fg }]}>🏅 {t('achievements.sectionTitle')}</Text>
          <Text style={[styles.sub, { color: subFg }]}>
            {t('achievements.sectionSub', { earned: earnedCount, total })}
          </Text>
        </View>
        <View style={[styles.progressRing, { borderColor: colors?.primary ?? '#10B981' }]}>
          <Text style={[styles.progressTxt, { color: colors?.primary ?? '#10B981' }]}>
            {Math.round((earnedCount / Math.max(total, 1)) * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {BADGES.map((b) => {
          const isEarned = earnedSet.has(b.id);
          return (
            <Pressable
              key={b.id}
              onPress={() => onBadgePress?.(b, isEarned)}
              style={[
                styles.cell,
                {
                  backgroundColor: isEarned ? `${b.color}1A` : lockedBg,
                  borderColor: isEarned ? b.color : cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.icon,
                  !isEarned && { opacity: 0.4 },
                ]}
              >
                {isEarned ? b.icon : '🔒'}
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  styles.cellTitle,
                  { color: isEarned ? fg : lockedFg },
                ]}
              >
                {t(b.titleKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 2,
  },
  sub: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTxt: {
    fontSize: 12,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    width: '23.5%',
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  icon: {
    fontSize: 26,
    marginBottom: 4,
  },
  cellTitle: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 12,
  },
});