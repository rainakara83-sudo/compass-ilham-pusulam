import { Platform, type ViewStyle } from 'react-native';

export type ShadowStyle = ViewStyle & {
  boxShadow?: string;
};

const webShadow = (offsetY: number, blur: number, color: string): string =>
  `0px ${offsetY}px ${blur}px 0px ${color}`;

export const shadows: Record<'sm' | 'md' | 'lg' | 'xl', ShadowStyle> = {
  sm: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      boxShadow: webShadow(1, 2, 'rgba(15, 23, 42, 0.08)'),
    },
    android: {
      elevation: 2,
      boxShadow: webShadow(1, 2, 'rgba(15, 23, 42, 0.08)'),
    },
    default: {
      boxShadow: webShadow(1, 2, 'rgba(15, 23, 42, 0.08)'),
    },
  }) as ShadowStyle,
  md: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      boxShadow: webShadow(4, 8, 'rgba(15, 23, 42, 0.12)'),
    },
    android: {
      elevation: 4,
      boxShadow: webShadow(4, 8, 'rgba(15, 23, 42, 0.12)'),
    },
    default: {
      boxShadow: webShadow(4, 8, 'rgba(15, 23, 42, 0.12)'),
    },
  }) as ShadowStyle,
  lg: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      boxShadow: webShadow(8, 16, 'rgba(15, 23, 42, 0.16)'),
    },
    android: {
      elevation: 8,
      boxShadow: webShadow(8, 16, 'rgba(15, 23, 42, 0.16)'),
    },
    default: {
      boxShadow: webShadow(8, 16, 'rgba(15, 23, 42, 0.16)'),
    },
  }) as ShadowStyle,
  xl: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      boxShadow: webShadow(12, 24, 'rgba(15, 23, 42, 0.2)'),
    },
    android: {
      elevation: 12,
      boxShadow: webShadow(12, 24, 'rgba(15, 23, 42, 0.2)'),
    },
    default: {
      boxShadow: webShadow(12, 24, 'rgba(15, 23, 42, 0.2)'),
    },
  }) as ShadowStyle,
};
