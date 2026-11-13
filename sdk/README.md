# Crease browser SDK (early prototype)

This standalone script is an initial SDK, not a production-ready analytics service. Call `init` only when your consent policy permits tracking.

```html
<script src="/crease.js" defer></script>
<script>
  // After the script loads and the visitor has granted any required consent:
  crease.init({
    projectId: 'YOUR_PROJECT_ID',
    writeKey: 'crease_YOUR_PROJECT_WRITE_KEY',
    endpoint: 'https://YOUR_COLLECTOR/api/events'
  });
  crease.capture('signup_started', { from_pricing: true });
  // pushState, replaceState, query-only changes, and back/forward are tracked automatically.
  // When consent is withdrawn, call crease.optOut().
</script>
```

`init` fails closed if the write key is missing or malformed. The collector rejects events without a valid key for the project, so keep the key in sync with the dashboard and rotate it if it leaks. The key is embedded in client code and is not a substitute for server-side trust.

Page paths exclude query strings and fragments. Query-only changes create a pageview while keeping query values out of stored paths. Custom properties currently accept only numbers and booleans, with sensitive-looking names rejected. Do not put personal information in event names or URL paths. A persistent first-party visitor ID and session state are shared across tabs. A session ends after 30 minutes of inactivity or 24 hours; the server records its start and last activity, entry and exit paths, and pageview count. Session duration is the elapsed time between the first and latest received event, so it can be shorter than a visitor's actual session when delivery fails or a tab closes abruptly. The SDK observes pushState, replaceState, and browser back/forward without blocking navigation, and suppresses duplicate route notifications. It buffers at most 100 events and retries network errors, HTTP 429, and server errors; delivery is best effort. Opt-out clears queued events and identifiers, but cannot cancel an already in-flight request. `reset()` starts a fresh anonymous identity. The collector must independently validate all input and enforce project isolation.
