// Dashboard navigation model. Only sections that render real content are listed;
// sections without a backend API are marked unavailable and explain the gap.

import {
  Activity,
  Code2,
  DollarSign,
  FileText,
  Filter,
  LayoutDashboard,
  Megaphone,
  Plug,
  Route,
  Settings,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

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
  icon: LucideIcon;
  /** True when no backend API exists yet; the section renders an honest unavailable state. */
  unavailable?: boolean;
};

export const NAV_SECTIONS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'acquisition', label: 'Acquisition', icon: TrendingUp },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'funnels', label: 'Funnels', icon: Filter },
  { id: 'journeys', label: 'User journeys', icon: Route, unavailable: true },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'events', label: 'Events', icon: Zap },
  { id: 'live', label: 'Live activity', icon: Activity },
  { id: 'revenue', label: 'Revenue', icon: DollarSign, unavailable: true },
  { id: 'customers', label: 'Customers', icon: Users, unavailable: true },
];

export const PROJECT_NAV: ProjectSection[] = ['installation', 'integrations', 'settings'];

export const PROJECT_ICONS: Record<ProjectSection, LucideIcon> = {
  installation: Code2,
  integrations: Plug,
  settings: Settings,
};

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
