import { type TextStyle, type ViewStyle } from 'react-native';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';
import type { Palette } from './colors';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeVariant = 'solid' | 'outline';

export type BadgeStyle = {
  container: ViewStyle;
  text: TextStyle;
};

export type ChipPalette = {
  default: BadgeStyle;
  selected: BadgeStyle;
};

const buildBadge = (
  bg: string,
  text: string,
  border: string,
): BadgeStyle => ({
  container: {
    backgroundColor: bg,
    borderColor: border,
    borderWidth: border === 'transparent' ? 0 : 1,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  text: {
    color: text,
    ...typography.caption,
    fontWeight: '600',
  },
});

const buildBadgeOutline = (
  text: string,
  border: string,
): BadgeStyle => ({
  container: {
    backgroundColor: 'transparent',
    borderColor: border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  text: {
    color: text,
    ...typography.caption,
    fontWeight: '600',
  },
});

export type BadgeStyles = {
  badges: Record<BadgeVariant, Record<BadgeTone, BadgeStyle>>;
  chips: ChipPalette;
  tag: BadgeStyle;
};

export const createBadgeStyles = (colors: Palette): BadgeStyles => {
  const solidByTone: Record<BadgeTone, BadgeStyle> = {
    neutral: buildBadge(colors.surface, colors.text, colors.border),
    primary: buildBadge(colors.primarySoft, colors.primary, 'transparent'),
    success: buildBadge(colors.success.bg, colors.success.text, 'transparent'),
    warning: buildBadge(colors.warning.bg, colors.warning.text, 'transparent'),
    error: buildBadge(colors.error.bg, colors.error.text, 'transparent'),
    info: buildBadge(colors.info.bg, colors.info.text, 'transparent'),
  };

  const outlineByTone: Record<BadgeTone, BadgeStyle> = {
    neutral: buildBadgeOutline(colors.text, colors.border),
    primary: buildBadgeOutline(colors.primary, colors.primary),
    success: buildBadgeOutline(colors.success.text, colors.success.border),
    warning: buildBadgeOutline(colors.warning.text, colors.warning.border),
    error: buildBadgeOutline(colors.error.text, colors.error.border),
    info: buildBadgeOutline(colors.info.text, colors.info.border),
  };

  const badges: Record<BadgeVariant, Record<BadgeTone, BadgeStyle>> = {
    solid: solidByTone,
    outline: outlineByTone,
  };

  const chips: ChipPalette = {
    default: {
      container: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.full,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
      },
      text: {
        color: colors.text,
        ...typography.label,
      },
    },
    selected: {
      container: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primary,
        borderWidth: 1,
        borderRadius: radius.full,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
      },
      text: {
        color: colors.primary,
        ...typography.label,
      },
    },
  };

  const tag: BadgeStyle = {
    container: {
      backgroundColor: colors.inputBg,
      borderRadius: radius.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    text: {
      color: colors.textMuted,
      ...typography.caption,
      fontWeight: '600',
    },
  };

  return { badges, chips, tag };
};