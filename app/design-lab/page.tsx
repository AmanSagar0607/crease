import { DM_Sans } from 'next/font/google';
import DashboardView from '../dashboard/DashboardView';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export default function DesignLabPage() {
  return (
    <div className={`${dmSans.variable} min-h-screen`}>
      <DashboardView mode="design-lab" />
    </div>
  );
}
