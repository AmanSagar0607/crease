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
    setTimeout: fn => { const key = ++sequence; timers.set(key, fn); return key; }, clearTimeout: key => timers.delete(key),
    addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; },
    fetch: (url, request) => { calls.push({ body: JSON.parse(request.body), headers: request.headers }); return Promise.resolve({ ok: true }); }
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/crease.js', 'utf8'), { window, URL, Date, isFinite });
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
