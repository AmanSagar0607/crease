'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { eventLabel, formatUtcStamp, type Range } from './reporting';
import s from './sections.module.css';

type LiveEvent = { id: string; name: string; path: string; occurred_at: string; country?: string | null; device?: string | null };
type Connection = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'paused';
const MAX_EVENTS = 100;

function relativeWhen(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function LiveActivity({ projectId, range }: { projectId: string; range: Range }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [connection, setConnection] = useState<Connection>('connecting');
  const [paused, setPaused] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [eventFilter, setEventFilter] = useState('');
  const [pathFilter, setPathFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const seen = useRef(new Set<string>());
  const cursor = useRef('');
  const streamRef = useRef<EventSource | null>(null);

  const addEvents = useCallback((rows: LiveEvent[], countAsNew: boolean) => {
    const fresh: LiveEvent[] = [];
    for (const event of rows) {
      if (seen.current.has(event.id)) continue;
      if (seen.current.size >= 5000) {
        const oldest = seen.current.values().next().value;
        if (oldest) seen.current.delete(oldest);
      }
      seen.current.add(event.id);
      fresh.push(event);
    }
    if (countAsNew && fresh.length) setNewCount((count) => count + fresh.length);
    setEvents((current) => [...fresh, ...current].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, MAX_EVENTS));
  }, []);

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({ days: '30', limit: '100', start: range.start, end: range.end });
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/events?${params}`, {
      credentials: 'same-origin', cache: 'no-store', signal,
    });
    if (!res.ok) throw new Error(`Activity unavailable (${res.status}).`);
    const rows = await res.json() as LiveEvent[];
    if (!signal?.aborted) {
      addEvents(rows, false);
      setHistoryError('');
      setLoading(false);
    }
  }, [addEvents, projectId, range.end, range.start]);

  useEffect(() => {
    const controller = new AbortController();
    seen.current.clear();
    cursor.current = '';
    setEvents([]);
    setNewCount(0);
    setHistoryError('');
    setLoading(true);
    void loadHistory(controller.signal).catch(() => {
      if (!controller.signal.aborted) {
        setHistoryError('Could not load historical events. Check your connection and refresh.');
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [loadHistory]);

  useEffect(() => {
    let active = true;
    let retryTimer = 0;
    let retries = 0;
    setConnection(paused ? 'paused' : 'connecting');

    const connect = () => {
      if (!active || paused) return;
      const params = new URLSearchParams({ projectId });
      if (cursor.current) params.set('after', cursor.current);
      const source = new EventSource(`/api/events/stream?${params.toString()}`, { withCredentials: true });
      streamRef.current = source;
      source.addEventListener('ready', (event) => {
        const ready = event as MessageEvent<string>;
        if (ready.lastEventId) cursor.current = ready.lastEventId;
        setConnection('connected');
        retries = 0;
      });
      source.addEventListener('analytics-event', (event) => {
        const message = event as MessageEvent<string>;
        try {
          const row = JSON.parse(message.data) as LiveEvent & { ingest_seq: number };
          cursor.current = String(row.ingest_seq || message.lastEventId || '');
          const date = row.occurred_at.slice(0, 10);
          if (date >= range.start && date <= range.end) addEvents([row], true);
        } catch {
          // Ignore malformed data and keep the stream available for later events.
        }
      });
      source.onerror = () => {
        source.close();
        if (!active || paused) return;
        retries += 1;
        setConnection(retries > 8 ? 'disconnected' : 'reconnecting');
        const delay = Math.min(1000 * (2 ** Math.min(retries - 1, 5)), 30000);
        retryTimer = window.setTimeout(connect, delay);
      };
    };
    if (!paused) connect();

    return () => {
      active = false;
      window.clearTimeout(retryTimer);
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [addEvents, paused, projectId, range.end, range.start]);

  const filteredEvents = events.filter((event) =>
    (!eventFilter || event.name.toLowerCase().includes(eventFilter.toLowerCase())) &&
    (!pathFilter || event.path.toLowerCase().includes(pathFilter.toLowerCase())) &&
    (!deviceFilter || event.device?.toLowerCase() === deviceFilter.toLowerCase()) &&
    (!countryFilter || event.country?.toLowerCase() === countryFilter.toLowerCase()),
  );

  return (
    <section className={s.section} aria-label="Live activity">
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>LIVE ACTIVITY</span>
          <h2>Newest events as they arrive</h2>
          <p>Live event stream for {range.start} – {range.end} UTC. Historical events load separately. Property values are not shown.</p>
        </div>
      </header>

      <div className={s.liveBar}>
        <span className={s.liveStatus}>
          <span className={s.liveDot} data-paused={connection === 'paused' || connection === 'disconnected' ? 'true' : 'false'} aria-hidden="true" />
          {connection === 'connected' ? 'Connected · events arrive live' : connection === 'reconnecting' ? 'Reconnecting…' : connection === 'disconnected' ? 'Connection interrupted · retrying' : connection === 'paused' ? 'Stream paused' : 'Connecting…'}
          {newCount > 0 && !paused ? ` · ${newCount} new since you opened this page` : ''}
        </span>
        <span className={s.actions}>
          <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? 'Resume stream' : 'Pause stream'}</button>
          <button type="button" onClick={() => void loadHistory().catch(() => setHistoryError('Could not load historical events. Check your connection and refresh.'))}>Refresh history</button>
        </span>
      </div>

      <div className={s.liveFilters}>
        <label>Event <input aria-label="Filter event names" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} placeholder="All events" /></label>
        <label>Path <input aria-label="Filter event paths" value={pathFilter} onChange={(event) => setPathFilter(event.target.value)} placeholder="All pages" /></label>
        <label>Device <select aria-label="Filter device" value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}><option value="">All devices</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option><option value="unknown">Unknown</option></select></label>
        <label>Country <input aria-label="Filter country code" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} placeholder="Any country" maxLength={2} /></label>
      </div>

      {loading ? (
        <div className={s.skeleton} aria-busy="true" role="status"><span className="sr-only">Loading live activity…</span>{[0, 1, 2, 3].map((item) => <i key={item} />)}</div>
      ) : historyError ? (
        <div className={s.error} role="alert"><strong>History unavailable</strong><p>{historyError}</p></div>
      ) : !filteredEvents.length ? (
        <div className={s.empty}>{events.length ? 'No events match these filters.' : 'No events in this range yet. Open your site with the tracker installed and events will appear here.'}</div>
      ) : (
        <ul className={s.eventList}>
          {filteredEvents.map((event) => (
            <li className={s.eventRow} key={event.id}>
              <strong>{eventLabel(event.name)}</strong>
              <span className={s.eventPath} title={event.path}>{event.path}</span>
              <span className={s.eventMeta}>
                {event.device && <span>{event.device}</span>}{event.country && <span>{event.country}</span>}
                <time dateTime={event.occurred_at} title={`${formatUtcStamp(event.occurred_at)} UTC`}>{relativeWhen(event.occurred_at)}</time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
