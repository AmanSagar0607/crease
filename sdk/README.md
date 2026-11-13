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
  // On client-side route changes, call crease.pageview().
  // When consent is withdrawn, call crease.optOut().
</script>
```

`init` fails closed if the write key is missing or malformed. The collector rejects events without a valid key for the project, so keep the key in sync with the dashboard and rotate it if it leaks. The key is embedded in client code and is not a substitute for server-side trust.

Page paths exclude query strings and fragments. Custom properties currently accept only numbers and booleans, with sensitive-looking names rejected. Do not put personal information in event names or URL paths. Random IDs are stored in first-party local and session storage; session storage currently follows the browser tab lifetime and is not the final inactivity-based session model. The SDK observes history back/forward and requires an explicit `pageview()` call after other SPA navigation. It buffers at most 100 events and retries network errors, HTTP 429, and server errors; delivery is best effort. Opt-out clears queued events and identifiers, but cannot cancel an already in-flight request. The collector must independently validate all input and enforce project isolation.
