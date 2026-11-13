import type { Metadata } from 'next';
import Link from 'next/link';
import ThemeToggle from '../theme-toggle';
import p from './pricing.module.css';
import s from '../landing.module.css';

export const metadata: Metadata = {
  title: 'Pricing — Crease',
  description:
    'One project free forever. Unlimited projects during early access. Self-host the whole thing with Apache-2.0 source.',
};

const repo = 'https://github.com/AmanSagar0607/crease';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/ project',
    description: 'For the first site, or the forty-first side project.',
    features: [
      '1 project',
      'All analytics',
      '1–90 day retention',
      'GitHub installation PR',
      'Community support',
    ],
    action: { label: 'Start free', href: '/dashboard', style: 'secondary' },
  },
  {
    name: 'Early access',
    price: '$0',
    period: '/ month',
    description: 'Everything Crease can do, while it’s still young.',
    features: [
      'Unlimited projects',
      'All analytics',
      'Vercel integration',
      'A direct line to the founder',
      'Early access to new features',
    ],
    action: { label: 'Open dashboard', href: '/dashboard', style: 'primary' },
    featured: true,
  },
  {
    name: 'Self-host',
    price: '$0',
    period: '/ forever',
    description: 'Run the whole thing on your own Postgres.',
    features: [
      'FastAPI + Postgres',
      'Tracker and npm package',
      'No vendor lock-in',
      'Apache-2.0 source',
      'Deploy anywhere',
    ],
    action: { label: 'Read the source', href: repo, style: 'secondary' },
  },
] as const;

const comparison = [
  { label: 'Projects', free: '1', early: 'Unlimited', self: 'Unlimited' },
  { label: 'Page views and custom events', free: 'Included', early: 'Included', self: 'Included' },
  { label: 'Retention', free: '1–90 days', early: '1–90 days', self: 'Your database' },
  { label: 'GitHub installation PR', free: 'Included', early: 'Included', self: 'Included' },
  { label: 'Vercel integration', free: '—', early: 'Included', self: 'Included' },
  { label: 'Self-host', free: '—', early: '—', self: 'Included' },
  { label: 'Support', free: 'Community', early: 'Direct line to the founder', self: 'Community' },
];

const faqs = [
  {
    q: 'Is Crease really free?',
    a: 'Yes. One project is free forever, and every plan is free while Crease is in early access. If paid plans arrive later, existing projects will hear about it well before anything changes.',
  },
  {
    q: 'Do I need a credit card?',
    a: 'No. There is no card field, no trial timer, and no automatic upgrade. You can use Crease for as long as it is useful to you.',
  },
  {
    q: 'What happens when early access ends?',
    a: 'Existing projects will be told exactly what changes before it happens. Nothing switches to a paid plan silently, and the free single-project plan stays free.',
  },
  {
    q: 'Can I self-host Crease?',
    a: 'Yes. The source is Apache-2.0 and runs on FastAPI and Postgres. The repository includes setup notes for running the collector, dashboard, and database yourself.',
  },
  {
    q: 'What counts as a project?',
    a: 'One site or app with its own domain. The free plan covers one project; early access lifts the limit so you can add every side project you ship.',
  },
  {
    q: 'How long do you keep data?',
    a: 'You choose a retention window between 1 and 90 days for each project. Deleting a project deletes its events as well.',
  },
];

