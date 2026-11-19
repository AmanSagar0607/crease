// Shared reporting types, date presets and formatting for dashboard sections.
// All reporting dates are UTC calendar days, matching the backend contract.

export type AttributionModel = 'first_touch' | 'last_touch' | 'last_non_direct';

export type Range = { start: string; end: string };

export type Preset = 'today' | 'yesterday' | '7' | '30' | '90' | 'custom';

export const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  custom: 'Custom range',
};

export function dateOffset(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateRange(preset: Exclude<Preset, 'custom'>): Range {
  const offset = preset === 'yesterday' ? -1 : 0;
  const end = dateOffset(offset);
  const count = preset === 'today' || preset === 'yesterday' ? 1 : Number(preset);
  return { start: dateOffset(offset - count + 1), end };
}

export function rangeDays(range: Range) {
  return Math.round((Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86400000) + 1;
}

export function shiftRange(range: Range, days: number) {
  return { start: dateOffsetShift(range.start, days), end: dateOffsetShift(range.end, days) };
}

function dateOffsetShift(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function invalidCustomRange(range: Range) {
  return !range.start || !range.end || range.start > range.end || range.end > dateOffset(0) || rangeDays(range) > 90;
}

export function display(value: number | null | undefined, rate = false) {
  if (value == null) return '—';
  return rate ? `${(value * 100).toFixed(1)}%` : value.toLocaleString();
}

export function compareLabel(value: number | null, previous: number | null) {
  if (value == null || previous == null) return 'Not configured';
  if (previous === 0) return value === 0 ? 'No change' : 'New activity';
  const delta = ((value - previous) / previous) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs previous period`;
}

export function eventLabel(name: string) {
  if (name === 'pageview') return 'Page view';
  if (name === 'signup' || name === 'sign_up') return 'Sign up';
  if (name === 'conversion') return 'Conversion event';
  return name;
}

export function formatUtcStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type Metrics = {
  visitors: number;
  sessions: number;
  pageviews: number;
  new_visitors: number;
  returning_visitors: number;
  conversions: number | null;
  conversion_rate: number | null;
};

export type AcquisitionRow = {
  source: string;
  medium: string | null;
  campaign: string | null;
  visitors: number;
  sessions: number;
  conversions: number | null;
  conversion_rate: number | null;
};

export type CampaignRow = {
  campaign: string;
  source: string | null;
  visitors: number;
  conversions: number | null;
  conversion_rate: number | null;
};

export type LandingRow = {
  path: string;
  visitors: number;
  sessions: number;
  conversions: number | null;
  conversion_rate: number | null;
};

export type RecentRow = { name: string; path: string; occurred_at: string };

export type SeriesPoint = {
  date: string;
  visitors: number;
  sessions: number;
  previous_visitors: number;
  previous_sessions: number;
};

export type Report = {
  start: string;
  end: string;
  timezone: string;
  model: AttributionModel;
  metrics: Metrics;
  previous: Metrics;
  series: SeriesPoint[];
  acquisition: AcquisitionRow[];
  campaigns: CampaignRow[];
  landing_pages: LandingRow[];
  recent_activity: RecentRow[];
  revenue_available: boolean;
};

export const EMPTY_METRICS: Metrics = {
  visitors: 0,
  sessions: 0,
  pageviews: 0,
  new_visitors: 0,
  returning_visitors: 0,
  conversions: null,
  conversion_rate: null,
};
