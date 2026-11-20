'use client';

import { useEffect, useMemo, useState } from 'react';
import { csvRows } from './csv';
import { compareLabel, display, type AcquisitionRow, type AttributionModel, type Range, type Report } from './reporting';
import useOverviewReport from './useOverviewReport';
import s from './sections.module.css';
import { Table } from '@/components/ui/table';

type SortKey = 'source' | 'medium' | 'campaign' | 'visitors' | 'sessions' | 'conversions' | 'conversion_rate';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 15;

function cell(value: string | null | undefined) {
  return value && value !== 'Unknown' ? value : '—';
}

function deltaTag(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? '0%' : 'New';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function deltaClass(tag: string | null) {
  if (!tag || tag === '0%') return s.deltaFlat;
  return tag.startsWith('-') ? s.deltaDown : s.deltaUp;
}

type Props = {
  projectId: string;
  range: Range;
  model: AttributionModel;
  conversionEvent: string;
  refresh: number;
  report: Report | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  query: string;
  onQueryChange: (value: string) => void;
};

/**
 * Full acquisition report: attribution model, search, sorting, pagination,
 * previous-period comparison and formula-safe CSV export.
 */
export default function AcquisitionSection({
  projectId,
  range,
  model,
  conversionEvent,
  refresh,
  report,
  loading,
  error,
  onRetry,
  query,
  onQueryChange,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'visitors', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [compare, setCompare] = useState(false);
  const previousRange = useMemo(() => {
    const days = Math.round((Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86400000) + 1;
    const shift = (iso: string) => {
      const date = new Date(`${iso}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - days);
      return date.toISOString().slice(0, 10);
    };
    return { start: shift(range.start), end: shift(range.end) };
  }, [range.start, range.end]);
  const previousReport = useOverviewReport({
    projectId,
    range: previousRange,
    model,
    conversionEvent,
    refresh,
    enabled: compare,
  });

  const rows = report?.acquisition ?? [];
  const previousRows = useMemo(() => {
    const map = new Map<string, AcquisitionRow>();
    for (const row of previousReport.report?.acquisition ?? []) {
      map.set(`${row.source}|${row.medium}|${row.campaign}`, row);
    }
    return map;
  }, [previousReport.report]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matched = needle
      ? rows.filter((row) => [row.source, row.medium, row.campaign].some((value) => value?.toLocaleLowerCase().includes(needle)))
      : rows;
    const sorted = [...matched].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left ?? '').localeCompare(String(right ?? ''));
      return sort.dir === 'asc' ? result : -result;
    });
    return sorted;
  }, [rows, query, sort]);

  useEffect(() => setPage(0), [query, sort, range.start, range.end, model]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'source' || key === 'medium' || key === 'campaign' ? 'asc' : 'desc' },
    );
  }

  function exportCsv() {
    if (!filtered.length) return;
    const header = ['Source', 'Medium', 'Campaign', 'Visitors', 'Sessions', 'Conversions', 'Conversion rate'];
    if (compare) header.push('Previous visitors', 'Change vs previous');
    const contents = csvRows([
      header,
      ...filtered.map((row) => {
        const base: (string | number | null)[] = [
          row.source,
          row.medium,
          row.campaign,
          row.visitors,
          row.sessions,
          row.conversions,
          row.conversion_rate,
        ];
        if (compare) {
          const previous = previousRows.get(`${row.source}|${row.medium}|${row.campaign}`);
          base.push(previous?.visitors ?? null, deltaTag(row.visitors, previous?.visitors ?? null));
        }
        return base;
      }),
    ]);
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Zappa-acquisition-${range.start}-${range.end}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: 'source', label: 'Source' },
    { key: 'medium', label: 'Medium' },
    { key: 'campaign', label: 'Campaign' },
    { key: 'visitors', label: 'Visitors', numeric: true },
    { key: 'sessions', label: 'Sessions', numeric: true },
    { key: 'conversions', label: 'Conversions', numeric: true },
    { key: 'conversion_rate', label: 'Rate', numeric: true },
  ];

  return (
    <section className={s.section} aria-label="Acquisition report">
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>ACQUISITION</span>
          <h2>Where visitors come from</h2>
          <p>
            Visitor sources attributed with the {model.replaceAll('_', ' ')} model for {range.start} – {range.end} UTC.
            Sources without observed evidence are reported as direct or unknown.
          </p>
        </div>
      </header>

      <div className={s.tools}>
        <label>
          Search source, medium or campaign
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="e.g. newsletter"
          />
        </label>
        <button
          type="button"
          aria-pressed={compare}
          onClick={() => setCompare((value) => !value)}
          title={`Fetch the ${previousRange.start} – ${previousRange.end} window for comparison`}
        >
          {compare ? 'Comparing previous period' : 'Compare previous period'}
        </button>
        <button type="button" onClick={exportCsv} disabled={!filtered.length}>
          Export CSV
        </button>
      </div>

      <p className={s.note}>
        Showing {filtered.length} of up to 50 source groups (the report cap), sorted by {sort.key.replace('_', ' ')}{' '}
        {sort.dir === 'asc' ? 'ascending' : 'descending'}. The CSV export contains every matching row and protects
        spreadsheet cells from formula injection. Rates are decimal fractions of attributed visitors.
      </p>

      {loading ? (
        <div className={s.skeleton} aria-busy="true" role="status">
          <span className="sr-only">Loading acquisition report…</span>
          {[0, 1, 2, 3, 4].map((item) => (
            <i key={item} />
          ))}
        </div>
      ) : error ? (
        <div className={s.error} role="alert">
          <strong>Could not load acquisition data</strong>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !rows.length ? (
        <div className={s.empty}>
          No attributed visitors in this period. Sources appear once visitors arrive with referrer or campaign
          evidence.
        </div>
      ) : !filtered.length ? (
        <div className={s.empty}>No source groups match “{query}”. Clear the search to see every group.</div>
      ) : (
        <>
          <div className={s.scroll}>
            <Table className={s.table}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className={column.numeric ? s.num : undefined} aria-sort={sort.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button type="button" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        {sort.key === column.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                  {compare && (
                    <th className={s.num}>vs previous</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => {
                  const previous = previousRows.get(`${row.source}|${row.medium}|${row.campaign}`);
                  const tag = deltaTag(row.visitors, previous?.visitors ?? null);
                  return (
                    <tr key={`${row.source}-${row.medium}-${row.campaign}-${index}`}>
                      <td title={row.source}>{row.source}</td>
                      <td>{cell(row.medium)}</td>
                      <td>{cell(row.campaign)}</td>
                      <td className={s.num}>{display(row.visitors)}</td>
                      <td className={s.num}>{display(row.sessions)}</td>
                      <td className={s.num}>{display(row.conversions)}</td>
                      <td className={s.num}>{display(row.conversion_rate, true)}</td>
                      {compare && (
                        <td className={s.num}>
                          {previousReport.loading ? (
                            <span className={s.muted}>…</span>
                          ) : (
                            <span className={`${s.deltaCell} ${deltaClass(tag)}`} title={tag ? `${compareLabel(row.visitors, previous?.visitors ?? null)}` : undefined}>
                              {tag ?? '—'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <div className={s.footerRow}>
            <span>
              Page {page + 1} of {pages} · {filtered.length} source groups
            </span>
            <span className={s.pager}>
              <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                Previous
              </button>
              <button
                type="button"
                disabled={page + 1 >= pages}
                onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}
              >
                Next
              </button>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
