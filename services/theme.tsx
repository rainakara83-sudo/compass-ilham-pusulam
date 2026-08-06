import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTheme, type CompassTheme } from '../styles';
import { lightColors, darkColors, type Palette } from '../styles/colors';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeColors = Palette;

const THEME_KEY = '@content-coach/theme';

type Ctx = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => Promise<void>;
  theme: CompassTheme;
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<Ctx | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await AsyncStorage.setItem(THEME_KEY, m);
  }, []);

  const isDark =
    mode === 'dark' || (mode === 'system' && system === 'dark');

  const theme = useMemo<CompassTheme>(() => createTheme(isDark ? 'dark' : 'light'), [isDark]);
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, setMode, theme, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): Ctx => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};

export { lightColors, darkColors } from '../styles/colors';
