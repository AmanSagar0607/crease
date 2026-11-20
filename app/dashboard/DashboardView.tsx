'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useClerk } from '@clerk/nextjs';
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { alpha2ToAlpha3, alpha3ToAlpha2, alpha2ToNumeric, getName, registerLocale } from 'i18n-iso-countries';
import englishLocale from 'i18n-iso-countries/langs/en.json';
import type * as GeoJSON from 'geojson';
import { Compass, Flame, Globe, Monitor, Smartphone, Tablet, UserRound, LogOut, SlidersHorizontal, ExternalLink, Sun, Moon } from 'lucide-react';
import { Map as InteractiveMap, MapControls, MapGeoJSON, useMap } from '@/components/ui/map';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorldData } from '@/lib/use-world-data';
import GitHubInstall from './GitHubInstall';
import VercelGitSettings from './VercelGitSettings';
import ZappaWordmark from '../zappa-wordmark';
import VerifiedBadge from './VerifiedBadge';
import ProjectOnboarding from './ProjectOnboarding';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dock, DockCard } from '@/components/ui/dock';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ButtonGroup } from '@/components/ui/button-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle } from '@/components/ui/code-block';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import OverviewV1 from './OverviewV1';
import ReportToolbar from './ReportToolbar';
import AcquisitionSection from './AcquisitionSection';
import CampaignsSection from './CampaignsSection';
import PagesSection from './PagesSection';
import GoalsSection from './GoalsSection';
import UnavailableSection from './UnavailableSection';
import LiveActivity from './LiveActivity';
import useOverviewReport from './useOverviewReport';
import DesignLabView from './design-lab/DesignLabView';
import { appendFunnelStep, buildFunnelRequest, normalizeFunnelSteps, selectFunnelStep } from './funnel-api';
import {
  LEGACY_HASHES,
  NAV_GROUPS,
  PROJECT_ICONS,
  PROJECT_NAV,
  isAnalyticsSection,
  type AnalyticsSection,
  type Tab,
} from './navigation';
import { dateRange, displayPagePath, type AttributionModel, type Preset, type Range } from './reporting';
import s from './dashboard.module.css';

registerLocale(englishLocale);

function DashboardDock({
  tab,
  activeSection,
  onSelectAnalytics,
  onSelectTab,
}: {
  tab: Tab;
  activeSection: AnalyticsSection;
  onSelectAnalytics: (section: AnalyticsSection) => void;
  onSelectTab: (section: Tab) => void;
}) {
  const analyticsItems = NAV_GROUPS.flatMap((group) => group.items);
  return (
    <nav className={s.dashboardDockLayer} aria-label="Dashboard navigation">
      <Dock className={s.dashboardDock}>
        {analyticsItems.map((item, index) => (
          <DockCard
            key={item.id}
            id={String(index)}
            href={`#${item.id}`}
            label={item.label}
            active={tab === 'analytics' && activeSection === item.id}
            className={s.dashboardDockItem}
            onClick={(event) => { event.preventDefault(); onSelectAnalytics(item.id); }}
          >
            <item.icon aria-hidden="true" />
          </DockCard>
        ))}
        <span className={s.dashboardDockDivider} aria-hidden="true" />
        {PROJECT_NAV.map((section, index) => {
          const Icon = PROJECT_ICONS[section];
          const label = section[0].toUpperCase() + section.slice(1);
          return (
            <DockCard
              key={section}
              id={String(analyticsItems.length + index)}
              href={`#${section}`}
              label={label}
              active={tab === section}
              className={s.dashboardDockItem}
              onClick={(event) => { event.preventDefault(); onSelectTab(section); }}
            >
              <Icon aria-hidden="true" />
            </DockCard>
          );
        })}
      </Dock>
    </nav>
  );
}

type User = { id: string; login: string };
export type Project = {
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
  dns_name?: string;
};
type Breakdown = { label: string; count: number };
type GeographyRow = { key: string; label: string; country_code: string | null; region_code: string | null; visitors: number; sessions: number; pageviews: number; conversions: number | null; verified_revenue: number | null; share: number };
type GeographyResponse = { rows: GeographyRow[]; total_rows: number; total_visitors: number; conversion_configured: boolean; verified_revenue_available: boolean; page: number; page_size: number };
type SeriesPoint = { date: string; events: number; pageviews: number; visitors: number; sessions: number };
type Metrics = { events: number; pageviews: number; visitors: number; sessions: number };
type PropertyValue = { value: string; count: number };
type PropertyKey = {
  name: string;
  value_type: 'number' | 'boolean' | 'mixed';
  event_count: number;
  distinct_values: number;
  first_seen_at: string;
  last_seen_at: string;
  values: PropertyValue[];
};
type EventRow = {
  id: string;
  name: string;
  occurred_at: string;
  path: string;
  visitor_id: string | null;
  session_id: string | null;
  country: string | null;
  device: string | null;
  referrer: string | null;
  properties: Record<string, number | boolean>;
};
export type Summary = {
  metrics: Metrics;
  previous: Metrics;
  series: SeriesPoint[];
  last_event_at: string | null;
  pages: Breakdown[];
  devices: Breakdown[];
  browsers: Breakdown[];
  operating_systems: Breakdown[];
  countries: Breakdown[];
  country_visitors: Breakdown[];
  referrers: Breakdown[];
  event_names: Breakdown[];
  days: number;
  filter?: { property: string | null; value: string | null };
  average_session_duration_seconds?: number;
};
type FunnelStep = {
  event_name: string;
  count: number;
  conversion_from_previous: number | null;
};
type Funnel = { steps: FunnelStep[]; days: number; start: string; end: string };
function writeKeyStorage(projectId: string) {
  return `Zappa-write-key:${projectId}`;
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

const SESSION_DEFINITION = 'Sessions end after 30 min idle or at UTC midnight';
const NO_BREAKDOWNS: Breakdown[] = [];
const COUNTRY_MAP_COLORS = {
  dark: { base: '#1A1A1A', ramp: ['#30302E', '#6B6B6B', '#AAA69D', '#FF5A3A'], hover: '#FF5A3A', line: '#151412' },
  light: { base: '#F7F6F2', ramp: ['#D9D8D3', '#B9B4AA', '#817D75', '#EB3514'], hover: '#EB3514', line: '#fffefa' },
} as const;

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

const MoreHorizontalIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
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

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
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

/* ---------- Small building blocks ---------- */

function BrowserMark({ label }: { label: string }) {
  const family = label.toLowerCase();
  if (family.includes('chrome') || family.includes('chromium')) {
    return <span className={s.chromeBrowserMark} aria-hidden="true" />;
  }
  if (family.includes('safari')) {
    return <span className={s.safariBrowserMark} aria-hidden="true"><Compass /></span>;
  }
  if (family.includes('firefox')) {
    return <span className={s.firefoxBrowserMark} aria-hidden="true"><Flame /></span>;
  }
  if (family.includes('edge')) {
    return <span className={s.edgeBrowserMark} aria-hidden="true"><Globe /></span>;
  }
  if (family.includes('opera')) {
    return <span className={s.operaBrowserMark} aria-hidden="true">O</span>;
  }
  return <Globe aria-hidden="true" />;
}

function BreakdownCard({
  id,
  title,
  icon,
  rows,
  browserRows = [],
  operatingSystemRows = [],
  total,
  empty,
  deviceFacets = false,
}: {
  id?: string;
  title: string;
  icon: ReactNode;
  rows: Breakdown[];
  browserRows?: Breakdown[];
  operatingSystemRows?: Breakdown[];
  total: number;
  empty: string;
  deviceFacets?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deviceFacet, setDeviceFacet] = useState('device');
  const activeRows = deviceFacet === 'browser' ? browserRows : deviceFacet === 'os' ? operatingSystemRows : rows;
  const shown = expanded ? activeRows : activeRows.slice(0, 5);
  const max = activeRows[0]?.count || 1;
  const emptyLabel = deviceFacet === 'browser' ? 'No browser data for this period yet.' : deviceFacet === 'os' ? 'No operating system data for this period yet.' : empty;

  return (
    <section className={s.breakdownCard} id={id}>
      <div className={s.cardTop}>
        <h3>
          {icon}
          {title}
        </h3>
        <span className={s.cardCount}>{activeRows.length ? `${activeRows.length} SOURCES` : 'NO DATA'}</span>
      </div>
      {deviceFacets && <Tabs value={deviceFacet} onValueChange={setDeviceFacet} className={s.deviceTabs}>
        <TabsList className={s.deviceTabsList} aria-label="Device breakdown type">
          <TabsTrigger className={s.deviceTab} value="browser">Browser</TabsTrigger>
          <TabsTrigger className={s.deviceTab} value="os">OS</TabsTrigger>
          <TabsTrigger className={s.deviceTab} value="device">Device</TabsTrigger>
        </TabsList>
      </Tabs>}
      {shown.length ? (
        <>
          {deviceFacets ? (
            <ul className={s.deviceBreakdownList} aria-label={`Pageviews by ${deviceFacet === 'os' ? 'operating system' : deviceFacet}`}>
              {shown.map((row, index) => {
                const label = row.label.toLowerCase();
                const icon = deviceFacet === 'browser'
                  ? <BrowserMark label={row.label} />
                  : deviceFacet === 'os'
                    ? <Monitor aria-hidden="true" />
                    : label === 'mobile'
                      ? <Smartphone aria-hidden="true" />
                      : label === 'tablet'
                        ? <Tablet aria-hidden="true" />
                        : <Monitor aria-hidden="true" />;
                return <li className={s.deviceBreakdownRow} key={`${row.label}-${index}`}>
                  <div className={s.deviceBarRow}>
                    <span className={s.deviceBarFill} data-unknown={label === 'unknown'} style={{ width: `${Math.max(2, (row.count / max) * 68)}%` }} aria-hidden="true" />
                    <span className={s.deviceBarLabel}>{icon}<span>{row.label || 'Unknown'}</span></span>
                    <span className={s.deviceBarValue}>{compact(row.count)}</span>
                  </div>
                </li>;
              })}
            </ul>
          ) : (
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
          )}
          {deviceFacet === 'browser' && browserRows.some((row) => row.label.toLowerCase() === 'unknown') && (
            <p className={s.deviceBreakdownNote}>Unknown includes older events or requests without a recognizable browser signature.</p>
          )}
          {activeRows.length > 5 && (
            <button className={s.breakdownMore} type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show fewer' : `Show all ${activeRows.length}`}
            </button>
          )}
        </>
      ) : (
        <div className={s.emptyBlock}>
          <FileIcon />
          <span>{emptyLabel}</span>
        </div>
      )}
    </section>
  );
}

function countryFeatureCenter(feature: GeoJSON.Feature<GeoJSON.Geometry, { ISO_A3?: string }>): [number, number] | null {
  const positions: [number, number][] = [];
  const collect = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      positions.push([value[0], value[1]]);
      return;
    }
    value.forEach(collect);
  };
  const visitGeometry = (geometry: GeoJSON.Geometry) => {
    if (geometry.type === 'GeometryCollection') geometry.geometries.forEach(visitGeometry);
    else collect(geometry.coordinates);
  };
  visitGeometry(feature.geometry);
  if (!positions.length) return null;
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;
  let minLatitude = Infinity;
  let maxLatitude = -Infinity;
  for (const [longitude, latitude] of positions) {
    minLongitude = Math.min(minLongitude, longitude);
    maxLongitude = Math.max(maxLongitude, longitude);
    minLatitude = Math.min(minLatitude, latitude);
    maxLatitude = Math.max(maxLatitude, latitude);
  }
  return [
    (minLongitude + maxLongitude) / 2,
    (minLatitude + maxLatitude) / 2,
  ];
}

