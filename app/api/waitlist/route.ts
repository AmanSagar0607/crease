const MAX_BODY = 4096;

export async function POST(request: Request) {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY)) {
    return Response.json({ detail: 'Request is too large.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        return Response.json({ detail: 'Request is too large.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
      }
      chunks.push(value);
    }
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    return Response.json({ detail: 'Invalid JSON.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const backend = process.env.BACKEND_URL || (!process.env.VERCEL ? 'http://127.0.0.1:8000' : '');
  if (!backend) return Response.json({ detail: 'Waitlist is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  let url: URL;
  try {
    url = new URL(backend);
    if (url.username || url.password || (process.env.VERCEL && url.protocol !== 'https:')) throw new Error();
  } catch {
    return Response.json({ detail: 'Waitlist is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  url.pathname = '/api/waitlist';
  url.search = '';

  try {
    const origin = request.headers.get('origin');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': response.headers.get('content-type') || 'application/json',
        ...(response.headers.get('retry-after') ? { 'Retry-After': response.headers.get('retry-after')! } : {}),
      },
    });
  } catch {
    return Response.json({ detail: 'Waitlist is temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
