import { createContext, useContext, type ReactNode } from 'react';
import type { ThemeMode } from './theme';

const ThemeContext = createContext<ThemeMode>('dark');

export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeMode;
  children: ReactNode;
}) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext);
}