function FocusCountryOnOpen({ feature }: { feature: GeoJSON.Feature<GeoJSON.Geometry, { ISO_A3?: string }> | null }) {
  const { map, isLoaded } = useMap();
  const center = useMemo(() => feature ? countryFeatureCenter(feature) : null, [feature]);
  useEffect(() => {
    if (!map || !isLoaded || !center) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo({ center, zoom: 1.55, duration: reduceMotion ? 0 : 550 });
  }, [center, isLoaded, map]);
  return null;
}

function CountryDemographicCard({ rows, loading, projectId, range }: { rows: Breakdown[]; loading: boolean; projectId: string; range: Range | null }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const world = useWorldData();
  const [hover, setHover] = useState<{ name: string; visitors: number } | null>(null);
  const [view, setView] = useState('map');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [geoRows, setGeoRows] = useState<GeographyRow[]>([]);
  const [geoTotalRows, setGeoTotalRows] = useState(0);
  const [geoPage, setGeoPage] = useState(1);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const { byAlpha3, maxCount, total } = useMemo(() => {
    const countryCounts = new Map<string, number>();
    let max = 0;
    for (const row of rows) {
      const label = row.label.trim().toUpperCase();
      const code = /^[A-Z]{2}$/.test(label) ? alpha2ToAlpha3(label) : undefined;
      if (!code) continue;
      countryCounts.set(code, row.count);
      max = Math.max(max, row.count);
    }
    return { byAlpha3: countryCounts, maxCount: max, total: rows.reduce((sum, row) => sum + row.count, 0) };
  }, [rows]);
  const visible = rows.slice(0, 6);
  const unknown = rows.find((row) => row.label.trim().toLowerCase() === 'unknown');
  const colors = COUNTRY_MAP_COLORS[theme];
  const maxStop = Math.max(1, maxCount);
  const fillPaint = useMemo(() => ({
    'fill-color': [
      'case',
      ['all', ['boolean', ['feature-state', 'hover'], false], ['>', ['coalesce', ['get', 'visitors'], 0], 0]],
      colors.hover,
      [
        'interpolate', ['linear'], ['coalesce', ['get', 'visitors'], 0],
        0, colors.base,
        maxStop * .25, colors.ramp[0],
        maxStop * .5, colors.ramp[1],
        maxStop * .75, colors.ramp[2],
        maxStop, colors.ramp[3],
      ],
    ],
    'fill-opacity': .94,
  }), [colors, maxStop]);
  const countries = useMemo(() => {
    if (!world) return null;
    return {
      type: 'FeatureCollection' as const,
      features: world.features.map((item) => {
        const iso3 = item.properties.ISO_A3;
        return {
          ...item,
          properties: {
            NAME_LONG: item.properties.NAME_LONG,
            ISO_A3: item.properties.ISO_A3,
            visitors: typeof iso3 === 'string' ? byAlpha3.get(iso3) ?? 0 : 0,
          },
        };
      }),
    };
  }, [world, byAlpha3]);
  const focusFeature = useMemo(() => {
    if (!world) return null;
    const leadingCode = rows
      .filter((row) => /^[A-Z]{2}$/i.test(row.label))
      .sort((a, b) => b.count - a.count)
      .map((row) => alpha2ToAlpha3(row.label.toUpperCase()))
      .find((code) => code && world.features.some((feature) => feature.properties.ISO_A3 === code));
    return leadingCode ? world.features.find((feature) => feature.properties.ISO_A3 === leadingCode) ?? null : null;
  }, [rows, world]);

  const activeGeoLevel = view === 'city' ? 'city' : view === 'region' ? 'region' : 'country';
  const activeGeoCountry = view === 'city' || view === 'region' ? selectedCountry : null;
  const activeGeoRegion = view === 'city' ? selectedRegion : null;
  useEffect(() => {
    if (!projectId || (view !== 'region' && view !== 'city') || (view === 'region' && !selectedCountry) || (view === 'city' && (!selectedCountry || !selectedRegion))) return;
    let cancelled = false;
    const params = new URLSearchParams({ level: activeGeoLevel, days: '30', timezone: 'UTC', page: String(geoPage), page_size: '20' });
    if (range) { params.set('start', range.start); params.set('end', range.end); }
    if (activeGeoCountry) params.set('country', activeGeoCountry);
    if (activeGeoRegion) params.set('region_code', activeGeoRegion);
    setGeoLoading(true);
    setGeoError('');
    api<GeographyResponse>(`/api/projects/${encodeURIComponent(projectId)}/geography?${params.toString()}`)
      .then((result) => {
        if (cancelled) return;
        setGeoRows((current) => geoPage === 1 ? result.rows : [...current, ...result.rows]);
        setGeoTotalRows(result.total_rows);
      })
      .catch((error) => { if (!cancelled) setGeoError(error instanceof Error ? error.message : 'Could not load location data.'); })
      .finally(() => { if (!cancelled) setGeoLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, range?.start, range?.end, view, activeGeoLevel, activeGeoCountry, activeGeoRegion, geoPage]);

  useEffect(() => {
    setGeoRows([]);
    setGeoPage(1);
  }, [range?.start, range?.end]);

  function chooseCountry(code: string | null) {
    setSelectedCountry(code);
    setSelectedRegion(null);
    setGeoRows([]);
    setGeoPage(1);
    setView('region');
  }

  function chooseRegion(code: string | null) {
    setSelectedRegion(code);
    setGeoRows([]);
    setGeoPage(1);
    setView('city');
  }

  return (
    <section className={`${s.breakdownCard} ${s.countryDemographic}`} aria-labelledby="country-demographic-title">
      <div className={s.cardTop}>
        <h3 id="country-demographic-title"><GlobeIcon />Customers by country</h3>
        <span className={s.cardCount}>{rows.length ? `${compact(total)} VISITORS` : 'NO DATA'}</span>
      </div>
      <Tabs value={view} onValueChange={setView} className={s.countryTabs}>
        <TabsList className={s.countryTabsList} aria-label="Visitor geography view">
          <TabsTrigger className={s.countryTab} value="map">Map</TabsTrigger>
          <TabsTrigger className={s.countryTab} value="country">Country</TabsTrigger>
          <TabsTrigger className={s.countryTab} value="region">Region</TabsTrigger>
          <TabsTrigger className={s.countryTab} value="city">City</TabsTrigger>
        </TabsList>
        {loading && !rows.length ? (
          <div className={s.countryMapEmpty} role="status">Loading location data</div>
        ) : rows.length ? (
          <>
          <TabsContent value="map" className={s.countryTabPanel}>
          <div className={s.demographicMap} role="region" aria-label="Interactive map of visitors by country">
            <InteractiveMap
              blank
              theme={theme}
              center={[12, 28]}
              zoom={1.25}
              minZoom={1}
              maxZoom={5}
              scrollZoom={false}
              dragRotate={false}
              pitchWithRotate={false}
              loading={!countries}
            >
              <FocusCountryOnOpen feature={focusFeature} />
              {countries && <MapGeoJSON
                data={countries as GeoJSON.FeatureCollection<GeoJSON.Geometry, { NAME_LONG: string; ISO_A3?: string; visitors: number }>}
                promoteId="NAME_LONG"
                fillPaint={fillPaint as never}
                linePaint={{ 'line-color': colors.line, 'line-width': .65 }}
                interactive
                onHover={(event) => {
                  const visitors = event?.feature.properties.visitors ?? 0;
                  if (!event || visitors <= 0) { setHover(null); return; }
                  setHover({ name: event.feature.properties.NAME_LONG, visitors });
                }}
                onClick={(event) => {
                  const alpha2 = event.feature.properties.ISO_A3 ? alpha3ToAlpha2(event.feature.properties.ISO_A3) : undefined;
                  if (alpha2 && event.feature.properties.visitors > 0) chooseCountry(alpha2);
                }}
              />}
              <MapControls position="top-right" showZoom />
            </InteractiveMap>
            {hover && <div className={s.countryMapTooltip} role="status" aria-live="polite">
              <strong>{hover.name}</strong>
              <span>{hover.visitors.toLocaleString()} {hover.visitors === 1 ? 'visitor' : 'visitors'}</span>
            </div>}
            {unknown && <span className={s.countryMapNote}>Unknown locations · {compact(unknown.count)}</span>}
          </div>
          <ul className={s.countryLegend} aria-label="Top countries by visitors">
            {visible.map((row) => {
              const countryCode = /^[A-Z]{2}$/i.test(row.label) ? row.label.toLowerCase() : null;
              const countryName = countryCode ? getName(row.label.toUpperCase(), 'en') ?? row.label : row.label || 'Unknown';
              return (
                <li key={row.label}>
                  <span className={s.countryLegendName}>
                    {countryCode && <img src={`https://flagcdn.com/w20/${countryCode}.png`} alt="" aria-hidden="true" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
                    <span>{countryName}</span>
                  </span>
                  <span className={s.countryLegendTrack} aria-hidden="true"><i style={{ width: `${total ? Math.max(2, row.count / total * 100) : 0}%` }} /></span>
                  <span className={s.countryLegendValue}>{Math.round(total ? row.count / total * 100 : 0)}%</span>
                </li>
              );
            })}
          </ul>
          <p className={s.countryMapAttribution}>Locations are approximate. Legacy country data may include GeoLite Data created by <a href="https://www.maxmind.com/" target="_blank" rel="noreferrer">MaxMind</a>.</p>
          {unknown && <p className={s.countryDataNote}>Unknown means a country could not be resolved when those events arrived; older events aren’t backfilled.</p>}
          </TabsContent>
          <TabsContent value="country" className={s.countryTabPanel}>
            <ul className={s.countryFullList} aria-label="Visitors by country">
              {rows.map((row) => {
                const countryCode = /^[A-Z]{2}$/i.test(row.label) ? row.label.toLowerCase() : null;
                const countryName = countryCode ? getName(row.label.toUpperCase(), 'en') ?? row.label : row.label || 'Unknown';
                return <li key={row.label}>
                  <button type="button" className={s.geoRowButton} disabled={!countryCode} onClick={() => chooseCountry(countryCode?.toUpperCase() ?? null)} aria-label={`View regions for ${countryName}`}>
                  <span className={s.countryLegendName}>
                    {countryCode && <img src={`https://flagcdn.com/w20/${countryCode}.png`} alt="" aria-hidden="true" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
                    <span>{countryName}</span>
                  </span>
                  <span className={s.countryFullCount}>{compact(row.count)} <i>{Math.round(total ? row.count / total * 100 : 0)}%</i></span>
                  <span className={s.countryFullTrack} aria-hidden="true"><i style={{ width: `${total ? Math.max(2, row.count / total * 100) : 0}%` }} /></span>
                  </button>
                </li>;
              })}
            </ul>
          </TabsContent>
          <TabsContent value="region" className={s.countryTabPanel}>
            {!selectedCountry ? <div className={s.geoLevelEmpty}><strong>Select a country to view regions</strong><span>Choose a country from the map or Country tab.</span><button type="button" className={s.geoBackButton} onClick={() => setView('country')}>Browse countries</button></div> : <GeoList rows={geoRows} loading={geoLoading} error={geoError} totalRows={geoTotalRows} onPage={() => setGeoPage((value) => value + 1)} onBack={() => { setView('country'); setSelectedCountry(null); setSelectedRegion(null); }} backLabel={getName(selectedCountry, 'en') ?? selectedCountry} onChoose={(row) => chooseRegion(row.region_code)} />}
          </TabsContent>
          <TabsContent value="city" className={s.countryTabPanel}>
            {!selectedCountry || !selectedRegion ? <div className={s.geoLevelEmpty}><strong>Select a region to view cities</strong><span>Drill down from a country to a region.</span><button type="button" className={s.geoBackButton} onClick={() => setView(selectedCountry ? 'region' : 'country')}>Back to {selectedCountry ? 'regions' : 'countries'}</button></div> : <GeoList rows={geoRows} loading={geoLoading} error={geoError} totalRows={geoTotalRows} onPage={() => setGeoPage((value) => value + 1)} onBack={() => { setView('region'); setSelectedRegion(null); setGeoRows([]); setGeoPage(1); }} backLabel={selectedRegion} />}
          </TabsContent>
          </>
        ) : (
          <div className={s.emptyBlock}><FileIcon /><span>No country data yet.</span></div>
        )}
      </Tabs>
    </section>
  );
}

function GeoList({ rows, loading, error, totalRows, onPage, onBack, backLabel, onChoose }: { rows: GeographyRow[]; loading: boolean; error: string; totalRows: number; onPage: () => void; onBack: () => void; backLabel: string; onChoose?: (row: GeographyRow) => void }) {
  return <div className={s.geoListWrap}>
    <div className={s.geoListHeader}><button type="button" className={s.geoBackButton} onClick={onBack}>← {backLabel}</button><span>{rows.length} of {totalRows}</span></div>
    {error ? <div className={s.geoLevelEmpty} role="alert"><strong>Couldn’t load geography</strong><span>{error}</span></div> : loading && !rows.length ? <div className={s.countryMapEmpty} role="status">Loading location data</div> : !rows.length ? <div className={s.geoLevelEmpty}><strong>No detailed locations yet</strong><span>New events will appear here when Cloudflare provides region and city data.</span></div> : <ul className={s.countryFullList} aria-label="Visitor locations">
      {rows.map((row) => <li key={row.key}>
        <div className={s.geoRowHead}>
          {onChoose ? <button type="button" className={s.geoNameButton} disabled={!row.region_code} onClick={() => onChoose(row)}>{row.label}</button> : <span className={s.geoNameButton}>{row.label}</span>}
          <span className={s.countryFullCount}>{row.visitors.toLocaleString()} <i>{row.share}%</i></span>
        </div>
        <div className={s.geoMetrics} aria-label={`${row.sessions} sessions, ${row.pageviews} page views`}><span>{row.sessions.toLocaleString()} sessions</span><span>{row.pageviews.toLocaleString()} pageviews</span>{row.conversions !== null && <span>{row.conversions.toLocaleString()} conversions</span>}</div>
        <span className={s.countryFullTrack} aria-hidden="true"><i style={{ width: `${Math.max(2, row.share)}%` }} /></span>
      </li>)}
    </ul>}
    {!error && rows.length < totalRows && <button type="button" className={s.geoBackButton} onClick={onPage} disabled={loading}>{loading ? 'Loading…' : 'Show more locations'}</button>}
    <p className={s.countryDataNote}>Locations are approximate and may be incomplete.</p>
  </div>;
}

/* ---------- Main component ---------- */

type DashboardViewProps = { projectId?: string; mode?: 'standard' | 'design-lab' };

export default function DashboardView({ projectId, mode = 'standard' }: DashboardViewProps) {
  const isDesignLab = mode === 'design-lab';
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { signOut } = useClerk();
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const handleUnauthorized = useCallback((setMessage: (message: string) => void) => {
    if (clerkLoaded && !isSignedIn) {
      const signInUrl = new URL('/sign-in', window.location.origin);
      signInUrl.searchParams.set('redirect_url', window.location.href);
      router.replace(`${signInUrl.pathname}${signInUrl.search}`);
      return;
    }
    setMessage(
      clerkLoaded
        ? `You’re signed in, but Zappa’s production API rejected the session (401). The API needs the same Clerk production issuer as this site and ${window.location.origin} in CLERK_AUTHORIZED_PARTIES. Update those settings on the API host, then redeploy it.`
        : 'Could not verify your sign-in yet. Refresh after Clerk finishes loading.',
    );
  }, [clerkLoaded, isSignedIn, router]);
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState('');
  const [showProjects, setShowProjects] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(true);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [acquisitionRefresh, setAcquisitionRefresh] = useState(0);
  const [summaryError, setSummaryError] = useState('');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [reportRange, setReportRange] = useState<Range>(() => dateRange('30'));
  const [preset, setPreset] = useState<Preset>('30');
  const [draftRange, setDraftRange] = useState<Range>(() => dateRange('30'));
  const [model, setModel] = useState<AttributionModel>('first_touch');
  const [conversionEvent, setConversionEvent] = useState('');
  const [acquisitionQuery, setAcquisitionQuery] = useState('');
  const days = reportRange ? Math.round((Date.parse(reportRange.end) - Date.parse(reportRange.start)) / 86400000) + 1 : 30;
  const rangeQuery = reportRange ? `&start=${reportRange.start}&end=${reportRange.end}` : '';
  const [retention, setRetention] = useState(30);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [keyNotice, setKeyNotice] = useState('');
  const [writeKey, setWriteKey] = useState('');
  const [showWriteKey, setShowWriteKey] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState('');
  const [setupChecking, setSetupChecking] = useState(false);
  const [setupCheckAt, setSetupCheckAt] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState('');
  const [properties, setProperties] = useState<PropertyKey[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsBusy, setEventsBusy] = useState(false);
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const [funnelSteps, setFunnelSteps] = useState<string[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [funnelBusy, setFunnelBusy] = useState(false);
  const [funnelError, setFunnelError] = useState('');
  const [tab, setTab] = useState<Tab>('analytics');
  const [activeSection, setActiveSection] = useState<AnalyticsSection>('overview');
  const project = showProjects ? undefined : projects.find((item) => item.id === selected);
  const projectRef = useRef<Project | undefined>(undefined);
  const loadVersion = useRef(0);
  projectRef.current = project;
  const activeProperty = properties.find((item) => item.name === propertyKey);
  const activeFilter = propertyKey && propertyValue ? { property: propertyKey, value: propertyValue } : null;
  const filterProperty = activeFilter?.property ?? '';
  const filterValue = activeFilter?.value ?? '';
  const filterQuery = activeFilter
    ? `&property=${encodeURIComponent(activeFilter.property)}&value=${encodeURIComponent(activeFilter.value)}`
    : '';
  const eventNames = summary?.event_names ?? NO_BREAKDOWNS;

  const overviewReport = useOverviewReport({
    projectId: selected,
    range: reportRange,
    model,
    conversionEvent,
    refresh: acquisitionRefresh,
  });

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setBusy(true);
    setError('');
    try {
      const current = await api<User>('/api/me');
      if (version !== loadVersion.current) return;
      setUser(current);
      const list = await api<Project[]>('/api/projects');
      if (version !== loadVersion.current) return;
      setProjects(list);
      const viewingProjects = !projectId && !isDesignLab && new URLSearchParams(window.location.search).get('view') === 'projects';
      setShowProjects(viewingProjects);
      setSelected(projectId ? (list.some((project) => project.id === projectId) ? projectId : '') : isDesignLab ? (list[0]?.id ?? '') : !viewingProjects && list.length === 1 ? list[0].id : '');
    } catch (e) {
      if (version !== loadVersion.current) return;
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized(setError);
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load your workspace.');
    } finally {
      if (version === loadVersion.current) setBusy(false);
    }
  }, [projectId, handleUnauthorized, isDesignLab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const syncWorkspaceView = () => {
      if (projectId) return;
      const viewingProjects = new URLSearchParams(window.location.search).get('view') === 'projects';
      setShowProjects(viewingProjects);
      if (viewingProjects) setSelected('');
      else if (projects.length === 1) setSelected(projects[0].id);
    };
    window.addEventListener('popstate', syncWorkspaceView);
    return () => window.removeEventListener('popstate', syncWorkspaceView);
  }, [projectId, projects]);

  const loadSummary = useCallback(async () => {
    if (!selected) {
      setSummary(null);
      return;
    }
    setSummaryBusy(true);
    setSummaryError('');
    try {
      const result = await api<Summary>(`/api/projects/${encodeURIComponent(selected)}/summary?days=30${rangeQuery}${filterQuery}`);
      setSummary(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized(setSummaryError);
        return;
      }
      setSummaryError(e instanceof Error ? e.message : 'Could not load analytics.');
    } finally {
      setSummaryBusy(false);
    }
  }, [selected, rangeQuery, filterQuery, handleUnauthorized]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const pollSetup = useCallback(async () => {
    if (!selected) return;
    setSetupChecking(true);
    try {
      const list = await api<Project[]>('/api/projects');
      setProjects(list);
      setSetupCheckAt(new Date().toISOString());
      const current = list.find((item) => item.id === selected);
      if (current?.last_event_at) {
        setSetupNotice('Setup verified — the first events have arrived.');
        await loadSummary();
      } else {
        setSetupNotice('');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized(setSetupNotice);
        return;
      }
      setSetupNotice(e instanceof Error ? e.message : 'Could not check for events.');
    } finally {
      setSetupChecking(false);
    }
  }, [selected, loadSummary, handleUnauthorized]);

  useEffect(() => {
    if ((tab !== 'installation' && !onboarding) || !project || project.last_event_at) return;
    void pollSetup();
    const timer = window.setInterval(() => {
      void pollSetup();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [tab, onboarding, project?.id, project?.last_event_at, pollSetup]);

  const loadProperties = useCallback(async () => {
    if (!selected) {
      setProperties([]);
      return;
    }
    try {
      setProperties(await api<PropertyKey[]>(`/api/projects/${encodeURIComponent(selected)}/properties`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized(setError);
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load custom properties.');
    }
  }, [selected, handleUnauthorized]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const loadEvents = useCallback(async () => {
    if (!selected) {
      setEvents([]);
      return;
    }
    setEventsBusy(true);
    try {
      const params = new URLSearchParams({ days: '30', limit: '25', ...(reportRange || {}) });
      if (filterProperty && filterValue) {
        params.set('property', filterProperty);
        params.set('value', filterValue);
      }
      setEvents(await api<EventRow[]>(`/api/projects/${encodeURIComponent(selected)}/events?${params.toString()}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized(setError);
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load events.');
    } finally {
      setEventsBusy(false);
    }
  }, [selected, reportRange, filterProperty, filterValue, handleUnauthorized]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const names = eventNames.map((item) => item.label);
    setFunnelSteps((current) => normalizeFunnelSteps(current, names));
  }, [eventNames]);

  const loadFunnel = useCallback(async () => {
    if (!selected) {
      setFunnel(null);
      setFunnelError('');
      return;
    }
    if (funnelSteps.length < 2 || funnelSteps.some((step) => !step) || new Set(funnelSteps).size !== funnelSteps.length) {
      setFunnel(null);
      setFunnelError(eventNames.length < 2 ? 'Track at least two distinct events before building a funnel.' : 'Choose at least two funnel steps to continue.');
      return;
    }
    setFunnelBusy(true);
    setFunnelError('');
    try {
      const resultPath = buildFunnelRequest(selected, reportRange, funnelSteps);
      if (funnelSteps.length === 2) {
        const result = await api<{ first: string; second: string; first_count: number; second_count: number; conversion: number; days: number }>(resultPath);
        setFunnel({
          days: result.days,
          start: reportRange?.start ?? '',
          end: reportRange?.end ?? '',
          steps: [
            { event_name: result.first, count: result.first_count, conversion_from_previous: null },
            { event_name: result.second, count: result.second_count, conversion_from_previous: result.conversion },
          ],
        });
      } else {
        setFunnel(await api<Funnel>(resultPath));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized(setFunnelError);
        return;
      }
      if (e instanceof ApiError && e.status === 404 && funnelSteps.length > 2) {
        setFunnelError('This backend build supports two-step funnels. Redeploy the analytics API to enable 3–5 steps.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not load the funnel.');
      }
    } finally {
      setFunnelBusy(false);
    }
  }, [selected, reportRange, funnelSteps, eventNames.length, handleUnauthorized]);

  useEffect(() => {
    void loadFunnel();
  }, [loadFunnel]);

  function chooseProperty(name: string) {
    setPropertyKey(name);
    setPropertyValue(properties.find((item) => item.name === name)?.values[0]?.value ?? '');
  }

  function clearPropertyFilter() {
    setPropertyKey('');
    setPropertyValue('');
  }

  const refreshAnalytics = useCallback(() => {
    setAcquisitionRefresh((value) => value + 1);
    setError('');
    void loadSummary();
    void loadProperties();
    void loadEvents();
    void loadFunnel();
  }, [loadEvents, loadFunnel, loadProperties, loadSummary]);

  useEffect(() => {
    if (!selected || tab !== 'analytics' || activeSection === 'live') return;

    let refreshTimer = 0;
    const params = new URLSearchParams({ projectId: selected });
    const source = new EventSource(`/api/events/stream?${params.toString()}`);
    source.addEventListener('analytics-event', () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshAnalytics();
        void api<Project[]>('/api/projects').then(setProjects).catch(() => {});
      }, 350);
    });

    return () => {
      window.clearTimeout(refreshTimer);
      source.close();
    };
  }, [activeSection, refreshAnalytics, selected, tab]);

  useEffect(() => {
    setOnboarding(new URLSearchParams(window.location.search).get('onboarding') === '1');
    const read = () => {
      const candidate = window.location.hash.slice(1);
      const mapped = LEGACY_HASHES[candidate] ?? candidate;
      if (isAnalyticsSection(mapped)) {
        setTab('analytics');
        setActiveSection(mapped);
      } else if ((PROJECT_NAV as readonly string[]).includes(candidate)) {
        setTab(candidate as Tab);
      } else {
        setTab('analytics');
        setActiveSection('overview');
      }
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
    setShowWriteKey(false);
    setVerification(null);
    setVerificationNotice('');
    setSetupChecking(false);
    setSetupCheckAt(null);
    setSetupNotice('');
    setProperties([]);
    setEvents([]);
    setPropertyKey('');
    setPropertyValue('');
    setFunnelSteps([]);
    setFunnel(null);
    setFunnelError('');
    setSummaryError('');
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
        handleUnauthorized(setError);
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load domain verification status.');
    }
  }, [selected, handleUnauthorized]);

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
          ? 'Domain verified via the DNS TXT record.'
          : 'No matching DNS TXT record found yet. DNS changes can take a few minutes to propagate.',
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
    const rotating = Boolean(project.has_write_key || writeKey);
    if (rotating && !window.confirm('Rotate this project write key? The current key will stop working immediately. Update every deployed site and environment variable with the replacement.')) return;
    setError('');
    setKeyNotice('');
    try {
      const result = await api<{ write_key: string }>(
        `/api/projects/${encodeURIComponent(project.id)}/write-key`,
        { method: 'POST' },
      );
      saveWriteKey(project.id, result.write_key);
      setWriteKey(result.write_key);
      setShowWriteKey(true);
      setProjects((list) =>
        list.map((item) => (item.id === project.id ? { ...item, has_write_key: true } : item)),
      );
      setKeyNotice(rotating
        ? 'Write key rotated. The previous key stopped working immediately; update every deployed site and environment variable.'
        : 'Write key generated. This key is public browser configuration and appears in your installation snippet.');
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
      setProjects((list) => [...list, created]);
      setSelected(created.id);
      setName('');
      setDomain('');
      saveWriteKey(created.id, created.write_key ?? '');
      setWriteKey(created.write_key ?? '');
      setKeyNotice(created.write_key ? 'Write key created. Copy the installation code now; it is also stored in this browser.' : '');
      setOnboarding(true);
      router.push(`/dashboard/projects/${encodeURIComponent(created.id)}?onboarding=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the project.');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await signOut({ redirectUrl: '/sign-in' });
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
    if (!project) return;
    setDeleteTarget(project);
  }

  async function confirmDeleteProject() {
    const target = deleteTarget;
    if (!target) return;
    setError('');
    setSettingsMessage('');
    setSettingsBusy(true);
    setDeletingProjectId(target.id);
    try {
      await api(`/api/projects/${encodeURIComponent(target.id)}`, { method: 'DELETE' });
      setProjects((list) => list.filter((item) => item.id !== target.id));
      setDeleteTarget(null);
      if (selected === target.id) {
        setSelected('');
        setShowProjects(true);
        router.push('/dashboard?view=projects');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the project.');
    } finally {
      setSettingsBusy(false);
      setDeletingProjectId('');
    }
  }

  async function deleteProjectFromList(item: Project) {
    setDeleteTarget(item);
  }

  const collectorOrigin = process.env.NEXT_PUBLIC_ZAPPA_ORIGIN || 'https://www.zappa.in';
  const collector = process.env.NEXT_PUBLIC_ZAPPA_GEO_ENDPOINT || 'https://zappa-geo-ingest.amansagar0307.workers.dev/api/events';
  const snippet = `<script src="${collectorOrigin}/Zappa.js" defer></script>
<script>
  // Dispatch Zappa:consent after any required consent has been granted.
  window.addEventListener('Zappa:consent', function () {
    Zappa.init({ projectId: '${project?.id || ''}', writeKey: '${writeKey}', endpoint: '${collector}' });
  }, { once: true });
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
    if (next === 'analytics') setActiveSection('overview');
    window.history.replaceState(null, '', `#${next}`);
  }

  function changePreset(next: Preset) {
    setPreset(next);
    if (next !== 'custom') {
      const value = dateRange(next);
      setDraftRange(value);
      setReportRange(value);
    }
  }

  function selectAnalyticsSection(section: AnalyticsSection) {
    setTab('analytics');
    setActiveSection(section);
    window.history.replaceState(null, '', `#${section}`);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      const main = document.getElementById('main');
      if (main) window.scrollTo({ top: main.getBoundingClientRect().top + window.scrollY, behavior });
    }));
  }

  const series = summary?.series ?? [];
  const hasEvents = (summary?.metrics.events ?? 0) > 0;
  const rangeLabel = reportRange ? `${reportRange.start} ? ${reportRange.end} UTC` : 'Last 30 days';
  const isLive = Boolean(project?.last_event_at) && Date.now() - new Date(project?.last_event_at ?? 0).getTime() < 7 * 864e5;

  if (onboarding && project) {
    return <ProjectOnboarding
      name={project.name}
      domain={project.domain}
      projectId={project.id}
      writeKey={writeKey}
      origin={collectorOrigin}
      endpoint={collector}
      verified={project.verified === true}
      verification={verification}
      checking={verificationBusy}
      notice={verificationNotice || error}
      eventReceived={Boolean(project.last_event_at)}
      eventChecking={setupChecking}
      eventNotice={setupNotice}
      onVerify={() => void checkVerification()}
      onCheckEvents={() => void pollSetup()}
      onFinish={() => { setOnboarding(false); window.history.replaceState(null, '', `/dashboard/projects/${encodeURIComponent(project.id)}`); }}
    />;
  }

  return (
    <TooltipProvider>
    <div className={`${s.dashboard} ${project || isDesignLab ? s.analyticsDashboard : ''}`}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>

      {!isDesignLab && (
      <header className={`${s.header} ${project ? s.analyticsHeader : ''}`}>
        <div className={s.headerInner}>
          <div className={s.headerIdentity}>
            <Link className={s.brand} href="/" aria-label="Zappa home"><ZappaWordmark /></Link>
          </div>
          <div className={s.account}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={s.headerAvatarButton} type="button" aria-label={`Open account menu for ${user?.login ?? 'Account'}`}>
                  <span className={s.avatar} aria-hidden="true">{user?.login.slice(0, 1).toUpperCase() ?? 'A'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className={s.profileMenu}>
                <DropdownMenuLabel className={s.profileMenuIdentity}>
                  <span className={s.avatar} aria-hidden="true">{user?.login.slice(0, 1).toUpperCase() ?? 'A'}</span>
                  <span><strong>{user?.login ?? 'Account'}</strong><small>Zappa workspace</small></span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/account"><UserRound aria-hidden="true" />My account</Link></DropdownMenuItem>
                {project && <DropdownMenuItem onSelect={() => selectTab('settings')}><SlidersHorizontal aria-hidden="true" />Project settings</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
                  {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                  Use {resolvedTheme === 'dark' ? 'light' : 'dark'} appearance
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={logout}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      )}

      {!isDesignLab && (
        <div className={s.utilityNavWrap}>
          <div className={s.utilityNav}>
            <Breadcrumb className={s.dashboardBreadcrumb}>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link href="/dashboard?view=projects" onClick={() => { setShowProjects(true); setSelected(''); }}>Projects</Link></BreadcrumbLink>
                </BreadcrumbItem>
                {project && <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem><BreadcrumbPage>{project.name}</BreadcrumbPage></BreadcrumbItem>
                  {project.verified && <Badge variant="secondary" className={s.projectStatusBadge}>Verified</Badge>}
                </>}
              </BreadcrumbList>
            </Breadcrumb>
            <ButtonGroup className={s.utilityActions}>
              <Button variant="ghost" size="sm" asChild className={s.utilityAction}><Link href="/docs"><ExternalLink aria-hidden="true" />Docs</Link></Button>
              {user && <Button variant="outline" size="sm" asChild className={`${s.utilityAction} ${s.utilityActionPrimary}`}><Link href="/dashboard?view=projects#add-website" onClick={() => { setShowProjects(true); setSelected(''); }}>+ Website</Link></Button>}
            </ButtonGroup>
          </div>
        </div>
      )}

      {project && !isDesignLab && (
        <div className={s.projectTopNavWrap}>
          <div className={s.projectTopNav}>
            <Combobox
              value={selected}
              onValueChange={(value) => { if (typeof value === 'string') router.push(`/dashboard/projects/${encodeURIComponent(value)}`); }}
              items={projects.map((item) => item.id)}
              itemToStringValue={(value) => projects.find((item) => item.id === value)?.name ?? ''}
            >
              <ComboboxInput className={s.projectCombobox} placeholder={project.name} aria-label="Switch website" />
              <ComboboxContent>
                <ComboboxList>
                  {projects.map((item) => <ComboboxItem key={item.id} value={item.id}>{item.name}<span className={s.projectComboDomain}>{item.domain}</span></ComboboxItem>)}
                </ComboboxList>
                <ComboboxEmpty>No websites found.</ComboboxEmpty>
              </ComboboxContent>
            </Combobox>
            <nav className={s.projectTopNavLinks} aria-label="Project analytics">
              {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={tab === 'analytics' && activeSection === item.id ? 'page' : undefined}
                  onClick={(event) => { event.preventDefault(); selectAnalyticsSection(item.id); }}
                >
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>
            <nav className={s.projectTopNavTools} aria-label="Project tools">
              {PROJECT_NAV.map((section) => {
                const Icon = PROJECT_ICONS[section];
                const label = section[0].toUpperCase() + section.slice(1);
                return (
                  <a
                    key={section}
                    href={`#${section}`}
                    aria-current={tab === section ? 'page' : undefined}
                    onClick={(event) => { event.preventDefault(); selectTab(section); }}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <main className={isDesignLab ? `${s.main} ${s.designLabMain}` : s.main} id="main">
        {isDesignLab ? (
          <DesignLabView
            project={project ?? null}
            projects={projects}
            selectedProjectId={selected}
            summary={summary}
            report={overviewReport.report}
            loading={busy || summaryBusy || overviewReport.loading}
            error={error || summaryError || overviewReport.error}
          />
        ) : busy ? (
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
              If nothing happens, <Link href="/sign-in">open the sign-in page</Link>.
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

            {project ? (
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
                      <span className={s.metaChip} data-tone={project.verified ? 'ok' : 'warn'}>
                        <span className={s.statusDot} aria-hidden="true" />
                        {project.verified ? 'Domain verified' : 'Domain unverified'}
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

                <div className={s.tabPanel} key={`${tab}-${tab === 'analytics' ? activeSection : ''}`}>
                  {tab === 'analytics' && (
                    <>
                      <ReportToolbar
                        preset={preset}
                        range={reportRange}
                        draft={draftRange}
                        model={model}
                        conversionEvent={conversionEvent}
                        onPresetChange={changePreset}
                        onDraftChange={setDraftRange}
                        onApplyRange={() => setReportRange(draftRange)}
                        onModelChange={setModel}
                        onConversionEventChange={setConversionEvent}
                        onRefresh={refreshAnalytics}
                        onLiveActivity={() => selectAnalyticsSection('live')}
                        refreshing={summaryBusy}
                        updatedLabel={`Last event ${relativeWhen(project.last_event_at)}`}
                      />

                      {project.verified === false && (
                        <div className={s.statePanel} data-tone="warn" role="status">
                          <AlertIcon className={s.icon} />
                          <div className={s.statePanelBody}>
                            <strong>Domain not verified</strong>
                            <p>
                              Zappa rejects events until {project.domain} proves ownership. Finish verification to
                              start collecting.
                            </p>
                          </div>
                          <button
                            className={`${s.btn} ${s.btnSecondary}`}
                            type="button"
                            onClick={() => selectTab('installation')}
                          >
                            Finish setup
                          </button>
                        </div>
                      )}

                      {summaryError && (
                        <div className={s.statePanel} data-tone="error" role="alert">
                          <AlertIcon className={s.icon} />
                          <div className={s.statePanelBody}>
                            <strong>Analytics could not load</strong>
                            <p>{summaryError}</p>
                          </div>
                          <button
                            className={`${s.btn} ${s.btnSecondary}`}
                            type="button"
                            onClick={() => void loadSummary()}
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {!summaryError && !summaryBusy && summary && !hasEvents && activeSection !== 'journeys' && activeSection !== 'revenue' && activeSection !== 'customers' && (
                        <div className={s.statePanel} data-tone="empty" role="status">
                          <ZapIcon className={s.icon} />
                          <div className={s.statePanelBody}>
                            <strong>{activeFilter ? 'No events match this filter' : 'No events yet'}</strong>
                            <p>
                              {activeFilter
                                ? 'Clear the property filter or choose another value.'
                                : 'Install the tracker, verify your domain, and open your site to send the first event.'}
                            </p>
                          </div>
                          <button
                            className={`${s.btn} ${s.btnSecondary}`}
                            type="button"
                            onClick={() => (activeFilter ? clearPropertyFilter() : selectTab('installation'))}
                          >
                            {activeFilter ? 'Clear filter' : 'Open installation'}
                          </button>
                        </div>
                      )}

                      {activeSection === 'overview' && (
                        <>
                          <OverviewV1
                            key={selected}
                            report={overviewReport.report}
                            loading={overviewReport.loading}
                            error={overviewReport.error}
                            onRetry={overviewReport.retry}
                            model={model}
                            conversionEvent={conversionEvent}
                            filtered={Boolean(activeFilter)}
                            audience={(
                              <div className={`${s.breakdownGrid} ${s.overviewAudience}`} aria-label="Audience breakdowns">
                                <CountryDemographicCard rows={summary?.country_visitors ?? summary?.countries ?? []} loading={summaryBusy} projectId={selected} range={reportRange} />
                                <BreakdownCard
                                  id="devices"
                                  title="Devices"
                                  icon={<MonitorIcon />}
                                  rows={summary?.devices ?? []}
                                  browserRows={summary?.browsers ?? []}
                                  operatingSystemRows={summary?.operating_systems ?? []}
                                  total={summary?.metrics.pageviews ?? 0}
                                  empty="No device data yet."
                                  deviceFacets
                                />
                              </div>
                            )}
                            onNavigate={selectAnalyticsSection}
                          />
                        </>
                      )}

                      {activeSection === 'acquisition' && (
                        <>
                          <AcquisitionSection
                            projectId={selected}
                            range={reportRange}
                            model={model}
                            conversionEvent={conversionEvent}
                            refresh={acquisitionRefresh}
                            report={overviewReport.report}
                            loading={overviewReport.loading}
                            error={overviewReport.error}
                            onRetry={overviewReport.retry}
                            query={acquisitionQuery}
                            onQueryChange={setAcquisitionQuery}
                          />
                          <BreakdownCard
                            id="referrers"
                            title="Referrers"
                            icon={<LinkIcon />}
                            rows={summary?.referrers ?? []}
                            total={summary?.metrics.pageviews ?? 0}
                            empty="No referrer data yet."
                          />
                        </>
                      )}

                      {activeSection === 'campaigns' && (
                        <CampaignsSection
                          range={reportRange}
                          report={overviewReport.report}
                          loading={overviewReport.loading}
                          error={overviewReport.error}
                          onRetry={overviewReport.retry}
                          onInspect={(campaign) => {
                            setAcquisitionQuery(campaign);
                            selectAnalyticsSection('acquisition');
                          }}
                        />
                      )}

                      {activeSection === 'journeys' && (
                        <UnavailableSection variant="journeys" onNavigate={selectAnalyticsSection} />
                      )}

                      {activeSection === 'pages' && (
                        <PagesSection
                          range={reportRange}
                          report={overviewReport.report}
                          loading={overviewReport.loading}
                          error={overviewReport.error}
                          onRetry={overviewReport.retry}
                          pageRows={summary?.pages ?? []}
                          series={series}
                          metrics={summary?.metrics ?? { events: 0, pageviews: 0, visitors: 0, sessions: 0 }}
                          hasEvents={hasEvents}
                        />
                      )}

                      {activeSection === 'live' && <LiveActivity projectId={selected} range={reportRange} />}

                      {activeSection === 'revenue' && (
                        <UnavailableSection variant="revenue" onNavigate={selectAnalyticsSection} />
                      )}

                      {activeSection === 'customers' && (
                        <UnavailableSection variant="customers" onNavigate={selectAnalyticsSection} />
                      )}

                      {activeSection === 'goals' && selected && (
                        <GoalsSection projectId={selected} range={reportRange} />
                      )}

                      {activeSection === 'funnels' && (
                        <section className={s.funnelSection} id="funnel">
                          <div className={s.sectionHead}>
                            <div>
                              <h2>Funnel</h2>
                              <p>Ordered session steps · {rangeLabel}.</p>
                            </div>
                            <span className={s.updated}>
                              {funnel?.steps[0]?.count
                                ? `${Math.round(((funnel.steps[funnel.steps.length - 1]?.count ?? 0) / funnel.steps[0].count) * 100)}% complete`
                                : `${funnelSteps.length || 2} steps`}
                            </span>
                          </div>
                          <p className={s.funnelLimit}>
                            Choose 2–5 observed events. A session advances when each event occurs in order; each session counts once per step. Saved funnels and property filters are not available yet.
                          </p>
                          <div className={s.funnelControls}>
                            {funnelSteps.map((step, index) => (
                              <div className={s.funnelControl} key={`funnel-step-${index}`}>
                                {index > 0 && <span className={s.funnelArrow} aria-hidden="true">→</span>}
                                <label className={s.filterField}>
                                  <span className={s.srOnly}>Funnel step {index + 1}</span>
                                  <select
                                    value={step}
                                    onChange={(event) => setFunnelSteps((current) => selectFunnelStep(current, index, event.target.value))}
                                    disabled={!eventNames.length}
                                  >
                                    {eventNames.length ? eventNames
                                      .filter((item) => item.label === step || !funnelSteps.some((selectedName, selectedIndex) => selectedIndex !== index && selectedName === item.label))
                                      .map((item) => (
                                      <option key={item.label} value={item.label}>{item.label}</option>
                                    )) : <option value="">No events yet</option>}
                                  </select>
                                  <ChevronIcon />
                                </label>
                                {index > 1 && (
                                  <button
                                    className={s.filterClear}
                                    type="button"
                                    aria-label={`Remove funnel step ${index + 1}`}
                                    onClick={() => setFunnelSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              className={s.filterClear}
                              type="button"
                              disabled={funnelSteps.length >= 5 || new Set(eventNames.map((item) => item.label)).size < 2 || !eventNames.some((item) => !funnelSteps.includes(item.label))}
                              onClick={() => setFunnelSteps((current) => appendFunnelStep(current, eventNames.map((item) => item.label)))}
                            >
                              Add step
                            </button>
                          </div>
                          {funnelError && (
                            <div className={s.statePanel} data-tone="warn" role="status">
                              <AlertIcon className={s.icon} />
                              <div className={s.statePanelBody}>
                                <strong>Funnel unavailable</strong>
                                <p>{funnelError}</p>
                              </div>
                            </div>
                          )}
                          {funnelBusy ? (
                            <div className={s.funnelSteps} aria-busy="true" role="status">
                              <span className={s.skeleton} style={{ height: 52 }} />
                            </div>
                          ) : funnel && funnel.steps[0]?.count > 0 ? (
                            <div className={s.funnelSteps} aria-label="Funnel session counts">
                              {funnel.steps.map((step, index) => {
                                const firstCount = funnel.steps[0].count;
                                const previousCount = index > 0 ? funnel.steps[index - 1].count : null;
                                const completion = previousCount ? Math.round((step.count / previousCount) * 100) : 100;
                                const width = Math.round((step.count / firstCount) * 100);
                                return (
                                  <div className={s.funnelStep} key={`${step.event_name}-${index}`}>
                                    <span className={s.funnelStepLabel}>Step {index + 1} · {step.event_name}</span>
                                    <strong>{compact(step.count)}</strong>
                                    <span className={s.funnelStepConversion}>
                                      {index === 0 ? 'Starting sessions' : `${completion}% from previous step`}
                                    </span>
                                    <span className={s.funnelBar}>
                                      <i style={{ width: `${width}%` }} />
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className={s.emptyBlock}>
                              <strong>{eventNames.length ? 'No sessions reached the first step' : 'No events to build a funnel'}</strong>
                              <span>
                                {eventNames.length
                                  ? 'Try another event sequence or a longer date range.'
                                  : 'Install the tracker and send named events first.'}
                              </span>
                            </div>
                          )}
                        </section>
                      )}

                      {activeSection === 'events' && (
                        <>
                      <div className={s.filterBar} role="group" aria-label="Custom property filter">
                        <span className={s.filterLabel}>Filter events</span>
                        <label className={s.filterField}>
                          <span className={s.srOnly}>Property key</span>
                          <select value={propertyKey} onChange={(event) => chooseProperty(event.target.value)}>
                            <option value="">Any property</option>
                            {properties.map((item) => (
                              <option key={item.name} value={item.name}>
                                {item.name} · {item.value_type}
                              </option>
                            ))}
                          </select>
                          <ChevronIcon />
                        </label>
                        <label className={s.filterField}>
                          <span className={s.srOnly}>Property value</span>
                          <select
                            value={propertyValue}
                            onChange={(event) => setPropertyValue(event.target.value)}
                            disabled={!propertyKey}
                          >
                            {!propertyKey && <option value="">Choose a property first</option>}
                            {activeProperty?.values.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.value} ({item.count})
                              </option>
                            ))}
                          </select>
                          <ChevronIcon />
                        </label>
                        {activeFilter && (
                          <button className={s.filterClear} type="button" onClick={clearPropertyFilter}>
                            Clear filter
                          </button>
                        )}
                        <span className={s.filterHint}>
                          {properties.length
                            ? activeFilter
                              ? `Filters this list, top pages and audience breakdowns by ${activeFilter.property} = ${activeFilter.value}.`
                              : 'Filter this list, top pages and audience breakdowns by an observed property.'
                            : 'Property filters appear after events with properties arrive.'}
                        </span>
                      </div>

                      <section className={s.eventsSection} id="events">
                        <div className={s.sectionHead}>
                          <div>
                            <h2>Recent events</h2>
                            <p>
                              {activeFilter
                                ? `Filtered by ${activeFilter.property} = ${activeFilter.value}`
                                : `Newest first · last ${days} days`}
                            </p>
                          </div>
                          <span className={s.updated}>{events.length} shown</span>
                        </div>
                        {eventsBusy ? (
                          <div className={s.eventList} aria-busy="true">
                            {[0, 1, 2].map((item) => (
                              <span className={s.skeletonRow} key={item}>
                                <span className={s.skeleton} />
                                <span className={s.skeleton} />
                              </span>
                            ))}
                          </div>
                        ) : events.length ? (
                          <ul className={s.eventList}>
                            {events.map((event) => (
                              <li className={s.eventRow} key={event.id}>
                                <span className={s.eventName}>{event.name}</span>
                                <span className={s.eventPath} title={event.path}>{displayPagePath(event.path)}</span>
                                <span className={s.eventProps}>
                                  {Object.entries(event.properties).map(([key, value]) => (
                                    <span className={s.eventProp} key={key}>
                                      {key}={String(value)}
                                    </span>
                                  ))}
                                </span>
                                <span className={s.eventWhen}>{relativeWhen(event.occurred_at)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className={s.emptyBlock}>
                            <ZapIcon className={s.icon} />
                            <strong>{activeFilter ? 'No events match this filter' : 'No events yet'}</strong>
                            <span>
                              {activeFilter
                                ? 'Try another property value or clear the filter.'
                                : 'Install the tracker to see the newest events here.'}
                            </span>
                          </div>
                        )}
                      </section>
                        </>
                      )}
                    </>
                  )}

                  {tab === 'installation' && (
                    <div className={s.installGrid}>
                      <section className={s.installCopy}>
                        <p className={s.eyebrow}>GET CONNECTED / 01</p>
                        <h2>Bring your site into focus.</h2>
                        <button className={`${s.btn} ${s.btnQuiet}`} type="button" onClick={() => { setOnboarding(true); window.history.replaceState(null, '', `/dashboard/projects/${encodeURIComponent(project.id)}?onboarding=1`); }}>Open setup guide</button>
                        <p>
                          Add this snippet to your site after obtaining any required visitor consent. The collector URL
                          must be publicly reachable by your visitors.
                        </p>
                        {!writeKey ? (
                          <div className={s.keyNotice} role="status">
                            <strong>{project.has_write_key ? 'Key is stored in another browser' : 'Generate a write key'}</strong>
                            <p>
                              {project.has_write_key
                                ? 'Reveal a key here by rotating it. The current key will stop working immediately, so update all installed copies.'
                                : 'Zappa rejects events without a valid per-project write key. Generate one before copying the installation code.'}
                            </p>
                            <button className={`${s.btn} ${s.btnSecondary}`} type="button" onClick={generateWriteKey}>
                              {project.has_write_key ? 'Rotate & reveal key' : 'Generate write key'}
                            </button>
                          </div>
                        ) : (
                          <div className={s.keyStatus}>
                            <p>Write key ready. This is public browser configuration embedded in your site.</p>
                            <code>{showWriteKey ? writeKey : `${writeKey.slice(0, 9)}${'•'.repeat(18)}`}</code>{' '}
                            <button className={s.keyRotate} type="button" onClick={() => setShowWriteKey((value) => !value)}>
                              {showWriteKey ? 'Hide key' : 'Reveal key'}
                            </button>{' '}
                            <button className={s.keyRotate} type="button" onClick={generateWriteKey}>Rotate key</button>
                          </div>
                        )}
                        {keyNotice && (
                          <p className={s.keyStatus} role="status">
                            {keyNotice}
                          </p>
                        )}
                        <div className={s.setupCheck} data-ready={project.last_event_at ? 'true' : 'false'} role="status" aria-live="polite">
                          <span className={s.setupDot} aria-hidden="true" />
                          <div className={s.setupCheckBody}>
                            <strong>{project.last_event_at ? 'Events received' : 'Waiting for the first event'}</strong>
                            <p>
                              {project.last_event_at
                                ? `Events are arriving. Last event ${relativeWhen(project.last_event_at)}.`
                                : 'Keep this tab open. Zappa checks for events every 10 seconds.'}
                            </p>
                            {setupCheckAt && <small>Last checked {relativeWhen(setupCheckAt)}</small>}
                            {!project.last_event_at && setupNotice && <small>{setupNotice}</small>}
                          </div>
                          <button className={`${s.btn} ${s.btnQuiet}`} type="button" onClick={() => void pollSetup()} disabled={setupChecking}>
                            {setupChecking ? 'Checking…' : 'Check now'}
                          </button>
                        </div>
                        <div className={s.stepList}>
                          {[
                            ['Paste the snippet', 'Place it in your document head so every page loads the tracker.'],
                            ['Set your endpoint', 'Point the tracker at your own collector or the hosted endpoint.'],
                            ['Watch data arrive', project.last_event_at ? 'Events are arriving for this project.' : 'Open the analytics tab — events appear within seconds.'],
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
                              ? 'Zappa accepts events for this domain. Keep your verification record in place.'
                              : 'Zappa rejects events until the domain proves ownership. Add the TXT record at your DNS provider, then check again.'}
                          </p>
                          {!verification?.verified && verification && (
                            <div className={s.verifyRows}>
                              <div className={s.verifyRow}>
                                <span>TXT name: _Zappa-verification.{project.domain}</span>
                                <code>{verification.record}</code>
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
                          <CodeBlock className={`${s.code} ${s.installCodeBlock}`}>
                            <CodeBlockHeader className={s.installCodeHeader}>
                              <CodeBlockTitle>INSTALLATION CODE</CodeBlockTitle>
                              <CodeBlockActions>
                                <CodeBlockCopyButton value={snippet} disabled={!writeKey} />
                              </CodeBlockActions>
                            </CodeBlockHeader>
                            <CodeBlockContent>{snippet}</CodeBlockContent>
                          </CodeBlock>
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
                          <div className={s.detailRow}>
                            <dt>Session definition</dt>
                            <dd>30 min inactivity or UTC day boundary</dd>
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
                        <ContextMenu key={item.id}>
                        <ContextMenuTrigger asChild>
                        <div className={s.projectCardShell}>
                        <Link className={s.projectCard} href={`/dashboard/projects/${encodeURIComponent(item.id)}`}>
                          <span className={s.projectCardTop}>
                            <span className={s.projectCardMark} aria-hidden="true">
                              {item.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className={s.projectCardName}>
                              <strong>{item.name}</strong>
                              <span className={s.projectDomain}><span>{item.domain}</span>{item.verified === true && <VerifiedBadge />}</span>
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
                            <span
                              className={`${s.statusLine} ${live ? s.isLive : ''}`}
                              data-warn={item.verified === false ? 'true' : undefined}
                            >
                              <i aria-hidden="true" />
                              {item.verified === false ? 'Verification required' : live ? 'Receiving events' : 'No recent events'}
                            </span>
                            <span>{item.retention_days}d retention</span>
                          </span>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={s.projectCardMenuTrigger}
                              type="button"
                              aria-label={`More options for ${item.name}`}
                              title={`More options for ${item.name}`}
                              disabled={Boolean(deletingProjectId)}
                            >
                              <MoreHorizontalIcon className={s.projectCardMenuIcon} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={6} className={s.projectCardMenu}>
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={Boolean(deletingProjectId)}
                              onSelect={() => void deleteProjectFromList(item)}
                            >
                              <TrashIcon className={s.projectCardMenuIcon} />
                              Delete project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem asChild><Link href={`/dashboard/projects/${encodeURIComponent(item.id)}`}>Open dashboard</Link></ContextMenuItem>
                          <ContextMenuItem asChild><Link href={`/dashboard/projects/${encodeURIComponent(item.id)}#settings`}>Project settings</Link></ContextMenuItem>
                          <ContextMenuItem asChild><Link href={`/dashboard/projects/${encodeURIComponent(item.id)}#events`}>Recent activity</Link></ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem variant="destructive" onSelect={() => void deleteProjectFromList(item)}><TrashIcon />Delete project</ContextMenuItem>
                        </ContextMenuContent>
                        </ContextMenu>
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
                  <form className={s.createForm} id="add-website" onSubmit={createProject}>
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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingProjectId) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>This permanently removes project and its analytics data. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {error && <p className={s.dialogError} role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingProjectId)}>Cancel</Button>
            <Button variant="destructive" type="button" onClick={() => void confirmDeleteProject()} disabled={Boolean(deletingProjectId)}>
              {deletingProjectId ? 'Deleting…' : 'Delete project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isDesignLab && (
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span>ZAPPA / YOUR WORK, UNDERSTOOD</span>
          <div className={s.footerLinks}>
            <Link href="/docs">DOCS</Link>
            <a href="https://github.com/AmanSagar0607/Zappa">OPEN SOURCE</a>
          </div>
        </div>
      </footer>
      )}
      {project && !isDesignLab && (
        <DashboardDock
          tab={tab}
          activeSection={activeSection}
          onSelectAnalytics={selectAnalyticsSection}
          onSelectTab={selectTab}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
