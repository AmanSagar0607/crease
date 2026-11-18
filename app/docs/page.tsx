import Link from 'next/link';
import ThemeToggle from '../theme-toggle';

const Code = ({ children }: { children: string }) => <pre style={{ overflowX: 'auto', padding: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--soft)' }}><code>{children}</code></pre>;

export default function Docs() {
  return <main style={{ maxWidth: 780, margin: '0 auto', padding: '72px 24px', fontFamily: 'var(--font)', lineHeight: 1.55 }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <Link href="/">✳ Crease</Link>
      <ThemeToggle />
    </header>
    <p style={{ fontSize: 12, letterSpacing: '.1em', marginTop: 48 }}>CREASE ANALYTICS / GET STARTED</p>
    <h1 style={{ fontSize: 42, letterSpacing: '-.05em' }}>Get started.</h1>
    <p>Count page views and send custom events from any JavaScript site, including Next.js and React.</p>
    <h2>1. Add the tracker</h2>
    <Code>{`<script src="https://crease-bice.vercel.app/crease.js" defer></script>
<script>
  // Dispatch crease:consent once your consent policy allows analytics.
  window.addEventListener('crease:consent', function () {
    crease.init({
      projectId: 'YOUR_PROJECT_ID',
      writeKey: 'crease_YOUR_PROJECT_WRITE_KEY',
      endpoint: 'https://crease-bice.vercel.app/api/events'
    });
  }, { once: true });
</script>`}</Code>
    <p>
      The dashboard shows the same snippet with your project ID and write key filled in.
      Crease only records page views after <code>crease:consent</code> fires.
    </p>
    <h2>2. Deploy and visit your site</h2>
    <p>Deploy the change, visit your site, then open your Crease project to see page views. Content blockers can prevent browser analytics from loading.</p>
    <h2>Custom events</h2>
    <Code>{`window.crease.capture('signup_completed', { plan: 1, trial: true });`}</Code>
    <p>Property values must be numbers or booleans, with at most 20 properties per event. Pages and referrers are recorded automatically.</p>
    <h2>Next.js and npm</h2>
    <p>
      The <code>@crease/analytics</code> package lives in the repository under
      <code>packages/crease-analytics</code>. It is not published to npm yet, so use the script tag
      above or install it from the repository until it is.
    </p>
  </main>;
}
