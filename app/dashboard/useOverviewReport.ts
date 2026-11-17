'use client';

import { useEffect, useState } from 'react';
import type { AttributionModel, Range, Report } from './reporting';

type Options = {
  projectId: string;
  range: Range | null;
  model: AttributionModel;
  conversionEvent: string;
  refresh: number;
  /** Skip the request entirely (used for on-demand comparisons). */
  enabled?: boolean;
};

/** Fetches the shared UTC overview report used by Overview, Acquisition, Campaigns and Pages. */
export default function useOverviewReport({ projectId, range, model, conversionEvent, refresh, enabled = true }: Options) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const start = range?.start ?? '';
  const end = range?.end ?? '';
  const active = enabled && Boolean(projectId && start && end);

  useEffect(() => {
    if (!active) {
      setReport(null);
      setLoading(false);
      setError('');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setReport(null);
    const params = new URLSearchParams({ start, end, model });
    if (conversionEvent) params.set('conversion_event', conversionEvent);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/overview?${params}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Overview unavailable (${res.status}).`);
        return res.json() as Promise<Report>;
      })
      .then((data) => {
        if (!controller.signal.aborted) setReport(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Overview unavailable.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, start, end, model, conversionEvent, refresh, active, attempt]);

  return { report, loading, error, retry: () => setAttempt((value) => value + 1) };
}
