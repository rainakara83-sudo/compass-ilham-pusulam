export type ColorScheme = 'light' | 'dark';

export type SemanticTone = {
  bg: string;
  text: string;
  border: string;
  solid: string;
  solidText: string;
};

export type Palette = {
  primary: string;
  primarySoft: string;
  primaryPressed: string;
  primaryText: string;
  secondary: string;
  secondarySoft: string;
  secondaryText: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  bg: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  inputBg: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  textInverse: string;
  overlay: string;
  success: SemanticTone;
  warning: SemanticTone;
  error: SemanticTone;
  info: SemanticTone;
};

export const sagePalette = {
  bg: '#5C6B4F',
  bgSubtle: '#4F5C42',
  card: '#FAFCF6',
  accent: '#2F3B25',
  highlight: '#D4836B',
  accentDeep: '#1E2818',
  accentSoft: '#C5D2A0',
  text: '#2F3B25',
  textMuted: '#E8E4D2',
};

export const lightColors: Palette = {
  primary: '#2F3B25',
  primarySoft: '#C5D2A0',
  primaryPressed: '#1E2818',
  primaryText: '#FFFFFF',
  secondary: '#D4836B',
  secondarySoft: '#F5D9C3',
  secondaryText: '#FFFFFF',
  accent: '#2F3B25',
  accentSoft: '#C5D2A0',
  accentText: '#FFFFFF',
  bg: '#5C6B4F',
  surface: '#FAFCF6',
  surfaceElevated: '#FFFFFF',
  card: '#FAFCF6',
  inputBg: '#F0F4ED',
  border: '#C5D2A0',
  borderStrong: '#2F3B25',
  text: '#2F3B25',
  textMuted: '#4A5D3F',
  textSecondary: '#2F3B25',
  textInverse: '#FFFFFF',
  overlay: 'rgba(47, 59, 37, 0.55)',
  success: {
    bg: '#E6F7EE',
    text: '#11804A',
    border: '#B8E7CC',
    solid: '#22C55E',
    solidText: '#FFFFFF',
  },
  warning: {
    bg: '#FFF6E0',
    text: '#A36300',
    border: '#FCE3A1',
    solid: '#F5A524',
    solidText: '#FFFFFF',
  },
  error: {
    bg: '#FDEBEC',
    text: '#B22A3B',
    border: '#F5C2C9',
    solid: '#EF4444',
    solidText: '#FFFFFF',
  },
  info: {
    bg: '#E6F1FF',
    text: '#1F5FBF',
    border: '#BDD8FF',
    solid: '#3B82F6',
    solidText: '#FFFFFF',
  },
};

export const darkColors: Palette = {
  primary: '#60A5FA',
  primarySoft: '#1E3A66',
  primaryPressed: '#3B82F6',
  primaryText: '#0B1220',
  secondary: '#C4B5FD',
  secondarySoft: '#3B2E66',
  secondaryText: '#0B1220',
  accent: '#FF8FB6',
  accentSoft: '#5C2A41',
  accentText: '#0B1220',
  bg: '#0B1220',
  surface: '#141C2E',
  surfaceElevated: '#1B2540',
  card: '#162039',
  inputBg: '#1F2A44',
  border: '#283450',
  borderStrong: '#3A466A',
  text: '#F1F5F9',
  textMuted: '#CBD5E1',
  textSecondary: '#E2E8F0',
  textInverse: '#0F172A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  success: {
    bg: '#0F2E22',
    text: '#7CE2B0',
    border: '#1E5A42',
    solid: '#22C55E',
    solidText: '#0B1220',
  },
  warning: {
    bg: '#3A2A0A',
    text: '#FCD58A',
    border: '#715010',
    solid: '#F5A524',
    solidText: '#0B1220',
  },
  error: {
    bg: '#3A141A',
    text: '#FCA5A5',
    border: '#7A1F2C',
    solid: '#EF4444',
    solidText: '#FFFFFF',
  },
  info: {
    bg: '#0F223F',
    text: '#A8C8FF',
    border: '#244A85',
    solid: '#3B82F6',
    solidText: '#FFFFFF',
  },
};

export const neutralScale = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
} as const;

export type NeutralScale = typeof neutralScale;
