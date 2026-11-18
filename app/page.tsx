import Link from 'next/link';
import PlatformLogo, { platforms } from './platform-logos';
import LandingNav from './landing-nav';
import InstallSnippet from './install-snippet';
import LandingProductPreview from './v0-preview/LandingProductPreview';
import s from './landing.module.css';

const repo = 'https://github.com/AmanSagar0607/crease';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const principles = [
  {
    label: 'DB',
    category: 'Storage',
    title: 'Your data, your database.',
    body: 'Every event is scoped to your project. You choose a 1–90 day retention window and can delete a project and its data at any time.',
  },
  {
    label: 'JS',
    category: 'Tracker',
    title: 'A tracker you can read.',
    body: 'One small script with no cookies and no fingerprinting. Initialization waits for the consent event you control.',
  },
  {
    label: 'PR',
    category: 'Install',
    title: 'Install by pull request.',
    body: 'Connect a repository and Zappa opens a small, reviewable pull request. Nothing merges until you merge it.',
  },
];

const faqs = [
  {
    q: 'Is Zappa really free?',
    a: 'Yes. Hosted Zappa is free for unlimited projects while it is in early access. If paid plans arrive later, existing projects will hear about it well before anything changes.',
  },
  {
    q: 'Do I have to change my site’s code?',
    a: 'You add one script tag, or connect your GitHub repository and Zappa opens a small, reviewable pull request. Nothing is merged automatically — you review and merge it yourself.',
  },
  {
    q: 'Does it work with Next.js?',
    a: 'Yes. Use the @crease/analytics/next component, the plain ESM package, or the standalone crease.js tracker for any HTML site. The docs show all three.',
  },
  {
    q: 'Where does my data live?',
    a: 'Events are stored in Postgres and scoped to your project. You choose a retention window between 1 and 90 days, and you can delete a project and its data at any time.',
  },
  {
    q: 'Do I need a cookie banner?',
    a: 'Zappa is built to collect as little as possible, but compliance depends on where you and your visitors are. The tracker waits for a crease:consent event if you need one, and the docs explain the trade-offs honestly.',
  },
  {
    q: 'Can I use my own domain?',
    a: 'Yes. Zappa checks the hostname configured for your project and accepts its www counterpart. Your site keeps its own domain; the tracker simply sends events to the collector.',
  },
  {
    q: 'Who is building Zappa?',
    a: 'Aman, an independent developer. Zappa is open source on GitHub, and the roadmap is shaped by the people using it.',
  },
];

