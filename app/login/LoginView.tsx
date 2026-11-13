'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import s from '../dashboard/dashboard.module.css';

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className ?? s.icon}>
      <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.16c-3.1.67-3.7-1.3-3.7-1.3-.5-1.27-1.22-1.6-1.22-1.6-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.2 3.2.92.1-.72.38-1.2.7-1.48-2.47-.28-5.07-1.24-5.07-5.5 0-1.22.43-2.21 1.14-3-.11-.28-.5-1.41.1-2.94 0 0 .94-.3 3.08 1.14a10.6 10.6 0 0 1 5.6 0c2.14-1.44 3.08-1.14 3.08-1.14.6 1.53.22 2.66.1 2.94.71.79 1.14 1.78 1.14 3 0 4.27-2.6 5.21-5.08 5.49.39.34.74 1 .74 2.02v3c0 .3.2.64.77.53A11.1 11.1 0 0 0 12 .9Z" />
    </svg>
  );
}

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
    <div className={s.dashboard}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>

      <header className={s.header}>
        <div className={s.headerInner}>
          <Link className={s.brand} href="/">
            <span className={s.brandMark}>✳</span>
            crease.
          </Link>
          <span className={s.headerDivider} aria-hidden="true" />
          <span className={s.workspaceLabel}>SIGN IN</span>
          <div className={s.account}>
            <Link className={s.headerLink} href="/docs">
              Docs
            </Link>
          </div>
        </div>
      </header>

      <main className={`${s.main} ${s.loginMain}`} id="main">
        <div className={s.authWrap}>
          <section className={s.authCopy}>
            <p className={s.eyebrow}>YOUR ANALYTICS WORKSPACE</p>
            <h1>
              Sign in to
              <br />
              <span className={s.muted}>Crease.</span>
            </h1>
            <p>
              Crease uses GitHub as its only sign-in method. Authorize once to open your workspace, create projects, and
              connect the repositories you want to measure.
            </p>
            <div className={s.authActions}>
              <a className={`${s.btn} ${s.btnPrimary}`} href="/api/auth/github">
                <GitHubMark className={s.icon} />
                Continue with GitHub
              </a>
            </div>
            <p className={s.authNote}>
              Sign-in reads your public GitHub profile only. Repository access is requested separately when you install
              the Crease GitHub App.
            </p>
          </section>

          <aside className={s.authPreview} aria-label="Example analytics preview">
            <div className={s.authPreviewInner}>
              <div className={s.authPreviewTop}>
                <strong>crease.app</strong>
                <span>LIVE PREVIEW</span>
              </div>
              <div className={s.previewMetrics}>
                {[
                  ['Visitors', '4,182'],
                  ['Page views', '9,406'],
                  ['Sessions', '5,731'],
                ].map(([label, value]) => (
                  <div className={s.previewMetric} key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className={s.authPreviewFoot}>
                <span>Last 30 days</span>
                <span>2.4 pages / session</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span>CREASE / YOUR WORK, UNDERSTOOD</span>
          <div className={s.footerLinks}>
            <Link href="/docs">DOCS</Link>
            <a href="https://github.com/AmanSagar0607/crease">OPEN SOURCE</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
