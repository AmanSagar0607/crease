import { ClerkProvider } from '@clerk/nextjs';
import Script from 'next/script';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeProvider from './theme-provider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Zappa — Calm analytics for independent developers',
  description:
    'A quiet analytics workspace for independent developers. Create an account, connect a site, and see what people actually do — nothing more.',
};

export const viewport: Viewport = { themeColor: '#F0EFEB' };

const clerkAppearance = {
  variables: {
    colorPrimary: '#d8c5a7',
    colorBackground: '#141412',
    colorInputBackground: '#1d1d1a',
    colorInputText: '#f1eee8',
    colorText: '#f1eee8',
    colorTextSecondary: '#a9a69e',
    colorNeutral: '#d4d0c6',
    borderRadius: '0.75rem',
  },
  elements: {
    cardBox: 'shadow-none',
    card: 'shadow-none border border-white/10',
    formButtonPrimary: 'font-semibold shadow-none hover:opacity-90',
    footerActionLink: 'underline-offset-4 hover:underline',
    formFieldInput: 'focus:ring-2 focus:ring-offset-0',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="Zappa-theme-init" strategy="beforeInteractive">
          {`(function(){var key='Zappa-theme',theme='system';try{var stored=localStorage.getItem(key);if(stored==='system'||stored==='light'||stored==='dark')theme=stored;}catch(e){}var resolved=theme==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);root.setAttribute('data-theme',resolved);root.style.colorScheme=resolved;})();`}
        </Script>
      </head>
      <body>
        <ClerkProvider appearance={clerkAppearance}>
          <ThemeProvider>{children}<Toaster /></ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