function Check() {
  return (
    <svg className={p.check} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m3.5 8.4 2.9 2.9 6.1-6.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Pricing() {
  return (
    <div className={s.landing}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>

      <div className={s.navWrap}>
        <nav className={s.nav} aria-label="Main navigation">
          <Link className={s.brand} href="/">
            <span className={s.brandMark} aria-hidden="true">
              ✳
            </span>
            crease
          </Link>
          <div className={s.navLinks}>
            <Link href="/#how">How it works</Link>
            <Link className={p.navActive} href="/pricing" aria-current="page">
              Pricing
            </Link>
            <Link href="/docs">Docs</Link>
          </div>
          <div className={s.navEnd}>
            <ThemeToggle />
            <Link className={s.navAction} href="/dashboard">
              Open dashboard
            </Link>
          </div>
        </nav>
      </div>

      <main id="main">
        <section className={p.hero}>
          <span className={p.eyebrow}>PRICING</span>
          <h1 className={p.heroTitle}>
            Free while it’s early.
            <br />
            Free for one project, always.
          </h1>
          <p className={p.heroLead}>
            One project is free forever. During early access, every plan is free too. When paid
            plans arrive, existing projects will hear about it well before anything changes.
          </p>
          <div className={p.heroActions}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href="/dashboard">
              Open dashboard <span aria-hidden="true">↗</span>
            </Link>
            <a className={`${s.btn} ${s.btnSecondary}`} href={repo}>
              Read the source
            </a>
          </div>
          <p className={p.heroNote}>No credit card. No trial timer. No sales call.</p>
        </section>

        <section className={p.plans} aria-label="Plans">
          <div className={p.plansGrid}>
            {plans.map((plan) => (
              <article
                className={`${p.plan} ${'featured' in plan && plan.featured ? p.planFeatured : ''}`}
                key={plan.name}
              >
                <div className={p.planTop}>
                  <span className={p.planName}>{plan.name}</span>
                  {'featured' in plan && plan.featured && (
                    <span className={p.planBadge}>Recommended</span>
                  )}
                </div>
                <div className={p.planPrice}>
                  <strong>{plan.price}</strong>
                  <span>{plan.period}</span>
                </div>
                <p className={p.planDesc}>{plan.description}</p>
                <ul className={p.planFeatures}>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.action.href.startsWith('http') ? (
                  <a
                    className={`${s.btn} ${
                      plan.action.style === 'primary' ? s.btnPrimary : s.btnSecondary
                    } ${p.planAction}`}
                    href={plan.action.href}
                  >
                    {plan.action.label}
                  </a>
                ) : (
                  <Link
                    className={`${s.btn} ${
                      plan.action.style === 'primary' ? s.btnPrimary : s.btnSecondary
                    } ${p.planAction}`}
                    href={plan.action.href}
                  >
                    {plan.action.label}
                  </Link>
                )}
              </article>
            ))}
          </div>
          <p className={p.guarantee}>
            No credit card. No trial timer. Paid plans may arrive after early access — existing
            projects will hear first.
          </p>
        </section>

        <section className={p.compare} aria-labelledby="compare-title">
          <span className={p.eyebrow}>WHAT’S INCLUDED</span>
          <h2 className={p.compareTitle} id="compare-title">
            The same product in every plan.
          </h2>
          <p className={p.compareLead}>
            Every plan includes the full analytics product. The difference is how many projects
            you run and how much of it you host yourself.
          </p>
          <div className={p.tableWrap}>
            <table className={p.table}>
              <thead>
                <tr>
                  <th scope="col">Included</th>
                  <th scope="col">Free</th>
                  <th scope="col">Early access</th>
                  <th scope="col">Self-host</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td data-label="Free">{row.free}</td>
                    <td data-label="Early access">{row.early}</td>
                    <td data-label="Self-host">{row.self}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={p.faq} id="faq" aria-labelledby="faq-title">
          <span className={p.eyebrow}>FAQ</span>
          <h2 className={p.compareTitle} id="faq-title">
            Pricing questions.
          </h2>
          <div className={p.faqList}>
            {faqs.map((item) => (
              <details className={p.faqItem} key={item.q}>
                <summary className={p.faqSummary}>
                  {item.q}
                  <span className={p.faqPlus} aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className={p.faqAnswer}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={p.cta}>
          <h2>
            Open the dashboard.
            <br />
            See your own data before lunch.
          </h2>
          <div className={p.ctaActions}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href="/dashboard">
              Open dashboard <span aria-hidden="true">↗</span>
            </Link>
            <a className={`${s.btn} ${s.btnGhost}`} href={repo}>
              Read the source
            </a>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div>
            <Link className={s.footerBrand} href="/">
              <span aria-hidden="true">✳</span>
              crease
            </Link>
            <p className={s.footerTagline}>Analytics for the things you make.</p>
          </div>
          <div className={s.footerCol}>
            <h3>Product</h3>
            <ul>
              <li>
                <Link href="/#how">How it works</Link>
              </li>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/docs">Documentation</Link>
              </li>
              <li>
                <Link href="/dashboard">Dashboard</Link>
              </li>
            </ul>
          </div>
          <div className={s.footerCol}>
            <h3>Project</h3>
            <ul>
              <li>
                <a href={repo}>GitHub</a>
              </li>
              <li>
                <a href="https://github.com/AmanSagar0607/crease/issues">Issues</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>
          </div>
          <div>
            <p className={s.footerLegal}>
              Crease is an independent project. Your data belongs to you, and you can delete it
              whenever you like. Built in the open, without a growth team.
            </p>
          </div>
        </div>
        <div className={s.footerBottom}>
          <span>© 2026 Crease</span>
          <span>Made for the things you make.</span>
        </div>
      </footer>
    </div>
  );
}
