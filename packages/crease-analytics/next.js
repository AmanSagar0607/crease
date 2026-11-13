'use client';
import { useEffect } from 'react';
import { init } from './index.js';

export function Analytics({ projectId, endpoint, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;
    const analytics = init({ projectId, endpoint });
    return () => analytics.destroy();
  }, [projectId, endpoint, enabled]);
  return null;
}
