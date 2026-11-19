import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, CircleDot } from 'lucide-react';
import WaitlistForm from './WaitlistForm';
import s from './waitlist.module.css';

export const metadata: Metadata = {
  title: 'Join the Zappa waitlist',
  description: 'Get an invitation to Zappa, calm, privacy-conscious analytics for independent developers.',
};

const steps = [
  { number: '01', title: 'A note when your invite is ready', detail: 'No launch countdowns or manufactured scarcity.' },
  { number: '02', title: 'A short setup', detail: 'Connect a site and start with real project data.' },
  { number: '03', title: 'Room to shape the product', detail: 'Early feedback goes straight to the person building it.' },
];

export default function WaitlistPage() {
  return (
    <main className={s.page}>
      <a className={s.skip} href="#main">Skip to content</a>
      <header className={s.header}>
        <Link className={s.brand} href="/" aria-label="Zappa home">
          <span className={s.brandMark} aria-hidden="true"><i /><i /><i /></span>
          Zappa<span className={s.brandDot}>.</span>
        </Link>
        <Link className={s.backLink} href="/">
          <ArrowLeft aria-hidden="true" /> Back to Zappa
        </Link>
      </header>

      <section className={s.content} id="main" aria-labelledby="waitlist-title">
        <div className={s.copy}>
          <p className={s.eyebrow}><CircleDot aria-hidden="true" /> EARLY ACCESS</p>
          <h1 id="waitlist-title">Good analytics.<br /><span>Less noise.</span></h1>
          <p className={s.lede}>
            Zappa helps independent developers understand what people do on their sites—without turning every visit into a profile.
          </p>
          <div className={s.formWrap}>
            <p className={s.formHeading}>Get an early-access invite</p>
            <WaitlistForm />
          </div>
          <p className={s.finePrint}>No weekly noise. Your email is used only for Zappa updates.</p>
        </div>

        <aside className={s.preview} aria-label="What to expect">
          <div className={s.previewTop}>
            <span className={s.previewLabel}>A SMALL, USEFUL START</span>
            <span className={s.previewIndex}>C / 01</span>
          </div>
          <div className={s.signal} aria-hidden="true">
            <div className={s.signalRule} />
            <span className={`${s.signalBar} ${s.signalBarOne}`} />
            <span className={`${s.signalBar} ${s.signalBarTwo}`} />
            <span className={`${s.signalBar} ${s.signalBarThree}`} />
            <span className={`${s.signalBar} ${s.signalBarFour}`} />
            <span className={s.signalPoint}><Check /></span>
          </div>
          <ol className={s.steps}>
            {steps.map((step) => (
              <li key={step.number}>
                <span className={s.stepNumber}>{step.number}</span>
                <div><strong>{step.title}</strong><p>{step.detail}</p></div>
                <ArrowUpRight className={s.stepArrow} aria-hidden="true" />
              </li>
            ))}
          </ol>
          <div className={s.previewFoot}>
            <span>BUILT IN THE OPEN</span>
            <a href="https://github.com/AmanSagar0607/Zappa" target="_blank" rel="noreferrer">View the project <ArrowUpRight aria-hidden="true" /></a>
          </div>
        </aside>
      </section>

      <footer className={s.footer}>
        <span>Privacy-minded analytics for the independent web.</span>
        <Link href="/docs">Read the docs <ArrowUpRight aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
