import { type TextStyle, type ViewStyle } from 'react-native';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';
import { shadows } from './shadows';
import type { Palette } from './colors';

export type InputState = 'default' | 'focused' | 'error' | 'disabled';
export type CardVariant = 'flat' | 'elevated' | 'outlined';
export type ModalPart = 'backdrop' | 'sheet';

export type InputStyle = {
  container: ViewStyle;
  text: TextStyle;
  placeholder: { color: string };
};

export type InputStyles = {
  inputs: Record<InputState, InputStyle>;
  cards: Record<CardVariant, ViewStyle>;
  modals: Record<ModalPart, ViewStyle>;
};

export const createInputStyles = (colors: Palette): InputStyles => {
  const baseContainer: ViewStyle = {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    minHeight: 44,
  };

  const baseText: TextStyle = {
    color: colors.text,
    ...typography.body,
  };

  const inputs: Record<InputState, InputStyle> = {
    default: {
      container: {
        ...baseContainer,
        borderColor: colors.border,
      },
      text: baseText,
      placeholder: { color: colors.textMuted },
    },
    focused: {
      container: {
        ...baseContainer,
        borderColor: colors.primary,
        borderWidth: 2,
      },
      text: baseText,
      placeholder: { color: colors.textMuted },
    },
    error: {
      container: {
        ...baseContainer,
        borderColor: colors.error.solid,
        borderWidth: 2,
      },
      text: { ...baseText, color: colors.error.text },
      placeholder: { color: colors.textMuted },
    },
    disabled: {
      container: {
        ...baseContainer,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        opacity: 0.6,
      },
      text: { ...baseText, color: colors.textMuted },
      placeholder: { color: colors.textMuted },
    },
  };

  const cards: Record<CardVariant, ViewStyle> = {
    flat: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    elevated: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.lg,
      ...shadows.md,
    },
    outlined: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
  };

  const modals: Record<ModalPart, ViewStyle> = {
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      ...shadows.xl,
    },
  };

  return { inputs, cards, modals };
};