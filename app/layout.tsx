import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Crease — analytics for the things you make', description: 'Simple analytics for independent builders.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
