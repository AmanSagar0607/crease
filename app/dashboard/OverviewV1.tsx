'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AnalyticsSection } from './navigation';
import { compareLabel, display, displayPagePath, eventLabel, type AttributionModel, type Metrics, type Report } from './reporting';
import s from './overview-v1.module.css';
import TrafficChart from './TrafficChart';

type Props = {
  projectId?: string;
  report: Report | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  model: AttributionModel;
  conversionEvent: string;
  filtered: boolean;
  audience?: ReactNode;
  previewMotion?: boolean;
  onNavigate: (section: AnalyticsSection) => void;
};

const PRIMARY_METRICS: { key: keyof Metrics; label: string; description: string; rate?: boolean }[] = [
  { key: 'visitors', label: 'Unique visitors', description: 'Distinct visitor IDs with events in this period.' },
  { key: 'sessions', label: 'Sessions', description: 'Server-assigned sessions starting in this period.' },
  { key: 'pageviews', label: 'Page views', description: 'Pageview events in this period.' },
  { key: 'conversion_rate', label: 'Conversion rate', description: 'Converted visitors divided by unique visitors.', rate: true },
];

const SECONDARY_METRICS: { key: keyof Metrics; label: string; description: string }[] = [
  { key: 'new_visitors', label: 'New visitors', description: 'First observed in retained project history during this period.' },
  { key: 'returning_visitors', label: 'Returning visitors', description: 'Observed before this period in retained project history.' },
  { key: 'conversions', label: 'Converted visitors', description: 'Distinct visitors who triggered the selected conversion event.' },
];

function formatMetric(value: number | null, rate = false) {
  if (value == null) return '—';
  return rate ? `${(value * 100).toFixed(1)}%` : Math.round(value).toLocaleString();
}

function AnimatedMetric({ value, rate = false, active, delay = 0 }: {
  value: number | null;
  rate?: boolean;
  active: boolean;
  delay?: number;
}) {
  const counterRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);
  const completeRef = useRef(false);

  useEffect(() => {
    if (!active || !counterRef.current) return;
    const element = counterRef.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (!active || !visible || completeRef.current) return;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let timeout = 0;
    const finish = () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
      completeRef.current = true;
      setStarted(true);
      setProgress(value ?? 0);
    };

    if (motionPreference.matches || value == null) {
      finish();
      return;
    }

    const onMotionPreferenceChange = () => {
      if (motionPreference.matches) finish();
    };
    motionPreference.addEventListener('change', onMotionPreferenceChange);
    timeout = window.setTimeout(() => {
      const startedAt = performance.now();
      const duration = 1050;
      setStarted(true);
      const tick = (now: number) => {
        if (motionPreference.matches) {
          finish();
          return;
        }
        const linear = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - linear, 4);
        setProgress(value * eased);
        if (linear < 1) frame = requestAnimationFrame(tick);
        else {
          finish();
        }
      };
      frame = requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
      motionPreference.removeEventListener('change', onMotionPreferenceChange);
    };
  }, [active, delay, value, visible]);

  const current = active && !started ? 0 : started ? progress : (value ?? 0);
  return <span ref={counterRef} aria-label={formatMetric(value, rate)}>{formatMetric(value == null ? null : current, rate)}</span>;
}

