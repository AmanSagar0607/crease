const MAX_BODY = 32768;

function cors(request: Request): HeadersInit {
  return {
    'Access-Control-Allow-Origin': request.headers.get('origin') || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Crease-Key, Authorization',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const headers = cors(request);
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY)) {
    return new Response(null, { status: 413, headers });
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY) {
        await reader.cancel();
        return new Response(null, { status: 413, headers });
      }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  try { JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
  catch { return new Response(null, { status: 400, headers }); }

  const backend = process.env.BACKEND_URL || (!process.env.VERCEL ? 'http://127.0.0.1:8000' : '');
  const secret = process.env.GEO_FORWARD_SECRET;
  if (!backend) return new Response(null, { status: 503, headers });
  let url: URL;
  try {
    url = new URL(backend);
    if (url.username || url.password || (process.env.VERCEL && url.protocol !== 'https:')) throw new Error();
  } catch { return new Response(null, { status: 503, headers }); }
  url.pathname = secret ? '/internal/events' : '/api/events';
  url.search = '';
  const forwarded = new Headers({ 'content-type': 'application/json' });
  for (const name of ['origin', 'x-crease-key', 'authorization', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) forwarded.set(name, value);
  }
  if (secret) {
    forwarded.set('x-crease-forward-secret', secret);
    // Only Vercel's trusted edge may supply these headers; never copy client forwarding headers.
    if (process.env.VERCEL === '1') {
      const country = request.headers.get('x-vercel-ip-country');
      const ip = request.headers.get('x-vercel-forwarded-for');
      if (country) forwarded.set('x-crease-country', country);
      if (ip) forwarded.set('x-crease-client-ip', ip);
    }
  }
  try {
    const response = await fetch(url, { method: 'POST', headers: forwarded, body, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', response.headers.get('content-type') || 'application/json');
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) responseHeaders.set('Retry-After', retryAfter);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch { return new Response(null, { status: 502, headers }); }
}
