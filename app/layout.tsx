import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Crease — analytics for the things you make', description: 'Quiet analytics for independent developers. Connect a site with GitHub and see visitors, pages, referrers, and countries.' };

const themeScript = `(function(){try{var k='crease-theme';var v=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=(v==='light'||v==='dark')?v:(d?'dark':'light');}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
