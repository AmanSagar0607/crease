'use client';

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import './git-settings.css';

type Repository = { full_name: string; installation_id: number };
type Status = { configured: boolean; install_url: string | null; public_origin_configured: boolean };

export default function GitHubInstall({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pr, setPr] = useState('');
  const [installations, setInstallations] = useState<number | null>(null);
  const [appSlugs, setAppSlugs] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [savedRepo, setSavedRepo] = useState<Repository | null>(null);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState('');
  const [savingRepo, setSavingRepo] = useState(false);
  const [repoNotice, setRepoNotice] = useState('');
  const searchId = useId();
  const filtered = useMemo(() => repos.filter(repo => repo.full_name.toLowerCase().includes(search.trim().toLowerCase())), [repos, search]);
  const selectedRepo = repos.find(repo => `${repo.installation_id}:${repo.full_name}` === selected);

  useEffect(() => {
    let cancelled = false;
    async function loadSaved() {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/git`);
        if (!response.ok) throw new Error('Could not load the connected repository.');
        const data = await response.json();
        if (!cancelled) setSavedRepo(data.repository);
      } catch (error) { if (!cancelled) setSavedError(error instanceof Error ? error.message : 'Could not load the connected repository.'); }
      finally { if (!cancelled) setSavedLoading(false); }
    }
    void loadSaved();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const statusResponse = await fetch('/api/github-app/status');
        if (!statusResponse.ok) throw new Error('Could not check GitHub connection.');
        const statusData: Status = await statusResponse.json();
        if (cancelled) return;
        setStatus(statusData);
        if (!statusData.configured) return;
        const response = await fetch('/api/github-app/repositories');
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) { setRepos(data.repositories); setInstallations(data.installation_count); setAppSlugs(data.available_app_slugs); setTruncated(Boolean(data.truncated)); setConnected(true); }
        } else if (response.status !== 401) {
          const data = await response.json().catch(() => ({}));
          if (!cancelled) setMessage(typeof data.detail === 'string' ? data.detail : 'Could not load GitHub repositories. Please try again.');
        }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not load GitHub repositories.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function updateConnection(disconnect = false) {
    if (!disconnect && !selectedRepo) return;
    setSavingRepo(true); setMessage(''); setRepoNotice('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/git`, disconnect ? { method: 'DELETE' } : {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository: selectedRepo?.full_name, installation_id: selectedRepo?.installation_id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not update repository connection.');
      setSavedRepo(disconnect ? null : data.repository);
      setRepoNotice(disconnect ? 'Repository disconnected from this project.' : 'Repository connected to this project.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update repository connection.'); }
    finally { setSavingRepo(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setPr('');
    if (!selectedRepo) { setBusy(false); setMessage('Select a repository.'); return; }
    if (!reviewing) { setReviewing(true); return; }
    if (!status?.public_origin_configured) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/github-install`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({repository:selectedRepo.full_name, installation_id:selectedRepo.installation_id, path:'index.html'}) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not create pull request.');
      setPr(body.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create pull request.'); }
    finally { setBusy(false); }
  }

  return <section className="repo-connect" aria-labelledby="github-install-title">
    <div className="repo-connect-heading">
      <div><p className="eyebrow">INSTALLATION OPTIONS <span aria-hidden="true">/</span> GITHUB</p><h2 id="github-install-title">Connect your repository<span className="blue">.</span></h2><p>Choose the project you want to connect. Crease will prepare a change for you to review.</p></div>
      <div className="repo-hosts" aria-label="Works with repositories deployed on any host"><span>VERCEL</span><span>NETLIFY</span><span>ANY HOST</span></div>
    </div>
    <div className="repo-panel">
      <div className="repo-panel-top"><div className="repo-github-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.16c-3.1.67-3.75-1.32-3.75-1.32-.51-1.29-1.25-1.63-1.25-1.63-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.15 1.72 1.15 1 .1.71 1.42 3.23.83.1-.72.39-1.2.71-1.48-2.47-.28-5.07-1.24-5.07-5.5 0-1.21.43-2.2 1.15-2.98-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.11-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.67.11 2.95.72.78 1.15 1.77 1.15 2.98 0 4.27-2.61 5.21-5.1 5.49.4.35.76 1.03.76 2.08V22c0 .29.2.64.76.53A11.1 11.1 0 0 0 12 .9Z"/></svg></div><div className="repo-panel-title"><h3>GitHub repositories</h3><p>Connect once, then choose a repository.</p></div><span className={`repo-connection ${connected ? 'is-connected' : ''}`}><span aria-hidden="true" />{loading ? 'Checking' : connected ? 'Connected' : 'Not connected'}</span></div>
      <section className="git-connected" aria-labelledby="git-connected-title">
          <div className="git-connected-heading"><div><p className="git-kicker">PROJECT SETTINGS / GIT</p><h3 id="git-connected-title">Connected Git repository</h3><p>Choose the repository associated with this Crease project.</p></div><span className={`git-pill ${savedRepo ? 'is-live' : ''}`}>{savedLoading ? 'Checking' : savedError ? 'Unavailable' : savedRepo ? 'Connected' : 'Not connected'}</span></div>
          {savedLoading ? <p role="status">Loading repository…</p> : savedError ? <p className="error" role="alert">{savedError}</p> : savedRepo ? <div className="git-connected-repo"><span className="git-repo-icon" aria-hidden="true">↗</span><div><span className="git-small-label">GITHUB</span><a href={`https://github.com/${savedRepo.full_name}`} target="_blank" rel="noreferrer">{savedRepo.full_name}</a><p>Linked to this Crease project</p></div><button className="git-disconnect" type="button" disabled={savingRepo} onClick={() => void updateConnection(true)}>{savingRepo ? 'Disconnecting…' : 'Disconnect'}</button></div> : <div className="git-connected-empty"><span aria-hidden="true">＋</span><div><strong>No repository connected</strong><p>Select an available repository below to connect it.</p></div></div>}
          {repoNotice && <p className="git-notice" role="status">{repoNotice}</p>}
      </section>
      {loading ? <p className="repo-loading" role="status">Checking your GitHub connection…</p> : !status ? null : !status.configured ? <div className="repo-note"><strong>GitHub App setup required</strong><p>A Crease administrator needs to configure the GitHub App before repositories can be connected.</p></div> : <>
        <div className="repo-actions"><a className="repo-action" href={status.install_url || '#'} target="_blank" rel="noreferrer">{connected ? 'Manage installation' : 'Install GitHub App'} <span aria-hidden="true">↗</span></a><a className="repo-action" href="/api/github-app/connect">{connected ? 'Reconnect GitHub' : 'Connect GitHub'} <span aria-hidden="true">↗</span></a></div>
        {!status.public_origin_configured && <div className="repo-warning"><span className="repo-warning-icon" aria-hidden="true">!</span><div><strong>Public deployment needed</strong><p>Deploy Crease over HTTPS to create a pull request. You can still browse your repositories now.</p></div></div>}
        {connected && repos.length > 0 && <form onSubmit={submit} className="repo-form">
          <div className="repo-list-heading"><div><h4>Choose a repository</h4><p>Repositories available to your GitHub App</p></div><span>{repos.length} available</span></div>
          {truncated && <p className="repo-limit-note">Showing up to 1,000 repositories per installation. Some repositories may not be listed.</p>}
          <label className="repo-search" htmlFor={searchId}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg><span className="repo-visually-hidden">Search repositories</span><input id={searchId} type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search repositories..." autoComplete="off" /></label>
          <p className="repo-visually-hidden" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'repository' : 'repositories'} found</p>
          <fieldset className="repo-list"><legend className="repo-visually-hidden">Select a repository</legend>{filtered.length ? filtered.map(repo => { const value = `${repo.installation_id}:${repo.full_name}`; const [owner, ...name] = repo.full_name.split('/'); return <label className={`repo-item ${selected === value ? 'is-selected' : ''}`} key={value}><span className="repo-item-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 3.5h12a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V3.5Z"/><path d="M8 3.5v13.5M7 17h12M11 8h5"/></svg></span><span className="repo-item-name"><strong>{name.join('/')}</strong><small>{owner}</small></span><input type="radio" name={`repo-${projectId}`} value={value} checked={selected === value} onChange={() => { setSelected(value); setReviewing(false); }} /><span className="repo-choice" aria-hidden="true" /></label>; }) : <div className="repo-no-results"><strong>No repositories found</strong><p>Try a different search or check which repositories the app can access.</p></div>}</fieldset>
          <div className="git-connect-action"><span>{selectedRepo && savedRepo?.full_name === selectedRepo.full_name && savedRepo.installation_id === selectedRepo.installation_id ? 'This repository is connected.' : 'Connect the selected repository to this project.'}</span><button className="repo-action" type="button" onClick={() => void updateConnection()} disabled={!selectedRepo || savingRepo || (savedRepo?.full_name === selectedRepo?.full_name && savedRepo?.installation_id === selectedRepo?.installation_id)}>{savingRepo ? 'Connecting…' : savedRepo ? 'Update connection' : 'Connect repository'} <span aria-hidden="true">↗</span></button></div>
          {reviewing && selectedRepo && <div className="repo-note" role="status"><strong>Review installation for {selectedRepo.full_name}</strong><p>Crease will propose a change to the root index.html on a new branch. You can review it on GitHub before merging. Tracking starts only after your site signals consent.</p>{!status.public_origin_configured && <p>Next, deploy Crease over HTTPS and set CREASE_PUBLIC_ORIGIN on the server. This step cannot create a working installation while Crease is only on localhost.</p>}<button type="button" className="repo-action" onClick={() => setReviewing(false)}>Back to selection</button></div>}
          <div className="repo-form-footer"><div><strong>{selectedRepo ? selectedRepo.full_name : 'Select a repository to continue'}</strong><p>{reviewing ? 'A GitHub pull request will be created for your review.' : 'Review the installation before creating any changes.'}</p></div><button className="button primary repo-submit" disabled={busy || !selectedRepo || (reviewing && !status.public_origin_configured)} type="submit">{busy ? 'Preparing installation…' : reviewing ? 'Prepare installation' : 'Continue'} <span aria-hidden="true">↗</span></button></div>
        </form>}
        {connected && repos.length === 0 && <div className="repo-note" role="status"><strong>No repositories available</strong><p>{installations === 0 ? 'GitHub did not return an installation of the configured app for this account.' : 'The app is installed, but GitHub returned no repositories for it.'} {appSlugs.length > 0 && installations === 0 ? `Available app installations: ${appSlugs.join(', ')}. ` : ''}Check the app’s repository access in GitHub settings, then reconnect.</p></div>}
        {!connected && <div className="repo-note"><strong>Ready when you are</strong><p>Install the app on your repositories, then connect your GitHub account to browse them here.</p></div>}
      </>}
      {message && <p className="error repo-feedback" role="alert">{message}</p>}{pr && <p className="repo-success" role="status">Pull request created. <a href={pr} target="_blank" rel="noreferrer">Review on GitHub ↗</a></p>}
    </div>
  </section>;
}

