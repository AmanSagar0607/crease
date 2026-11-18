import Link from 'next/link';
import ThemeToggle from './theme-toggle';
import PlatformLogo, { platforms } from './platform-logos';
import LivingCat from './mascot/living-cat';
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
    body: 'Connect a repository and Crease opens a small, reviewable pull request. Nothing merges until you merge it.',
  },
];

const faqs = [
  {
    q: 'Is Crease really free?',
    a: 'Yes. Hosted Crease is free for unlimited projects while it is in early access. If paid plans arrive later, existing projects will hear about it well before anything changes.',
  },
  {
    q: 'Do I have to change my site’s code?',
    a: 'You add one script tag, or connect your GitHub repository and Crease opens a small, reviewable pull request. Nothing is merged automatically — you review and merge it yourself.',
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
    a: 'Crease is built to collect as little as possible, but compliance depends on where you and your visitors are. The tracker waits for a crease:consent event if you need one, and the docs explain the trade-offs honestly.',
  },
  {
    q: 'Can I use my own domain?',
    a: 'Yes. Crease checks the hostname configured for your project and accepts its www counterpart. Your site keeps its own domain; the tracker simply sends events to the collector.',
  },
  {
    q: 'Who is building Crease?',
    a: 'Aman, an independent developer. Crease is open source on GitHub, and the roadmap is shaped by the people using it.',
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

const sideItems = ['Visitors', 'Pages', 'Referrers', 'Countries', 'Events'];

export default function Home() {
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
            <a href="#how">How it works</a>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/waitlist">Early access</Link>
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
        <section className={s.hero}>
          <Ghost className={s.ghostHero} />
          <h1>
            Analytics for the
            <br />
            things you make.
          </h1>
          <p className={s.heroLead}>
            A quiet analytics workspace for independent developers. Sign in with GitHub,
            connect a site, and see what people actually do — nothing more.
          </p>
          <div className={s.heroActions}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href="/waitlist">
              Join the waitlist <span aria-hidden="true">↗</span>
            </Link>
            <a className={`${s.btn} ${s.btnSecondary}`} href="#how">
              <span aria-hidden="true">+</span> See how it works
            </a>
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

        <section className={s.mockWrap} aria-label="Crease analytics dashboard preview">
          <Ghost className={s.ghostMock} />
          <div className={s.catPerch}>
            <LivingCat variant="hero" listen />
          </div>
          <div className={s.mockPanel}>
            <div className={s.window}>
              <div className={s.windowTop}>
                <div className={s.dots} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className={s.windowUrl}>your-site.com / overview</span>
              </div>
              <div className={s.mockBody}>
                <aside className={s.sidebar} aria-hidden="true">
                  <div className={s.workspace}>
                    <span>✳</span>
                    <div>
                      your-site.com
                      <em>project preview</em>
                    </div>
                  </div>
                  <ul className={s.sideNav}>
                    <li className={s.active}>
                      Overview
                      <span className={s.count}>01</span>
                    </li>
                    {sideItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className={s.sideLabel}>Project</p>
                  <ul className={s.sideNav}>
                    <li>Installation</li>
                    <li>Integrations</li>
                    <li>Settings</li>
                  </ul>
                </aside>

                <div className={s.mockMain} aria-hidden="true">
                  <div className={s.mockHead}>
                    <div>
                      <h3>Overview</h3>
                      <small>Project overview</small>
                    </div>
                    <span className={s.previewChip}>
                      PREVIEW <strong>02</strong>
                    </span>
                  </div>

                  <div className={s.metrics}>
                    {['Visitors', 'Page views', 'Sessions', 'Events'].map((label, index) => (
                      <div className={s.metric} key={label}>
                        <span>{label}<em>0{index + 1}</em></span>
                        <strong aria-label="Project data appears after setup">—</strong>
                        <small>From your project</small>
                      </div>
                    ))}
                  </div>

                  <div className={s.chartCard}>
                    <div className={s.chartHead}>
                      <b>Visitors over time</b>
                      <span>Project data only</span>
                    </div>
                    <div className={s.bars}>Real activity appears here after tracking is verified.</div>
                  </div>

                  <div className={s.mockLower}>
                    <div className={s.listCard}><h4>Top pages</h4><p>Real pages from your project appear here.</p></div>
                    <div className={s.listCard}><h4>Referrers</h4><p>Observed sources appear here after tracking starts.</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={s.toast}>
            <i aria-hidden="true" />
            Setup preview
            <Link href="/docs">View docs</Link>
          </div>
        </section>

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
              <p>With Crease</p>
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
                <p>Crease inspects the default branch and prepares the change.</p>
              </div>
            </div>

            <div>
              <div className={s.stepPanel}>
                <div className={s.miniCard}>
                  <div className={s.prHead}>
                    Add Crease tracking
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
            <article className={s.priceCard}>
              <span className={s.priceName}>Free</span>
              <div className={s.price}>
                <strong>$0</strong>
                <span>/ month</span>
              </div>
              <p className={s.priceDesc}>Hosted analytics for every project you ship.</p>
              <div className={s.priceFeatures}>
                <span>Unlimited projects</span>
                <span>All analytics</span>
                <span>1–90 day retention</span>
                <span>GitHub installation PR</span>
              </div>
              <Link className={`${s.btn} ${s.btnSecondary}`} href="/dashboard">
                Start free
              </Link>
            </article>

            <article className={s.priceCard}>
              <span className={s.priceName}>Open source</span>
              <div className={s.price}>
                <strong>$0</strong>
                <span>/ forever</span>
              </div>
              <p className={s.priceDesc}>Run the same stack on your own Postgres.</p>
              <div className={s.priceFeatures}>
                <span>FastAPI + Postgres</span>
                <span>Tracker and npm package</span>
                <span>No vendor lock-in</span>
                <span>Apache-2.0 source</span>
              </div>
              <a className={`${s.btn} ${s.btnSecondary}`} href={repo}>
                Read the source
              </a>
            </article>

            <article className={`${s.priceCard} ${s.priceFeatured}`}>
              <span className={s.priceName}>Early access</span>
              <div className={s.price}>
                <strong>$0</strong>
                <span>/ month</span>
              </div>
              <p className={s.priceDesc}>Everything now, and a say in what ships next.</p>
              <div className={s.priceFeatures}>
                <span>Vercel integration</span>
                <span>A direct line to the founder</span>
                <span>Early access to new features</span>
                <span>Input on the roadmap</span>
              </div>
              <Link className={`${s.btn} ${s.btnPrimary}`} href="/dashboard">
                Open dashboard
              </Link>
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
                Here is what Crease actually does.
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
              I built Crease because I wanted a quieter way to know if the things I ship are
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
              <Link className={`${s.btn} ${s.btnPrimary}`} href="/dashboard">
                Open dashboard <span aria-hidden="true">↗</span>
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
              crease
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
