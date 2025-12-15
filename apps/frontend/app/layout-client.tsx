'use client';

import React from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from './providers';

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Providers>
        {children}
      </Providers>
    </ThemeProvider>
  );
}
