import { lightColors, darkColors, type Palette, type ColorScheme } from './colors';
import { typography, type TypographyVariant } from './typography';
import { spacing, type SpacingKey, type SpacingValue } from './spacing';
import { radius, type RadiusKey } from './radius';
import { shadows, type ShadowStyle } from './shadows';
import {
  createButtonStyles,
  buttonSizes,
  type ButtonVariant,
  type ButtonSize,
  type ButtonStyles,
} from './buttons';
import { createBadgeStyles, type BadgeStyles } from './badges';
import { createInputStyles, type InputStyles } from './inputs';

export type CompassTheme = {
  scheme: ColorScheme;
  colors: Palette;
  typography: Record<string, TypographyVariant>;
  spacing: Record<SpacingKey, SpacingValue>;
  radius: Record<RadiusKey, number>;
  shadows: Record<'sm' | 'md' | 'lg' | 'xl', ShadowStyle>;
  buttons: Record<ButtonVariant, ButtonStyles> & { sizes: typeof buttonSizes };
  badges: BadgeStyles;
  inputs: InputStyles;
};

export const createTheme = (scheme: ColorScheme): CompassTheme => {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const buttonStyles = createButtonStyles(colors);

  return {
    scheme,
    colors,
    typography,
    spacing,
    radius,
    shadows,
    buttons: {
      ...buttonStyles,
      sizes: buttonSizes,
    },
    badges: createBadgeStyles(colors),
    inputs: createInputStyles(colors),
  };
};

export const lightTheme: CompassTheme = createTheme('light');
export const darkTheme: CompassTheme = createTheme('dark');
