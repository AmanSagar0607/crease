'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import './vercel-git-settings.css';

type Status = { configured: boolean; connected: boolean };
type Project = { id: string; name: string };
type Settings = {
  on_commit: boolean | null;
  on_pull_request: boolean | null;
  git_lfs: boolean | null;
  require_verified_commits: boolean | null;
  repository_dispatch_events: boolean | null;
  git_commit_status: boolean | null;
  consolidated_commit_status: boolean | null;
  soft_failures: boolean | null;
  deployment_status_events: boolean | null;
};
type ProjectSettings = { project: Project; settings: Settings };
type DeployHook = { id: string; name: string; ref: string };
type CreatedHook = DeployHook & { url: string };
type SettingKey = keyof Settings;
const rows: { key: SettingKey; label: string; description: string }[] = [
  { key: 'on_pull_request', label: 'Pull request comments', description: 'Let Vercel comment on pull requests with deployment details.' },
  { key: 'on_commit', label: 'Commit comments', description: 'Let Vercel post comments on commits.' },
  { key: 'repository_dispatch_events', label: 'Repository dispatch events', description: 'Send repository dispatch events when a deployment changes.' },
  { key: 'deployment_status_events', label: 'Deployment status events', description: 'Publish GitHub deployment status events. This does not control whether Vercel deploys your project.' },
  { key: 'git_commit_status', label: 'Commit status', description: 'Let Vercel report deployment status on Git commits.' },
  { key: 'consolidated_commit_status', label: 'Consolidated commit status', description: 'Combine deployment statuses into a single Git commit status.' },
  { key: 'soft_failures', label: 'Soft failures', description: 'Allow deployment failures without marking the consolidated commit status as failed.' },
  { key: 'require_verified_commits', label: 'Require verified commits', description: 'Only deploy GitHub commits verified by GitHub.' },
  { key: 'git_lfs', label: 'Git Large File Storage', description: 'Include Git LFS objects in Vercel builds.' },
];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${response.status}).`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export default function VercelGitSettings({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState('');
  const [linked, setLinked] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hooks, setHooks] = useState<DeployHook[]>([]);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [hookBusy, setHookBusy] = useState('');
  const [hookError, setHookError] = useState('');
  const [hookName, setHookName] = useState('');
  const [hookRef, setHookRef] = useState('');
  const [createdHook, setCreatedHook] = useState<CreatedHook | null>(null);
  const [hookNotice, setHookNotice] = useState('');
  const selectId = useId();
  const hookNameId = useId();
  const hookRefId = useId();
  const resource = `/api/projects/${encodeURIComponent(projectId)}/vercel`;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const nextStatus = await request<Status>('/api/vercel/status');
      setStatus(nextStatus); setLinked(null); setProjects([]); setSelected(''); setHasMore(false);
      if (nextStatus.connected) {
        const [list, current] = await Promise.all([
          request<{ projects: Project[]; has_more: boolean }>('/api/vercel/projects'),
          request<ProjectSettings>(`${resource}/git`).catch((e: Error & { status?: number }) => { if (e.status === 404) return null; throw e; }),
        ]);
        setProjects(list.projects); setHasMore(list.has_more); setLinked(current); setSelected(current?.project.id || '');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load Vercel settings.'); }
    finally { setLoading(false); }
  }, [resource]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    setHooks([]); setCreatedHook(null); setHookError(''); setHookNotice('');
    if (!linked?.project.id) { setHooksLoading(false); return; }
    setHooksLoading(true);
    request<{ hooks: DeployHook[] }>(`${resource}/hooks`).then(data => { if (!cancelled) setHooks(data.hooks); }).catch(e => { if (!cancelled) setHookError(e instanceof Error ? e.message : 'Could not load deploy hooks.'); }).finally(() => { if (!cancelled) setHooksLoading(false); });
    return () => { cancelled = true; };
  }, [linked?.project.id, resource]);

  async function createHook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHookBusy('create'); setHookError(''); setHookNotice(''); setCreatedHook(null);
    try {
      const data = await request<{ hook: CreatedHook }>(`${resource}/hooks`, { method: 'POST', body: JSON.stringify({ name: hookName.trim(), ref: hookRef.trim() }) });
      setHooks(list => [...list, { id: data.hook.id, name: data.hook.name, ref: data.hook.ref }]);
      setCreatedHook(data.hook); setHookName(''); setHookRef(''); setHookNotice('Deploy hook created. Copy the URL now.');
    } catch (e) { setHookError(e instanceof Error ? e.message : 'Could not create the deploy hook.'); }
    finally { setHookBusy(''); }
  }
  async function deleteHook(hook: DeployHook) {
    if (!window.confirm(`Delete deploy hook “${hook.name}”? Any system using its URL will no longer be able to trigger deployments.`)) return;
    setHookBusy(hook.id); setHookError(''); setHookNotice('');
    try {
      await request(`${resource}/hooks/${encodeURIComponent(hook.id)}`, { method: 'DELETE' });
      setHooks(list => list.filter(item => item.id !== hook.id));
      setCreatedHook(previous => previous?.id === hook.id ? null : previous);
      setHookNotice('Deploy hook deleted.');
    } catch (e) { setHookError(e instanceof Error ? e.message : 'Could not delete the deploy hook.'); }
    finally { setHookBusy(''); }
  }
  async function copyHookUrl() {
    if (!createdHook) return;
    try { await navigator.clipboard.writeText(createdHook.url); setHookNotice('Deploy hook URL copied.'); }
    catch { setHookError('Could not copy the URL. Select it below and copy it manually.'); }
  }

  async function linkProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setBusy('link'); setError(''); setNotice('');
    try {
      await request(resource, { method: 'POST', body: JSON.stringify({ vercel_project_id: selected }) });
      setLinked(await request<ProjectSettings>(`${resource}/git`));
      setNotice('Vercel project connected.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect the Vercel project.'); }
    finally { setBusy(''); }
  }
  async function changeSetting(key: SettingKey, checked: boolean) {
    const supportsOverride = key === 'require_verified_commits' || key === 'repository_dispatch_events';
    if (!linked || (linked.settings[key] == null && !supportsOverride)) return;
    setBusy(key); setError(''); setNotice('');
    try {
      const updated = await request<ProjectSettings>(`${resource}/git`, { method: 'PATCH', body: JSON.stringify({ [key]: checked }) });
      setLinked(updated); setNotice('Vercel setting updated.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the Vercel setting.'); }
    finally { setBusy(''); }
  }
  async function disconnect() {
    setBusy('disconnect'); setError(''); setNotice('');
    try { await request('/api/vercel/disconnect', { method: 'POST' }); setLinked(null); setProjects([]); setSelected(''); setStatus(s => s ? { ...s, connected: false } : null); setNotice('Removed the connection from Crease. The integration remains installed in Vercel.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not disconnect Vercel.'); }
    finally { setBusy(''); }
  }

  return <section className="vercel-settings" aria-labelledby="vercel-settings-title">
    <header className="vercel-settings-heading"><div><p className="vercel-settings-kicker">HOSTING INTEGRATIONS / VERCEL</p><h2 id="vercel-settings-title">Vercel Git settings<span className="blue">.</span></h2><p>Manage settings on your connected Vercel project from Crease.</p></div><span className={`vercel-settings-status ${status?.connected ? 'is-connected' : ''}`}>{loading ? 'Checking' : status?.connected ? 'Connected' : 'Not connected'}</span></header>
    {loading ? <div className="vercel-settings-state" role="status">Checking your Vercel connection…</div> : status && <>
      {!status.configured ? <div className="vercel-settings-state"><strong>Vercel integration setup required</strong><p>A Crease administrator must configure the Vercel integration before you can connect your account.</p></div> : !status.connected ? <div className="vercel-settings-state"><strong>Connect your Vercel account</strong><p>Choose the projects Crease may access when you authorize the integration on Vercel. The integration requests Project read/write access to manage these settings. This is a broad permission that can also allow project updates and deletion.</p><a className="button primary" href="/api/vercel/connect">Connect Vercel <span aria-hidden="true">↗</span></a></div> : <>
        <div className="vercel-settings-connection"><div className="vercel-settings-provider" aria-hidden="true">▲</div><div><strong>Vercel account connected</strong><p>Choose which Vercel project belongs to this Crease project. Disconnecting removes the connection in Crease; it does not uninstall the integration in Vercel.</p></div><button type="button" className="vercel-settings-secondary" disabled={Boolean(busy || hookBusy)} onClick={() => void disconnect()}>{busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}</button></div>
        <form className="vercel-settings-select" onSubmit={linkProject}><div><label htmlFor={selectId}>Vercel project</label><p>Only projects available to this integration appear here.</p></div><div className="vercel-settings-select-controls"><select id={selectId} required value={selected} onChange={e => setSelected(e.target.value)} disabled={Boolean(busy || hookBusy)}><option value="">Select a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button className="button primary" type="submit" disabled={Boolean(busy || hookBusy) || !selected || selected === linked?.project.id}>{busy === 'link' ? 'Connecting…' : linked ? 'Update project' : 'Connect project'}</button></div></form>
        {projects.length === 0 && <p className="vercel-settings-empty">No Vercel projects are available. Check the integration’s project access in Vercel.</p>}
        {hasMore && <p className="vercel-settings-empty">Showing the first 100 projects available to this integration.</p>}
        {linked && <div className="vercel-settings-list"><div className="vercel-settings-list-title"><div><p className="vercel-settings-kicker">CONNECTED PROJECT</p><h3>{linked.project.name}</h3></div><span>VERCEL</span></div>{rows.map(row => {
          const inherited = linked.settings[row.key] == null && (row.key === 'require_verified_commits' || row.key === 'repository_dispatch_events');
          return <div className="vercel-settings-row" key={row.key}><div><strong>{row.label}</strong><p>{row.description}</p>{inherited ? <small>Inherited from team</small> : linked.settings[row.key] == null && <small>Unavailable for this project or integration.</small>}</div>{inherited ? <div className="vercel-settings-overrides" role="group" aria-label={`Set ${row.label}`}><button className="vercel-settings-secondary" type="button" aria-label={`Set ${row.label} on`} disabled={Boolean(busy)} onClick={() => void changeSetting(row.key, true)}>{busy === row.key ? 'Saving…' : 'Set on'}</button><button className="vercel-settings-secondary" type="button" aria-label={`Set ${row.label} off`} disabled={Boolean(busy)} onClick={() => void changeSetting(row.key, false)}>{busy === row.key ? 'Saving…' : 'Set off'}</button></div> : <label className="vercel-settings-switch"><input type="checkbox" checked={linked.settings[row.key] === true} disabled={Boolean(busy) || linked.settings[row.key] == null} onChange={e => void changeSetting(row.key, e.target.checked)} aria-label={row.label}/><span aria-hidden="true" /></label>}</div>;
        })}</div>}
      </>}
      {linked && <section className="vercel-hooks" aria-labelledby="vercel-hooks-title"><div className="vercel-hooks-heading"><div><p className="vercel-settings-kicker">AUTOMATION / VERCEL</p><h3 id="vercel-hooks-title">Deploy hooks <span className="vercel-hooks-beta">Experimental</span></h3><p>Trigger a deployment for a branch with a unique URL.</p></div><span className="vercel-hooks-count">{hooksLoading ? 'Loading' : hookError && hooks.length === 0 ? 'Unavailable' : `${hooks.length} ${hooks.length === 1 ? 'hook' : 'hooks'}`}</span></div>
        <p className="vercel-hooks-provider-note">Vercel may deny hook access for this integration even with project write permission. If it does, manage hooks in <a href="https://vercel.com/docs/project-configuration/git-settings#deploy-hooks" target="_blank" rel="noreferrer">Vercel Git settings ↗</a>.</p>
        <p className="vercel-hooks-warning"><strong>Keep hook URLs private.</strong> Anyone with a URL can trigger deployments. New URLs are shown only once.</p>
        {hooksLoading ? <p className="vercel-hooks-empty" role="status">Loading deploy hooks…</p> : hooks.length ? <ul className="vercel-hooks-list">{hooks.map(hook => <li key={hook.id}><div><strong>{hook.name}</strong><span>Branch: {hook.ref}</span></div><button className="vercel-settings-secondary" type="button" aria-label={`Delete deploy hook ${hook.name}`} disabled={Boolean(hookBusy) || Boolean(busy)} onClick={() => void deleteHook(hook)}>{hookBusy === hook.id ? 'Deleting…' : 'Delete'}</button></li>)}</ul> : !hookError && <p className="vercel-hooks-empty">No deploy hooks yet.</p>}
        <form className="vercel-hooks-form" onSubmit={createHook}><div><label htmlFor={hookNameId}>Hook name</label><input id={hookNameId} required maxLength={100} value={hookName} onChange={e => setHookName(e.target.value)} placeholder="e.g. Content update" disabled={Boolean(hookBusy) || Boolean(busy)} /></div><div><label htmlFor={hookRefId}>Git branch</label><input id={hookRefId} required maxLength={200} value={hookRef} onChange={e => setHookRef(e.target.value)} placeholder="e.g. main" disabled={Boolean(hookBusy) || Boolean(busy)} /></div><button className="button primary" type="submit" disabled={Boolean(hookBusy) || Boolean(busy) || !hookName.trim() || !hookRef.trim()}>{hookBusy === 'create' ? 'Creating…' : 'Create deploy hook'}</button></form>
        {createdHook && <div className="vercel-hook-created"><strong>Copy your deploy hook URL</strong><p>This URL is shown only once. Store it securely.</p><div><input aria-label="New deploy hook URL" readOnly value={createdHook.url} onFocus={e => e.currentTarget.select()} /><button type="button" className="vercel-settings-secondary" onClick={() => void copyHookUrl()}>Copy URL</button></div></div>}
        {hookError && <p className="vercel-hooks-error" role="alert">{hookError}</p>}{hookNotice && <p className="vercel-hooks-notice" role="status">{hookNotice}</p>}
      </section>}
    </>}
    {error && <p className="vercel-settings-error" role="alert">{error}</p>}{notice && <p className="vercel-settings-notice" role="status">{notice}</p>}
  </section>;
}
