# @crease/analytics

Add Crease page views and custom events to a site.

## Next.js

```bash
npm i @crease/analytics
```

```tsx
import { Analytics } from '@crease/analytics/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}<Analytics projectId="YOUR_PROJECT_ID" writeKey="crease_YOUR_PROJECT_WRITE_KEY" /></body></html>;
}
```

## Any JavaScript site

```js
import { init } from '@crease/analytics';
const analytics = init({ projectId: 'YOUR_PROJECT_ID', writeKey: 'crease_YOUR_PROJECT_WRITE_KEY' });
analytics.track('signup_completed', { plan: 'free' });
```

Only initialize analytics when your consent policy permits it. Pass `enabled={false}` to the Next.js component until consent is granted, then render it with `enabled` set to `true`. `init` fails closed without a valid write key.
