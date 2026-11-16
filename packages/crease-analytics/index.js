const DEFAULT_ENDPOINT = 'https://crease-bice.vercel.app/api/events';
const VISITOR_KEY = 'crease_visitor';
const SESSION_KEY = 'crease_session';
const IDLE_MS = 30 * 60 * 1000;
const MAX_SESSION_MS = 24 * 60 * 60 * 1000;

function makeId() {
  try { return crypto.randomUUID(); } catch { return undefined; }
}

export function init(options = {}) {
  const noop = { track() {}, page() {}, identify() { return null; }, reset() {}, optOut() {}, destroy() {} };
  if (typeof window === 'undefined' || !options.projectId || typeof options.writeKey !== 'string' || !/^crease_[A-Za-z0-9_-]{16,}$/.test(options.writeKey)) return noop;
  if (options.enabled === false) return noop;
  if (window.__creaseAnalytics) return window.__creaseAnalytics;

  const endpoint = options.endpoint || DEFAULT_ENDPOINT;
  const visitorKey = VISITOR_KEY + ':' + options.projectId, sessionKey = SESSION_KEY + ':' + options.projectId;
  let enabled = options.enabled !== false;
  let queue = [], timer = null, lastUrl = null, lastPath = null;
  let vitals = {}, vitalsSent = false;
  const observerList = [];
  const originals = {};
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const remove = (key) => { try { localStorage.removeItem(key); } catch {} };
  if (enabled) { if (!read(visitorKey) && read(VISITOR_KEY)) write(visitorKey, read(VISITOR_KEY)); if (!read(sessionKey) && read(SESSION_KEY)) write(sessionKey, read(SESSION_KEY)); }
  const visitor = () => { if (!enabled) return null; let value = read(visitorKey); if (!value) { value = makeId(); if (value) write(visitorKey, value); } return value; };
  const campaign = () => { const values = {}; try { const params = new URL(location.href).searchParams; ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(key => { const value = params.get(key); if (value && /^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,127}$/.test(value)) values[key] = value; }); } catch {} return values; };
  const session = () => {
    const now = Date.now(); let state;
    try { state = JSON.parse(read(sessionKey) || 'null'); } catch { state = null; }
    if (!state?.id || now - state.lastActivity >= IDLE_MS || now - state.startedAt >= MAX_SESSION_MS) {
      state = { id: makeId(), startedAt: now, lastActivity: now, entryPage: location.pathname, exitPage: location.pathname, pageviews: 0 };
    }
    state.lastActivity = now; write(sessionKey, JSON.stringify(state)); return state;
  };
  const observe = (type, update) => {
    try { const observer = new PerformanceObserver((list) => update(list.getEntries())); observer.observe({ type, buffered: true }); observerList.push(observer); } catch {}
  };
  const observeVitals = () => {
    if (typeof PerformanceObserver === 'undefined') return;
    observe('largest-contentful-paint', (entries) => { const last = entries[entries.length - 1]; if (last) vitals.lcp = Math.round(last.startTime); });
    observe('layout-shift', (entries) => entries.forEach((entry) => { vitals.clsSeen = true; if (!entry.hadRecentInput) vitals.cls = Math.round(((vitals.cls || 0) + entry.value) * 10000) / 10000; }));
    observe('event', (entries) => { const list = vitals.interactions || []; entries.forEach((entry) => { if (entry.duration) list.push(entry.duration); }); vitals.interactions = list.slice(-50).sort((a, b) => a - b); });
  };
  const resetVitals = () => { vitals = {}; vitalsSent = false; };
  const flushVitals = (path) => {
    if (!enabled || vitalsSent) return;
    const properties = {}, interactions = vitals.interactions || [];
    if (vitals.lcp) properties.lcp_ms = vitals.lcp;
    if (vitals.clsSeen) properties.cls = vitals.cls || 0;
    if (interactions.length) properties.inp_ms = Math.round(interactions[Math.floor((interactions.length - 1) * 0.98)]);
    if (!properties.lcp_ms && !properties.cls && !properties.inp_ms) return;
    vitalsSent = true; track('web_vitals', properties, path);
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
  const track = (name, properties = {}, pathOverride, pageReferrer) => {
    if (!enabled || typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return;
    const clean = {};
    if (properties && typeof properties === 'object') Object.entries(properties).slice(0, 20).forEach(([key, value]) => {
      if (/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key) && !/password|token|secret|email/i.test(key) && (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))) clean[key] = value;
    });
    const active = session();
    if (name === 'pageview') { active.pageviews += 1; active.exitPage = location.pathname; write(sessionKey, JSON.stringify(active)); }
    let referrer = pageReferrer;
    if (typeof referrer === 'undefined') {
      try { referrer = document.referrer ? new URL(document.referrer).hostname : null; } catch { referrer = null; }
    }
    const event = { id: makeId(), name, timestamp: new Date().toISOString(), path: pathOverride || location.pathname, visitorId: visitor(), sessionId: active.id, referrer, properties: clean, schemaVersion: 1 };
    if (name === 'pageview') event.attribution = campaign();
    queue.push(event);
    if (queue.length > 100) queue.shift();
    if (queue.length >= 20) flush(); else timer ??= setTimeout(flush, 2000);
  };
  const page = () => {
    const url = location.pathname + location.search;
    if (!enabled || url === lastUrl) return;
    flushVitals(lastPath || location.pathname); resetVitals();
    const previous = lastUrl;
    lastUrl = url; lastPath = location.pathname;
    // SPA navigation comes from this site, not from the original external referrer.
    const referrer = previous ? location.hostname : undefined;
    track('pageview', {}, undefined, referrer);
  };
  const leaving = () => { flushVitals(lastPath); flush(); };
  const hidden = () => { if (document.visibilityState === 'hidden') leaving(); };
  const dispatchRoute = () => window.dispatchEvent(new Event('crease:navigation'));
  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    if (typeof original !== 'function' || original.__creasePatched) return;
    const wrapped = function (...args) { const result = original.apply(this, args); dispatchRoute(); return result; };
    wrapped.__creasePatched = true; originals[method] = original; history[method] = wrapped;
  });
  const api = {
    track, page, flush, identify: visitor,
    reset() { remove(visitorKey); remove(sessionKey); remove(VISITOR_KEY); remove(SESSION_KEY); resetVitals(); lastUrl = null; lastPath = null; page(); },
    optOut() { enabled = false; queue = []; lastUrl = null; resetVitals(); observerList.forEach((observer) => { try { observer.disconnect(); } catch {} }); observerList.length = 0; if (timer) clearTimeout(timer); timer = null; remove(visitorKey); remove(sessionKey); remove(VISITOR_KEY); remove(SESSION_KEY); },
    destroy() {
      enabled = false; queue = [];
      window.removeEventListener('popstate', page); window.removeEventListener('crease:navigation', page); window.removeEventListener('pagehide', leaving);
      document.removeEventListener('visibilitychange', hidden);
      Object.entries(originals).forEach(([method, original]) => { if (history[method]?.__creasePatched) history[method] = original; });
      if (timer) clearTimeout(timer); timer = null;
      if (window.__creaseAnalytics === api) delete window.__creaseAnalytics;
    },
  };
  if (enabled) {
    observeVitals();
    window.addEventListener('popstate', page); window.addEventListener('crease:navigation', page); window.addEventListener('pagehide', leaving); document.addEventListener('visibilitychange', hidden); page();
  }
  window.__creaseAnalytics = api;
  return api;
}
