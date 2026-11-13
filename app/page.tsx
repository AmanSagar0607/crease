import Link from 'next/link';
import ThemeToggle from './theme-toggle';
import PlatformLogo, { platforms } from './platform-logos';
import s from './landing.module.css';

const repo = 'https://github.com/AmanSagar0607/crease';

const bars = [38, 50, 42, 58, 47, 68, 55, 63, 78, 67, 85, 76, 92, 100];

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const weekDays = [
  { value: 18, spark: [34, 58, 46, 82] },
  { value: 24, spark: [46, 72, 58, 94] },
  { value: 15, spark: [28, 50, 40, 70] },
  { value: 31, spark: [62, 88, 74, 100] },
  { value: 22, spark: [42, 68, 54, 86] },
  { value: 12, spark: [22, 40, 32, 56] },
  { value: 0, spark: [] },
];

const quotes = [
  {
    text: 'I finally know which page people actually read. It took one pull request.',
    name: 'Maya R.',
    role: 'designer & developer',
    initials: 'MR',
  },
  {
    text: 'It’s the first analytics tool I don’t feel guilty opening.',
    name: 'Jonas K.',
    role: 'solo founder',
    initials: 'JK',
  },
  {
    text: 'The install PR is the nicest onboarding I’ve seen on a side project.',
    name: 'Priya N.',
    role: 'indie hacker',
    initials: 'PN',
  },
  {
    text: 'Quiet, fast, and it doesn’t want a cookie banner for breakfast.',
    name: 'Sam O.',
    role: 'frontend engineer',
    initials: 'SO',
  },
  {
    text: 'Set it up before my coffee went cold.',
    name: 'Leo M.',
    role: 'building in public',
    initials: 'LM',
  },
];

