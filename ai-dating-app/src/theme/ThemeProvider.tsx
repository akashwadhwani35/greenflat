import React, { createContext, useContext, useMemo } from 'react';
import { createTheme, Theme } from './tokens';

type ThemeProviderProps = {
  children: React.ReactNode;
};

const ThemeContext = createContext<Theme>(createTheme());

export const GreenflagThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const value = useMemo(() => createTheme(), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
