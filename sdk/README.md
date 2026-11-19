# Zappa browser SDK (early prototype)

This standalone script is an initial SDK, not a production-ready analytics service. Call `init` only when your consent policy permits tracking.

```html
<script src="/Zappa.js" defer></script>
<script>
  // After the script loads and the visitor has granted any required consent:
  Zappa.init({
    projectId: 'YOUR_PROJECT_ID',
    writeKey: 'Zappa_YOUR_PROJECT_WRITE_KEY',
    endpoint: 'https://YOUR_COLLECTOR/api/events'
  });
  Zappa.capture('signup_started', { from_pricing: true });
  // pushState, replaceState, query-only changes, and back/forward are tracked automatically.
  // When consent is withdrawn, call Zappa.optOut().
</script>
```

`init` fails closed if the write key is missing or malformed. The collector rejects events without a valid key for the project, so keep the key in sync with the dashboard and rotate it if it leaks. The key is embedded in client code and is not a substitute for server-side trust.

Page paths exclude query strings and fragments. Query-only changes create a pageview while keeping query values out of stored paths. Custom properties currently accept only numbers and booleans, with sensitive-looking names rejected. Do not put personal information in event names or URL paths. A persistent first-party visitor ID and session state are shared across tabs. The collector assigns the authoritative session server-side: a new session starts after 30 minutes without an event from the same visitor or at a UTC day boundary. The SDK's own session hint is not authoritative. The server records session start and last activity, entry and exit paths, and pageview count. Session duration is the elapsed time between the first and latest received event, so it can be shorter than a visitor's actual session when delivery fails or a tab closes abruptly. The SDK observes pushState, replaceState, and browser back/forward without blocking navigation, and suppresses duplicate route notifications. It buffers at most 100 events and retries network errors, HTTP 429, and server errors; delivery is best effort. Opt-out clears queued events and identifiers, but cannot cancel an already in-flight request. `reset()` starts a fresh anonymous identity. The collector must independently validate all input and enforce project isolation.

## Attribution capture

After consent, the SDK may capture the allowlisted UTM campaign fields on pageviews. It omits other query parameters and reduces referrers to a hostname. Campaign values are restricted to 128 ASCII letters, digits, spaces, underscores, hyphens or periods and must begin with a letter or digit. Do not put personal data, email addresses, credentials, or sensitive information in UTMs or URL paths. Attribution is untrusted browser evidence, not payment verification; no cross-domain matching or revenue attribution is provided yet. Project-scoped identifiers are stored only after the SDK is enabled. See `docs/api.md` for details and retention limitations.
