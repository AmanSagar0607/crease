import Link from 'next/link';
import ThemeToggle from '../theme-toggle';

const Code = ({ children }: { children: string }) => <pre style={{ overflowX: 'auto', padding: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--soft)' }}><code>{children}</code></pre>;

export default function Docs() {
  return <main style={{ maxWidth: 780, margin: '0 auto', padding: '72px 24px', fontFamily: 'var(--font)', lineHeight: 1.55 }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <Link href="/">✳ Zappa</Link>
      <ThemeToggle />
    </header>
    <p style={{ fontSize: 12, letterSpacing: '.1em', marginTop: 48 }}>Zappa ANALYTICS / GET STARTED</p>
    <h1 style={{ fontSize: 42, letterSpacing: '-.05em' }}>Get started.</h1>
    <p>Count page views and send custom events from any JavaScript site, including Next.js and React.</p>
    <h2>1. Add the tracker</h2>
    <Code>{`<script src="https://www.zappa.in/Zappa.js" defer></script>
<script>
  // Dispatch Zappa:consent once your consent policy allows analytics.
  window.addEventListener('Zappa:consent', function () {
    Zappa.init({
      projectId: 'YOUR_PROJECT_ID',
      writeKey: 'Zappa_YOUR_PROJECT_WRITE_KEY',
      endpoint: process.env.NEXT_PUBLIC_ZAPPA_ENDPOINT || 'https://www.zappa.in/api/events'
    });
  }, { once: true });
</script>`}</Code>
    <p>
      The dashboard shows the same snippet with your project ID and write key filled in.
      Zappa only records page views after <code>Zappa:consent</code> fires.
    </p>
    <h2>2. Deploy and visit your site</h2>
    <p>Deploy the change, visit your site, then open your Zappa project to see page views. Content blockers can prevent browser analytics from loading.</p>
    <h2>Custom events</h2>
    <Code>{`window.Zappa.capture('signup_completed', { plan: 1, trial: true });`}</Code>
    <p>Property values must be numbers or booleans, with at most 20 properties per event. Pages and referrers are recorded automatically.</p>
    <h2 id="ai-crawlers">AI crawler reporting on Next.js/Vercel</h2>
    <p>Browser analytics cannot see crawlers that do not run JavaScript. Crawler reporting needs a server or middleware collector on the website being monitored; generating a Zappa key alone does not install that collector.</p>
    <ol>
      <li>In the Zappa project’s <strong>Overview → AI Traffic → AI crawlers</strong> panel, generate or rotate a private crawler key.</li>
      <li>In the tracked website’s Vercel project, set <code>ZAPPA_PROJECT_ID</code> and <code>ZAPPA_CRAWLER_KEY</code> as server-only environment variables. Never use a <code>NEXT_PUBLIC_</code> prefix for the private key, commit it, or put it in browser code.</li>
      <li>Install a Next.js middleware or server collector on the tracked site. Forward only privacy-minimized crawler request metadata to Zappa’s AI crawler endpoint, then deploy the site.</li>
    </ol>
    <p>Middleware runs before the final page response, so it cannot observe the downstream HTTP status; such integrations may report “status not captured.” User-Agent detection is heuristic and displayed as unverified, not proof that a request came from a named AI provider. AI referrals are separate and require an actual visitor click-through from a recognized AI source; crawler requests do not create referral sessions.</p>
    <h2>Next.js and npm</h2>
    <p>Install <code>@aman-sagar06077/zappa-analytics</code> with <code>npm install @aman-sagar06077/zappa-analytics</code>. Then add its component to your app and pass the project ID and public write key shown in Installation.</p>
    <p>Copy the project-specific <code>NEXT_PUBLIC_ZAPPA_*</code> values from your project’s Installation setup and add them to <code>.env.local</code> (and your hosting provider for production). The endpoint is prefilled by Installation; it can point to Zappa’s standard collector or an enabled Cloudflare geolocation collector.</p>
    <Code>{`import { Analytics } from '@aman-sagar06077/zappa-analytics/next';

<Analytics
  projectId={process.env.NEXT_PUBLIC_ZAPPA_PROJECT_ID!}
  writeKey={process.env.NEXT_PUBLIC_ZAPPA_WRITE_KEY!}
  endpoint={process.env.NEXT_PUBLIC_ZAPPA_ENDPOINT}
  enabled={consentGranted}
/>`}</Code>
  </main>;
}
