'use client';

import { useEffect, useState } from 'react';
import s from './dashboard.module.css';

type Model = 'first_touch' | 'last_touch' | 'last_non_direct';
type Acquisition = { total_visitors: number; sources: { type: string; source: string; visitors: number }[] };

export default function AcquisitionOverview({ projectId, days, filtered, refresh }: { projectId: string; days: number; filtered: boolean; refresh: number }) {
  const [model, setModel] = useState<Model>('first_touch');
  const [report, setReport] = useState<Acquisition | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setReport(null);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/acquisition?days=${days}&model=${model}`, { credentials: 'same-origin', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load acquisition (${response.status}).`);
        return response.json() as Promise<Acquisition>;
      })
      .then(setReport)
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load acquisition.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, days, model, attempt, refresh]);

  return (
    <div className={s.businessOverview}>
      <section className={s.acquisitionOverview} aria-labelledby="acquisition-overview-title">
        <div className={s.businessHeading}>
          <div><span className={s.businessEyebrow}>Where people find you</span><h3 id="acquisition-overview-title">Acquisition sources</h3></div>
          <label className={s.modelSelect}><span className={s.srOnly}>Attribution model</span><select value={model} onChange={(event) => setModel(event.target.value as Model)}><option value="first_touch">First touch</option><option value="last_touch">Last touch</option><option value="last_non_direct">Last non-direct</option></select></label>
        </div>
        <p className={s.businessDescription}>Visitors with an observed touchpoint in the last {days} days. {filtered && 'Property filters do not apply to this report.'}</p>
        {loading ? <div className={s.businessLoading} role="status">Loading acquisition sources…</div> : error ? <div className={s.businessState} role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div> : !report?.total_visitors ? <p className={s.businessState}>Sources appear when visitors arrive with the tracker installed and consent enabled.</p> : <>
          <div className={s.acquisitionTotal}><strong>{report.total_visitors.toLocaleString()}</strong><span>observed visitors</span></div>
          <ul className={s.sourceList}>{report.sources.slice(0, 5).map((item) => <li key={`${item.type}:${item.source}`}><div><span title={item.source}>{item.source}</span><strong>{item.visitors.toLocaleString()}</strong></div><span className={s.sourceTrack} aria-hidden="true"><span style={{ width: `${Math.min(100, item.visitors / report.total_visitors * 100)}%` }} /></span></li>)}</ul>
          <p className={s.sourceFootnote}>Showing up to 5 sources. Direct or unknown includes visits without a reported source.</p>
        </>}
      </section>
      <section className={s.revenueOverview} aria-labelledby="revenue-overview-title">
        <span className={s.businessEyebrow}>Revenue intelligence</span>
        <h3 id="revenue-overview-title">Revenue reporting</h3>
        <div className={s.revenueDivider} aria-hidden="true" />
        <p>Revenue reporting is not available yet.</p>
        <small>Zappa will show recorded revenue here when a verified revenue reporting workflow is available.</small>
      </section>
    </div>
  );
}
