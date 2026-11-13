'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import GitHubInstall from './GitHubInstall';
import VercelGitSettings from './VercelGitSettings';
import ThemeToggle from '../theme-toggle';
import LivingCat from '../mascot/living-cat';
import AnalyticsCharts from './AnalyticsCharts';
import { dispatchMascotEvent } from '../mascot/mascot-events';
import s from './dashboard.module.css';

type User = { id: string; login: string };
type Project = {
  id: string;
  name: string;
  domain: string;
  retention_days: number;
  visitors_7d?: number;
  events_7d?: number;
  last_event_at?: string | null;
  has_write_key?: boolean;
  write_key?: string;
  verified?: boolean;
};
type Verification = {
  token: string;
  verified: boolean;
  verified_at: string | null;
  record: string;
  meta: string;
};
type Breakdown = { label: string; count: number };
type SeriesPoint = { date: string; events: number; pageviews: number; visitors: number; sessions: number };
type Metrics = { events: number; pageviews: number; visitors: number; sessions: number };
type Summary = {
  metrics: Metrics;
  previous: Metrics;
  series: SeriesPoint[];
  last_event_at: string | null;
  pages: Breakdown[];
  devices: Breakdown[];
  countries: Breakdown[];
  referrers: Breakdown[];
  days: number;
};
type Delta = { label: string; dir: 'up' | 'down' | 'flat' };

const firstPageviewSeen = new Set<string>();

function writeKeyStorage(projectId: string) {
  return `crease-write-key:${projectId}`;
}

function readWriteKey(projectId: string) {
  try {
    return window.localStorage.getItem(writeKeyStorage(projectId)) ?? '';
  } catch {
    return '';
  }
}

function saveWriteKey(projectId: string, key: string) {
  try {
    if (key) window.localStorage.setItem(writeKeyStorage(projectId), key);
    else window.localStorage.removeItem(writeKeyStorage(projectId));
  } catch {
    // Storage can be unavailable; the key stays in component state for this session.
  }
}

