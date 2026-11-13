import Link from 'next/link';

const Code = ({ children }: { children: string }) => <pre style={{ overflowX: 'auto', padding: 16, border: '1px solid #ececec', borderRadius: 10, background: '#f8f8f7' }}><code>{children}</code></pre>;

export default function Docs() {
  return <main style={{ maxWidth: 780, margin: '0 auto', padding: '72px 24px', fontFamily: 'Arial, sans-serif', lineHeight: 1.55 }}>
    <Link href="/">← Crease</Link>
    <p style={{ fontSize: 12, letterSpacing: '.1em', marginTop: 48 }}>CREASE ANALYTICS / NPM</p>
    <h1 style={{ fontSize: 42, letterSpacing: '-.05em' }}>Get started.</h1>
    <p>Count page views and send custom events from Next.js, React, and any JavaScript site.</p>
    <h2>1. Install the package</h2>
    <Code>npm i @crease/analytics</Code>
    <h2>2. Add the Next.js component</h2>
    <Code>{`import { Analytics } from '@crease/analytics/next';

export default function RootLayout({ children }) {
  return <html><body>{children}<Analytics projectId="YOUR_PROJECT_ID" /></body></html>;
}`}</Code>
    <h2>3. Deploy and visit your site</h2>
    <p>Deploy the change, visit your site, then open your Crease project to see page views. Content blockers can prevent browser analytics from loading.</p>
    <h2>Custom events</h2>
    <Code>{`import { init } from '@crease/analytics';

const analytics = init({ projectId: 'YOUR_PROJECT_ID' });
analytics.track('signup_completed', { plan: 'free' });`}</Code>
    <p>Only initialize analytics when your consent policy permits it.</p>
  </main>;
}
