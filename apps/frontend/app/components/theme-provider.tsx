import React from 'react';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps as NextThemesProviderProps } from 'next-themes';

interface ThemeProviderProps extends Omit<NextThemesProviderProps, 'children'> {
  children: React.ReactNode;
}

export function ThemeProvider(props: ThemeProviderProps) {
  return <NextThemesProvider {...props} />;
}