function celebrateFirstPageview(projectId: string, summary: Summary, project?: Project) {
  if (!project || summary.metrics.pageviews <= 0 || !project.last_event_at) return;

  const lastEvent = new Date(project.last_event_at).getTime();
  if (!Number.isFinite(lastEvent) || Date.now() - lastEvent > 10 * 60 * 1000) return;
  if (firstPageviewSeen.has(projectId)) return;
  firstPageviewSeen.add(projectId);

  try {
    const key = `crease-mascot-first-pageview:${projectId}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage can be unavailable; the in-memory guard still prevents repeats.
  }

  dispatchMascotEvent({ kind: 'first-pageview', projectName: project.name });
}

const TABS = ['analytics', 'installation', 'integrations', 'settings'] as const;
type Tab = (typeof TABS)[number];

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const json = await response.json();
      if (typeof json.detail === 'string') message = json.detail;
    } catch {}
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/* ---------- Icons ---------- */

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? s.icon}
    >
      {children}
    </svg>
  );
}

const UsersIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

const ActivityIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M22 12h-4l-3 8-6-16-3 8H2" />
  </Svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </Svg>
);

const GlobeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
  </Svg>
);

const MonitorIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" />
  </Svg>
);

const FileIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
  </Svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m20 6-11 11-5-5" />
  </Svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </Svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </Svg>
);

const ArrowUpRightIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
);

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

const CodeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
  </Svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

const ChevronIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

/* ---------- Formatting helpers ---------- */

function compact(value: number) {
  return value.toLocaleString('en-US');
}

function shortDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function relativeWhen(iso?: string | null) {
  if (!iso) return 'No events yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'No events yet';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function getDelta(current?: number, previous?: number): Delta | null {
  if (current === undefined || previous === undefined) return null;
  if (previous === 0) return current === 0 ? { label: '0%', dir: 'flat' } : { label: 'New', dir: 'up' };
  const pct = ((current - previous) / previous) * 100;
  const dir: Delta['dir'] = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat';
  return { label: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, dir };
}

function deltaClass(dir: Delta['dir']) {
  return dir === 'up' ? s.deltaUp : dir === 'down' ? s.deltaDown : s.deltaFlat;
}

/* ---------- Chart geometry ---------- */

function pointsFor(values: number[], width: number, height: number, padTop: number, padBottom: number) {
  const max = Math.max(1, ...values);
  const inner = height - padTop - padBottom;
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    return [x, padTop + inner - (value / max) * inner] as const;
  });
}

function linePath(points: ReadonlyArray<readonly [number, number]>) {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

function areaPath(points: ReadonlyArray<readonly [number, number]>, height: number) {
  if (!points.length) return '';
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePath(points)} L${last[0].toFixed(1)} ${height} L${first[0].toFixed(1)} ${height} Z`;
}

function Sparkline({ values }: { values: number[] }) {
  const points = pointsFor(values.length ? values : [0, 0], 120, 36, 3, 3);
  return (
    <svg className={s.spark} viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">
      <path d={areaPath(points, 36)} fill="rgba(17,17,17,.05)" />
      <path d={linePath(points)} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---------- Small building blocks ---------- */

function BreakdownCard({
  title,
  icon,
  rows,
  total,
  empty,
}: {
  title: string;
  icon: ReactNode;
  rows: Breakdown[];
  total: number;
  empty: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, 5);
  const max = rows[0]?.count || 1;

  return (
    <section className={s.breakdownCard}>
      <div className={s.cardTop}>
        <h3>
          {icon}
          {title}
        </h3>
        <span className={s.cardCount}>{rows.length ? `${rows.length} SOURCES` : 'NO DATA'}</span>
      </div>
      {shown.length ? (
        <>
          <ul className={s.breakdownList}>
            {shown.map((row, index) => (
              <li className={s.breakdownRow} key={`${row.label}-${index}`}>
                <div className={s.breakdownLine}>
                  <span className={s.breakdownLabel} title={row.label || 'Unknown'}>
                    {row.label || 'Unknown'}
                  </span>
                  <span className={s.breakdownValue}>
                    {compact(row.count)}
                    {total > 0 && <em>{Math.round((row.count / total) * 100)}%</em>}
                  </span>
                </div>
                <span className={s.barTrack} aria-hidden="true">
                  <span className={s.barFill} style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
          {rows.length > 5 && (
            <button className={s.breakdownMore} type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
        </>
      ) : (
        <div className={s.emptyBlock}>
          <FileIcon />
          <span>{empty}</span>
        </div>
      )}
    </section>
  );
}

function Kpi({
  label,
  icon,
  value,
  delta,
  hint,
  series,
}: {
  label: string;
  icon: ReactNode;
  value?: number;
  delta: Delta | null;
  hint: string;
  series: number[];
}) {
  return (
    <article className={s.kpi}>
      <div className={s.kpiTop}>
        <span className={s.kpiIcon}>{icon}</span>
        <span>{label}</span>
        {delta && <span className={`${s.kpiDelta} ${deltaClass(delta.dir)}`}>{delta.label}</span>}
      </div>
      <strong className={s.kpiValue}>{value === undefined ? '—' : compact(value)}</strong>
      <span className={s.kpiHint}>{hint}</span>
      <Sparkline values={series} />
    </article>
  );
}

/* ---------- Main component ---------- */

export default function DashboardView({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(true);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [days, setDays] = useState(30);
  const [retention, setRetention] = useState(30);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [keyNotice, setKeyNotice] = useState('');
  const [writeKey, setWriteKey] = useState('');
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState('');
  const [origin, setOrigin] = useState('');
  const [tab, setTab] = useState<Tab>('analytics');
  const project = projects.find((item) => item.id === selected);
  const projectRef = useRef<Project | undefined>(undefined);
  projectRef.current = project;

  const load = useCallback(async () => {
    try {
      const current = await api<User>('/api/me');
      setUser(current);
      const list = await api<Project[]>('/api/projects');
      setProjects(list);
      setSelected(projectId && list.some((project) => project.id === projectId) ? projectId : '');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/login');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load your workspace.');
    } finally {
      setBusy(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSummary = useCallback(async () => {
    if (!selected) {
      setSummary(null);
      return;
    }
    setSummaryBusy(true);
    try {
      const result = await api<Summary>(`/api/projects/${encodeURIComponent(selected)}/summary?days=${days}`);
      setSummary(result);
      celebrateFirstPageview(selected, result, projectRef.current);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/login');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load analytics.');
    } finally {
      setSummaryBusy(false);
    }
  }, [selected, days, router]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    setOrigin(window.location.origin);
    const read = () => {
      const candidate = window.location.hash.slice(1) as Tab;
      setTab(TABS.includes(candidate) ? candidate : 'analytics');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  useEffect(() => {
    if (project) setRetention(project.retention_days);
  }, [project?.id, project?.retention_days]);

  useEffect(() => {
    setSettingsMessage('');
    setKeyNotice('');
    setWriteKey(selected ? readWriteKey(selected) : '');
    setVerification(null);
    setVerificationNotice('');
  }, [selected]);

  const loadVerification = useCallback(async () => {
    if (!selected) {
      setVerification(null);
      return;
    }
    try {
      const result = await api<Verification>(`/api/projects/${encodeURIComponent(selected)}/verification`);
      setVerification(result);
      setProjects((list) =>
        list.map((item) => (item.id === selected ? { ...item, verified: result.verified } : item)),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/login');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load domain verification status.');
    }
  }, [selected, router]);

  useEffect(() => {
    void loadVerification();
  }, [loadVerification]);

  async function checkVerification() {
    if (!project) return;
    setError('');
    setVerificationNotice('');
    setVerificationBusy(true);
    try {
      const result = await api<{ verified: boolean; method: string | null; checked_at: string }>(
        `/api/projects/${encodeURIComponent(project.id)}/verification/check`,
        { method: 'POST' },
      );
      setProjects((list) =>
        list.map((item) => (item.id === project.id ? { ...item, verified: item.verified || result.verified } : item)),
      );
      setVerificationNotice(
        result.verified
          ? `Domain verified via ${result.method === 'meta' ? 'the root meta tag' : 'the DNS TXT record'}.`
          : 'No matching DNS TXT record or meta tag found yet. DNS changes can take a few minutes to propagate.',
      );
      if (result.verified) await loadVerification();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check domain verification.');
    } finally {
      setVerificationBusy(false);
    }
  }

  async function generateWriteKey() {
    if (!project) return;
    setError('');
    setKeyNotice('');
    try {
      const result = await api<{ write_key: string }>(
        `/api/projects/${encodeURIComponent(project.id)}/write-key`,
        { method: 'POST' },
      );
      saveWriteKey(project.id, result.write_key);
      setWriteKey(result.write_key);
      setProjects((list) =>
        list.map((item) => (item.id === project.id ? { ...item, has_write_key: true } : item)),
      );
      setKeyNotice('New write key generated. Update every deployed copy of the snippet; the old key no longer works.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a write key.');
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const created = await api<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, domain }),
      });
      const isFirstProject = projects.length === 0;
      setProjects((list) => [...list, created]);
      setSelected(created.id);
      setName('');
      setDomain('');
      saveWriteKey(created.id, created.write_key ?? '');
      setWriteKey(created.write_key ?? '');
      setKeyNotice(created.write_key ? 'Write key created. Copy the installation code now; it is also stored in this browser.' : '');
      if (isFirstProject) {
        dispatchMascotEvent({ kind: 'project-created', projectName: created.name });
      }
      router.push(`/dashboard/projects/${encodeURIComponent(created.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the project.');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await api('/api/logout', { method: 'POST' });
      router.replace('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out.');
    }
  }

  async function updateRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    setError('');
    setSettingsMessage('');
    setSettingsBusy(true);
    try {
      await api(`/api/projects/${encodeURIComponent(project.id)}/retention`, {
        method: 'PATCH',
        body: JSON.stringify({ retention_days: retention }),
      });
      setProjects((list) =>
        list.map((item) => (item.id === project.id ? { ...item, retention_days: retention } : item)),
      );
      setSettingsMessage('Retention updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update retention.');
    } finally {
      setSettingsBusy(false);
    }
  }

  async function deleteProject() {
    if (!project || !window.confirm(`Delete ${project.name} and its analytics data? This cannot be undone.`)) return;
    setError('');
    setSettingsMessage('');
    setSettingsBusy(true);
    try {
      await api(`/api/projects/${encodeURIComponent(project.id)}`, { method: 'DELETE' });
      setProjects((list) => list.filter((item) => item.id !== project.id));
      setSelected('');
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the project.');
    } finally {
      setSettingsBusy(false);
    }
  }

  const collector = process.env.NEXT_PUBLIC_COLLECTOR_URL || (origin ? `${origin}/api/events` : '');
  const snippet = `<script src="${origin}/crease.js" defer></script>
<script>
  window.addEventListener('load', function () {
    crease.init({ projectId: '${project?.id || ''}', writeKey: '${writeKey}', endpoint: '${collector}' });
  });
</script>`;

  async function copySnippet() {
    if (!writeKey) {
      setError('Generate a write key before copying the installation code.');
      return;
    }
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy. Select the installation code and copy it manually.');
    }
  }

  function selectTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  }

  const series = summary?.series ?? [];
  const totalEvents = summary?.metrics.events ?? 0;
  const rangeLabel = days === 7 ? 'Last 7 days' : days === 90 ? 'Last 90 days' : 'Last 30 days';
  const isLive = Boolean(project?.last_event_at) && Date.now() - new Date(project?.last_event_at ?? 0).getTime() < 7 * 864e5;

  return (
    <div className={s.dashboard}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>

      <header className={s.header}>
        <div className={s.headerInner}>
          <Link className={s.brand} href="/">
            <span className={s.brandMark}>✳</span>
            crease.
          </Link>
          <span className={s.headerDivider} aria-hidden="true" />
          <span className={s.workspaceLabel}>WORKSPACE</span>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <Link href="/dashboard">Projects</Link>
            {project && (
              <>
                <span aria-hidden="true">/</span>
                <strong>{project.name}</strong>
              </>
            )}
          </nav>
          <div className={s.account}>
            <ThemeToggle />
            {user && (
              <span className={s.userChip}>
                <span className={s.avatar} aria-hidden="true">
                  {user.login.slice(0, 1).toUpperCase()}
                </span>
                <span>{user.login}</span>
              </span>
            )}
            <Link className={s.headerLink} href="/docs">
              Docs
            </Link>
            {user && (
              <button className={s.signOut} type="button" onClick={logout}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={s.main} id="main">
        <div className={s.dashboardCat}>
          <LivingCat variant="dashboard" listen />
        </div>
        {busy ? (
          <div className={s.loadingPage} role="status" aria-label="Loading your workspace">
            <span className={s.loadingBar} style={{ width: '22%' }} />
            <span className={s.loadingBar} style={{ width: '46%', height: 34 }} />
            <div className={s.loadingCards}>
              {[0, 1, 2, 3].map((item) => (
                <span className={s.loadingCard} key={item} />
              ))}
            </div>
            <div className={s.loadingCards}>
              <span className={s.loadingCard} key="a" />
              <span className={s.loadingCard} key="b" />
            </div>
          </div>
        ) : !user ? (
          <div className={s.redirecting} role="status">
            <p className={s.eyebrow}>SIGNED OUT</p>
            <h1>Taking you to sign in…</h1>
            <p>
              If nothing happens, <Link href="/login">open the sign-in page</Link>.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className={s.alert} role="alert">
                <AlertIcon className={`${s.icon} ${s.alertIcon}`} />
                <span>{error}</span>
                <button type="button" onClick={() => setError('')}>
                  Dismiss
                </button>
              </div>
            )}

            {projectId && project ? (
              <>
                <section className={s.projectHero} aria-labelledby="project-title">
                  <span className={s.projectMark} aria-hidden="true">
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className={s.projectHeroBody}>
                    <p className={s.eyebrow}>PROJECT</p>
                    <h1 id="project-title">{project.name}</h1>
                    <a className={s.domainLink} href={`https://${project.domain}`} target="_blank" rel="noreferrer">
                      {project.domain}
                      <ArrowUpRightIcon className={s.iconXs} />
                    </a>
                    <div className={s.projectMeta}>
                      <span className={`${s.metaChip} ${isLive ? s.isLive : ''}`}>
                        <span className={s.statusDot} aria-hidden="true" />
                        {isLive ? 'Receiving events' : 'Waiting for events'}
                      </span>
                      <span className={s.metaChip}>
                        <span className={s.statusDot} aria-hidden="true" />
                        Last event {relativeWhen(project.last_event_at)}
                      </span>
                      <span className={s.metaChip}>
                        <span className={s.statusDot} aria-hidden="true" />
                        {project.retention_days} day retention
                      </span>
                    </div>
                  </div>
                  <div className={s.projectActions}>
                    <label className={s.switcher}>
                      <span className={s.srOnly}>Switch project</span>
                      <select
                        value={selected}
                        onChange={(event) => router.push(`/dashboard/projects/${encodeURIComponent(event.target.value)}`)}
                      >
                        {projects.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <ChevronIcon />
                    </label>
                    <button className={`${s.btn} ${s.btnQuiet}`} type="button" onClick={() => selectTab('installation')}>
                      <CodeIcon className={s.iconSm} />
                      Install tracker
                    </button>
                  </div>
                </section>

                <nav className={s.tabs} aria-label="Project sections">
                  {TABS.map((item) => (
                    <a
                      key={item}
                      className={s.tab}
                      href={`#${item}`}
                      aria-current={tab === item ? 'page' : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        selectTab(item);
                      }}
                    >
                      {item === 'analytics' ? 'Analytics' : item === 'installation' ? 'Installation' : item[0].toUpperCase() + item.slice(1)}
                    </a>
                  ))}
                </nav>

                <div className={s.tabPanel} key={tab}>
                  {tab === 'analytics' && (
                    <>
                      <div className={s.analyticsBar}>
                        <div>
                          <h2>Analytics</h2>
                          <p>
                            {rangeLabel} · {project.domain}
                          </p>
                        </div>
                        <div className={s.controls}>
                          <div className={s.range} role="group" aria-label="Reporting period">
                            {[7, 30, 90].map((option) => (
                              <button
                                key={option}
                                type="button"
                                aria-pressed={days === option}
                                onClick={() => {
                                  setError('');
                                  setDays(option);
                                }}
                              >
                                {option}d
                              </button>
                            ))}
                          </div>
                          <button
                            className={s.refresh}
                            type="button"
                            onClick={() => void loadSummary()}
                            disabled={summaryBusy}
                            aria-label="Refresh analytics"
                          >
                            <RefreshIcon className={`${s.icon} ${summaryBusy ? s.spinning : ''}`} />
                          </button>
                          <span className={s.updated}>Updated {relativeWhen(project.last_event_at)}</span>
                        </div>
                      </div>

                      <div className={s.kpiGrid}>
                        <Kpi
                          label="Visitors"
                          icon={<UsersIcon />}
                          value={summary?.metrics.visitors}
                          delta={getDelta(summary?.metrics.visitors, summary?.previous?.visitors)}
                          hint={`Unique visitors · vs previous ${days} days`}
                          series={series.map((point) => point.visitors)}
                        />
                        <Kpi
                          label="Page views"
                          icon={<EyeIcon />}
                          value={summary?.metrics.pageviews}
                          delta={getDelta(summary?.metrics.pageviews, summary?.previous?.pageviews)}
                          hint={`Pageview events · vs previous ${days} days`}
                          series={series.map((point) => point.pageviews)}
                        />
                        <Kpi
                          label="Sessions"
                          icon={<ActivityIcon />}
                          value={summary?.metrics.sessions}
                          delta={getDelta(summary?.metrics.sessions, summary?.previous?.sessions)}
                          hint={`Distinct sessions · vs previous ${days} days`}
                          series={series.map((point) => point.sessions)}
                        />
                        <Kpi
                          label="Events"
                          icon={<ZapIcon />}
                          value={summary?.metrics.events}
                          delta={getDelta(summary?.metrics.events, summary?.previous?.events)}
                          hint={`All tracked events · vs previous ${days} days`}
                          series={series.map((point) => point.events)}
                        />
                      </div>

                      <AnalyticsCharts series={series} metrics={summary?.metrics ?? { events: 0, pageviews: 0, visitors: 0, sessions: 0 }} />

                      <div className={s.breakdownGrid}>
                        <BreakdownCard
                          title="Top pages"
                          icon={<FileIcon />}
                          rows={summary?.pages ?? []}
                          total={summary?.metrics.pageviews ?? 0}
                          empty="Pages will appear once events arrive."
                        />
                        <BreakdownCard
                          title="Referrers"
                          icon={<LinkIcon />}
                          rows={summary?.referrers ?? []}
                          total={summary?.metrics.pageviews ?? 0}
                          empty="No referrer data yet."
                        />
                        <BreakdownCard
                          title="Devices"
                          icon={<MonitorIcon />}
                          rows={summary?.devices ?? []}
                          total={summary?.metrics.pageviews ?? 0}
                          empty="No device data yet."
                        />
                        <BreakdownCard
                          title="Countries"
                          icon={<GlobeIcon />}
                          rows={summary?.countries ?? []}
                          total={summary?.metrics.pageviews ?? 0}
                          empty="No country data yet."
                        />
                      </div>
                    </>
                  )}

                  {tab === 'installation' && (
                    <div className={s.installGrid}>
                      <section className={s.installCopy}>
                        <p className={s.eyebrow}>GET CONNECTED / 01</p>
                        <h2>Bring your site into focus.</h2>
                        <p>
                          Add this snippet to your site after obtaining any required visitor consent. The collector URL
                          must be publicly reachable by your visitors.
                        </p>
                        {!writeKey ? (
                          <div className={s.keyNotice} role="status">
                            <strong>Generate a write key</strong>
                            <p>
                              Crease rejects events without a valid per-project write key. Generate one before copying
                              the installation code.
                            </p>
                            <button className={`${s.btn} ${s.btnSecondary}`} type="button" onClick={generateWriteKey}>
                              Generate write key
                            </button>
                          </div>
                        ) : (
                          <p className={s.keyStatus}>
                            Write key ready. It is stored in this browser and embedded in the snippet.{' '}
                            <button className={s.keyRotate} type="button" onClick={generateWriteKey}>
                              Rotate key
                            </button>
                          </p>
                        )}
                        {keyNotice && (
                          <p className={s.keyStatus} role="status">
                            {keyNotice}
                          </p>
                        )}
                        <div className={s.stepList}>
                          {[
                            ['Paste the snippet', 'Place it in your document head so every page loads the tracker.'],
                            ['Set your endpoint', 'Point the tracker at your own collector or the hosted endpoint.'],
                            ['Watch data arrive', 'Open the analytics tab — events appear within seconds.'],
                          ].map(([title, copy], index) => (
                            <div className={s.stepItem} key={title}>
                              <span className={s.stepNum} aria-hidden="true">
                                0{index + 1}
                              </span>
                              <div>
                                <strong>{title}</strong>
                                <p>{copy}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className={s.installFooter}>
                          <button className={`${s.btn} ${s.btnSecondary}`} type="button" onClick={copySnippet} disabled={!writeKey}>
                            {copied ? <CheckIcon className={s.iconSm} /> : <CopyIcon className={s.iconSm} />}
                            {copied ? 'Copied' : 'Copy installation code'}
                          </button>
                          <button className={`${s.btn} ${s.btnQuiet}`} type="button" onClick={() => selectTab('integrations')}>
                            Open integrations
                          </button>
                        </div>
                      </section>

                      <div>
                        <div className={s.verifyCard}>
                          <div className={s.verifyHead}>
                            <span className={s.verifyBadge} data-verified={verification?.verified ? 'true' : 'false'}>
                              {verification?.verified ? 'Domain verified' : 'Verification required'}
                            </span>
                            <span className={s.verifyDomain}>{project.domain}</span>
                          </div>
                          <p className={s.verifyCopy}>
                            {verification?.verified
                              ? 'Crease accepts events for this domain. Re-check if you move the site to a new host.'
                              : 'Crease rejects events until the domain proves ownership. Add one of the records below, then check again.'}
                          </p>
                          {!verification?.verified && verification && (
                            <div className={s.verifyRows}>
                              <div className={s.verifyRow}>
                                <span>DNS TXT record</span>
                                <code>{verification.record}</code>
                              </div>
                              <div className={s.verifyRow}>
                                <span>Root meta tag</span>
                                <code>{verification.meta}</code>
                              </div>
                            </div>
                          )}
                          <button
                            className={`${s.btn} ${s.btnSecondary}`}
                            type="button"
                            onClick={checkVerification}
                            disabled={verificationBusy || verification?.verified}
                          >
                            {verificationBusy ? 'Checking…' : verification?.verified ? 'Verified' : 'Check verification'}
                          </button>
                          {verificationNotice && (
                            <p className={s.verifyNotice} role="status">
                              {verificationNotice}
                            </p>
                          )}
                        </div>
                        <div className={s.codeCard}>
                          <div className={s.codeTop}>
                            <span>INSTALLATION CODE</span>
                            <button className={s.copyButton} type="button" onClick={copySnippet} disabled={!writeKey}>
                              {copied ? <CheckIcon /> : <CopyIcon />}
                              {copied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <pre className={s.code} tabIndex={0}>
                            <code>{snippet}</code>
                          </pre>
                          <div className={s.codeMeta}>
                            <span>Project {project.id.slice(0, 8)}</span>
                            <span>Async · defer</span>
                            <span>No cookies required</span>
                          </div>
                        </div>
                        <p className={s.updated} style={{ marginTop: 10 }}>
                          Consent-first by default. Only initialize tracking when your policy allows it.
                        </p>
                      </div>
                    </div>
                  )}

                  {tab === 'integrations' && (
                    <div className={s.integrations}>
                      <GitHubInstall key={project.id} projectId={project.id} writeKey={writeKey} />
                      <VercelGitSettings key={`vercel-${project.id}`} projectId={project.id} />
                    </div>
                  )}

                  {tab === 'settings' && (
                    <div className={s.settingsGrid}>
                      <section className={s.settingCard}>
                        <h3>Data retention</h3>
                        <p>Set how long analytics events are kept, from 1 to 90 days. Older events are removed automatically.</p>
                        <form className={s.retentionForm} onSubmit={updateRetention}>
                          <label className={s.field}>
                            Retention in days
                            <input
                              type="number"
                              required
                              min={1}
                              max={90}
                              step={1}
                              value={retention}
                              onChange={(event) => setRetention(Number(event.target.value))}
                            />
                          </label>
                          <button className={`${s.btn} ${s.btnPrimary}`} disabled={settingsBusy} type="submit">
                            {settingsBusy ? 'Saving…' : 'Save retention'}
                          </button>
                        </form>
                        <p className={s.feedback} role="status">
                          {settingsMessage}
                        </p>
                      </section>

                      <section className={s.settingCard}>
                        <h3>Project details</h3>
                        <p>Identifiers used by the tracker and collector.</p>
                        <dl className={s.detailList}>
                          <div className={s.detailRow}>
                            <dt>Name</dt>
                            <dd>{project.name}</dd>
                          </div>
                          <div className={s.detailRow}>
                            <dt>Domain</dt>
                            <dd>{project.domain}</dd>
                          </div>
                          <div className={s.detailRow}>
                            <dt>Project ID</dt>
                            <dd>{project.id}</dd>
                          </div>
                          <div className={s.detailRow}>
                            <dt>Retention</dt>
                            <dd>{project.retention_days} days</dd>
                          </div>
                        </dl>
                      </section>

                      <section className={`${s.settingCard} ${s.dangerCard}`}>
                        <h3>Delete project</h3>
                        <p>Permanently remove this project, its installation, and all retained analytics events.</p>
                        <button className={s.dangerButton} type="button" disabled={settingsBusy} onClick={deleteProject}>
                          <TrashIcon className={s.iconSm} />
                          Delete project and data
                        </button>
                      </section>
                    </div>
                  )}
                </div>
              </>
            ) : projectId ? (
              <section className={s.notFound}>
                <h2>Project not found.</h2>
                <p>This project may have been deleted or you may not have access.</p>
                <Link className={`${s.btn} ${s.btnSecondary}`} href="/dashboard">
                  Back to projects
                </Link>
              </section>
            ) : (
              <>
                <div className={s.pageHead}>
                  <div>
                    <p className={s.eyebrow}>YOUR WORKSPACE</p>
                    <h1>Your projects.</h1>
                    <p>Every site you track, in one place. Open a project to read its analytics or finish setup.</p>
                  </div>
                  <div className={s.pageActions}>
                    <Link className={`${s.btn} ${s.btnSecondary}`} href="/docs">
                      Read the docs
                      <ArrowUpRightIcon className={s.iconSm} />
                    </Link>
                  </div>
                </div>

                <div className={s.sectionHead}>
                  <div>
                    <h2>All projects</h2>
                    <p>Last 7 days at a glance.</p>
                  </div>
                  <div className={s.sectionHeadActions}>
                    <span className={s.updated}>{projects.length} total</span>
                  </div>
                </div>

                {projects.length ? (
                  <div className={s.projectGrid}>
                    {projects.map((item) => {
                      const live = Boolean(item.last_event_at) && Date.now() - new Date(item.last_event_at!).getTime() < 7 * 864e5;
                      return (
                        <Link className={s.projectCard} key={item.id} href={`/dashboard/projects/${encodeURIComponent(item.id)}`}>
                          <span className={s.projectCardTop}>
                            <span className={s.projectCardMark} aria-hidden="true">
                              {item.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className={s.projectCardName}>
                              <strong>{item.name}</strong>
                              <span>{item.domain}</span>
                            </span>
                            <span className={s.projectCardArrow} aria-hidden="true">
                              <ArrowRightIcon />
                            </span>
                          </span>
                          <span className={s.projectStats}>
                            <span className={s.projectStat}>
                              <strong>{compact(item.visitors_7d ?? 0)}</strong>
                              <span>VISITORS / 7D</span>
                            </span>
                            <span className={s.projectStat}>
                              <strong>{compact(item.events_7d ?? 0)}</strong>
                              <span>EVENTS / 7D</span>
                            </span>
                          </span>
                          <span className={s.projectFoot}>
                            <span className={`${s.statusLine} ${live ? s.isLive : ''}`}>
                              <i aria-hidden="true" />
                              {live ? 'Receiving events' : 'No recent events'}
                            </span>
                            <span>{item.retention_days}d retention</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className={s.emptyProjects}>
                    <span className={s.emptyIcon} aria-hidden="true">
                      <ZapIcon />
                    </span>
                    <strong>No projects yet</strong>
                    <p>Create your first project below, then install the tracker to start collecting analytics.</p>
                  </div>
                )}

                <section className={s.createPanel}>
                  <div>
                    <p className={s.eyebrow}>GET STARTED</p>
                    <h2>Create a project.</h2>
                    <p>
                      Add a domain, install the tracker, and events show up here. You can keep every site in one
                      workspace.
                    </p>
                  </div>
                  <form className={s.createForm} onSubmit={createProject}>
                    <label>
                      Project name
                      <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="My website" />
                    </label>
                    <label>
                      Domain
                      <input
                        required
                        maxLength={253}
                        value={domain}
                        onChange={(event) => setDomain(event.target.value)}
                        placeholder="example.com"
                        autoCapitalize="none"
                      />
                    </label>
                    <button className={`${s.btn} ${s.btnPrimary}`} disabled={saving} type="submit">
                      {saving ? 'Creating…' : 'Create project'}
                      <ArrowRightIcon className={s.iconSm} />
                    </button>
                  </form>
                </section>
              </>
            )}
          </>
        )}
      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span>CREASE / YOUR WORK, UNDERSTOOD</span>
          <div className={s.footerLinks}>
            <Link href="/docs">DOCS</Link>
            <a href="https://github.com/AmanSagar0607/crease">OPEN SOURCE</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
