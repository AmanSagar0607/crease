# @aman-sagar06077/zappa-analytics

Add Zappa page views and custom events to a site.

## Next.js

```bash
npm i @aman-sagar06077/zappa-analytics
```

```tsx
import { Analytics } from '@aman-sagar06077/zappa-analytics/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}<Analytics
    projectId={process.env.NEXT_PUBLIC_ZAPPA_PROJECT_ID!}
    writeKey={process.env.NEXT_PUBLIC_ZAPPA_WRITE_KEY!}
    endpoint={process.env.NEXT_PUBLIC_ZAPPA_ORIGIN + '/api/events'}
  /></body></html>;
}
```

Copy the project-specific `NEXT_PUBLIC_ZAPPA_PROJECT_ID`, `NEXT_PUBLIC_ZAPPA_WRITE_KEY`, and `NEXT_PUBLIC_ZAPPA_ORIGIN` values from Zappa's Installation setup into `.env.local` and your production hosting environment. These values are public browser configuration; the write key scopes events to one project and is not a secret.

## Any JavaScript site

```js
import { init } from '@aman-sagar06077/zappa-analytics';
const analytics = init({ projectId: 'YOUR_PROJECT_ID', writeKey: 'Zappa_YOUR_PROJECT_WRITE_KEY' });
analytics.track('signup_completed', { plan: 1 });
```

The SDK defaults to Zappa's hosted collector at `https://www.zappa.in/api/events`. Override `endpoint` only when using a different collector.

Only initialize analytics when your consent policy permits it. Pass `enabled={false}` to the Next.js component until consent is granted, then render it with `enabled` set to `true`. `init` fails closed without a valid write key. The package tracks initial navigation, History API push/replace, query-only changes and browser back/forward, suppressing duplicate pageviews. It shares a persistent first-party visitor and session hint across tabs; the collector assigns the authoritative session after 30 minutes of inactivity or at a UTC day boundary. Use `analytics.reset()` to start a fresh anonymous identity and `analytics.optOut()` to stop collection and clear identifiers. Events are sent in batches of up to 20 and retried on transient network failures.
