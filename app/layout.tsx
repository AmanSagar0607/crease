import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Crease — calm analytics for the independent web', description: 'Privacy-conscious analytics for developers and small teams. Understand visitors, acquisition, pages, and goals from observed project data.' };

export const viewport: Viewport = { themeColor: '#f7f5ef' };

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
