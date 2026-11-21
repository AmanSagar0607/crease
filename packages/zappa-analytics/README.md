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

## Server-side AI crawler observations (Node.js 18+)

Browser tracking cannot see crawlers that do not execute JavaScript. For Node/Express-style sites, install the optional server middleware from the separate `./crawler` export:

```js
import express from 'express';
import { createCrawlerMiddleware } from '@aman-sagar06077/zappa-analytics/crawler';

const app = express();
app.use(createCrawlerMiddleware({
  projectId: process.env.ZAPPA_PROJECT_ID,
  crawlerKey: process.env.ZAPPA_CRAWLER_KEY,
  // Optional when using a self-hosted collector:
  // endpoint: process.env.ZAPPA_CRAWLER_ENDPOINT,
}));
```

Generate or rotate the private crawler key in the Zappa dashboard under **Overview → AI Traffic → AI crawlers**. Set `ZAPPA_PROJECT_ID` and `ZAPPA_CRAWLER_KEY` on the website's server only; never expose the crawler key to browser code. The middleware logs recognized crawler-like requests asynchronously after the response completes. It records the hostname, query-free path, method, status, timestamp, bounded User-Agent and a deduplication ID; it does not send request bodies or IP addresses. Requests are identified by User-Agent patterns only and are explicitly marked **unverified**—this does not prove that a request came from the crawler operator. Apply your site's usual consent/privacy policy and deploy middleware only on the Node server that receives the requests.
