const DEFAULT_ENDPOINT = 'https://crease-bice.vercel.app/api/events';
const VISITOR_KEY = 'crease_visitor';
const SESSION_KEY = 'crease_session';
const IDLE_MS = 30 * 60 * 1000;
const MAX_SESSION_MS = 24 * 60 * 60 * 1000;

function makeId() {
  try { return crypto.randomUUID(); } catch { return undefined; }
}

export function init(options = {}) {
  const noop = { track() {}, page() {}, identify() {}, reset() {}, optOut() {}, destroy() {} };
  if (typeof window === 'undefined' || !options.projectId || typeof options.writeKey !== 'string' || !/^crease_[A-Za-z0-9_-]{16,}$/.test(options.writeKey)) return noop;
  if (window.__creaseAnalytics) return window.__creaseAnalytics;

  const endpoint = options.endpoint || DEFAULT_ENDPOINT;
  let enabled = options.enabled !== false;
  let queue = [], timer = null, lastUrl = null;
  const originals = {};
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const remove = (key) => { try { localStorage.removeItem(key); } catch {} };
  const visitor = () => { let value = read(VISITOR_KEY); if (!value) { value = makeId(); if (value) write(VISITOR_KEY, value); } return value; };
  const session = () => {
    const now = Date.now(); let state;
    try { state = JSON.parse(read(SESSION_KEY) || 'null'); } catch { state = null; }
    if (!state?.id || now - state.lastActivity >= IDLE_MS || now - state.startedAt >= MAX_SESSION_MS) {
      state = { id: makeId(), startedAt: now, lastActivity: now, entryPage: location.pathname, exitPage: location.pathname, pageviews: 0 };
    }
    state.lastActivity = now; write(SESSION_KEY, JSON.stringify(state)); return state;
  };
  const flush = () => {
    if (timer) clearTimeout(timer); timer = null;
    if (!enabled || !queue.length) return;
    const batch = queue.slice(0, 20); queue = queue.slice(batch.length);
    fetch(endpoint, { method: 'POST', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Crease-Key': options.writeKey }, body: JSON.stringify({ projectId: options.projectId, events: batch }) })
      .then((response) => { if (!response.ok && (response.status === 429 || response.status >= 500)) throw new Error('Temporary ingestion failure'); })
      .catch(() => { if (enabled) { queue = [...batch, ...queue].slice(0, 100); timer ??= setTimeout(flush, 10000); } });
    if (queue.length) timer ??= setTimeout(flush, 2000);
  };
  const track = (name, properties = {}) => {
    if (!enabled || typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return;
    const clean = {};
    if (properties && typeof properties === 'object') Object.entries(properties).slice(0, 20).forEach(([key, value]) => {
      if (/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key) && !/password|token|secret|email/i.test(key) && (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))) clean[key] = value;
    });
    const active = session();
    if (name === 'pageview') { active.pageviews += 1; active.exitPage = location.pathname; write(SESSION_KEY, JSON.stringify(active)); }
    let referrer;
    try { referrer = document.referrer ? new URL(document.referrer).hostname : null; } catch { referrer = null; }
    queue.push({ id: makeId(), name, timestamp: new Date().toISOString(), path: location.pathname, visitorId: visitor(), sessionId: active.id, referrer, properties: clean, schemaVersion: 1 });
    if (queue.length > 100) queue.shift();
    if (queue.length >= 20) flush(); else timer ??= setTimeout(flush, 2000);
  };
  const page = () => {
    const url = location.pathname + location.search;
    if (!enabled || url === lastUrl) return;
    lastUrl = url; track('pageview');
  };
  const dispatchRoute = () => window.dispatchEvent(new Event('crease:navigation'));
  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    if (typeof original !== 'function' || original.__creasePatched) return;
    const wrapped = function (...args) { const result = original.apply(this, args); dispatchRoute(); return result; };
    wrapped.__creasePatched = true; originals[method] = original; history[method] = wrapped;
  });
  const api = {
    track, page, flush, identify: visitor,
    reset() { remove(VISITOR_KEY); remove(SESSION_KEY); lastUrl = null; page(); },
    optOut() { enabled = false; queue = []; lastUrl = null; if (timer) clearTimeout(timer); timer = null; remove(VISITOR_KEY); remove(SESSION_KEY); },
    destroy() {
      window.removeEventListener('popstate', page); window.removeEventListener('crease:navigation', page); window.removeEventListener('pagehide', flush);
      Object.entries(originals).forEach(([method, original]) => { if (history[method]?.__creasePatched) history[method] = original; });
      if (timer) clearTimeout(timer); timer = null;
      if (window.__creaseAnalytics === api) delete window.__creaseAnalytics;
    },
  };
  if (enabled) {
    window.addEventListener('popstate', page); window.addEventListener('crease:navigation', page); window.addEventListener('pagehide', flush); page();
  }
  window.__creaseAnalytics = api;
  return api;
}
