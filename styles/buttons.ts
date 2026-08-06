import { type TextStyle, type ViewStyle } from 'react-native';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';
import type { Palette } from './colors';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonState = 'default' | 'pressed';

export type ButtonStyleSet = {
  container: ViewStyle;
  text: TextStyle;
};

export type ButtonStyles = {
  default: ButtonStyleSet;
  pressed: ButtonStyleSet;
};

export const buttonSizes: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      minHeight: 32,
    },
    text: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
  },
  md: {
    container: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      minHeight: 40,
    },
    text: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '600',
    },
  },
  lg: {
    container: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      minHeight: 48,
    },
    text: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
    },
  },
};

const baseContainer: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
};

export const createButtonStyles = (colors: Palette): Record<ButtonVariant, ButtonStyles> => {
  const primary: ButtonStyles = {
    default: {
      container: {
        ...baseContainer,
        backgroundColor: colors.primary,
        borderRadius: radius.md,
      },
      text: {
        color: colors.primaryText,
        ...typography.label,
      },
    },
    pressed: {
      container: {
        ...baseContainer,
        backgroundColor: colors.primaryPressed,
        borderRadius: radius.md,
        opacity: 0.92,
      },
      text: {
        color: colors.primaryText,
        ...typography.label,
      },
    },
  };

  const secondary: ButtonStyles = {
    default: {
      container: {
        ...baseContainer,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
      },
      text: {
        color: colors.text,
        ...typography.label,
      },
    },
    pressed: {
      container: {
        ...baseContainer,
        backgroundColor: colors.inputBg,
        borderColor: colors.borderStrong,
        borderWidth: 1,
        borderRadius: radius.md,
      },
      text: {
        color: colors.text,
        ...typography.label,
      },
    },
  };

  const ghost: ButtonStyles = {
    default: {
      container: {
        ...baseContainer,
        backgroundColor: 'transparent',
        borderRadius: radius.md,
      },
      text: {
        color: colors.primary,
        ...typography.label,
      },
    },
    pressed: {
      container: {
        ...baseContainer,
        backgroundColor: colors.primarySoft,
        borderRadius: radius.md,
      },
      text: {
        color: colors.primary,
        ...typography.label,
      },
    },
  };

  const icon: ButtonStyles = {
    default: {
      container: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderRadius: radius.full,
        width: 40,
        height: 40,
      },
      text: {
        color: colors.text,
        ...typography.label,
      },
    },
    pressed: {
      container: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.inputBg,
        borderRadius: radius.full,
        width: 40,
        height: 40,
      },
      text: {
        color: colors.text,
        ...typography.label,
      },
    },
  };

  return { primary, secondary, ghost, icon };
};