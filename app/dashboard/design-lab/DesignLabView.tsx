'use client';

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ComposableMap, Geography, Geographies } from 'react-simple-maps';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { alpha2ToNumeric } from 'i18n-iso-countries';
import worldAtlas from 'world-atlas/countries-110m.json';
import { Activity, ArrowLeft, ArrowRight, ChevronDown, CircleHelp, RefreshCw, Search } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { Report } from '../reporting';
import type { Project, Summary } from '../DashboardView';
import s from './design-lab.module.css';

type Props = {
  project: Project | null;
  projects: Project[];
  selectedProjectId: string;
  summary: Summary | null;
  report: Report | null;
  loading: boolean;
  error: string;
};

type RankedRow = { label: string; count: number };
type Delta = { label: string; direction: 'up' | 'down' | 'neutral' };

const worldTopology = worldAtlas as unknown as Topology;
const worldGeography = feature(worldTopology, worldTopology.objects.countries);

const ACQUISITION_TABS = ['Channel', 'Referrer', 'Campaign', 'Keyword'] as const;
const MAP_TABS = ['Map', 'Country', 'Region', 'City'] as const;
const PAGE_TABS = ['Hostname', 'Page', 'Entry page', 'Exit link'] as const;
const DEVICE_TABS = ['Browser', 'OS', 'Device'] as const;
const JOURNEY_TABS = ['Goal', 'Funnel', 'User', 'Journey'] as const;
const AI_TABS = ['All answers', 'Indexing ads', 'Training data'] as const;

type StaticTabsProps = { label: string; tabs: readonly string[]; active: string };

