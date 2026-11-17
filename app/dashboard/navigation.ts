// Dashboard navigation model. Only sections that render real content are listed;
// sections without a backend API are marked unavailable and explain the gap.

export type AnalyticsSection =
  | 'overview'
  | 'acquisition'
  | 'campaigns'
  | 'funnels'
  | 'journeys'
  | 'pages'
  | 'events'
  | 'live'
  | 'revenue'
  | 'customers';

export type ProjectSection = 'installation' | 'integrations' | 'settings';

export type Tab = 'analytics' | ProjectSection;

export type NavItem = {
  id: AnalyticsSection;
  label: string;
  /** True when no backend API exists yet; the section renders an honest unavailable state. */
  unavailable?: boolean;
};

export const NAV_SECTIONS: NavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'funnels', label: 'Funnels' },
  { id: 'journeys', label: 'User journeys', unavailable: true },
  { id: 'pages', label: 'Pages' },
  { id: 'events', label: 'Events' },
  { id: 'live', label: 'Live activity' },
  { id: 'revenue', label: 'Revenue', unavailable: true },
  { id: 'customers', label: 'Customers', unavailable: true },
];

export const PROJECT_NAV: ProjectSection[] = ['installation', 'integrations', 'settings'];

export const ANALYTICS_SECTIONS = NAV_SECTIONS.map((item) => item.id);

/** Older bookmarks and in-page links from previous dashboard versions. */
export const LEGACY_HASHES: Record<string, AnalyticsSection> = {
  visitors: 'overview',
  referrers: 'acquisition',
  countries: 'overview',
};

export function isAnalyticsSection(value: string): value is AnalyticsSection {
  return (ANALYTICS_SECTIONS as readonly string[]).includes(value);
}
