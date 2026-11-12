'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import GitHubInstall from './GitHubInstall';

type User = { id: string; login: string };
type Project = { id: string; name: string; domain: string; retention_days: number };
type Breakdown = { label: string; count: number };
type Summary = { metrics: { events: number; pageviews: number; visitors: number; sessions: number }; pages: Breakdown[]; devices: Breakdown[]; countries: Breakdown[]; referrers: Breakdown[]; days: unknown };
class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  if (!response.ok) { let message = `Request failed (${response.status}).`; try { const json = await response.json(); if (typeof json.detail === 'string') message = json.detail; } catch {} throw new ApiError(message, response.status); }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
function Table({ title, rows, empty }: { title: string; rows: Breakdown[]; empty: string }) {
  return <section className="panel breakdown"><div className="panel-head"><h3>{title}</h3><span>COUNT</span></div>{rows?.length ? <ul>{rows.map((r, index) => <li key={`${r.label}-${index}`}><span>{r.label || 'Unknown'}</span><strong>{r.count.toLocaleString()}</strong></li>)}</ul> : <p className="empty-row">{empty}</p>}</section>;
}
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null), [projects, setProjects] = useState<Project[]>([]), [selected, setSelected] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null), [busy, setBusy] = useState(true), [saving, setSaving] = useState(false);
  const [name, setName] = useState(''), [domain, setDomain] = useState(''), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const [days, setDays] = useState(30), [retention, setRetention] = useState(30), [settingsBusy, setSettingsBusy] = useState(false), [settingsMessage, setSettingsMessage] = useState('');
  const load = useCallback(async () => {
    try { const current = await api<User>('/api/me'); setUser(current); const list = await api<Project[]>('/api/projects'); setProjects(list); setSelected(old => list.some(p => p.id === old) ? old : (list[0]?.id || '')); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setUser(null); else setError(e instanceof Error ? e.message : 'Could not load your workspace.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!selected) { setSummary(null); return; } let cancelled = false; setSummary(null); api<Summary>(`/api/projects/${encodeURIComponent(selected)}/summary?days=${days}`).then(data => { if (!cancelled) setSummary(data); }).catch(e => { if (!cancelled) setError(e.message); }); return () => { cancelled = true; }; }, [selected, days]);
  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaving(true);
    try { const project = await api<Project>('/api/projects', { method: 'POST', body: JSON.stringify({ name, domain }) }); setProjects(list => [...list, project]); setSelected(project.id); setName(''); setDomain(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create the project.'); } finally { setSaving(false); }
  }
  async function logout() { try { await api('/api/logout', { method: 'POST' }); setUser(null); setProjects([]); setSelected(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign out.'); } }
  const project = projects.find(p => p.id === selected);
  useEffect(() => { if (project) setRetention(project.retention_days); }, [project?.id, project?.retention_days]);
  useEffect(() => { setSettingsMessage(''); }, [selected]);
  async function updateRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!project) return; setError(''); setSettingsMessage(''); setSettingsBusy(true);
    try { await api(`/api/projects/${encodeURIComponent(project.id)}/retention`, { method: 'PATCH', body: JSON.stringify({ retention_days: retention }) }); setProjects(list => list.map(p => p.id === project.id ? { ...p, retention_days: retention } : p)); setSettingsMessage('Retention updated.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update retention.'); } finally { setSettingsBusy(false); }
  }
  async function deleteProject() {
    if (!project || !window.confirm(`Delete ${project.name} and its analytics data? This cannot be undone.`)) return;
    setError(''); setSettingsMessage(''); setSettingsBusy(true);
    try { await api(`/api/projects/${encodeURIComponent(project.id)}`, { method: 'DELETE' }); const remaining = projects.filter(p => p.id !== project.id); setProjects(remaining); setSelected(remaining[0]?.id || ''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete the project.'); } finally { setSettingsBusy(false); }
  }
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const collector = process.env.NEXT_PUBLIC_COLLECTOR_URL || (origin ? `${origin}/api/events` : '');
  const snippet = `<script src="${origin}/crease.js" defer></script>\n<script>\n  window.addEventListener('load', function () {\n    crease.init({ projectId: '${project?.id || ''}', endpoint: '${collector}' });\n  });\n</script>`;
  async function copySnippet() { try { await navigator.clipboard.writeText(snippet); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { setError('Could not copy. Select the installation code and copy it manually.'); } }
  return <><a className="skip" href="#main">Skip to content</a><header className="app-header"><div className="app-header-inner"><Link className="brand" href="/"><span className="brand-icon">✳</span>crease<span className="blue">.</span></Link><span className="header-separator"/><span className="workspace-label">YOUR WORKSPACE</span>{user && <div className="account"><span>{user.login}</span><button className="plain-button" onClick={logout}>Sign out ↗</button></div>}</div></header>
    <main className="dashboard-main" id="main">{busy ? <div className="loading" role="status">Loading your workspace…</div> : !user ? <section className="auth-state"><p className="eyebrow"><span className="dot"/> YOUR ANALYTICS WORKSPACE</p><h1>Know what’s<br/><em>working.</em></h1><p>Sign in to connect your projects and see how people use the things you make.</p><a className="button primary" href="/api/auth/github">Continue with GitHub <span>↗</span></a>{error && <p className="error" role="alert">{error}</p>}<p className="auth-note">New here? Signing in creates your account.</p></section> : <><div className="dashboard-title"><div><p className="eyebrow">WORKSPACE / ANALYTICS</p><h1>Overview<span className="blue">.</span></h1><p>Make sense of the people behind the page views.</p></div>{projects.length > 0 && <label className="project-select">PROJECT<select value={selected} onChange={e => { setError(''); setSelected(e.target.value); }}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}</div>{error && <p className="error" role="alert">{error}</p>}
    {project ? <><div className="site-line"><span><span className="dot"/> {project.domain}</span><label className="range-control">REPORTING PERIOD <select value={days} onChange={e => { setError(''); setDays(Number(e.target.value)); }}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></div><div className="metric-grid">{([['Visitors', summary?.metrics.visitors], ['Page views', summary?.metrics.pageviews], ['Sessions', summary?.metrics.sessions], ['Events', summary?.metrics.events]] as const).map(([label, value], i) => <div className="metric" key={label}><div><span>{label}</span><small>0{i+1}</small></div><strong>{value === undefined ? '—' : value.toLocaleString()}</strong><p>{value === undefined ? 'Loading' : `Last ${days} days`}</p></div>)}</div><div className="dashboard-grid"><Table title="Top pages" rows={summary?.pages || []} empty="Pages will appear once events arrive."/><Table title="Countries" rows={summary?.countries || []} empty="No country data yet."/><Table title="Referrers" rows={summary?.referrers || []} empty="No referrer data yet."/><Table title="Devices" rows={summary?.devices || []} empty="No device data yet."/></div><section className="install panel"><div><p className="eyebrow">GET CONNECTED / 01</p><h2>Bring your site into focus.</h2><p>Add this snippet to your site after obtaining any required visitor consent. The collector URL must be publicly reachable by your visitors.</p></div><div><div className="code-head"><span>INSTALLATION CODE</span><button className="plain-button" onClick={copySnippet}>{copied ? 'Copied' : 'Copy code ↗'}</button></div><pre tabIndex={0}><code>{snippet}</code></pre><p className="install-note">Only initialize tracking when your consent policy allows it.</p></div></section><section className="settings-section panel"><div><p className="eyebrow">PROJECT SETTINGS</p><h2>Data retention</h2><p>Set how long analytics events are kept, from 1 to 90 days.</p></div><div><form className="retention-form" onSubmit={updateRetention}><label>Retention in days<input type="number" required min={1} max={90} step={1} value={retention} onChange={e => setRetention(Number(e.target.value))}/></label><button className="button secondary" disabled={settingsBusy} type="submit">{settingsBusy ? 'Saving…' : 'Save retention'}</button></form><p className="settings-feedback" role="status">{settingsMessage}</p><button className="delete-button" disabled={settingsBusy} onClick={deleteProject}>Delete project and data</button></div></section></> : <section className="empty-project panel"><span className="empty-icon">✳</span><p className="eyebrow">A FRESH START</p><h2>Let’s bring your first<br/>project into focus.</h2><p>Create a project and connect your site to start seeing your own data.</p></section>}
    {project && <GitHubInstall key={project.id} projectId={project.id} />}<section className="create-section"><div><p className="eyebrow">YOUR PROJECTS / {String(projects.length).padStart(2,'0')}</p><h2>{project ? 'Add another project.' : 'Create a project.'}</h2><p>One workspace for all the things you make.</p></div><form onSubmit={createProject} className="create-form"><label>Project name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="My website"/></label><label>Domain<input required maxLength={253} value={domain} onChange={e => setDomain(e.target.value)} placeholder="example.com" autoCapitalize="none"/></label><button className="button primary" disabled={saving} type="submit">{saving ? 'Creating…' : 'Create project'} <span>↗</span></button></form></section></>}</main><footer className="app-footer"><span>CREASE / YOUR WORK, UNDERSTOOD</span><a href="https://github.com/AmanSagar0607/crease">OPEN SOURCE ↗</a></footer></>;
}
