const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup() {
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
    fetch: (url, request) => { calls.push({ body: JSON.parse(request.body), headers: request.headers }); return Promise.resolve({ ok: true }); }
  };
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