function StaticTabs({ label, tabs, active }: StaticTabsProps) {
  return (
    <div className={s.tabs} role="list" aria-label={label}>
      {tabs.map((tab) => (
        <span className={s.tab} role="listitem" data-current={tab === active ? 'true' : undefined} key={tab}>
          {tab}
        </span>
      ))}
    </div>
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function percentage(value: number | null | undefined) {
  return value == null ? null : `${(value * 100).toFixed(value * 100 < 10 ? 2 : 1)}%`;
}

function duration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

function delta(current: number | null | undefined, previous: number | null | undefined): Delta | null {
  if (current == null || previous == null || previous === 0) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(change)) return null;
  return {
    label: `${change > 0 ? '+' : ''}${change.toFixed(0)}%`,
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
  };
}

function KpiStrip({ report, summary, loading }: { report: Report | null; summary: Summary | null; loading: boolean }) {
  const visitors = report?.metrics.visitors;
  const visitorsDelta = report ? delta(report.metrics.visitors, report.previous.visitors) : null;
  const conversionRate = report?.metrics.conversion_rate ?? null;
  const conversionDelta = report ? delta(conversionRate, report.previous.conversion_rate) : null;
  const averageSession = summary && summary.metrics.sessions > 0
    ? duration(summary.average_session_duration_seconds)
    : null;

  const items = [
    { label: 'Visitors', value: visitors == null ? null : compact(visitors), change: visitorsDelta },
    { label: 'Revenue', value: null, change: null },
    { label: 'Conversion', value: percentage(conversionRate), change: conversionDelta },
    { label: 'Revenue / visitor', value: null, change: null },
    { label: 'Bounce rate', value: null, change: null },
    { label: 'Session time', value: averageSession, change: null },
    { label: 'Online', value: null, change: null },
  ];

  return (
    <section className={s.kpiStrip} aria-label="Key performance indicators">
      {items.map((item) => (
        <article className={s.kpi} key={item.label}>
          <span className={s.kpiLabel}>{item.label}</span>
          <strong className={s.kpiValue}>{item.value ?? '—'}</strong>
          {item.change ? (
            <span className={s.kpiDelta} data-direction={item.change.direction}>
              <span aria-hidden="true">{item.change.direction === 'up' ? '↑' : item.change.direction === 'down' ? '↓' : '·'}</span>
              {item.change.label}
            </span>
          ) : (
            <span className={s.kpiMeta}>{loading ? 'Loading' : item.value == null ? 'No data' : 'No comparison'}</span>
          )}
        </article>
      ))}
    </section>
  );
}

function ChartPanel({ summary, loading }: { summary: Summary | null; loading: boolean }) {
  const hasEvents = Boolean(summary && summary.metrics.events > 0);
  const series = summary?.series ?? [];
  return (
    <section className={`${s.card} ${s.chartCard}`} aria-label="Visitors and pageviews over time">
      <div className={s.chartTopline}>
        <div className={s.chartLegend} aria-label="Chart series">
          <span><i data-series="visitors" />Visitors</span>
          <span><i data-series="pageviews" />Pageviews</span>
        </div>
        <div className={s.chartArrows} aria-label="Date range navigation">
          <button type="button" disabled aria-label="Previous date range"><ArrowLeft aria-hidden="true" /></button>
          <button type="button" disabled aria-label="Next date range"><ArrowRight aria-hidden="true" /></button>
        </div>
      </div>
      {loading && !summary ? (
        <div className={s.chartEmpty} role="status">Loading report</div>
      ) : !hasEvents ? (
        <div className={s.chartEmpty} role="status">No analytics data for this period</div>
      ) : (
        <div className={s.chartFrame}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="design-lab-visitors-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--dl-blue)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--dl-blue)" stopOpacity={0.015} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--dl-grid)" strokeDasharray="2 4" />
              <XAxis
                dataKey="date"
                axisLine={{ stroke: 'var(--dl-border)' }}
                tickLine={false}
                tick={{ fill: 'var(--dl-muted)', fontSize: 9 }}
                tickMargin={7}
                minTickGap={25}
                tickFormatter={(value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' })}
              />
              <YAxis
                yAxisId="visitors"
                axisLine={false}
                tickLine={false}
                width={32}
                tick={{ fill: 'var(--dl-muted)', fontSize: 9 }}
                tickFormatter={(value: number) => compact(value)}
              />
              <YAxis
                yAxisId="pageviews"
                orientation="right"
                axisLine={false}
                tickLine={false}
                width={32}
                tick={{ fill: 'var(--dl-muted)', fontSize: 9 }}
                tickFormatter={(value: number) => compact(value)}
              />
              <Bar
                yAxisId="pageviews"
                dataKey="pageviews"
                name="Pageviews"
                fill="var(--dl-salmon)"
                fillOpacity={0.88}
                barSize={8}
                isAnimationActive={false}
              />
              <Area
                yAxisId="visitors"
                dataKey="visitors"
                name="Visitors"
                type="monotone"
                stroke="var(--dl-blue)"
                strokeWidth={2}
                fill="url(#design-lab-visitors-fill)"
                dot={{ r: 2, fill: 'var(--dl-blue)', strokeWidth: 0 }}
                activeDot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function EmptyState({ children, loading = false }: { children?: string; loading?: boolean }) {
  return <div className={s.emptyState} role="status">{loading ? 'Loading data' : children ?? 'No data available'}</div>;
}

function RankedCard({
  label,
  tabs,
  active,
  rows,
  total,
  totalLabel,
  loading,
  empty,
  accent = 'blue',
}: {
  label: string;
  tabs: readonly string[];
  active: string;
  rows: RankedRow[];
  total: number;
  totalLabel: string;
  loading: boolean;
  empty: string;
  accent?: 'blue' | 'salmon' | 'brown';
}) {
  const max = Math.max(0, ...rows.map((row) => row.count));
  return (
    <section className={`${s.card} ${s.rankedCard}`} aria-label={label}>
      <div className={s.cardHeader}>
        <StaticTabs label={label} tabs={tabs} active={active} />
        <span className={s.totalLabel}>{total > 0 ? `${compact(total)} ${totalLabel}` : '—'}</span>
      </div>
      {loading && !rows.length ? (
        <EmptyState loading />
      ) : rows.length ? (
        <ul className={s.rankedList}>
          {rows.slice(0, 6).map((row, index) => (
            <li className={s.rankedRow} key={`${row.label}-${index}`}>
              <span
                className={`${s.rowBar} ${s[`accent_${accent}`]}`}
                style={{ width: max > 0 ? `${(row.count / max) * 100}%` : '0%' }}
                aria-hidden="true"
              />
              <span className={s.rowLabel} title={row.label}>{row.label}</span>
              <span className={s.rowCount}>{compact(row.count)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{empty}</EmptyState>
      )}
      <div className={s.cardFooter}><button type="button" disabled>DETAILS</button></div>
    </section>
  );
}

function CountryMap({ countries, loading }: { countries: RankedRow[]; loading: boolean }) {
  const byNumericCode = new Map<string, number>();
  let maxCount = 0;
  for (const row of countries) {
    const alpha2 = row.label.trim().toUpperCase();
    const numericCode = /^[A-Z]{2}$/.test(alpha2) ? alpha2ToNumeric(alpha2) : undefined;
    if (!numericCode) continue;
    byNumericCode.set(numericCode.padStart(3, '0'), row.count);
    maxCount = Math.max(maxCount, row.count);
  }
  const unknownCount = countries.find((row) => row.label.toLowerCase() === 'unknown')?.count ?? 0;

  return (
    <section className={`${s.card} ${s.mapCard}`} aria-label="Visitor countries map">
      <div className={s.cardHeader}>
        <StaticTabs label="Geographic breakdown" tabs={MAP_TABS} active="Map" />
      </div>
      <div className={s.mapCanvas}>
        <ComposableMap
          width={800}
          height={420}
          projection="geoEqualEarth"
          projectionConfig={{ scale: 148, center: [0, 12] }}
          aria-label="World map of recorded visitor countries"
        >
          <Geographies geography={worldGeography}>
            {({ geographies }) => geographies.map((geography) => {
              const id = String(geography.id ?? '').padStart(3, '0');
              const count = byNumericCode.get(id) ?? 0;
              const opacity = maxCount > 0 && count > 0 ? 0.28 + (count / maxCount) * 0.58 : 0;
              return (
                <Geography
                  key={geography.rsmKey}
                  geography={geography}
                  fill={count > 0 ? `rgba(231, 132, 104, ${opacity})` : 'var(--dl-map-land)'}
                  stroke="var(--dl-map-stroke)"
                  strokeWidth={0.55}
                  style={{ outline: 'none' }}
                />
              );
            })}
          </Geographies>
        </ComposableMap>
        {loading && <span className={s.mapNotice}>Loading countries</span>}
        {!loading && byNumericCode.size === 0 && (
          <span className={s.mapNotice}>
            {unknownCount > 0 ? `Unknown locations · ${compact(unknownCount)}` : 'No country data'}
          </span>
        )}
      </div>
    </section>
  );
}

function JourneyCard() {
  return (
    <section className={`${s.card} ${s.journeyCard}`} aria-label="Visitor journeys">
      <div className={s.journeyHeader}>
        <StaticTabs label="Journey views" tabs={JOURNEY_TABS} active="Journey" />
        <div className={s.journeyControls}>
          <button className={s.goalSelect} type="button" disabled aria-label="Goal selector">
            All goals <ChevronDown aria-hidden="true" />
          </button>
          <label className={s.searchBox}>
            <Search aria-hidden="true" />
            <input aria-label="Search journeys" placeholder="Search" disabled />
          </label>
        </div>
      </div>
      <div className={s.tableScroll}>
        <table className={s.journeyTable}>
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Source</th>
              <th>Amount</th>
              <th>Time to complete</th>
              <th>Completed at</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5}>
                <EmptyState>No journey records available</EmptyState>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AiTrafficCard() {
  return (
    <section className={`${s.card} ${s.aiCard}`} aria-label="AI traffic">
      <div className={s.aiHeader}>
        <StaticTabs label="AI traffic filters" tabs={AI_TABS} active="All answers" />
        <button className={s.goalSelect} type="button" disabled>
          Crawlers <ChevronDown aria-hidden="true" />
        </button>
      </div>
      <div className={s.aiColumns}>
        <div className={s.aiChart}>
          <EmptyState>No AI traffic data available</EmptyState>
        </div>
        <div className={s.crawlerList}>
          <div className={s.crawlerTitle}>Crawlers <span>—</span></div>
          <EmptyState>No crawler data available</EmptyState>
        </div>
      </div>
    </section>
  );
}

function FloatingPill() {
  return (
    <div className={s.floatingPill} aria-hidden="true">
      <span><Activity /></span>
      <span><CircleHelp /></span>
    </div>
  );
}

function NetworkMark() {
  return (
    <svg className={s.networkMark} viewBox="0 0 180 112" fill="none" aria-hidden="true">
      <path className={s.networkPath} d="M10 84 48 62 78 75 116 34 168 18M48 62 55 20 116 34 135 91 168 18M78 75 135 91" />
      <circle cx="10" cy="84" r="3" /><circle cx="48" cy="62" r="4" /><circle cx="55" cy="20" r="3" />
      <circle cx="78" cy="75" r="3" /><circle cx="116" cy="34" r="5" /><circle cx="135" cy="91" r="3" /><circle cx="168" cy="18" r="4" />
    </svg>
  );
}

export default function DesignLabView({ project, projects, selectedProjectId, summary, report, loading, error }: Props) {
  const channelRows: RankedRow[] = report?.acquisition.map((row) => ({
    label: row.medium ? `${row.source} · ${row.medium}` : row.source,
    count: row.visitors,
  })) ?? [];
  const pageRows: RankedRow[] = summary?.pages.map((row) => ({ label: row.label, count: row.count })) ?? [];
  const deviceRows: RankedRow[] = summary?.devices.map((row) => ({ label: row.label, count: row.count })) ?? [];
  const countryRows: RankedRow[] = summary?.countries.map((row) => ({ label: row.label, count: row.count })) ?? [];

  return (
    <div className={`${s.page} min-h-screen w-full`}>
      <header className={s.topbar}>
        <SidebarTrigger className={s.mobileSidebarTrigger} aria-label="Open navigation" />
        <div className={s.brandAndSite}>
          <select className={s.siteSelect} value={selectedProjectId} disabled aria-label="Site switcher">
            {!project && <option value="">No website selected</option>}
            {projects.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
          </select>
          <ChevronDown className={s.selectChevron} aria-hidden="true" />
        </div>
        <div className={s.toolbarControls}>
          <button type="button" disabled className={s.toolbarButton}>Last 30 days <ChevronDown aria-hidden="true" /></button>
          <button type="button" disabled className={s.toolbarButton}>Daily <ChevronDown aria-hidden="true" /></button>
          <button type="button" disabled className={s.refreshButton} aria-label="Refresh report"><RefreshCw aria-hidden="true" /></button>
        </div>
      </header>

      {error && <div className={s.errorBanner} role="alert">{error}</div>}
      <div className={s.canvas}>
        <section className={s.intro} aria-labelledby="design-lab-title">
          <div className={s.introCopy}>
            <span className={s.eyebrow}><i aria-hidden="true" /> ANALYTICS / OVERVIEW</span>
            <h1 id="design-lab-title">Performance<br />at a glance<span>.</span></h1>
            <p>Understand how visitors find, explore and engage with {project?.name || 'your site'}.</p>
          </div>
          <div className={s.introDiagram}>
            <span>LIVE SIGNAL MAP</span><NetworkMark />
            <small>01 — 07&nbsp;&nbsp; NETWORK NODES</small>
          </div>
        </section>
        <div className={s.sectionHeading}><span>01</span><h2>Traffic overview</h2><i /></div>
        <KpiStrip report={report} summary={summary} loading={loading} />
        <ChartPanel summary={summary} loading={loading} />

      <div className={`${s.twoColumnGrid} ${s.primaryGrid}`}>
        <RankedCard
          label="Acquisition sources"
          tabs={ACQUISITION_TABS}
          active="Channel"
          rows={channelRows}
          total={report?.metrics.visitors ?? 0}
          totalLabel="visitors"
          loading={loading}
          empty="No channel data available"
          accent="blue"
        />
        <CountryMap countries={countryRows} loading={loading} />
      </div>

      <div className={s.sectionHeading}><span>02</span><h2>Audience &amp; behavior</h2><i /></div>
      <div className={s.twoColumnGrid}>
        <RankedCard
          label="Pages"
          tabs={PAGE_TABS}
          active="Page"
          rows={pageRows}
          total={summary?.metrics.pageviews ?? 0}
          totalLabel="pageviews"
          loading={loading}
          empty="No page data available"
          accent="blue"
        />
        <RankedCard
          label="Browser and device breakdown"
          tabs={DEVICE_TABS}
          active="Device"
          rows={deviceRows}
          total={summary?.metrics.pageviews ?? 0}
          totalLabel="pageviews"
          loading={loading}
          empty="No device data available"
          accent="salmon"
        />
      </div>

      <div className={s.detailGrid}><JourneyCard /><AiTrafficCard /></div>
      </div>
      <FloatingPill />
    </div>
  );
}
