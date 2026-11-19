import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  appendFunnelStep,
  buildFunnelRequest,
  normalizeFunnelSteps,
  selectFunnelStep,
} from './funnel-api.ts';

const range = { start: '2026-11-01', end: '2026-11-18' };

test('initial funnel selection uses two distinct observed events and handles one-event projects', () => {
  assert.deepEqual(normalizeFunnelSteps([], ['pageview', 'signup']), ['pageview', 'signup']);
  assert.deepEqual(normalizeFunnelSteps([], ['pageview']), []);
  assert.deepEqual(normalizeFunnelSteps(['pageview', 'pageview'], ['pageview', 'signup']), ['pageview', 'signup']);
});

test('funnel selectors cannot choose the same event twice or append a duplicate', () => {
  assert.deepEqual(selectFunnelStep(['pageview', 'signup'], 1, 'pageview'), ['pageview', 'signup']);
  assert.deepEqual(appendFunnelStep(['pageview', 'signup'], ['pageview', 'signup']), ['pageview', 'signup']);
  assert.deepEqual(appendFunnelStep(['pageview', 'signup'], ['pageview', 'signup', 'purchase']), ['pageview', 'signup', 'purchase']);
});

test('two-step request uses the documented legacy route and first/second parameters', () => {
  const url = new URL(buildFunnelRequest('project/id', range, ['pageview', 'signup']), 'https://zappa.example');
  assert.equal(url.pathname, '/api/projects/project%2Fid/funnel');
  assert.equal(url.searchParams.get('days'), '30');
  assert.equal(url.searchParams.get('start'), range.start);
  assert.equal(url.searchParams.get('end'), range.end);
  assert.equal(url.searchParams.get('first'), 'pageview');
  assert.equal(url.searchParams.get('second'), 'signup');
  assert.equal(url.searchParams.getAll('steps').length, 0);
});

test('three-to-five-step requests use repeated steps parameters on the documented multi route', () => {
  const url = new URL(buildFunnelRequest('project-1', range, ['pageview', 'signup', 'purchase']), 'https://zappa.example');
  assert.equal(url.pathname, '/api/projects/project-1/funnel/multi');
  assert.deepEqual(url.searchParams.getAll('steps'), ['pageview', 'signup', 'purchase']);
  assert.equal(url.searchParams.get('first'), null);
  assert.equal(url.searchParams.get('start'), range.start);
});

test('request builder refuses duplicate, out-of-range, empty, and overlong event steps', () => {
  assert.throws(() => buildFunnelRequest('project-1', range, ['pageview', 'pageview']), /different observed event/);
  assert.throws(() => buildFunnelRequest('project-1', range, ['pageview']), /2–5/);
  assert.throws(() => buildFunnelRequest('project-1', range, ['pageview', 'signup', 'purchase', 'a', 'b', 'c']), /2–5/);
  assert.throws(() => buildFunnelRequest('project-1', range, ['pageview', '']), /2–5/);
  assert.throws(() => buildFunnelRequest('project-1', range, ['pageview', 'x'.repeat(65)]), /2–5/);
});