export default function OverviewV1({ projectId, report, loading, error, onRetry, model, conversionEvent, audience, previewMotion = false, onNavigate }: Props) {
  const [aiTab, setAiTab] = useState<'referrals' | 'crawlers'>('referrals');
  const [newCrawlerKey, setNewCrawlerKey] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState('');
  async function rotateCrawlerKey() {
    setKeyBusy(true); setKeyError(''); setNewCrawlerKey('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId ?? '')}/ai-crawler-key`, { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Key generation failed (${response.status}).`);
      const payload = await response.json() as { crawler_key?: string };
      if (!payload.crawler_key) throw new Error('The server did not return a crawler key.');
      setNewCrawlerKey(payload.crawler_key);
    } catch (reason) { setKeyError(reason instanceof Error ? reason.message : 'Could not generate a crawler key.'); }
    finally { setKeyBusy(false); }
  }
  const [sourceSearch, setSourceSearch] = useState('');
  const [overviewTab, setOverviewTab] = useState<'acquisition' | 'pages' | 'activity'>('acquisition');
  const [chartVisible, setChartVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const overviewRef = useRef<HTMLElement>(null);
  const chartRef = useRef<HTMLElement>(null);
  const acquisition = useMemo(() => {
    const needle = sourceSearch.trim().toLocaleLowerCase();
    const rows = report?.acquisition ?? [];
    return needle
      ? rows.filter((row) => [row.source, row.medium, row.campaign].some((value) => value?.toLocaleLowerCase().includes(needle)))
      : rows;
  }, [report, sourceSearch]);
  const sparse = useMemo(
    () => (report?.series.filter((point) => point.visitors || point.sessions).length ?? 0) <= 2,
    [report],
  );
  const acquisitionMax = Math.max(1, ...(report?.acquisition.slice(0, 5).map((row) => row.visitors) ?? []));
  const landingPageMax = Math.max(1, ...(report?.landing_pages.slice(0, 5).map((row) => row.visitors) ?? []));

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!previewMotion || !overviewRef.current) return;
    const root = overviewRef.current;
    const chart = chartRef.current;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-preview-reveal]'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.dataset.previewVisible = 'true');
      setChartVisible(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          entry.target.dataset.previewVisible = 'true';
          if (entry.target === chart) setChartVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [previewMotion]);

  return (
    <section ref={overviewRef} className={`${s.overview}${previewMotion ? ` ${s.previewMotion}` : ''}`} id="overview" tabIndex={-1} aria-label="Business overview">
      {loading ? (
        <div className={s.skeletonGrid} aria-busy="true" role="status">
          <span>Loading overview…</span>
          {[0, 1, 2, 3].map((key) => (
            <i key={key} />
          ))}
        </div>
      ) : error ? (
        <div className={s.error} role="alert">
          <strong>Could not load overview</strong>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : (
        report && (
          <>
            <div className={`${s.kpis} ${conversionEvent ? s.kpisWithConversion : ''}`} aria-label="Primary metrics" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
              {PRIMARY_METRICS.filter((metric) => metric.key !== 'conversion_rate' || Boolean(conversionEvent)).map((metric, index) => (
                <div className={s.kpi} key={metric.key}>
                  <span title={metric.description}>
                    {metric.label}{' '}
                    <span className={s.info} aria-label={metric.description}>
                      ⓘ
                    </span>
                  </span>
                  {metric.key === 'conversion_rate' && !conversionEvent ? (
                    <div className={s.unconfigured}>
                      <strong>Not configured</strong>
                      <button type="button" onClick={() => onNavigate('goals')}>Add a goal</button>
                    </div>
                  ) : (
                    <>
                      <strong>{previewMotion
                        ? <AnimatedMetric value={report.metrics[metric.key]} rate={metric.rate} active={previewMotion} delay={560 + index * 100} />
                        : display(report.metrics[metric.key], metric.rate)}</strong>
                      <small>{metric.key === 'visitors'
                        ? `${display(report.metrics.new_visitors)} new · ${display(report.metrics.returning_visitors)} returning`
                        : compareLabel(report.metrics[metric.key], report.previous[metric.key])}</small>
                    </>
                  )}
                </div>
              ))}
            </div>

            {conversionEvent && <div className={s.secondaryStats} aria-label="Audience metrics" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
              {SECONDARY_METRICS.filter((metric) => metric.key === 'conversions').map((metric, index) => (
                <div className={s.secondaryStat} key={metric.key}>
                  <span title={metric.description}>{metric.label}</span>
                  {metric.key === 'conversions' && !conversionEvent ? (
                    <div className={s.unconfigured}>
                      <strong>Not configured</strong>
                      <button type="button" onClick={() => onNavigate('goals')}>Add a goal</button>
                    </div>
                  ) : (
                    <strong>{previewMotion
                      ? <AnimatedMetric value={report.metrics[metric.key]} active={previewMotion} delay={970 + index * 100} />
                      : display(report.metrics[metric.key])}</strong>
                  )}
                </div>
              ))}
            </div>}

            {audience && <div className={s.audience}>{audience}</div>}

            <section ref={chartRef} className={s.chart} data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
              <div className={s.sectionHead}>
                <div>
                  <span className={s.eyebrow}>TRAFFIC</span>
                  <h3>Visitors &amp; sessions</h3>
                  <p>Daily activity compared with the preceding period</p>
                </div>
              </div>
              <TrafficChart
                data={report.series}
                sparse={sparse}
                animate={previewMotion}
                animationActive={chartVisible}
                reducedMotion={reducedMotion}
              />
            </section>

            <div className={s.insightsBento}>
              <section className={`${s.panel} ${s.quickInsights}`} aria-labelledby="quick-insights-title">
                <div className={s.sectionHead}>
                  <div><span className={s.eyebrow}>EXPLORE</span><h3 id="quick-insights-title">Traffic details</h3><p>Switch between your top sources, entry pages, and latest activity.</p></div>
                </div>
                <div className={s.insightTabs} role="tablist" aria-label="Traffic details" onKeyDown={(event) => {
                  const tabs = ['acquisition', 'pages', 'activity'] as const;
                  const current = tabs.indexOf(overviewTab);
                  const next = event.key === 'ArrowRight' ? (current + 1) % tabs.length : event.key === 'ArrowLeft' ? (current + tabs.length - 1) % tabs.length : -1;
                  if (next >= 0) {
                    event.preventDefault();
                    setOverviewTab(tabs[next]);
                    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                  }
                }}>
                  {([['acquisition', 'Acquisition'], ['pages', 'Landing pages'], ['activity', 'Recent activity']] as const).map(([key, label]) => (
                    <button key={key} type="button" role="tab" id={`insight-tab-${key}`} aria-controls="insight-tab-panel" aria-selected={overviewTab === key} tabIndex={overviewTab === key ? 0 : -1} onClick={() => setOverviewTab(key)}>{label}</button>
                  ))}
                </div>
                <div className={s.insightRows} role="tabpanel" id="insight-tab-panel" aria-labelledby={`insight-tab-${overviewTab}`}>
                  {overviewTab === 'acquisition' && (report.acquisition.length ? report.acquisition.slice(0, 5).map((row, index) => (
                    <div className={`${s.insightRow} ${s.insightBarRow}`} key={`${row.source}-${row.medium}-${row.campaign}-${index}`}>
                      <span className={s.insightBar} aria-hidden="true"><i style={{ width: `${Math.max(2, (row.visitors / acquisitionMax) * 100)}%` }} /></span>
                      <span><strong>{row.source || 'Direct / unknown'}</strong><small>{row.medium || 'No medium'}{row.campaign ? ` · ${row.campaign}` : ''}</small></span><b>{display(row.visitors)}<small>visitors</small></b>
                    </div>
                  )) : <p className={s.insightEmpty}>No acquisition data for this period yet.</p>)}
                  {overviewTab === 'pages' && (report.landing_pages.length ? report.landing_pages.slice(0, 5).map((row) => (
                    <div className={`${s.insightRow} ${s.insightBarRow}`} key={row.path}>
                      <span className={s.insightBar} aria-hidden="true"><i style={{ width: `${Math.max(2, (row.visitors / landingPageMax) * 100)}%` }} /></span>
                      <span><strong>{displayPagePath(row.path)}</strong><small>Landing page</small></span><b>{display(row.visitors)}<small>visitors</small></b>
                    </div>
                  )) : <p className={s.insightEmpty}>No landing page data for this period yet.</p>)}
                  {overviewTab === 'activity' && (report.recent_activity.length ? report.recent_activity.slice(0, 5).map((row, index) => (
                    <div className={s.insightRow} key={`${row.occurred_at}-${row.path}-${index}`}><span><strong>{row.name || 'Page view'}</strong><small>{displayPagePath(row.path)}</small></span><b className={s.insightTime}>{new Date(row.occurred_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b></div>
                  )) : <p className={s.insightEmpty}>No recent activity for this period yet.</p>)}
                </div>
              </section>

              <section className={`${s.panel} ${s.aiPreview}`} aria-labelledby="ai-preview-title">
                <div className={s.sectionHead}><div><span className={s.eyebrow}>AI TRAFFIC</span><h3 id="ai-preview-title">AI referrals &amp; crawlers</h3><p>Observed in the selected date range using {model.replaceAll('_', ' ')} attribution.</p></div></div>
                <div className={s.insightTabs} role="tablist" aria-label="AI traffic views">
                  <button type="button" role="tab" aria-selected={aiTab === 'referrals'} onClick={() => setAiTab('referrals')}>AI referrals</button>
                  <button type="button" role="tab" aria-selected={aiTab === 'crawlers'} onClick={() => setAiTab('crawlers')}>AI crawlers</button>
                </div>
                {aiTab === 'referrals' ? <>
                  <p><strong>{display(report?.ai_traffic.referrals.metrics.visitors ?? 0)}</strong> visitors · <strong>{display(report?.ai_traffic.referrals.metrics.sessions ?? 0)}</strong> sessions · <strong>{display(report?.ai_traffic.referrals.metrics.pageviews ?? 0)}</strong> page views</p>
                  {(report?.ai_traffic.referrals.platforms ?? []).length ? <div className={s.aiSourceList}>{report!.ai_traffic.referrals.platforms.slice(0, 5).map((row) => <div className={s.aiSource} key={`${row.platform}-${row.referrer_hostname}`}><span><i />{row.platform}<small>{row.referrer_hostname}</small></span><b>{display(row.visitors)}</b></div>)}</div> : <p className={s.insightEmpty}>No AI traffic detected yet.</p>}
                </> : <>
                  <p><strong>{display(report?.ai_traffic.crawlers.metrics.requests ?? 0)}</strong> requests · <strong>{display(report?.ai_traffic.crawlers.metrics.unique_crawlers ?? 0)}</strong> crawler types · {report?.ai_traffic.crawlers.metrics.pages ?? 0} pages</p>
                  {(report?.ai_traffic.crawlers.platforms ?? []).length ? <div className={s.aiSourceList}>{report!.ai_traffic.crawlers.platforms.slice(0, 5).map((row) => <div className={s.aiSource} key={row.crawler}><span><i />{row.crawler}<small>{row.category} · {row.verification_status}</small></span><b>{display(row.requests)}</b></div>)}</div> : <p className={s.insightEmpty}>No AI crawler activity detected yet.</p>}
                  {report?.ai_traffic.crawlers.recent.slice(0, 3).map((row) => <div className={s.insightRow} key={row.request_id}><span><strong>{row.crawler} · {row.path}</strong><small>{row.hostname} · {row.method} {row.status_code} · unverified UA match</small></span><b className={s.insightTime}>{new Date(row.requested_at).toLocaleDateString()}</b></div>)}
                  {projectId && <button type="button" onClick={() => void rotateCrawlerKey()} disabled={keyBusy}>{keyBusy ? 'Generating…' : 'Generate / rotate private crawler key'}</button>}
                  {keyError && <p role="alert">{keyError}</p>}
                  {newCrawlerKey && <p role="status">Copy this private key now; it is shown once: <code>{newCrawlerKey}</code></p>}
                  {!report?.ai_traffic.crawler_key_configured && !newCrawlerKey && <p className={s.demoNote}>Add the generated key only to your site’s server environment. User-Agent matches are unverified.</p>}
                </>}
                <div className={s.aiPreviewChart} aria-label="AI traffic over time">{report?.ai_traffic.series.map((point) => <span key={point.date} title={`${point.date}: ${point.referral_visitors} referral visitors, ${point.crawler_requests} crawler requests`} style={{ display: 'inline-block', height: `${Math.max(2, Math.min(36, point.referral_visitors + point.crawler_requests))}px`, width: `${Math.max(2, 92 / Math.max(1, report.ai_traffic.series.length))}%`, marginRight: 2, background: 'var(--accent-line)', verticalAlign: 'bottom' }} />)}</div>
              </section>
            </div>

            <div className={s.twoCol}>
              <section className={s.panel} id="acquisition" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
                <div className={s.sectionHead}>
                  <div>
                    <span className={s.eyebrow}>ACQUISITION</span>
                    <h3>Where visitors find you</h3>
                    <p>Attributed by {model.replaceAll('_', ' ')}. Missing source is direct or unknown.</p>
                  </div>
                  <a
                    href="#acquisition"
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate('acquisition');
                    }}
                  >
                    Open acquisition →
                  </a>
                </div>
                <div className={s.sourceTools}>
                  <label>
                    Search sources
                    <input
                      type="search"
                      value={sourceSearch}
                      onChange={(event) => setSourceSearch(event.target.value)}
                      placeholder="Source, medium or campaign"
                    />
                  </label>
                </div>
                <p className={s.sourceNote}>
                  Showing {acquisition.length} source {acquisition.length === 1 ? 'group' : 'groups'}. Open acquisition for filters, sorting, and export.
                </p>
                {acquisition.length ? (
                  <div className={s.scroll}>
                    <table>
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Campaign</th>
                          <th>Visitors</th>
                          <th>Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acquisition.slice(0, 8).map((row, index) => (
                          <tr key={`${row.source}-${row.medium}-${row.campaign}-${index}`}>
                            <td>{row.source}</td>
                            <td>{row.campaign || '—'}</td>
                            <td>{display(row.visitors)}</td>
                            <td>{display(row.sessions)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={s.empty}>
                    {sourceSearch ? 'No acquisition sources match this search.' : 'No acquisition sources in this period.'}
                  </div>
                )}
              </section>

              {report.campaigns.length > 0 && <section className={s.panel} id="campaigns" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
                <div className={s.sectionHead}>
                  <div>
                    <span className={s.eyebrow}>CAMPAIGNS</span>
                    <h3>Campaign performance</h3>
                    <p>Observed campaign traffic</p>
                  </div>
                  <a
                    href="#campaigns"
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate('campaigns');
                    }}
                  >
                    Open campaigns →
                  </a>
                </div>
                {report.campaigns.length ? (
                  <div className={s.scroll}>
                    <table>
                      <thead>
                        <tr>
                          <th>Campaign</th>
                          <th>Source</th>
                          <th>Visitors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.campaigns.slice(0, 8).map((row, index) => (
                          <tr key={`${row.campaign}-${row.source}-${index}`}>
                            <td>{row.campaign}</td>
                            <td>{row.source || 'Unknown'}</td>
                            <td>{display(row.visitors)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>}
            </div>

            <div className={s.twoCol}>
              <section className={s.panel} id="pages" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
                <div className={s.sectionHead}>
                  <div>
                    <span className={s.eyebrow}>LANDING PAGES</span>
                    <h3>First pages visited</h3>
                    <p>Entry pages for observed sessions</p>
                  </div>
                  <a
                    href="#pages"
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate('pages');
                    }}
                  >
                    Page analytics →
                  </a>
                </div>
                {report.landing_pages.length ? (
                  <div className={s.scroll}>
                    <table>
                      <thead>
                        <tr>
                          <th>Page</th>
                          <th>Visitors</th>
                          <th>Sessions</th>
                          <th>Conversions</th>
                          <th>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.landing_pages.slice(0, 8).map((row) => (
                          <tr key={row.path}>
                            <td>{row.path}</td>
                            <td>{display(row.visitors)}</td>
                            <td>{display(row.sessions)}</td>
                            <td>{display(row.conversions)}</td>
                            <td>{display(row.conversion_rate, true)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={s.empty}>Landing pages appear after page views arrive.</div>
                )}
              </section>

              <section className={s.panel} id="events" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
                <div className={s.sectionHead}>
                  <div>
                    <span className={s.eyebrow}>RECENT ACTIVITY</span>
                    <h3>Latest events</h3>
                    <p>Event names and paths only</p>
                  </div>
                  <a
                    href="#events"
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate('events');
                    }}
                  >
                    Open events →
                  </a>
                </div>
                {report.recent_activity.length ? (
                  <ul className={s.activity}>
                    {report.recent_activity.slice(0, 6).map((event, index) => (
                      <li key={`${event.occurred_at}-${index}`}>
                        <div>
                          <strong>{eventLabel(event.name)}</strong>
                          <span>{displayPagePath(event.path)}</span>
                        </div>
                        <time dateTime={event.occurred_at}>
                          {new Date(event.occurred_at).toLocaleString(undefined, {
                            timeZone: 'UTC',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          UTC
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={s.empty}>No events in this period.</div>
                )}
              </section>
            </div>

            <section className={s.inactiveSection} aria-label="Not active yet" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
              <div className={s.inactiveHeading}>
                <span className={s.eyebrow}>NOT ACTIVE YET · {Number(!conversionEvent) + Number(report.campaigns.length === 0) + 1}</span>
                <span>These move up when matching data arrives.</span>
              </div>
              <div className={s.inactiveCards}>
                {!conversionEvent && <article className={s.inactiveCard}>
                  <h3>Conversion goals</h3>
                  <p>Not configured. Add a goal to measure converted visitors and conversion rate.</p>
                  <a href="#goals" onClick={(event) => { event.preventDefault(); onNavigate('goals'); }}>Add a goal →</a>
                </article>}
                {report.campaigns.length === 0 && <article className={s.inactiveCard}>
                  <h3>Campaigns</h3>
                  <p>Campaign reporting appears when visitors arrive with UTM campaign parameters.</p>
                  <a href="#campaigns" onClick={(event) => { event.preventDefault(); onNavigate('campaigns'); }}>Campaign setup →</a>
                </article>}
                <article className={s.inactiveCard} id="revenue">
                  <h3>Revenue</h3>
                  <p>No verified revenue recorded. Browser events are never treated as revenue.</p>
                  <a href="#revenue" onClick={(event) => { event.preventDefault(); onNavigate('revenue'); }}>What’s required →</a>
                </article>
              </div>
            </section>
          </>
        )
      )}
    </section>
  );
}
