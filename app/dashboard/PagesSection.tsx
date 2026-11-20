'use client';

import { useMemo, useState } from 'react';
import AnalyticsCharts from './AnalyticsCharts';
import { csvRows } from './csv';
import { display, type LandingRow, type Range, type Report } from './reporting';
import s from './sections.module.css';
import { Table } from '@/components/ui/table';

type BreakdownRow = { label: string; count: number };
type SeriesPoint = { date: string; events: number; pageviews: number; visitors: number; sessions: number };
type ChartMetrics = { events: number; pageviews: number; visitors: number; sessions: number };

type Props = {
  range: Range;
  report: Report | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  pageRows: BreakdownRow[];
  series: SeriesPoint[];
  metrics: ChartMetrics;
  hasEvents: boolean;
};

type SortKey = 'path' | 'visitors' | 'sessions' | 'conversions' | 'conversion_rate';
type SortDir = 'asc' | 'desc';

function sortLanding(rows: LandingRow[], key: SortKey, dir: SortDir) {
  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left ?? '').localeCompare(String(right ?? ''));
    return dir === 'asc' ? result : -result;
  });
}

/** Page analytics: top pages, landing pages and the traffic explorer. */
export default function PagesSection({ range, report, loading, error, onRetry, pageRows, series, metrics, hasEvents }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'sessions', dir: 'desc' });
  const [pageQuery, setPageQuery] = useState('');
  const [landingQuery, setLandingQuery] = useState('');

  const totalPageviews = pageRows.reduce((sum, row) => sum + row.count, 0);
  const filteredPages = useMemo(() => {
    const needle = pageQuery.trim().toLocaleLowerCase();
    return needle ? pageRows.filter((row) => row.label.toLocaleLowerCase().includes(needle)) : pageRows;
  }, [pageRows, pageQuery]);

  const landing = report?.landing_pages ?? [];
  const filteredLanding = useMemo(() => {
    const needle = landingQuery.trim().toLocaleLowerCase();
    const matched = needle ? landing.filter((row) => row.path.toLocaleLowerCase().includes(needle)) : landing;
    return sortLanding(matched, sort.key, sort.dir);
  }, [landing, landingQuery, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'path' ? 'asc' : 'desc' },
    );
  }

  function exportLanding() {
    if (!filteredLanding.length) return;
    const contents = csvRows([
      ['Landing page', 'Visitors', 'Sessions', 'Conversions', 'Conversion rate'],
      ...filteredLanding.map((row) => [row.path, row.visitors, row.sessions, row.conversions, row.conversion_rate]),
    ]);
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Zappa-landing-pages-${range.start}-${range.end}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const landingColumns: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: 'path', label: 'Landing page' },
    { key: 'visitors', label: 'Visitors', numeric: true },
    { key: 'sessions', label: 'Sessions', numeric: true },
    { key: 'conversions', label: 'Conversions', numeric: true },
    { key: 'conversion_rate', label: 'Rate', numeric: true },
  ];

  return (
    <section className={s.section} aria-label="Page analytics">
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>PAGES</span>
          <h2>Pages and landing pages</h2>
          <p>
            Page views from observed pageview events and entry pages from server-assigned sessions between {range.start}{' '}
            – {range.end} UTC.
          </p>
        </div>
      </header>

      {loading ? (
        <div className={s.skeleton} aria-busy="true" role="status">
          <span className="sr-only">Loading pages…</span>
          {[0, 1, 2, 3].map((item) => (
            <i key={item} />
          ))}
        </div>
      ) : error ? (
        <div className={s.error} role="alert">
          <strong>Could not load page data</strong>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className={s.grid2}>
            <section className={s.panel}>
              <div className={s.panelHead}>
                <h3>Top pages</h3>
                <span>{pageRows.length ? `${totalPageviews.toLocaleString()} page views` : 'No data'}</span>
              </div>
              <div className={s.tools}>
                <label>
                  Search pages
                  <input
                    type="search"
                    value={pageQuery}
                    onChange={(event) => setPageQuery(event.target.value)}
                    placeholder="/pricing"
                  />
                </label>
              </div>
              {filteredPages.length ? (
                <div className={s.scroll}>
                  <Table className={s.table}>
                    <thead>
                      <tr>
                        <th>Page</th>
                        <th className={s.num}>Page views</th>
                        <th className={s.num}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPages.map((row, index) => (
                        <tr key={`${row.label}-${index}`}>
                          <td title={row.label}>{row.label || 'Unknown'}</td>
                          <td className={s.num}>{row.count.toLocaleString()}</td>
                          <td className={s.num}>{totalPageviews ? `${((row.count / totalPageviews) * 100).toFixed(1)}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className={s.empty}>
                  {pageQuery ? `No pages match “${pageQuery}”.` : 'Page views appear once the tracker records pageviews.'}
                </div>
              )}
              <p className={s.note}>
                Unique visitors per page are not computed by the current API, so only page-view counts are shown here.
              </p>
            </section>

            <section className={s.panel}>
              <div className={s.panelHead}>
                <h3>Landing pages</h3>
                <span>Entry pages of observed sessions</span>
              </div>
              <div className={s.tools}>
                <label>
                  Search landing pages
                  <input
                    type="search"
                    value={landingQuery}
                    onChange={(event) => setLandingQuery(event.target.value)}
                    placeholder="/"
                  />
                </label>
                <button type="button" onClick={exportLanding} disabled={!filteredLanding.length}>
                  Export CSV
                </button>
              </div>
              {loading ? (
                <div className={s.skeleton} aria-busy="true">
                  {[0, 1, 2].map((item) => (
                    <i key={item} />
                  ))}
                </div>
              ) : !landing.length ? (
                <div className={s.empty}>Landing pages appear after sessions are recorded.</div>
              ) : !filteredLanding.length ? (
                <div className={s.empty}>No landing pages match “{landingQuery}”.</div>
              ) : (
                <div className={s.scroll}>
                  <Table className={s.table}>
                    <thead>
                      <tr>
                        {landingColumns.map((column) => (
                          <th
                            key={column.key}
                            className={column.numeric ? s.num : undefined}
                            aria-sort={sort.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                          >
                            <button type="button" onClick={() => toggleSort(column.key)}>
                              {column.label}
                              {sort.key === column.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLanding.map((row) => (
                        <tr key={row.path}>
                          <td title={row.path}>{row.path}</td>
                          <td className={s.num}>{display(row.visitors)}</td>
                          <td className={s.num}>{display(row.sessions)}</td>
                          <td className={s.num}>{display(row.conversions)}</td>
                          <td className={s.num}>{display(row.conversion_rate, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
              <p className={s.note}>
                Entry pages double as landing pages. Exit pages and per-page unique visitors are not recorded yet, so
                they are not shown rather than estimated.
              </p>
            </section>
          </div>

          <section className={s.panel}>
            <div className={s.panelHead}>
              <h3>Traffic explorer</h3>
              <span>Daily totals for the selected range</span>
            </div>
            {hasEvents ? (
              <AnalyticsCharts series={series} metrics={metrics} />
            ) : (
              <div className={s.empty}>Send a few events to unlock the traffic explorer.</div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
