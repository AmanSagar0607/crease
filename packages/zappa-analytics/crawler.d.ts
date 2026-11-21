export type CrawlerCategory =
  | 'ai_search_crawler'
  | 'ai_training_crawler'
  | 'ai_assistant_fetcher'
  | 'general_search_crawler'
  | 'unknown_bot';

export type CrawlerMatch = {
  crawler: string;
  organization: string;
  category: CrawlerCategory;
  detectionMethod: 'known_user_agent_match' | 'generic_user_agent_match';
  verificationStatus: 'unverified';
};

export type CrawlerRequest = {
  headers?: Record<string, string | undefined>;
  hostname?: string;
  originalUrl?: string;
  url?: string;
  method?: string;
};

export type CrawlerResponse = {
  statusCode: number;
  once(event: 'finish', listener: () => void): unknown;
};

export type CrawlerMiddlewareOptions = {
  projectId: string;
  crawlerKey: string;
  endpoint?: string;
  fetchImpl?: (input: URL, init: Record<string, unknown>) => Promise<unknown>;
  timeoutMs?: number;
};

export function classifyCrawler(userAgent: string | null | undefined): CrawlerMatch | null;
export function createCrawlerMiddleware(
  options: CrawlerMiddlewareOptions,
): (request: CrawlerRequest, response: CrawlerResponse, next: () => unknown) => unknown;
