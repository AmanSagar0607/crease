'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import OverviewV1 from '../dashboard/OverviewV1';
import { createSampleReport } from './sample-report';
import s from './landing-preview.module.css';

export default function LandingProductPreview() {
  const report = useMemo(() => createSampleReport(), []);

  return (
    <section className={s.preview} aria-label="Zappa dashboard preview">
      <div className={s.chrome}>
        <div className={s.windowControls} aria-hidden="true"><i /><i /><i /></div>
        <span className={s.address}>sample-site.example / overview</span>
        <span className={s.sampleBadge}>SAMPLE DATA</span>
      </div>
      <div
        className={s.viewport}
        role="img"
        aria-label="Dashboard preview with illustrative sample data: 1,284 visitors, 1,742 sessions, and 3,906 page views over seven days."
        inert
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
