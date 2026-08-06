export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radius;
