export default function ProjectLoading() {
  return (
    <main className="dashboard-route-loading" aria-label="Loading project" role="status">
      <span className="dashboard-route-loading__eyebrow">PROJECT</span>
      <span className="dashboard-route-loading__title" />
      <span className="dashboard-route-loading__line" />
      <div className="dashboard-route-loading__grid" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
