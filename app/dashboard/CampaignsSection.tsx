'use client';

import { useMemo, useState } from 'react';
import { csvRows } from './csv';
import { display, type CampaignRow, type Range, type Report } from './reporting';
import s from './sections.module.css';

type SortKey = 'campaign' | 'source' | 'visitors' | 'conversions' | 'conversion_rate';
type SortDir = 'asc' | 'desc';

type Props = {
  range: Range;
  report: Report | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onInspect: (campaign: string) => void;
};

/** Campaign explorer backed by the shared overview report. */
export default function CampaignsSection({ range, report, loading, error, onRetry, onInspect }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'visitors', dir: 'desc' });

  const rows = report?.campaigns ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matched = needle
      ? rows.filter((row) => row.campaign.toLocaleLowerCase().includes(needle) || (row.source ?? '').toLocaleLowerCase().includes(needle))
      : rows;
    return [...matched].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left ?? '').localeCompare(String(right ?? ''));
      return sort.dir === 'asc' ? result : -result;
    });
  }, [rows, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'campaign' || key === 'source' ? 'asc' : 'desc' },
    );
  }

  function exportCsv() {
    if (!filtered.length) return;
    const contents = csvRows([
      ['Campaign', 'Source', 'Visitors', 'Conversions', 'Conversion rate'],
      ...filtered.map((row) => [row.campaign, row.source, row.visitors, row.conversions, row.conversion_rate]),
    ]);
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Zappa-campaigns-${range.start}-${range.end}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: 'campaign', label: 'Campaign' },
    { key: 'source', label: 'Source' },
    { key: 'visitors', label: 'Visitors', numeric: true },
    { key: 'conversions', label: 'Conversions', numeric: true },
    { key: 'conversion_rate', label: 'Rate', numeric: true },
  ];

  return (
    <section className={s.section} aria-label="Campaign performance">
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>CAMPAIGNS</span>
          <h2>Campaign performance</h2>
          <p>
            Campaigns observed through UTM campaign parameters between {range.start} – {range.end} UTC. Conversions
            require a selected conversion event in the controls above.
          </p>
        </div>
      </header>

      <div className={s.tools}>
        <label>
          Search campaigns
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Campaign or source"
          />
        </label>
        <button type="button" onClick={exportCsv} disabled={!filtered.length}>
          Export CSV
        </button>
      </div>

      <p className={s.note}>
        The report returns the 10 highest-visitor campaign groups for the selected period; the search filters those
        groups. Open a campaign to inspect every source group behind it.
      </p>

      {loading ? (
        <div className={s.skeleton} aria-busy="true" role="status">
          <span className="sr-only">Loading campaigns…</span>
          {[0, 1, 2, 3].map((item) => (
            <i key={item} />
          ))}
        </div>
      ) : error ? (
        <div className={s.error} role="alert">
          <strong>Could not load campaigns</strong>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !rows.length ? (
        <div className={s.empty}>
          No campaigns in this period. Campaigns appear when visitors arrive with <code>utm_campaign</code> parameters.
        </div>
      ) : !filtered.length ? (
        <div className={s.empty}>No campaigns match “{query}”.</div>
      ) : (
        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                {columns.map((column) => (
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
                <th>
                  <span className="sr-only">Inspect</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr key={`${row.campaign}-${row.source}-${index}`}>
                  <td title={row.campaign}>{row.campaign}</td>
                  <td>{row.source || 'Unknown'}</td>
                  <td className={s.num}>{display(row.visitors)}</td>
                  <td className={s.num}>{display(row.conversions)}</td>
                  <td className={s.num}>{display(row.conversion_rate, true)}</td>
                  <td>
                    <button className={s.linkButton} type="button" onClick={() => onInspect(row.campaign)}>
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
