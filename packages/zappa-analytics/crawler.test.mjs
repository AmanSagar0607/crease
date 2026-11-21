import { EventEmitter } from 'node:events';
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { classifyCrawler, createCrawlerMiddleware } from './crawler.js';

const key = 'ZappaCrawler_' + 'x'.repeat(40);

test('classifies known AI and general search crawlers without claiming verification', () => {
  assert.deepEqual(classifyCrawler('Mozilla/5.0 (compatible; OAI-SearchBot/1.0)'), {
    crawler: 'OAI-SearchBot', organization: 'OpenAI', category: 'ai_search_crawler',
    detectionMethod: 'known_user_agent_match', verificationStatus: 'unverified',
  });
  assert.equal(classifyCrawler('Mozilla/5.0 (compatible; Googlebot/2.1)').category, 'general_search_crawler');
  assert.equal(classifyCrawler('Mozilla/5.0 (compatible; UnknownCrawler/1.0)').category, 'unknown_bot');
  assert.equal(classifyCrawler('Mozilla/5.0 Chrome/126 Safari/537.36'), null);
});

test('middleware strips query parameters and reports asynchronously after response completion', async () => {
  let sent;
  let nextCalled = false;
  const response = new EventEmitter();
  response.statusCode = 200;
  const middleware = createCrawlerMiddleware({
    projectId: 'project-1', crawlerKey: key,
    fetchImpl: async (url, options) => { sent = { url: String(url), options }; return { ok: true }; },
  });
  middleware({
    hostname: 'www.example.com', method: 'GET', originalUrl: '/docs/page?email=private&token=secret',
    headers: { host: 'www.example.com', 'user-agent': 'GPTBot/1.0' },
  }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(sent, undefined);
  response.emit('finish');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.url, 'https://www.zappa.in/api/ai-crawlers');
  assert.equal(sent.options.headers['X-Zappa-Crawler-Key'], key);
  const body = JSON.parse(sent.options.body);
  assert.equal(body.requests[0].path, '/docs/page');
  assert.equal(body.requests[0].hostname, 'www.example.com');
  assert.equal(body.requests[0].statusCode, 200);
  assert.equal(body.requests[0].userAgent, 'GPTBot/1.0');
  assert.equal('email' in body.requests[0], false);
});

test('rejects missing private key and never logs ordinary browser requests', () => {
  assert.throws(() => createCrawlerMiddleware({ projectId: 'project-1', crawlerKey: 'Zappa_PUBLIC' }), /private Zappa crawler key/);
  let nextCalled = false;
  let listenerAdded = false;
  createCrawlerMiddleware({ projectId: 'project-1', crawlerKey: key })(
    { headers: { 'user-agent': 'Mozilla/5.0 Chrome/126 Safari/537.36' } },
    { once() { listenerAdded = true; } },
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, true);
  assert.equal(listenerAdded, false);
});
