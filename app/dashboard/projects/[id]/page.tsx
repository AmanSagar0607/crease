import DashboardView from '../../DashboardView';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardView projectId={id} />;
}
