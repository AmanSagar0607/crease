'use client';

import type { AnalyticsSection } from './navigation';
import s from './sections.module.css';

type Variant = 'journeys' | 'revenue' | 'customers';

type Content = {
  eyebrow: string;
  title: string;
  intro: string;
  missing: string[];
  actions: { label: string; section: AnalyticsSection }[];
  primary?: AnalyticsSection;
};

const CONTENT: Record<Variant, Content> = {
  journeys: {
    eyebrow: 'NOT AVAILABLE YET',
    title: 'User journeys',
    intro:
      'A journey explorer needs the backend to return each visitor’s ordered history — landing page, sessions, page views, custom events, signups and conversions. The current API only serves aggregated reports and a flat recent-events list, so there is no honest way to render per-visitor paths yet.',
    missing: [
      'An endpoint returning ordered, per-visitor event paths',
      'Session-to-session history across the retained window',
      'Journey-level conversion and revenue attribution',
    ],
    actions: [
      { label: 'Open recent events', section: 'events' },
      { label: 'Open live activity', section: 'live' },
    ],
    primary: 'events',
  },
  revenue: {
    eyebrow: 'NO VERIFIED REVENUE',
    title: 'Revenue reporting',
    intro:
      'Crease never infers revenue from browser events. No verified revenue records exist for this project, and the server-to-server revenue ingestion API is not built yet — so every revenue figure here would be invented. Nothing is shown instead of a fake total.',
    missing: [
      'A server-to-server ingestion endpoint for verified revenue records',
      'Manual revenue entry with source and verification status',
      'Refunds, currency separation and transaction identifiers',
      'Attribution of verified revenue to sources and campaigns',
    ],
    actions: [
      { label: 'Open overview', section: 'overview' },
      { label: 'Open acquisition', section: 'acquisition' },
    ],
    primary: 'overview',
  },
  customers: {
    eyebrow: 'NOT AVAILABLE YET',
    title: 'Customers',
    intro:
      'Customer intelligence requires customer records and privacy-aware identity association on the server. None of those endpoints exist today, so a customer list would have to be fabricated. Anonymous visitors are reported in aggregate only.',
    missing: [
      'Customer records with first seen, last seen and acquisition source',
      'Anonymous-to-known identity association with privacy controls',
      'Purchases and recorded revenue per customer',
      'Customer detail views with event and session history',
    ],
    actions: [
      { label: 'Open acquisition', section: 'acquisition' },
      { label: 'Open events', section: 'events' },
    ],
    primary: 'acquisition',
  },
};

/**
 * Honest placeholder for sections whose backend API does not exist yet.
 * Explains the gap and links to the closest working section.
 */
export default function UnavailableSection({
  variant,
  onNavigate,
}: {
  variant: Variant;
  onNavigate: (section: AnalyticsSection) => void;
}) {
  const content = CONTENT[variant];
  return (
    <section className={s.unavailable} aria-label={content.title}>
      <span className={s.eyebrow}>{content.eyebrow}</span>
      <h2>{content.title}</h2>
      <p>{content.intro}</p>
      <strong>What is missing before this page can be built:</strong>
      <ul>
        {content.missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className={s.actions}>
        {content.actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.section === content.primary ? s.primary : undefined}
            onClick={() => onNavigate(action.section)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
