import type { Metadata } from 'next';
import V0Dashboard from './V0Dashboard';

export const metadata: Metadata = {
  title: 'Zappa dashboard preview',
  description: 'A design preview of the Zappa analytics dashboard. All displayed figures are sample data.',
  robots: { index: false, follow: false },
};

export default function V0PreviewPage() {
  return <V0Dashboard />;
}
