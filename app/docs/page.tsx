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
    <Code>{`<script src="https://YOUR_ZAPPA_ORIGIN/Zappa.js" defer></script>
<script>
  // Dispatch Zappa:consent once your consent policy allows analytics.
  window.addEventListener('Zappa:consent', function () {
    Zappa.init({
      projectId: 'YOUR_PROJECT_ID',
      writeKey: 'Zappa_YOUR_PROJECT_WRITE_KEY',
      endpoint: 'https://YOUR_ZAPPA_ORIGIN/api/events'
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
    <h2>Next.js and npm</h2>
    <p>Install <code>@aman-sagar06077/zappa-analytics</code> with <code>npm install @aman-sagar06077/zappa-analytics</code>. Then add its component to your app and pass the project ID and public write key shown in Installation.</p>
    <Code>{`import { Analytics } from '@aman-sagar06077/zappa-analytics/next';

<Analytics projectId="YOUR_PROJECT_ID" writeKey="Zappa_YOUR_PROJECT_WRITE_KEY" enabled={consentGranted} />`}</Code>
  </main>;
}
