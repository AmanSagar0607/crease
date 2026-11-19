'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import OverviewV1 from '../dashboard/OverviewV1';
import { createSampleReport } from './sample-report';
import s from './landing-preview.module.css';

const VISITED_KEY = 'zappa:landing-dashboard-preview-seen:v1';

export default function LandingProductPreview() {
  const report = useMemo(() => createSampleReport(), []);
  const previewRef = useRef<HTMLElement>(null);
  const [animateEntrance, setAnimateEntrance] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    try {
      if (window.localStorage.getItem(VISITED_KEY)) return;
    } catch {
      // Storage can be disabled; the animation still runs for this page view.
    }

    const element = previewRef.current;
    if (!element) return;

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      setAnimateEntrance(true);
      try {
        window.localStorage.setItem(VISITED_KEY, '1');
      } catch {
        // Keep the entrance animation available for this page view.
      }
    };

    if (!('IntersectionObserver' in window)) {
      start();
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        start();
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={previewRef} className={`${s.preview}${animateEntrance ? ` ${s.isEntering}` : ''}`} aria-label="Zappa dashboard preview">
      <div className={s.chrome}>
        <div className={s.windowControls} aria-hidden="true"><i /><i /><i /></div>
        <span className={s.address}>sample-site.example / overview</span>
        <span className={s.sampleBadge}>SAMPLE DATA</span>
      </div>
      <div
        className={s.viewport}
        role="region"
        aria-label="Scrollable sample analytics dashboard. Use the mouse wheel or arrow keys to explore the chart and report."
        tabIndex={0}
      >
        <div className={s.report}>
          <OverviewV1
            report={report}
            loading={false}
            error=""
            onRetry={() => undefined}
            model="last_non_direct"
            conversionEvent="signup"
            filtered={false}
            previewMotion={animateEntrance}
            onNavigate={() => window.location.assign('/v0-preview')}
          />
        </div>
      </div>
      <div className={s.previewFoot}>
        <p>Illustrative sample data only. No customer analytics are shown.</p>
        <Link href="/v0-preview">Open dashboard preview <ArrowUpRight aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
