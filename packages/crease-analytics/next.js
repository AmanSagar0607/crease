'use client';
import { useEffect } from 'react';
import { init } from './index.js';

export function Analytics({ projectId, writeKey, endpoint, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;
    const analytics = init({ projectId, writeKey, endpoint });
    return () => analytics.destroy();
  }, [projectId, writeKey, endpoint, enabled]);
  return null;
}
