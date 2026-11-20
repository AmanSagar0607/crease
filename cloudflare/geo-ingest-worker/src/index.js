const MAX_BODY = 32_768;

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlText(value) {
  return base64Url(new TextEncoder().encode(value));
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function text(value, max) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function locationFrom(cf) {
  cf = cf || {};
  const country = text(cf.country, 2)?.toUpperCase() ?? null;
  const latitude = cf.latitude == null ? NaN : Number(cf.latitude);
  const longitude = cf.longitude == null ? NaN : Number(cf.longitude);
  return {
    country,
    country_name: country ? new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? null : null,
    region_code: text(cf.regionCode, 32)?.toUpperCase() ?? null,
    region_name: text(cf.region, 128),
    city_name: text(cf.city, 128),
    continent_code: text(cf.continent, 2)?.toUpperCase() ?? null,
    timezone: text(cf.timezone, 64),
    latitude: Number.isFinite(latitude) && Math.abs(latitude) <= 90 ? Math.round(latitude * 100) / 100 : null,
    longitude: Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? Math.round(longitude * 100) / 100 : null,
    postal_code: text(cf.postalCode, 24),
    geo_source: 'cloudflare',
  };
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

async function readBoundedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Zappa-Key, Authorization',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin');
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST, OPTIONS' } });
    if (!env.BACKEND_URL || !env.GEO_CF_HMAC_SECRET || env.GEO_CF_HMAC_SECRET.length < 32) return new Response(null, { status: 503, headers });

    const declared = request.headers.get('content-length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY)) return new Response(null, { status: 413, headers });
    const bytes = await readBoundedBody(request);
    if (!bytes) return new Response(null, { status: 413, headers });
    let payload;
    try {
      payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.projectId !== 'string') throw new Error();
    } catch {
      return new Response(null, { status: 400, headers });
    }

    const envelope = base64UrlText(JSON.stringify(locationFrom(request.cf)));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomUUID();
    const payloadHash = hex(await crypto.subtle.digest('SHA-256', bytes));
    const signature = await hmac(env.GEO_CF_HMAC_SECRET, `zappa-geo-v1\n${timestamp}\n${nonce}\n${payload.projectId}\n${payloadHash}\n${envelope}`);
    let target;
    try {
      target = new URL('/internal/events/geo', env.BACKEND_URL);
      if (target.protocol !== 'https:' && target.hostname !== 'localhost') throw new Error();
    } catch {
      return new Response(null, { status: 503, headers });
    }

    const forwarded = new Headers({
      'content-type': 'application/json',
      'x-zappa-geo-envelope': envelope,
      'x-zappa-geo-timestamp': timestamp,
      'x-zappa-geo-nonce': nonce,
      'x-zappa-geo-signature': signature,
    });
    for (const name of ['origin', 'x-zappa-key', 'authorization', 'user-agent']) {
      const value = request.headers.get(name);
      if (value) forwarded.set(name, value);
    }
    try {
      const response = await fetch(target, { method: 'POST', headers: forwarded, body: bytes, redirect: 'error', signal: AbortSignal.timeout(10000) });
      const responseHeaders = new Headers(headers);
      responseHeaders.set('Content-Type', response.headers.get('content-type') || 'application/json');
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) responseHeaders.set('Retry-After', retryAfter);
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch {
      return new Response(null, { status: 502, headers });
    }
  },
};
