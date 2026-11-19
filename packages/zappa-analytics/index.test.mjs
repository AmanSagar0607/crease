import test from 'node:test';
import assert from 'node:assert/strict';
import { init } from './index.js';

test('npm tracker collects allowed UTMs only after activation and clears identity on opt out', () => {
  const data = new Map(), sent = [];
  const listeners = {};
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const location = new URL('https://example.com/landing?utm_source=search&utm_campaign=spring&email=private&utm_term=a%40b.com');
  const history = { pushState() {}, replaceState() {} };
  const document = { referrer: 'https://search.example/path?private=x', addEventListener() {}, removeEventListener() {} };
  const window = { location, localStorage: storage, history, document, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: () => {}, dispatchEvent() {} };
  Object.assign(globalThis, { window, location, history, document, localStorage: storage });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, request) => { sent.push(JSON.parse(request.body)); return Promise.resolve({ ok: true }); };
  try {
    const tracker = init({ projectId: 'project', writeKey: 'Zappa_0123456789abcdef', endpoint: 'https://collector.example/api/events' });
    tracker.flush();
    assert.equal(sent[0].events[0].path, '/landing');
    assert.deepEqual(sent[0].events[0].attribution, { utm_source: 'search', utm_campaign: 'spring' });
    assert.equal(sent[0].events[0].referrer, 'search.example');
    location.href = 'https://example.com/pricing';
    tracker.page();
    tracker.flush();
    assert.equal(sent[1].events[0].referrer, 'example.com');
    tracker.optOut();
    assert.equal(tracker.identify(), null);
    assert.equal(storage.getItem('Zappa_visitor:project'), null);
    tracker.destroy();
  } finally { globalThis.fetch = originalFetch; delete globalThis.window; delete globalThis.location; delete globalThis.history; delete globalThis.document; delete globalThis.localStorage; }
});

test('disabled npm tracker does not create identity', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const history = { pushState() {}, replaceState() {} };
  Object.assign(globalThis, { window: { removeEventListener() {} }, document: { removeEventListener() {} }, history, localStorage: storage });
  try {
    const tracker = init({ projectId: 'p', writeKey: 'Zappa_0123456789abcdef', enabled: false });
    assert.equal(tracker.identify(), null);
    assert.equal(data.size, 0);
    tracker.destroy();
  } finally { delete globalThis.window; delete globalThis.document; delete globalThis.history; delete globalThis.localStorage; }
});
