'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute={['class', 'data-theme']}
      defaultTheme="system"
      enableSystem
      storageKey="crease-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
