import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zappa — Revenue analytics for SaaS founders',
  description:
    'Understand which channels bring visitors, which journeys convert, and which acquisition activities generate verified revenue.',
};

export const viewport: Viewport = { themeColor: '#f7f5ef' };

const themeScript = `(function(){try{var k='crease-theme';var v=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=(v==='light'||v==='dark')?v:(d?'dark':'light');}catch(e){document.documentElement.dataset.theme='light';}})();`;

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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
