import DashboardView from './DashboardView';
import { clerkConfigured } from '@/lib/clerk-config';
export default function Dashboard() {
  return <DashboardView clerkEnabled={clerkConfigured} />;
}