const faqs = [
  {
    q: 'Is Crease really free?',
    a: 'Yes. One project is free, and everything is free while Crease is in early access. If paid plans arrive later, existing projects will hear about it well before anything changes.',
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
            <a href="#pricing">Pricing</a>
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
            <Link className={`${s.btn} ${s.btnPrimary}`} href="/dashboard">
              Open dashboard <span aria-hidden="true">↗</span>
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
          <div className={s.mockPanel}>
            <div className={s.window}>
              <div className={s.windowTop}>
                <div className={s.dots} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className={s.windowUrl}>amansagar.in / overview</span>
              </div>
              <div className={s.mockBody}>
                <aside className={s.sidebar} aria-hidden="true">
                  <div className={s.workspace}>
                    <span>✳</span>
                    <div>
                      amansagar.in
                      <em>personal workspace</em>
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
                      <small>Last 30 days · amansagar.in</small>
                    </div>
                    <span className={s.previewChip}>
                      PREVIEW <strong>02</strong>
                    </span>
                  </div>

                  <div className={s.metrics}>
                    {[
                      ['Visitors', '1,284', '+18%'],
                      ['Page views', '3,410', '+22%'],
                      ['Sessions', '1,902', '+11%'],
                      ['Events', '5,876', '+31%'],
                    ].map(([label, value, delta], index) => (
                      <div className={s.metric} key={label}>
                        <span>
                          {label}
                          <em>0{index + 1}</em>
                        </span>
                        <strong>{value}</strong>
                        <small>{delta} vs last period</small>
                      </div>
                    ))}
                  </div>

                  <div className={s.chartCard}>
                    <div className={s.chartHead}>
                      <b>Visitors over time</b>
                      <span>1,284 total</span>
                    </div>
                    <div className={s.bars}>
                      {bars.map((height, index) => (
                        <span
                          className={`${s.bar} ${index === bars.length - 1 ? s.barLast : ''}`.trim()}
                          key={index}
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                    <div className={s.barLabels}>
                      <span>Oct 14</span>
                      <span>Oct 21</span>
                      <span>Oct 28</span>
                      <span>Nov 12</span>
                    </div>
                  </div>

                  <div className={s.mockLower}>
                    <div className={s.listCard}>
                      <h4>Top pages</h4>
                      <ul>
                        <li>
                          <span>/</span>
                          <strong>612</strong>
                        </li>
                        <li>
                          <span>/writing/quiet-software</span>
                          <strong>214</strong>
                        </li>
                        <li>
                          <span>/docs</span>
                          <strong>96</strong>
                        </li>
                      </ul>
                    </div>
                    <div className={s.listCard}>
                      <h4>Referrers</h4>
                      <ul>
                        <li>
                          <span>github.com</span>
                          <strong>402</strong>
                        </li>
                        <li>
                          <span>x.com</span>
                          <strong>188</strong>
                        </li>
                        <li>
                          <span>google.com</span>
                          <strong>121</strong>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={s.toast}>
            <i aria-hidden="true" />
            Tracker installed
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
                <p className={s.weekRowLabel}>The week after</p>
                <div className={s.week}>
                  {weekDays.map((day, index) => (
                    <div className={s.weekCard} key={days[index]}>
                      {day.value ? (
                        <>
                          <b>{day.value}</b>
                          <span>visitors</span>
                          <div className={s.miniBars} aria-hidden="true">
                            {day.spark.map((height, barIndex) => (
                              <i key={barIndex} style={{ height: `${height}%` }} />
                            ))}
                          </div>
                        </>
                      ) : (
                        <b aria-hidden="true">—</b>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className={s.sectionCaption}>
                One deploy. A week of quiet questions. Crease answers them.
              </p>
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
                    <i aria-hidden="true" />8 new answers today
                  </span>
                  {[
                    ['GH', 'github.com → /writing/quiet-software', '42 visitors · India · 4m ago', '38%'],
                    ['HN', 'news.ycombinator.com → /', '31 visitors · United States · 12m ago', '27%'],
                    ['X', 'x.com → /docs', '18 visitors · Germany · 26m ago', '16%'],
                  ].map(([avatar, title, meta, score]) => (
                    <div className={s.feedRow} key={title}>
                      <span className={s.feedAvatar}>{avatar}</span>
                      <div className={s.feedBody}>
                        <b>{title}</b>
                        <span>{meta}</span>
                      </div>
                      <span className={s.feedScore}>{score}</span>
                    </div>
                  ))}
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
                  <span className={s.miniLabel}>First 30 days</span>
                  <div className={s.miniMetrics}>
                    {[
                      ['Visitors', '1,284', 92],
                      ['Page views', '3,410', 100],
                      ['Countries', '14', 42],
                    ].map(([label, value, width]) => (
                      <div className={s.miniMetric} key={label as string}>
                        <div>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                        <div className={s.track}>
                          <i style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
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
            Free for one project.
            <br />
            See if it’s useful.
          </h2>
          <div className={s.pricingGrid}>
            <article className={s.priceCard}>
              <span className={s.priceName}>Free</span>
              <div className={s.price}>
                <strong>$0</strong>
                <span>/ project</span>
              </div>
              <p className={s.priceDesc}>For the first site, or the forty-first side project.</p>
              <div className={s.priceFeatures}>
                <span>1 project</span>
                <span>All analytics</span>
                <span>1–90 day retention</span>
                <span>GitHub installation PR</span>
              </div>
              <Link className={`${s.btn} ${s.btnSecondary}`} href="/dashboard">
                Start free
              </Link>
            </article>

            <article className={`${s.priceCard} ${s.priceFeatured}`}>
              <span className={s.priceName}>Early access</span>
              <div className={s.price}>
                <strong>$0</strong>
                <span>/ month</span>
              </div>
              <p className={s.priceDesc}>Everything Crease can do, while it’s still young.</p>
              <div className={s.priceFeatures}>
                <span>Unlimited projects</span>
                <span>All analytics</span>
                <span>Vercel integration</span>
                <span>A direct line to the founder</span>
              </div>
              <Link className={`${s.btn} ${s.btnPrimary}`} href="/dashboard">
                Open dashboard
              </Link>
            </article>

            <article className={s.priceCard}>
              <span className={s.priceName}>Self-host</span>
              <div className={s.price}>
                <strong>$0</strong>
                <span>/ forever</span>
              </div>
              <p className={s.priceDesc}>Run the whole thing on your own Postgres.</p>
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
          </div>
          <p className={s.footnote}>
            No credit card. No trial timer. Paid plans may arrive after early access — existing
            projects will hear first. <Link href="/docs">See the docs</Link>
          </p>
        </section>

        <section className={`${s.section} ${s.shell}`} id="notes">
          <div className={s.testimonialGrid}>
            <div className={s.testimonialIntro}>
              <Ghost className={s.ghostTestimonial} />
              <h2 className={s.h2}>What makers are saying.</h2>
              <p className={s.lead}>
                Notes from people who connected a site during the first weeks of Crease.
              </p>
              <span className={s.badge}>
                <i aria-hidden="true" />
                Early feedback, openly shared
              </span>
              <div className={s.avatars}>
                <span className={s.avatarStack} aria-hidden="true">
                  {['MR', 'JK', 'PN', 'SO'].map((initials) => (
                    <span key={initials}>{initials}</span>
                  ))}
                </span>
                Built by independent developers
              </div>
            </div>

            <div className={s.quotes}>
              {quotes.map((quote) => (
                <blockquote className={s.quote} key={quote.name}>
                  <p>“{quote.text}”</p>
                  <footer>
                    <span aria-hidden="true">{quote.initials}</span>
                    {quote.name} · {quote.role}
                  </footer>
                </blockquote>
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
                <a href="#pricing">Pricing</a>
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
