'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ThemeToggle from '../theme-toggle';
import s from './login.module.css';

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.16c-3.1.67-3.7-1.3-3.7-1.3-.5-1.27-1.22-1.6-1.22-1.6-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.2 3.2.92.1-.72.38-1.2.7-1.48-2.47-.28-5.07-1.24-5.07-5.5 0-1.22.43-2.21 1.14-3-.11-.28-.5-1.41.1-2.94 0 0 .94-.3 3.08 1.14a10.6 10.6 0 0 1 5.6 0c2.14-1.44 3.08-1.14 3.08-1.14.6 1.53.22 2.66.1 2.94.71.79 1.14 1.78 1.14 3 0 4.27-2.6 5.21-5.08 5.49.39.34.74 1 .74 2.02v3c0 .3.2.64.77.53A11.1 11.1 0 0 0 12 .9Z" />
    </svg>
  );
}

function Ghost() {
  return (
    <svg className={s.ghost} viewBox="0 0 80 72" role="presentation" aria-hidden="true" focusable="false">
      <path
        d="M8 36C8 16 24 4 40 4s32 12 32 32v26c0 4-4 6-7 3l-6-5-6 5c-2 2-5 2-7 0l-6-5-6 5c-2 2-5 2-7 0l-6-5-6 5c-3 3-7 1-7-3V36z"
        fill="#ffffff"
      />
      <ellipse cx="29" cy="34" rx="4" ry="6.5" fill="#111111" />
      <ellipse cx="51" cy="34" rx="4" ry="6.5" fill="#111111" />
    </svg>
  );
}

const navItems = ['Overview', 'Visitors', 'Pages', 'Referrers', 'Countries', 'Events'];
const projectItems = ['Installation', 'Integrations', 'Settings'];
const bars = [34, 48, 40, 62, 52, 70, 58, 76, 66, 84, 72, 90, 78, 96];
const metrics = [
  ['Visitors', '1,284', '+18%'],
  ['Page views', '3,410', '+22%'],
  ['Sessions', '1,902', '+11%'],
  ['Events', '5,876', '+31%'],
];
const topPages = [
  ['/', '612'],
  ['/writing/quiet-software', '388'],
  ['/docs', '241'],
  ['/pricing', '187'],
];

export default function LoginView() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => {
        if (!cancelled && response.ok) router.replace('/dashboard');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className={s.page}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>

      <div className={s.left}>
        <div className={s.topbar}>
          <ThemeToggle />
          <Link className={s.plans} href="/#pricing">
            See plans
          </Link>
        </div>

        <main className={s.formWrap} id="main">
          <Link className={s.brand} href="/">
            <span className={s.brandMark} aria-hidden="true">
              ✳
            </span>
            crease
          </Link>

          <h1 className={s.title}>Sign in</h1>

          <a className={s.githubButton} href="/api/auth/github">
            <GitHubMark />
            Continue with GitHub
          </a>

          <p className={s.note}>No password needed. We use your GitHub account.</p>

          <div className={s.access}>
            <span className={s.accessTitle}>SIGN-IN ACCESS</span>
            <p>
              We read your public GitHub profile only. Repository access is requested separately when you install the
              Crease GitHub App.
            </p>
          </div>
        </main>

        <footer className={s.legal}>
          <Link href="/docs">Docs</Link>
          <a href="https://github.com/AmanSagar0607/crease">Open source</a>
          <span>© 2026 Crease</span>
        </footer>
      </div>

      <aside className={s.preview}>
        <div className={s.previewHead}>
          <h2>A quiet analytics workspace for the things you make.</h2>
          <p>Sign in with GitHub, connect a site, and see what people actually do — nothing more.</p>
        </div>

        <div className={s.mock} aria-hidden="true">
          <div className={s.mockTop}>
            <span className={s.mockDots}>
              <i />
              <i />
              <i />
            </span>
            <span className={s.mockUrl}>amsagar.in / overview</span>
          </div>

          <div className={s.mockBody}>
            <div className={s.mockSide}>
              <div className={s.mockBrand}>
                <span className={s.mockBrandMark}>✳</span>
                crease
              </div>
              <div className={s.mockNav}>
                {navItems.map((item, index) => (
                  <span className={index === 0 ? s.active : undefined} key={item}>
                    {item}
                  </span>
                ))}
              </div>
              <div className={s.mockLabel}>PROJECT</div>
              <div className={s.mockNav}>
                {projectItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div className={s.mockMain}>
              <div className={s.mockHead}>
                <div>
                  <h3>Overview</h3>
                  <p>Last 30 days · amsagar.in</p>
                </div>
                <span className={s.mockBadge}>PREVIEW</span>
              </div>

              <div className={s.mockMetrics}>
                {metrics.map(([label, value, delta]) => (
                  <div className={s.mockMetric} key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <em>{delta} vs last period</em>
                  </div>
                ))}
              </div>

              <div className={s.mockChart}>
                <div className={s.mockChartTop}>
                  <span>Visitors over time</span>
                  <span>1,284 total</span>
                </div>
                <div className={s.mockBars}>
                  {bars.map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>

              <div className={s.mockRows}>
                {topPages.map(([path, count]) => (
                  <div className={s.mockRow} key={path}>
                    <span>{path}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Ghost />
      </aside>
    </div>
  );
}
