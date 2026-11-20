import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.js';

const encoder = new TextEncoder();
const secret = 'local-test-secret-with-32-byte-minimum';

test('signs edge metadata, strips client geolocation headers, and preserves event bytes', async () => {
  const payload = JSON.stringify({ projectId: 'project-1', events: [{ id: 'event-1', name: 'pageview' }] });
  const request = new Request('https://collector.workers.dev/api/events', {
    method: 'POST',
    headers: {
      origin: 'https://customer.example',
      'content-type': 'application/json',
      'x-zappa-key': 'public-project-key',
      'cf-ipcountry': 'US',
      'x-zappa-geo-signature': 'attacker-value',
      'x-zappa-forward-secret': 'attacker-value',
    },
    body: payload,
  });
  Object.defineProperty(request, 'cf', { value: {
    country: 'IN', continent: 'AS', regionCode: 'KA', region: 'Karnataka', city: 'Bengaluru',
    latitude: '12.9716', longitude: '77.5946', postalCode: '560001', timezone: 'Asia/Kolkata',
  } });

  let captured;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return Response.json({ accepted: 1 });
  };
  try {
    const response = await worker.fetch(request, { BACKEND_URL: 'https://api.example', GEO_CF_HMAC_SECRET: secret });
    assert.equal(response.status, 200);
    assert.equal(captured.url, 'https://api.example/internal/events/geo');
    assert.equal(new TextDecoder().decode(captured.init.body), payload);
    assert.equal(captured.init.headers.get('cf-ipcountry'), null);
    assert.equal(captured.init.headers.get('x-zappa-forward-secret'), null);

    const headers = captured.init.headers;
    const envelope = headers.get('x-zappa-geo-envelope');
    const metadata = JSON.parse(Buffer.from(envelope, 'base64url').toString('utf8'));
    assert.equal(metadata.country, 'IN');
    assert.equal(metadata.city_name, 'Bengaluru');
    assert.equal(metadata.geo_source, 'cloudflare');
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
    const payloadHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const timestamp = headers.get('x-zappa-geo-timestamp');
    const nonce = headers.get('x-zappa-geo-nonce');
    const canonical = `zappa-geo-v1\n${timestamp}\n${nonce}\nproject-1\n${payloadHash}\n${envelope}`;
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
    const signature = [...new Uint8Array(signatureBytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    assert.equal(headers.get('x-zappa-geo-signature'), signature);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('forwards unknown location when Cloudflare has no location context', async () => {
  const request = new Request('https://collector.workers.dev/api/events', { method: 'POST', body: '{"projectId":"p","events":[]}' });
  let captured;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { captured = init; return new Response(null, { status: 200 }); };
  try {
    await worker.fetch(request, { BACKEND_URL: 'https://api.example', GEO_CF_HMAC_SECRET: secret });
    const metadata = JSON.parse(Buffer.from(captured.headers.get('x-zappa-geo-envelope'), 'base64url').toString('utf8'));
    assert.equal(metadata.country, null);
    assert.equal(metadata.city_name, null);
    assert.equal(metadata.latitude, null);
    assert.equal(metadata.geo_source, 'cloudflare');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('handles preflight and rejects oversized request bodies before forwarding', async () => {
  const options = await worker.fetch(new Request('https://collector.workers.dev/api/events', { method: 'OPTIONS', headers: { origin: 'https://site.example' } }), {});
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), 'https://site.example');
  const oversized = new Request('https://collector.workers.dev/api/events', { method: 'POST', headers: { 'content-length': '32769' }, body: 'x' });
  assert.equal((await worker.fetch(oversized, { BACKEND_URL: 'https://api.example', GEO_CF_HMAC_SECRET: secret })).status, 413);
});
