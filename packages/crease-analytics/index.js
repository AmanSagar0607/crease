const DEFAULT_ENDPOINT = 'https://crease-bice.vercel.app/api/events';

function id(key) {
  try {
    let value = localStorage.getItem(key);
    if (!value) { value = crypto.randomUUID(); localStorage.setItem(key, value); }
    return value;
  } catch { return undefined; }
}

export function init(options) {
  const noop = { track() {}, page() {}, destroy() {} };
  if (typeof window === 'undefined' || !options?.projectId) return noop;
  if (typeof options.writeKey !== 'string' || !/^crease_[A-Za-z0-9_-]{16,}$/.test(options.writeKey)) return noop;
  if (window.__creaseAnalytics) return window.__creaseAnalytics;
  const endpoint = options.endpoint || DEFAULT_ENDPOINT;
  const visitorId = id('crease_visitor');
  const sessionId = id('crease_session');
  const send = (name, properties = {}) => fetch(endpoint, {
    method: 'POST', credentials: 'omit', keepalive: true,
    headers: { 'Content-Type': 'application/json', 'X-Crease-Key': options.writeKey },
    body: JSON.stringify({ projectId: options.projectId, events: [{ id: crypto.randomUUID(), name, timestamp: new Date().toISOString(), path: location.pathname, visitorId, sessionId, referrer: document.referrer ? new URL(document.referrer).hostname : undefined, properties }] })
  }).catch(() => {});
  const page = () => send('pageview');
  const onPopState = () => page();
  addEventListener('popstate', onPopState);
  page();
  const api = { track: send, page, destroy() { removeEventListener('popstate', onPopState); delete window.__creaseAnalytics; } };
  window.__creaseAnalytics = api;
  return api;
}
