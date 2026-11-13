import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Crease — analytics for the things you make', description: 'Quiet analytics for independent developers. Connect a site with GitHub and see visitors, pages, referrers, and countries.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
