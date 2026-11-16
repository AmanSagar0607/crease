'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import s from './overview-v1.module.css';

type Model = 'first_touch' | 'last_touch' | 'last_non_direct';
type Metrics = { visitors: number; sessions: number; pageviews: number; new_visitors: number; returning_visitors: number; conversions: number | null; conversion_rate: number | null };
type Report = {
  start: string; end: string; model: Model; metrics: Metrics; previous: Metrics;
  series: { date: string; visitors: number; sessions: number; previous_visitors: number; previous_sessions: number }[];
  acquisition: { source: string; medium: string | null; campaign: string | null; visitors: number; sessions: number; conversions: number | null; conversion_rate: number | null }[];
  campaigns: { campaign: string; source: string | null; visitors: number; conversions: number | null; conversion_rate: number | null }[];
  landing_pages: { path: string; visitors: number; sessions: number; conversions: number | null; conversion_rate: number | null }[];
  recent_activity: { name: string; path: string; occurred_at: string }[];
  revenue_available: boolean;
};
type Preset = 'today' | 'yesterday' | '7' | '30' | '90' | 'custom';
const labels: Record<Preset, string> = { today: 'Today', yesterday: 'Yesterday', '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', custom: 'Custom range' };
function dateOffset(days: number) { const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function dateRange(preset: Exclude<Preset, 'custom'>) { const offset = preset === 'yesterday' ? -1 : 0; const end = dateOffset(offset); const count = preset === 'today' || preset === 'yesterday' ? 1 : Number(preset); return { start: dateOffset(offset - count + 1), end }; }
function display(value: number | null | undefined, rate = false) { return value == null ? '—' : rate ? `${(value * 100).toFixed(1)}%` : value.toLocaleString(); }
function compare(value: number | null, previous: number | null) { if (value == null || previous == null) return 'Not configured'; if (previous === 0) return value === 0 ? 'No change' : 'New activity'; const delta = (value - previous) / previous * 100; return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs previous period`; }
function EventLabel(name: string) { return name === 'pageview' ? 'Page view' : name === 'signup' || name === 'sign_up' ? 'Sign up' : name === 'conversion' ? 'Conversion event' : name; }

export default function OverviewV1({ projectId, refresh, filtered }: { projectId: string; refresh: number; filtered: boolean }) {
  const [preset, setPreset] = useState<Preset>('30');
  const [range, setRange] = useState(() => dateRange('30'));
  const [draft, setDraft] = useState(() => dateRange('30'));
  const [model, setModel] = useState<Model>('first_touch');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const rangeDays = (Date.parse(draft.end + 'T00:00:00Z') - Date.parse(draft.start + 'T00:00:00Z')) / 86400000 + 1;
  const invalidRange = !draft.start || !draft.end || draft.start > draft.end || draft.end > dateOffset(0) || rangeDays > 90;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setReport(null);
    const params = new URLSearchParams({ start: range.start, end: range.end, model });
    fetch(`/api/projects/${encodeURIComponent(projectId)}/overview?${params}`, { credentials: 'same-origin', signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error(`Overview unavailable (${res.status}).`); return res.json() as Promise<Report>; })
      .then((data) => { if (!controller.signal.aborted) setReport(data); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Overview unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, range.start, range.end, model, refresh, attempt]);

  const metrics: { key: keyof Metrics; label: string; description: string; rate?: boolean }[] = [
    { key: 'visitors', label: 'Unique visitors', description: 'Distinct visitor IDs with events in this period.' },
    { key: 'sessions', label: 'Sessions', description: 'Server-assigned sessions starting in this period.' },
    { key: 'pageviews', label: 'Page views', description: 'Pageview events in this period.' },
    { key: 'new_visitors', label: 'New visitors', description: 'First observed in retained project history during this period.' },
    { key: 'returning_visitors', label: 'Returning visitors', description: 'Observed before this period in retained project history.' },
    { key: 'conversions', label: 'Conversions', description: 'Available once conversion goals are configured.' },
    { key: 'conversion_rate', label: 'Conversion rate', description: 'Available once conversion goals are configured.', rate: true },
  ];
  return <section className={s.overview} id="overview" tabIndex={-1} aria-label="Business overview">
    <div className={s.header}><div><div className={s.eyebrow}>BUSINESS OVERVIEW</div><h2>Understand what brings people in.</h2><p>Traffic and acquisition from observed activity. All dates are UTC.</p></div>
      <div className={s.controls}><label>Reporting period<select value={preset} onChange={(event) => { const next = event.target.value as Preset; setPreset(next); if (next !== 'custom') { const value = dateRange(next); setRange(value); setDraft(value); } }}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Attribution<select value={model} onChange={(event) => setModel(event.target.value as Model)}><option value="first_touch">First touch</option><option value="last_touch">Last touch</option><option value="last_non_direct">Last non-direct</option></select></label></div>
    </div>
    {preset === 'custom' && <div className={s.custom}><label>From <input type="date" value={draft.start} max={draft.end || dateOffset(0)} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label><label>To <input type="date" value={draft.end} max={dateOffset(0)} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label><button type="button" disabled={invalidRange} onClick={() => setRange(draft)}>Apply dates</button>{invalidRange && <span>Choose up to 90 days ending no later than today.</span>}</div>}
    <p className={s.scope}>Overview: {range.start} – {range.end} UTC. {filtered ? 'The detailed event property filter does not apply here. ' : ''}Detailed analytics below uses its own 7/30/90-day control.</p>
    {loading ? <div className={s.skeletonGrid} aria-busy="true" role="status"><span>Loading overview…</span>{[0, 1, 2, 3].map((key) => <i key={key} />)}</div> : error ? <div className={s.error} role="alert"><strong>Could not load overview</strong><p>{error}</p><button type="button" onClick={() => setAttempt((x) => x + 1)}>Try again</button></div> : report && <>
      <div className={s.kpis}>{metrics.map((metric) => <div className={s.kpi} key={metric.key}><span title={metric.description}>{metric.label} <span className={s.info} aria-label={metric.description}>ⓘ</span></span><strong>{display(report.metrics[metric.key], metric.rate)}</strong><small>{compare(report.metrics[metric.key], report.previous[metric.key])}</small></div>)}</div>
      <section className={s.chart}><div className={s.sectionHead}><div><span className={s.eyebrow}>TRAFFIC</span><h3>Visitors &amp; sessions</h3><p>Daily activity compared with the preceding period</p></div><div className={s.legend}><span>● Visitors</span><span>● Sessions</span><span>┄ Previous period</span></div></div>{report.series.every((point) => !point.visitors && !point.sessions && !point.previous_visitors && !point.previous_sessions) ? <div className={s.empty}>No traffic in this period. A chart will appear when activity arrives.</div> : <div className={s.chartArea}><ResponsiveContainer width="100%" height="100%"><LineChart data={report.series} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(x: string) => x.slice(5)} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' }} /><Line type="monotone" dataKey="visitors" name="Visitors" stroke="var(--ink)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="sessions" name="Sessions" stroke="var(--chartThird)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="previous_visitors" name="Previous visitors" stroke="var(--ink)" strokeDasharray="4 4" strokeOpacity={0.5} dot={false} /><Line type="monotone" dataKey="previous_sessions" name="Previous sessions" stroke="var(--chartThird)" strokeDasharray="4 4" strokeOpacity={0.5} dot={false} /></LineChart></ResponsiveContainer></div>}</section>
      <div className={s.twoCol}><section className={s.panel}><div className={s.sectionHead}><div><span className={s.eyebrow}>ACQUISITION</span><h3>Where visitors find you</h3><p>Attributed by {model.replaceAll('_', ' ')}. Missing source is direct or unknown.</p></div></div>{report.acquisition.length ? <div className={s.scroll}><table><thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th>Visitors</th><th>Sessions</th><th>Conversions</th><th>Rate</th></tr></thead><tbody>{report.acquisition.slice(0, 8).map((row, index) => <tr key={`${row.source}-${row.medium}-${row.campaign}-${index}`}><td>{row.source}</td><td>{row.medium || '—'}</td><td>{row.campaign || '—'}</td><td>{display(row.visitors)}</td><td>{display(row.sessions)}</td><td>{display(row.conversions)}</td><td>{display(row.conversion_rate, true)}</td></tr>)}</tbody></table></div> : <div className={s.empty}>No acquisition data for this period.</div>}</section>
      <section className={s.panel}><div className={s.sectionHead}><div><span className={s.eyebrow}>CAMPAIGNS</span><h3>Campaign performance</h3><p>Observed campaign traffic</p></div></div>{report.campaigns.length ? <div className={s.scroll}><table><thead><tr><th>Campaign</th><th>Source</th><th>Visitors</th><th>Conversions</th><th>Rate</th></tr></thead><tbody>{report.campaigns.slice(0, 8).map((row, index) => <tr key={`${row.campaign}-${row.source}-${index}`}><td>{row.campaign}</td><td>{row.source || 'Unknown'}</td><td>{display(row.visitors)}</td><td>{display(row.conversions)}</td><td>{display(row.conversion_rate, true)}</td></tr>)}</tbody></table></div> : <div className={s.empty}>Campaigns appear when visitors arrive with UTM campaign parameters.</div>}</section></div>
      <div className={s.twoCol}><section className={s.panel}><div className={s.sectionHead}><div><span className={s.eyebrow}>LANDING PAGES</span><h3>First pages visited</h3><p>Entry pages for observed sessions</p></div></div>{report.landing_pages.length ? <div className={s.scroll}><table><thead><tr><th>Page</th><th>Visitors</th><th>Sessions</th><th>Conversions</th><th>Rate</th></tr></thead><tbody>{report.landing_pages.slice(0, 8).map((row) => <tr key={row.path}><td>{row.path}</td><td>{display(row.visitors)}</td><td>{display(row.sessions)}</td><td>{display(row.conversions)}</td><td>{display(row.conversion_rate, true)}</td></tr>)}</tbody></table></div> : <div className={s.empty}>Landing pages appear after page views arrive.</div>}</section>
      <section className={s.panel}><div className={s.sectionHead}><div><span className={s.eyebrow}>RECENT ACTIVITY</span><h3>Latest events</h3><p>Event names and paths only</p></div></div>{report.recent_activity.length ? <ul className={s.activity}>{report.recent_activity.slice(0, 8).map((event, index) => <li key={`${event.occurred_at}-${index}`}><div><strong>{EventLabel(event.name)}</strong><span>{event.path}</span></div><time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC</time></li>)}</ul> : <div className={s.empty}>No events in this period.</div>}</section></div>
      <div className={s.revenue}><div><span className={s.eyebrow}>REVENUE</span><h3>Revenue reporting unavailable</h3><p>Recorded revenue will appear when a verified reporting workflow is available.</p></div><strong>—</strong></div>
    </>}
  </section>;
}
