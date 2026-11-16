const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(overrides = {}) {
  const calls = [], listeners = {}, timers = new Map();
  let sequence = 0;
  const storage = () => { const data = new Map(); return { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; };
  const window = {
    location: { href: 'https://site.example/path?secret=abc', pathname: '/path' },
    localStorage: storage(), sessionStorage: storage(), crypto: { randomUUID: () => String(++sequence) },
    history: {
      pushState(_state, _title, url) { if (url) setUrl(url); },
      replaceState(_state, _title, url) { if (url) setUrl(url); }
    },
    dispatchEvent(event) { listeners[event.type]?.(event); },
    setTimeout: fn => { const key = ++sequence; timers.set(key, fn); return key; }, clearTimeout: key => timers.delete(key),
    addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; },
    document: {
      referrer: '', visibilityState: 'visible',
      addEventListener: (name, fn) => { listeners['doc:' + name] = fn; }, removeEventListener: name => { delete listeners['doc:' + name]; }
    },
    fetch: (url, request) => { calls.push({ body: JSON.parse(request.body), headers: request.headers }); return Promise.resolve({ ok: true }); }
  };
  Object.assign(window, overrides);
  function setUrl(value) { const url = new URL(value, window.location.href); window.location.href = url.href; window.location.pathname = url.pathname; window.location.search = url.search; window.location.origin = url.origin; }
  vm.runInNewContext(fs.readFileSync(__dirname + '/crease.js', 'utf8'), { window, URL, Date, Event, isFinite });
  return { window, calls, listeners };
}

test('only sends after activation and excludes query strings and sensitive properties', () => {
  const { window, calls } = setup();
  window.crease.capture('before');
  window.crease.init({ projectId: 'p', writeKey: 'crease_0123456789abcdef', endpoint: 'https://collector.example/events' });
  window.crease.capture('signup', { count: 1, email: 'person@example.com', token: 2, label: 'private' });
  window.crease.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.events.length, 2);
  assert.equal(calls[0].body.events[0].path, '/path');
  assert.deepEqual(calls[0].body.events[1].properties, { count: 1 });
  assert.equal(calls[0].headers['X-Crease-Key'], 'crease_0123456789abcdef');
});

test('does not start without a write key', () => {
  const { window, calls } = setup();
  window.crease.init({ projectId: 'p', endpoint: 'https://collector.example/events' });
  window.crease.capture('after');
  window.crease.flush();
  assert.equal(calls.length, 0);
});

test('opt out removes identifiers and prevents further collection', () => {
  const { window, calls, listeners } = setup();
  window.crease.init({ projectId: 'p', writeKey: 'crease_0123456789abcdef', endpoint: 'https://collector.example/events' });
  window.crease.optOut();
  window.crease.capture('after'); window.crease.flush();
  assert.equal(calls.length, 0);
  assert.equal(window.localStorage.getItem('crease_visitor'), undefined);
  assert.equal(listeners.popstate, undefined);
});

test('tracks pushState, replaceState, back navigation, and query-only route changes once each', () => {
  const { window, calls } = setup();
  window.crease.init({ projectId: 'p', writeKey: 'crease_0123456789abcdef', endpoint: 'https://collector.example/events' });
  window.history.pushState({}, '', '/next');
  window.history.pushState({}, '', '/next?tab=one');
  window.history.replaceState({}, '', '/next?tab=two');
  window.dispatchEvent(new Event('popstate'));
  window.crease.flush();
  assert.deepEqual(calls[0].body.events.map(event => event.path), ['/path', '/next', '/next', '/next']);
  assert.equal(new Set(calls[0].body.events.map(event => event.sessionId)).size, 1);
  assert.equal(calls[0].body.events[0].visitorId, calls[0].body.events[3].visitorId);
});

test('repeated initialization does not duplicate initial page views', () => {
  const { window, calls } = setup();
  const config = { projectId: 'p', writeKey: 'crease_0123456789abcdef', endpoint: 'https://collector.example/events' };
  window.crease.init(config);
  window.crease.init(config);
  window.crease.flush();
  assert.equal(calls[0].body.events.length, 1);
});

test('sends one web_vitals event per page on hide and starts a new one after route change', () => {
  const { window, calls, listeners } = setup();
  const observers = {};
  window.PerformanceObserver = class {
    constructor(callback) { this.callback = callback; }
    observe({ type }) { observers[type] = this.callback; }
  };
  const emit = (type, entries) => observers[type]?.({ getEntries: () => entries });
  const config = { projectId: 'p', writeKey: 'crease_0123456789abcdef', endpoint: 'https://collector.example/events' };
  window.crease.init(config);
  emit('largest-contentful-paint', [{ startTime: 1234.5 }]);
  emit('layout-shift', [{ value: 0.05, hadRecentInput: false }, { value: 0.2, hadRecentInput: true }]);
  emit('event', [{ duration: 80 }, { duration: 240 }]);
  window.document.visibilityState = 'hidden';
  listeners['doc:visibilitychange']();
  const vitalsEvents = () => calls.flatMap(call => call.body.events).filter(event => event.name === 'web_vitals');
  assert.equal(vitalsEvents().length, 1);
  assert.equal(vitalsEvents()[0].path, '/path');
  assert.deepEqual(vitalsEvents()[0].properties, { lcp_ms: 1235, cls: 0.05, inp_ms: 80 });

  window.document.visibilityState = 'hidden';
  listeners['doc:visibilitychange']();
  window.crease.flush();
  assert.equal(vitalsEvents().length, 1);

  window.document.visibilityState = 'visible';
  window.history.pushState({}, '', '/next');
  emit('largest-contentful-paint', [{ startTime: 800 }]);
  window.document.visibilityState = 'hidden';
  listeners['doc:visibilitychange']();
  assert.equal(vitalsEvents().length, 2);
  assert.equal(vitalsEvents()[1].path, '/next');
  assert.deepEqual(vitalsEvents()[1].properties, { lcp_ms: 800 });
});

test('does not collect web vitals before consent or without PerformanceObserver', () => {
  const { window, calls } = setup();
  window.PerformanceObserver = class { observe() { throw new Error('must not observe before init'); } };
  window.crease.capture('before');
  window.crease.flush();
  assert.equal(calls.length, 0);
});

test('captures only allowlisted campaign parameters after consent', () => {
  const { window, calls } = setup();
  window.history.replaceState({}, '', '/landing?utm_source=search&utm_medium=paid&utm_campaign=spring&utm_content=hello%40example.com&email=private');
  assert.equal(window.crease.identify(), null);
  window.crease.init({ projectId: 'p', writeKey: 'crease_0123456789abcdef', endpoint: 'https://collector.example/events' });
  window.crease.flush();
  const event = calls[0].body.events[0];
  assert.equal(event.path, '/landing');
  assert.deepEqual(event.attribution, { utm_source: 'search', utm_medium: 'paid', utm_campaign: 'spring' });
  window.crease.optOut();
  assert.equal(window.crease.identify(), null);
  assert.equal(window.localStorage.getItem('crease_visitor:p'), undefined);
});
