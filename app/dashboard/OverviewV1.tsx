'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { AnalyticsSection } from './navigation';
import { compareLabel, display, displayPagePath, eventLabel, type AttributionModel, type Metrics, type Report } from './reporting';
import s from './overview-v1.module.css';

type Props = {
  report: Report | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  model: AttributionModel;
  conversionEvent: string;
  filtered: boolean;
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

const OVERVIEW_CHART_CONFIG: ChartConfig = {
  visitors: { label: 'Visitors', color: 'var(--accent-line)' },
  sessions: { label: 'Sessions', color: 'var(--chart-muted)' },
  previous_visitors: { label: 'Previous visitors', color: 'var(--accent-line)' },
  previous_sessions: { label: 'Previous sessions', color: 'var(--chart-muted)' },
};

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

export default function OverviewV1({ report, loading, error, onRetry, model, conversionEvent, filtered, previewMotion = false, onNavigate }: Props) {
  const [sourceSearch, setSourceSearch] = useState('');
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
      <div className={s.header} data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
        <div>
          <div className={s.eyebrow}>BUSINESS OVERVIEW</div>
          <h2>Understand what brings people in.</h2>
          <p>Observed traffic and conversion activity for this project.</p>
        </div>
      </div>
      <details className={s.definitions}>
        <summary>How these metrics are defined</summary>
        <p>
          Dates use UTC calendar days. Attribution: {model.replaceAll('_', ' ')}.
          {filtered ? ' The detailed event property filter does not apply to these overview figures.' : ''}
          {conversionEvent
            ? ` Conversions count visitors who triggered “${conversionEvent}”; attribution can include touchpoints after conversion.`
            : ' Select a conversion event in Filters or add a goal to configure conversion metrics.'}
        </p>
      </details>

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
            <div className={s.kpis} aria-label="Primary metrics" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
              {PRIMARY_METRICS.map((metric, index) => (
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
                      <small>{compareLabel(report.metrics[metric.key], report.previous[metric.key])}</small>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className={s.secondaryStats} aria-label="Audience metrics" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
              {SECONDARY_METRICS.map((metric, index) => (
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
            </div>

            <section ref={chartRef} className={s.chart} data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
              <div className={s.sectionHead}>
                <div>
                  <span className={s.eyebrow}>TRAFFIC</span>
                  <h3>Visitors &amp; sessions</h3>
                  <p>Daily activity compared with the preceding period</p>
                </div>
                <div className={s.legend}>
                  <span>● Visitors</span>
                  <span>● Sessions</span>
                  <span>┄ Previous period</span>
                </div>
              </div>
              {report.series.every(
                (point) => !point.visitors && !point.sessions && !point.previous_visitors && !point.previous_sessions,
              ) ? (
                <div className={s.empty}>No traffic in this period. A chart will appear when activity arrives.</div>
              ) : (
                <>
                {sparse && <p className={s.sparseNote}>Activity is sparse in this period; markers show observed days.</p>}
                <div className={s.chartArea}>
                  <ChartContainer
                    config={OVERVIEW_CHART_CONFIG}
                    className={s.chartContainer}
                    role="img"
                    aria-label="Daily visitors and sessions compared with the previous period"
                  >
                    <LineChart data={report.series} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--line)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        interval={Math.max(0, Math.ceil(report.series.length / 6) - 1)}
                        tick={{ fill: 'var(--muted)', fontSize: 13 }}
                        tickFormatter={(x: string) => x.slice(5)}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis domain={[0, 'dataMax']} tickCount={5} allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 13 }} tickLine={false} axisLine={false} />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent labelFormatter={(label) => `${String(label)} UTC`} />}
                      />
                      <Line type="monotone" dataKey="visitors" name="Visitors" stroke="var(--color-visitors)" strokeWidth={2.5} dot={sparse ? { r: 3 } : false} isAnimationActive={previewMotion ? chartVisible && !reducedMotion : undefined} animationBegin={previewMotion ? 650 : undefined} animationDuration={previewMotion ? 1250 : undefined} animationEasing={previewMotion ? 'ease-out' : undefined} activeDot={{ r: 5, strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="sessions" name="Sessions" stroke="var(--color-sessions)" strokeWidth={2} dot={sparse ? { r: 3 } : false} isAnimationActive={previewMotion ? chartVisible && !reducedMotion : undefined} animationBegin={previewMotion ? 780 : undefined} animationDuration={previewMotion ? 1200 : undefined} animationEasing={previewMotion ? 'ease-out' : undefined} activeDot={{ r: 5, strokeWidth: 2 }} />
                      <Line
                        type="monotone"
                        dataKey="previous_visitors"
                        name="Previous visitors"
                        stroke="var(--color-previous_visitors)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        dot={false}
                        isAnimationActive={previewMotion ? chartVisible && !reducedMotion : undefined}
                        animationBegin={previewMotion ? 1050 : undefined}
                        animationDuration={previewMotion ? 1050 : undefined}
                        animationEasing={previewMotion ? 'ease-out' : undefined}
                      />
                      <Line
                        type="monotone"
                        dataKey="previous_sessions"
                        name="Previous sessions"
                        stroke="var(--color-previous_sessions)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                        dot={false}
                        isAnimationActive={previewMotion ? chartVisible && !reducedMotion : undefined}
                        animationBegin={previewMotion ? 1120 : undefined}
                        animationDuration={previewMotion ? 1050 : undefined}
                        animationEasing={previewMotion ? 'ease-out' : undefined}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
                </>
              )}
            </section>

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
                  Previewing {acquisition.length} of up to 50 source groups — sorting, pagination and CSV export live in
                  the acquisition section.
                </p>
                {acquisition.length ? (
                  <div className={s.scroll}>
                    <table>
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Medium</th>
                          <th>Campaign</th>
                          <th>Visitors</th>
                          <th>Sessions</th>
                          <th>Conversions</th>
                          <th>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acquisition.slice(0, 8).map((row, index) => (
                          <tr key={`${row.source}-${row.medium}-${row.campaign}-${index}`}>
                            <td>{row.source}</td>
                            <td>{row.medium || '—'}</td>
                            <td>{row.campaign || '—'}</td>
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
                  <div className={s.empty}>
                    {sourceSearch ? 'No acquisition sources match this search.' : 'No acquisition sources in this period.'}
                  </div>
                )}
              </section>

              <section className={s.panel} id="campaigns" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
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
                          <th>Conversions</th>
                          <th>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.campaigns.slice(0, 8).map((row, index) => (
                          <tr key={`${row.campaign}-${row.source}-${index}`}>
                            <td>{row.campaign}</td>
                            <td>{row.source || 'Unknown'}</td>
                            <td>{display(row.visitors)}</td>
                            <td>{display(row.conversions)}</td>
                            <td>{display(row.conversion_rate, true)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={s.empty}>Campaigns appear when visitors arrive with UTM campaign parameters.</div>
                )}
              </section>
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
                    {report.recent_activity.slice(0, 8).map((event, index) => (
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

            <div className={s.revenue} id="revenue" data-preview-reveal data-preview-visible={previewMotion ? 'false' : undefined}>
              <div>
                <span className={s.eyebrow}>REVENUE</span>
                <h3>Revenue reporting unavailable</h3>
                <p>
                  No verified revenue has been recorded for this project, and browser events are never treated as
                  revenue. See what is required before this page can show totals.
                </p>
              </div>
              <div className={s.revenueActions}>
                <strong>—</strong>
                <a
                  href="#revenue"
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate('revenue');
                  }}
                >
                  Why →
                </a>
              </div>
            </div>
          </>
        )
      )}
    </section>
  );
}
