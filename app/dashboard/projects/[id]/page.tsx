import DashboardView from '../../DashboardView';
import { clerkConfigured } from '@/lib/clerk-config';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardView projectId={id} clerkEnabled={clerkConfigured} />;
}
