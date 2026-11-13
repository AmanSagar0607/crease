import DashboardView from '../../DashboardView';
import ProjectTabController from '../../ProjectTabController';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><ProjectTabController /><DashboardView projectId={id} /></>;
}
