# Zappa Cloudflare geolocation collector

This optional Worker is the trusted edge for full location metadata. It reads `request.cf`, discards browser-provided internal/location headers, signs a bounded metadata envelope, and forwards the unchanged event JSON to FastAPI. The API verifies the HMAC, five-minute timestamp window, and one-use nonce before saving the event snapshot. Visitor IP addresses are neither forwarded nor stored by this flow.

Cloudflare Free Workers currently has a 100,000-request daily limit. Requests beyond the plan quota are not guaranteed to be served. Do not add paid Cloudflare products or GeoIP API calls for this integration.

## Configure and deploy

1. Configure `BACKEND_URL` as the HTTPS origin of the existing FastAPI service.
2. Generate one random secret with at least 32 random bytes. Set the same value as Worker secret `GEO_CF_HMAC_SECRET` and FastAPI environment variable `GEO_CF_HMAC_SECRET`. Never use a `NEXT_PUBLIC_` variable for it.
3. Apply Alembic revision `0010_event_geography` to the target database after the usual backup and migration review.
4. Deploy from this directory with Wrangler, then use the assigned `https://zappa-geo-ingest.<account-subdomain>.workers.dev/api/events` endpoint in the tracking SDK. Set `NEXT_PUBLIC_ZAPPA_GEO_ENDPOINT` in the Zappa dashboard deployment to have installation snippets prefer this endpoint.
5. Send a test pageview and confirm the stored event has `geo_source='cloudflare'` and the expected coarse fields. Check that no IP address column or property has been added.

Example local configuration commands (they deploy only when `wrangler deploy` is run):

```sh
npx wrangler secret put BACKEND_URL
npx wrangler secret put GEO_CF_HMAC_SECRET
npx wrangler deploy
```

The `Add visitor location headers` Managed Transform is not required for this Worker: the Worker receives edge-derived `request.cf` directly. If the product later uses Cloudflare's managed transform on a proxied customer-facing zone, configure that transform there; it will not add location to cross-origin requests sent to a different zone. Do not trust `CF-Ray` or location headers at the Vercel route as proof of origin.

## Compatibility

Existing `https://www.zappa.in/api/events` and the current `GEO_FORWARD_SECRET` / GeoLite Country flow remain available. Existing historical events are not backfilled. Events received without Cloudflare location context retain null location fields and appear as Unknown.
