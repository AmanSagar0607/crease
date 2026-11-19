import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ShieldCheck } from 'lucide-react';
import Countdown from './Countdown';
import WaitlistForm from './WaitlistForm';
import s from './waitlist.module.css';

export const metadata: Metadata = {
  title: 'Join the Zappa waitlist',
  description: 'Get early access to Zappa, privacy-conscious analytics for independent developers.',
};

export default function WaitlistPage() {
  const launchDate = process.env.NEXT_PUBLIC_ZAPPA_LAUNCH_DATE;
  const launchAt = launchDate ? new Date(launchDate).getTime() : Number.NaN;
  const badge = Number.isFinite(launchAt) && launchAt > Date.now()
    ? `Coming soon in ${new Date(launchAt).getUTCFullYear()}`
    : 'Early access';

  return (
    <main className={s.page}>
      <a className={s.skip} href="#main">Skip to content</a>
      <section className={s.card} id="main" aria-labelledby="waitlist-title">
        <Link className={s.brand} href="/" aria-label="Zappa home">
          <span className={s.logo} aria-hidden="true"><i /><i /><i /></span>
          <span>Zappa<span className={s.brandDot}>.</span></span>
        </Link>

        <p className={s.badge}><span className={s.badgeDot} aria-hidden="true" /> {badge}</p>
        <h1 id="waitlist-title" className={s.title}>Join the waitlist</h1>
        <p className={s.lede}>A clearer view of your website is on the way. Get a note when Zappa opens early access.</p>

        <div className={s.formSection}>
          <WaitlistForm />
        </div>

        <div className={s.trust}>
          <span className={s.trustIcon}><ShieldCheck aria-hidden="true" /></span>
          <p><strong>For the independent web</strong><span>Consent-first analytics. Only occasional launch updates.</span></p>
          <Check className={s.trustCheck} aria-hidden="true" />
        </div>

        <Countdown target={launchDate} />

      </section>
    </main>
  );
}
