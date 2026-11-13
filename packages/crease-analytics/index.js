const DEFAULT_ENDPOINT = 'https://crease-bice.vercel.app/api/events';

function id(key) {
  try {
    let value = localStorage.getItem(key);
    if (!value) { value = crypto.randomUUID(); localStorage.setItem(key, value); }
    return value;
  } catch { return undefined; }
}

export function init(options) {
  if (typeof window === 'undefined' || !options?.projectId) return { track() {}, page() {}, destroy() {} };
  if (window.__creaseAnalytics) return window.__creaseAnalytics;
  const endpoint = options.endpoint || DEFAULT_ENDPOINT;
  const visitorId = id('crease_visitor');
  const sessionId = id('crease_session');
  const send = (name, properties = {}) => fetch(endpoint, {
    method: 'POST', credentials: 'omit', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
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
