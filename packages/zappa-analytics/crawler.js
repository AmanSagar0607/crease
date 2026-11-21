import { randomUUID } from 'node:crypto';

const DEFAULT_ENDPOINT = 'https://www.zappa.in/api/ai-crawlers';
const REGISTRY = [
  [/\bOAI-SearchBot\b/i, 'OAI-SearchBot', 'OpenAI', 'ai_search_crawler'],
  [/\bChatGPT-User\b/i, 'ChatGPT-User', 'OpenAI', 'ai_assistant_fetcher'],
  [/\bGPTBot\b/i, 'GPTBot', 'OpenAI', 'ai_training_crawler'],
  [/\bClaude-SearchBot\b/i, 'Claude-SearchBot', 'Anthropic', 'ai_search_crawler'],
  [/\bClaude-User\b/i, 'Claude-User', 'Anthropic', 'ai_assistant_fetcher'],
  [/\bClaudeBot\b/i, 'ClaudeBot', 'Anthropic', 'ai_training_crawler'],
  [/\bPerplexityBot\b/i, 'PerplexityBot', 'Perplexity', 'ai_search_crawler'],
  [/\bDuckAssistBot\b/i, 'DuckAssistBot', 'DuckDuckGo', 'ai_search_crawler'],
  [/\bGoogle-Extended\b/i, 'Google-Extended', 'Google', 'ai_training_crawler'],
  [/\bGoogleOther\b/i, 'GoogleOther', 'Google', 'unknown_bot'],
  [/\bGooglebot\b/i, 'Googlebot', 'Google', 'general_search_crawler'],
  [/\bBingbot\b/i, 'Bingbot', 'Microsoft', 'general_search_crawler'],
  [/\bApplebot\b/i, 'Applebot', 'Apple', 'general_search_crawler'],
  [/\bAmazonbot\b/i, 'Amazonbot', 'Amazon', 'unknown_bot'],
  [/\bMeta-ExternalAgent\b/i, 'Meta-ExternalAgent', 'Meta', 'unknown_bot'],
  [/\bBytespider\b/i, 'Bytespider', 'ByteDance', 'ai_training_crawler'],
  [/\bCCBot\b/i, 'CCBot', 'Common Crawl', 'unknown_bot'],
];
const GENERIC_BOT = /(?:\bbot\b|crawler|spider|crawl|slurp|scrapy|archiver|headlesschrome|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|pingdom|uptime|statuscake|gtmetrix|facebookexternalhit|slackbot|discordbot)/i;
const HOST_LABELS = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** Return a known UA match, explicitly unverified, or null for an ordinary UA. */
export function classifyCrawler(userAgent) {
  if (typeof userAgent !== 'string' || !userAgent.trim()) return null;
  const value = userAgent.slice(0, 1024);
  for (const [pattern, crawler, organization, category] of REGISTRY) {
    if (pattern.test(value)) {
      return { crawler, organization, category, detectionMethod: 'known_user_agent_match', verificationStatus: 'unverified' };
    }
  }
  if (GENERIC_BOT.test(value)) {
    return { crawler: 'Unknown bot', organization: 'Unknown', category: 'unknown_bot', detectionMethod: 'generic_user_agent_match', verificationStatus: 'unverified' };
  }
  return null;
}

/**
 * Install on the site's own Node HTTP/Express-style server. It records only
 * crawler-like requests, never blocks the response, and strips the query string.
 */
export function createCrawlerMiddleware({ projectId, crawlerKey, endpoint = DEFAULT_ENDPOINT, fetchImpl = globalThis.fetch, timeoutMs = 800 } = {}) {
  if (typeof projectId !== 'string' || !projectId.trim()) throw new TypeError('projectId is required');
  if (typeof crawlerKey !== 'string' || !/^ZappaCrawler_[A-Za-z0-9_-]{32,}$/.test(crawlerKey)) throw new TypeError('A private Zappa crawler key is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('Node.js fetch is required');
  const target = new URL(endpoint);
  if (target.protocol !== 'https:' && target.hostname !== 'localhost') throw new TypeError('The crawler endpoint must use HTTPS');
  const safeTimeout = Math.max(100, Math.min(Number(timeoutMs) || 800, 3000));

  return function zappaCrawlerMiddleware(request, response, next) {
    const rawUserAgent = request?.headers?.['user-agent'];
    const userAgent = typeof rawUserAgent === 'string' ? rawUserAgent.slice(0, 1024) : '';
    if (!classifyCrawler(userAgent)) return next();

    response.once('finish', () => {
      try {
        const rawHost = request.hostname || request.headers?.host || '';
        const hostname = String(rawHost).toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
        const rawUrl = request.originalUrl || request.url || '/';
        const path = new URL(String(rawUrl), 'https://zappa.invalid').pathname;
        const method = String(request.method || 'GET').toUpperCase();
        const statusCode = Number(response.statusCode);
        if (!HOST_LABELS.test(hostname) || !path.startsWith('/') || path.length > 512 || /[\u0000-\u001f\u007f]/.test(path) || !/^[A-Z]{1,10}$/.test(method) || statusCode < 100 || statusCode > 599) return;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), safeTimeout);
        timeout.unref?.();
        const payload = {
          projectId,
          requests: [{
            requestId: randomUUID(),
            timestamp: new Date().toISOString(),
            hostname,
            path,
            method,
            statusCode,
            userAgent,
          }],
        };
        Promise.resolve(fetchImpl(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Zappa-Crawler-Key': crawlerKey },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })).catch(() => {}).finally(() => clearTimeout(timeout));
      } catch {
        // Telemetry must not affect the website request.
      }
    });
    return next();
  };
}
