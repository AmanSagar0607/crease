'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AnalyticsSection } from './navigation';
import { compareLabel, display, eventLabel, type AttributionModel, type Metrics, type Report } from './reporting';
import s from './overview-v1.module.css';

type Props = {
  report: Report | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  model: AttributionModel;
  conversionEvent: string;
  filtered: boolean;
  onNavigate: (section: AnalyticsSection) => void;
};

const METRICS: { key: keyof Metrics; label: string; description: string; rate?: boolean }[] = [
  { key: 'visitors', label: 'Unique visitors', description: 'Distinct visitor IDs with events in this period.' },
  { key: 'sessions', label: 'Sessions', description: 'Server-assigned sessions starting in this period.' },
  { key: 'pageviews', label: 'Page views', description: 'Pageview events in this period.' },
  { key: 'new_visitors', label: 'New visitors', description: 'First observed in retained project history during this period.' },
  { key: 'returning_visitors', label: 'Returning visitors', description: 'Observed before this period in retained project history.' },
  { key: 'conversions', label: 'Converted visitors', description: 'Distinct visitors who triggered the selected conversion event.' },
  { key: 'conversion_rate', label: 'Conversion rate', description: 'Converted visitors divided by unique visitors.', rate: true },
];

export default function OverviewV1({ report, loading, error, onRetry, model, conversionEvent, filtered, onNavigate }: Props) {
  const [sourceSearch, setSourceSearch] = useState('');
  const acquisition = useMemo(() => {
    const needle = sourceSearch.trim().toLocaleLowerCase();
    const rows = report?.acquisition ?? [];
    return needle
      ? rows.filter((row) => [row.source, row.medium, row.campaign].some((value) => value?.toLocaleLowerCase().includes(needle)))
      : rows;
  }, [report, sourceSearch]);

  return (
    <section className={s.overview} id="overview" tabIndex={-1} aria-label="Business overview">
      <div className={s.header}>
        <div>
          <div className={s.eyebrow}>BUSINESS OVERVIEW</div>
          <h2>Understand what brings people in.</h2>
          <p>Traffic, acquisition and conversions from observed activity. All dates are UTC.</p>
        </div>
      </div>
      <p className={s.scope}>
        {report ? `${report.start} – ${report.end} UTC · ${model.replaceAll('_', ' ')} attribution` : 'Loading reporting window…'}
        {filtered ? ' · the detailed event property filter does not apply to these figures' : ''}
        {conversionEvent
          ? ` · conversions count visitors who triggered “${conversionEvent}”; attribution can include touchpoints after the conversion.`
          : ' · choose a conversion event in the controls above to add conversion metrics.'}
      </p>

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
            <div className={s.kpis}>
              {METRICS.map((metric) => (
                <div className={s.kpi} key={metric.key}>
                  <span title={metric.description}>
                    {metric.label}{' '}
                    <span className={s.info} aria-label={metric.description}>
                      ⓘ
                    </span>
                  </span>
                  <strong>{display(report.metrics[metric.key], metric.rate)}</strong>
                  <small>{compareLabel(report.metrics[metric.key], report.previous[metric.key])}</small>
                </div>
              ))}
            </div>

            <section className={s.chart}>
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
                <div className={s.chartArea}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.series} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'var(--muted)', fontSize: 10 }}
                        tickFormatter={(x: string) => x.slice(5)}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' }}
                        labelFormatter={(label) => `${label} UTC`}
                      />
                      <Line type="monotone" dataKey="visitors" name="Visitors" stroke="var(--ink)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="sessions" name="Sessions" stroke="var(--chartThird)" strokeWidth={2} dot={false} />
                      <Line
                        type="monotone"
                        dataKey="previous_visitors"
                        name="Previous visitors"
                        stroke="var(--ink)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="previous_sessions"
                        name="Previous sessions"
                        stroke="var(--chartThird)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <div className={s.twoCol}>
              <section className={s.panel}>
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

              <section className={s.panel}>
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
              <section className={s.panel}>
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

              <section className={s.panel}>
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
                          <span>{event.path}</span>
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

            <div className={s.revenue}>
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
