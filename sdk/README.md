# Crease browser SDK (early prototype)

This standalone script is an initial SDK, not a production-ready analytics service. No ingestion endpoint or dashboard is implemented yet. Call `init` only when your consent policy permits tracking.

```html
<script src="/crease.js" defer></script>
<script>
  // After the script loads and the visitor has granted any required consent:
  crease.init({ projectId: 'YOUR_PROJECT_ID', endpoint: 'https://YOUR_COLLECTOR/api/events' });
  crease.capture('signup_started', { from_pricing: true });
  // On client-side route changes, call crease.pageview().
  // When consent is withdrawn, call crease.optOut().
</script>
```

Page paths exclude query strings and fragments. Custom properties currently accept only numbers and booleans, with sensitive-looking names rejected. Do not put personal information in event names or URL paths. Random IDs are stored in first-party local and session storage; session storage currently follows the browser tab lifetime and is not the final inactivity-based session model. The SDK observes history back/forward and requires an explicit `pageview()` call after other SPA navigation. It buffers at most 100 events and retries network errors, HTTP 429, and server errors; delivery is best effort. Opt-out clears queued events and identifiers, but cannot cancel an already in-flight request. The collector must independently validate all input and enforce project isolation.
