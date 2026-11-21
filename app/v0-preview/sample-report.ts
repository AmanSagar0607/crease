import { dateOffset, type Report } from '../dashboard/reporting';

/** Illustrative preview values only. Never use this report in the authenticated product. */
export function createSampleReport(): Report {
  const visitors = [142, 155, 171, 181, 185, 205, 245];
  const sessions = [198, 211, 222, 239, 243, 292, 337];

  return {
    start: dateOffset(-7),
    end: dateOffset(-1),
    timezone: 'UTC',
    model: 'last_non_direct',
    metrics: {
      visitors: 1284,
      sessions: 1742,
      pageviews: 3906,
      new_visitors: 920,
      returning_visitors: 364,
      conversions: 63,
      conversion_rate: 63 / 1284,
    },
    previous: {
      visitors: 1126,
      sessions: 1543,
      pageviews: 3584,
      new_visitors: 798,
      returning_visitors: 328,
      conversions: 51,
      conversion_rate: 51 / 1126,
    },
    series: visitors.map((value, index) => ({
      date: dateOffset(index - 7),
      visitors: value,
      sessions: sessions[index],
      previous_visitors: [126, 138, 144, 157, 165, 184, 212][index],
      previous_sessions: [182, 194, 202, 214, 218, 250, 283][index],
    })),
    acquisition: [
      { source: 'Direct', medium: null, campaign: null, visitors: 504, sessions: 622, conversions: 22, conversion_rate: 22 / 504 },
      { source: 'github.com', medium: 'referral', campaign: null, visitors: 283, sessions: 351, conversions: 18, conversion_rate: 18 / 283 },
      { source: 'news.ycombinator.com', medium: 'referral', campaign: null, visitors: 172, sessions: 229, conversions: 12, conversion_rate: 12 / 172 },
    ],
    campaigns: [
      { campaign: 'launch-note', source: 'newsletter', visitors: 118, conversions: 7, conversion_rate: 7 / 118 },
      { campaign: 'starter-guide', source: 'github.com', visitors: 84, conversions: 5, conversion_rate: 5 / 84 },
    ],
    landing_pages: [
      { path: '/', visitors: 638, sessions: 781, conversions: 31, conversion_rate: 31 / 638 },
      { path: '/pricing', visitors: 421, sessions: 512, conversions: 19, conversion_rate: 19 / 421 },
      { path: '/docs', visitors: 225, sessions: 389, conversions: 11, conversion_rate: 11 / 225 },
    ],
    recent_activity: [
      { name: 'pageview', path: '/', occurred_at: `${dateOffset(-1)}T16:45:00.000Z` },
      { name: 'signup', path: '/sign-up', occurred_at: `${dateOffset(-1)}T16:41:00.000Z` },
      { name: 'pageview', path: '/pricing', occurred_at: `${dateOffset(-1)}T16:36:00.000Z` },
    ],
    ai_traffic: {
      model: 'last_non_direct',
      crawler_key_configured: false,
      referrals: { metrics: { visitors: 0, sessions: 0, pageviews: 0, conversions: null, conversion_rate: null }, platforms: [], landing_pages: [] },
      crawlers: { metrics: { requests: 0, unique_crawlers: 0, pages: 0, latest_at: null }, platforms: [], top_pages: [], recent: [] },
      series: [],
    },
    revenue_available: false,
  };
}