function Ghost({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`${s.ghost} ${className}`.trim()}
      viewBox="0 0 80 72"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 36C8 16 24 4 40 4s32 12 32 32v26c0 4-4 6-7 3l-6-5-6 5c-2 2-5 2-7 0l-6-5-6 5c-2 2-5 2-7 0l-6-5-6 5c-3 3-7 1-7-3V36z"
        fill="#ffffff"
        stroke="#E9E7E2"
      />
      <ellipse cx="29" cy="34" rx="4" ry="6.5" fill="#111111" />
      <ellipse cx="51" cy="34" rx="4" ry="6.5" fill="#111111" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className={s.landing}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>

      <LandingNav />

      <main id="main">
        <section className={s.hero}>
          <p className={s.heroEyebrow}><span aria-hidden="true" />Independent analytics · Open source</p>
          <h1>
            Analytics for the
            <br />
            things you make.
          </h1>
          <p className={s.heroLead}>
            A quiet analytics workspace for independent developers. Create an account,
            connect a site, and see what people actually do — nothing more.
          </p>
          <div className={s.heroActions}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href="/sign-up">
              Start free <span aria-hidden="true">↗</span>
            </Link>
            <Link className={s.heroTextLink} href="/v0-preview">Preview dashboard</Link>
          </div>
          <InstallSnippet />
          <div className={s.trustRow} aria-label="Product attributes">
            <span>Free to start</span><span>Self-hostable</span><span>No cookies by default</span>
          </div>
          <div className={s.logoRow}>
            <span>Works with</span>
            <div className={s.logos} role="img" aria-label="Next.js, React, HTML, GitHub, and Vercel">
              {platforms.map((platform) => (
                <span className={s.logoChip} key={platform.label} aria-hidden="true">
                  <PlatformLogo id={platform.id} />
                </span>
              ))}
            </div>
          </div>
        </section>

        <LandingProductPreview />

        <section className={`${s.section} ${s.shell}`} id="problem">
          <div className={s.problemGrid}>
            <div className={s.problemCopy}>
              <Ghost className={s.ghostProblem} />
              <h2 className={s.h2}>
                You shipped it.
                <br />
                Now you’re guessing.
              </h2>
              <p className={s.lead}>
                The site is live. The post is out. And then the questions start: did anyone
                read it, where did they come from, and which page made them stay?
              </p>
            </div>
            <div className={s.weekPanel}>
              <div className={s.weekRow}>
                <p className={s.weekRowLabel}>Your launch</p>
                <div className={s.week}>
                  {days.map((day) => (
                    <div className={s.day} key={day}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className={s.week} style={{ marginTop: 6 }}>
                  {days.map((day, index) =>
                    index === 0 ? (
                      <div className={s.weekCard} key={day}>
                        <b>Ship the site</b>
                        <span>Day one</span>
                      </div>
                    ) : (
                      <div className={s.weekEmpty} key={day} aria-hidden="true">
                        —
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className={s.weekRow}>
                <p className={s.weekRowLabel}>After tracking starts</p>
                <div className={s.emptyBrowser}>Real visitor activity appears here once your project is verified.</div>
              </div>

              <p className={s.sectionCaption}>Your dashboard uses observed project data—not sample metrics.</p>
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.shell} ${s.center}`} id="compare">
          <h2 className={s.h2}>
            Two ways to spend
            <br />
            the same morning.
          </h2>
          <div className={s.compareGrid}>
            <div className={s.compareCol}>
              <p>Guessing by hand</p>
              <div className={s.comparePanel}>
                <div className={s.browserCard}>
                  <div className={s.browserTabs}>
                    <span className={s.browserTabActive}>GA4</span>
                    <span>Plausible</span>
                    <span>A spreadsheet</span>
                  </div>
                  <div className={s.searchField}>
                    <i aria-hidden="true" />
                    Where did that visitor come from?
                  </div>
                  <div className={s.emptyBrowser}>
                    <b>Three tabs open.</b>
                    <span>Still no answer.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={s.compareCol}>
              <p>With Zappa</p>
              <div className={s.comparePanel}>
                <div className={s.feedCard}>
                  <span className={s.feedBanner}>
                    <i aria-hidden="true" />Live activity preview
                  </span>
                  <div className={s.emptyBrowser}>
                    <b>Live activity</b>
                    <span>See visits as they arrive in your verified project.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className={s.sectionCaption}>
            Connect your site once. The answers come to you. Your data stays yours.
          </p>
        </section>

        <section className={`${s.section} ${s.shell}`} id="how">
          <div className={s.center}>
            <h2 className={s.h2}>
              From a push to a
              <br />
              real answer.
            </h2>
          </div>
          <div className={s.stepsGrid}>
            <div>
              <div className={s.stepPanel}>
                <div className={s.miniCard}>
                  <span className={s.miniLabel}>Your site</span>
                  <div className={s.miniField}>https://your-site.com</div>
                  <span className={s.miniButton}>Create project</span>
                </div>
              </div>
              <div className={s.stepMeta}>
                <h3>
                  <span>1.</span> Paste your URL
                </h3>
                <p>Give the project a domain. That’s the whole setup form.</p>
              </div>
            </div>

            <div>
              <div className={s.stepPanel}>
                <div className={s.miniCard}>
                  <span className={s.miniLabel}>Repository</span>
                  <div className={s.repoRow}>
                    <span className={s.repoMark}>GH</span>
                    <b>amansagar/website</b>
                    <span className={s.repoPill}>Detected</span>
                  </div>
                  <div className={s.checkList}>
                    <span>
                      <i>✓</i> layout.tsx found
                    </span>
                    <span>
                      <i>✓</i> tracker ready to add
                    </span>
                  </div>
                  <span className={`${s.miniButton} ${s.miniButtonLight}`}>
                    Open pull request
                  </span>
                </div>
              </div>
              <div className={s.stepMeta}>
                <h3>
                  <span>2.</span> Connect your repo
                </h3>
                <p>Zappa inspects the default branch and prepares the change.</p>
              </div>
            </div>

            <div>
              <div className={s.stepPanel}>
                <div className={s.miniCard}>
                  <div className={s.prHead}>
                    Add Zappa tracking
                    <span className={s.prDiff}>
                      <span>+2</span>−0
                    </span>
                  </div>
                  <div className={s.prFile}>src/app/layout.tsx</div>
                  <div className={s.prChecks}>
                    <span>
                      <i>✓</i> <b>Preview ready</b>
                    </span>
                    <span>
                      <i>✓</i> No conflicts
                    </span>
                  </div>
                  <span className={s.miniButton}>Merge pull request</span>
                </div>
              </div>
              <div className={s.stepMeta}>
                <h3>
                  <span>3.</span> Review the pull request
                </h3>
                <p>Read the diff, merge when you’re ready. Nothing happens silently.</p>
              </div>
            </div>

            <div>
              <div className={s.stepPanel}>
                <div className={s.miniCard}>
                  <span className={s.miniLabel}>Your project dashboard</span>
                  <p className={s.note}>Real visitors, pages and sources appear after tracking is verified.</p>
                </div>
              </div>
              <div className={s.stepMeta}>
                <h3>
                  <span>4.</span> Watch the numbers land
                </h3>
                <p>Visitors, pages, referrers, countries. One page, no dashboard maze.</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.shell} ${s.center}`} id="pricing">
          <Ghost className={s.ghostPricing} />
          <h2 className={s.h2}>
            Free while it’s early.
            <br />
            Every project, every feature.
          </h2>
          <div className={s.pricingGrid}>
            <article className={`${s.priceCard} ${s.priceFeatured}`}>
              <span className={s.priceName}>Hosted · Early access</span>
              <div className={s.price}>
                <strong>$0</strong>
                <span>while it’s early</span>
              </div>
              <p className={s.priceDesc}>Every analytics feature, for every project you ship. No trial timer or credit card.</p>
              <div className={s.priceFeatures}>
                <span>Unlimited projects</span>
                <span>All analytics</span>
                <span>1–90 day retention</span>
                <span>GitHub installation PR</span>
                <span>Open-source Apache-2.0 core</span>
                <span>Postgres-backed data</span>
              </div>
              <Link className={`${s.btn} ${s.btnPrimary}`} href="/sign-up">Start free</Link>
              <a className={s.priceSourceLink} href={repo}>Self-host from source ↗</a>
            </article>
          </div>
          <p className={s.footnote}>
            No credit card. No trial timer. Paid plans may arrive after early access — existing
            projects will hear first. <Link href="/pricing">See all plan details</Link>.
          </p>
        </section>

        <section className={`${s.section} ${s.shell}`} id="notes">
          <div className={s.testimonialGrid}>
            <div className={s.testimonialIntro}>
              <Ghost className={s.ghostTestimonial} />
              <h2 className={s.h2}>Built in the open.</h2>
              <p className={s.lead}>
                A small, honest product: no growth team, no dark patterns, no borrowed logos.
                Here is what Zappa actually does.
              </p>
              <span className={s.badge}>
                <i aria-hidden="true" />
                Apache-2.0 source
              </span>
              <div className={s.avatars}>
                <span className={s.avatarStack} aria-hidden="true">
                  {['DB', 'JS', 'PR'].map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </span>
                Independent and self-hostable
              </div>
            </div>

            <div className={s.quotes}>
              {principles.map((item) => (
                <article className={s.quote} key={item.title}>
                  <p>
                    <strong>{item.title}</strong> {item.body}
                  </p>
                  <footer>
                    <span aria-hidden="true">{item.label}</span>
                    {item.category}
                  </footer>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.shellNarrow}`} id="faq">
          <h2 className={`${s.h2} ${s.center}`}>FAQ</h2>
          <div className={s.faqList}>
            {faqs.map((item) => (
              <details className={s.faqItem} key={item.q}>
                <summary>
                  {item.q}
                  <span className={s.faqPlus} aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className={s.faqAnswer}>{item.a}</div>
              </details>
            ))}
          </div>
        </section>

        <section className={s.cta}>
          <Ghost className={s.ghostCta} />
          <div className={s.ctaInner}>
            <p className={s.founderNote}>
              I built Zappa because I wanted a quieter way to know if the things I ship are
              working. No dashboards to configure, no numbers to perform for. Just a clear look
              at what people do when they arrive.
              <span className={s.signature}>— Aman</span>
            </p>
            <h2>
              Open the dashboard.
              <br />
              See your own data before lunch.
            </h2>
            <div className={s.ctaActions}>
              <Link className={`${s.btn} ${s.btnPrimary}`} href="/sign-up">
                Start free <span aria-hidden="true">↗</span>
              </Link>
              <a className={`${s.btn} ${s.btnGhost}`} href={repo}>
                Read the source
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div>
            <Link className={s.footerBrand} href="/">
              <span aria-hidden="true">✳</span>
              Zappa
            </Link>
            <p className={s.footerTagline}>Analytics for the things you make.</p>
          </div>
          <div className={s.footerCol}>
            <h3>Product</h3>
            <ul>
              <li>
                <a href="#how">How it works</a>
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
              Zappa is an independent project. Your data belongs to you, and you can delete it
              whenever you like. Built in the open, without a growth team.
            </p>
          </div>
        </div>
        <div className={s.footerBottom}>
          <span>© 2026 Zappa</span>
          <span>Made for the things you make.</span>
        </div>
      </footer>
    </div>
  );
}
