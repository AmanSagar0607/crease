'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { eventLabel, formatUtcStamp, type Range } from './reporting';
import s from './sections.module.css';

type LiveEvent = { id: string; name: string; path: string; occurred_at: string };

const POLL_MS = 15000;

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

/**
 * Near-real-time activity: polls the recent-events endpoint while visible.
 * This is a poll of the newest stored events, not a live server stream.
 */
export default function LiveActivity({ projectId, range }: { projectId: string; range: Range }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({ days: '30', limit: '25', start: range.start, end: range.end });
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/events?${params}`, {
          credentials: 'same-origin',
          signal,
        });
        if (!res.ok) throw new Error(`Activity unavailable (${res.status}).`);
        const rows = (await res.json()) as LiveEvent[];
        if (signal?.aborted) return;
        if (!seeded.current) {
          seeded.current = true;
          rows.forEach((event) => seen.current.add(event.id));
          setNewCount(0);
        } else {
          const fresh = rows.filter((event) => !seen.current.has(event.id)).length;
          rows.forEach((event) => seen.current.add(event.id));
          if (fresh) setNewCount((value) => value + fresh);
        }
        setEvents(rows);
        setUpdatedAt(new Date().toISOString());
        setError('');
      } catch (reason) {
        if (signal?.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Activity unavailable.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [projectId, range.start, range.end],
  );

  useEffect(() => {
    const controller = new AbortController();
    seeded.current = false;
    setNewCount(0);
    setLoading(true);
    setEvents([]);
    void load(controller.signal);
    return () => controller.abort();
  }, [load, attempt]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [paused, load]);

  return (
    <section className={s.section} aria-label="Live activity">
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>LIVE ACTIVITY</span>
          <h2>Newest events as they arrive</h2>
          <p>
            Polled from the events endpoint every {POLL_MS / 1000} seconds for {range.start} – {range.end} UTC. Event
            names and paths only — property values are not shown here.
          </p>
        </div>
      </header>

      <div className={s.liveBar}>
        <span className={s.liveStatus}>
          <span className={s.liveDot} data-paused={paused ? 'true' : 'false'} aria-hidden="true" />
          {paused
            ? 'Polling paused'
            : updatedAt
              ? `Updated ${relativeWhen(updatedAt)} · next check in ${POLL_MS / 1000}s`
              : 'Connecting…'}
          {newCount > 0 && !paused ? ` · ${newCount} new since you opened this page` : ''}
        </span>
        <span className={s.actions}>
          <button type="button" onClick={() => setPaused((value) => !value)}>
            {paused ? 'Resume polling' : 'Pause polling'}
          </button>
          <button type="button" onClick={() => void load()}>
            Refresh now
          </button>
        </span>
      </div>

      {loading ? (
        <div className={s.skeleton} aria-busy="true" role="status">
          <span className="sr-only">Loading live activity…</span>
          {[0, 1, 2, 3].map((item) => (
            <i key={item} />
          ))}
        </div>
      ) : error ? (
        <div className={s.error} role="alert">
          <strong>Could not load activity</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : !events.length ? (
        <div className={s.empty}>
          No events in this range yet. Open your site with the tracker installed and events will appear here within a
          few seconds.
        </div>
      ) : (
        <ul className={s.eventList}>
          {events.map((event) => (
            <li className={s.eventRow} key={event.id}>
              <strong>{eventLabel(event.name)}</strong>
              <span className={s.eventPath} title={event.path}>
                {event.path}
              </span>
              <span className={s.eventMeta}>
                <time dateTime={event.occurred_at} title={`${formatUtcStamp(event.occurred_at)} UTC`}>
                  {relativeWhen(event.occurred_at)}
                </time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
