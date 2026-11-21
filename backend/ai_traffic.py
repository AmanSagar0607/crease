"""Deterministic classification for observed AI referrers and crawler user agents.

A hostname or User-Agent match is evidence, not proof of crawler ownership. The
crawler result intentionally stays unverified until source IP validation exists.
"""
from __future__ import annotations

import re

AI_REFERRAL_DOMAINS = {
    'chatgpt.com': 'ChatGPT',
    'chat.openai.com': 'ChatGPT',
    'claude.ai': 'Claude',
    'perplexity.ai': 'Perplexity',
    'gemini.google.com': 'Gemini',
    'copilot.microsoft.com': 'Microsoft Copilot',
    'copilot.com': 'Microsoft Copilot',
    'you.com': 'You.com',
    'phind.com': 'Phind',
    'poe.com': 'Poe',
    'duck.ai': 'DuckDuckGo AI',
}

# Ordered from specific provider identifiers to broader generic bot evidence.
CRAWLER_REGISTRY = (
    (r'\bOAI-SearchBot\b', 'OAI-SearchBot', 'OpenAI', 'ai_search_crawler'),
    (r'\bChatGPT-User\b', 'ChatGPT-User', 'OpenAI', 'ai_assistant_fetcher'),
    (r'\bGPTBot\b', 'GPTBot', 'OpenAI', 'ai_training_crawler'),
    (r'\bClaude-SearchBot\b', 'Claude-SearchBot', 'Anthropic', 'ai_search_crawler'),
    (r'\bClaude-User\b', 'Claude-User', 'Anthropic', 'ai_assistant_fetcher'),
    (r'\bClaudeBot\b', 'ClaudeBot', 'Anthropic', 'ai_training_crawler'),
    (r'\bPerplexityBot\b', 'PerplexityBot', 'Perplexity', 'ai_search_crawler'),
    (r'\bDuckAssistBot\b', 'DuckAssistBot', 'DuckDuckGo', 'ai_search_crawler'),
    (r'\bGoogle-Extended\b', 'Google-Extended', 'Google', 'ai_training_crawler'),
    (r'\bGoogleOther\b', 'GoogleOther', 'Google', 'unknown_bot'),
    (r'\bGooglebot\b', 'Googlebot', 'Google', 'general_search_crawler'),
    (r'\bBingbot\b', 'Bingbot', 'Microsoft', 'general_search_crawler'),
    (r'\bApplebot\b', 'Applebot', 'Apple', 'general_search_crawler'),
    (r'\bAmazonbot\b', 'Amazonbot', 'Amazon', 'unknown_bot'),
    (r'\bMeta-ExternalAgent\b', 'Meta-ExternalAgent', 'Meta', 'unknown_bot'),
    (r'\bBytespider\b', 'Bytespider', 'ByteDance', 'ai_training_crawler'),
    (r'\bCCBot\b', 'CCBot', 'Common Crawl', 'unknown_bot'),
)

_CRAWLER_PATTERNS = tuple(
    (re.compile(pattern, re.IGNORECASE), name, organization, category)
    for pattern, name, organization, category in CRAWLER_REGISTRY
)
_GENERIC_BOT = re.compile(
    r'(?:\bbot\b|crawler|spider|crawl|slurp|scrapy|archiver|'
    r'headlesschrome|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|'
    r'pingdom|uptime|statuscake|gtmetrix|facebookexternalhit|slackbot|discordbot)',
    re.IGNORECASE,
)


def _matches_host(hostname: str, domain: str) -> bool:
    host = hostname.strip().lower().rstrip('.')
    return host == domain or host.endswith('.' + domain)


def classify_ai_referrer(hostname: str | None) -> str | None:
    """Map only reliably identifiable AI product hosts; ordinary search stays excluded."""
    if not isinstance(hostname, str) or not hostname.strip():
        return None
    host = hostname.strip().lower().rstrip('.')
    for domain, platform in AI_REFERRAL_DOMAINS.items():
        if _matches_host(host, domain):
            return platform
    return None


def classify_crawler(user_agent: str | None) -> dict[str, str] | None:
    """Return registry evidence for a bot-like UA; never calls it verified."""
    if not isinstance(user_agent, str) or not user_agent.strip():
        return None
    value = user_agent[:1024]
    for pattern, name, organization, category in _CRAWLER_PATTERNS:
        if pattern.search(value):
            return {
                'crawler_name': name,
                'organization': organization,
                'category': category,
                'detection_method': 'known_user_agent_match',
                'verification_status': 'unverified',
            }
    if _GENERIC_BOT.search(value):
        return {
            'crawler_name': 'Unknown bot',
            'organization': 'Unknown',
            'category': 'unknown_bot',
            'detection_method': 'generic_user_agent_match',
            'verification_status': 'unverified',
        }
    return None


def ai_referrer_case_sql(column: str) -> str:
    """Build a fixed-registry SQL CASE expression; ``column`` is an internal constant."""
    branches = []
    for domain, platform in AI_REFERRAL_DOMAINS.items():
        label = platform.replace("'", "''")
        safe_domain = domain.replace("'", "''")
        branches.append(
            f"WHEN lower({column}) = '{safe_domain}' OR lower({column}) LIKE '%.{safe_domain}' THEN '{label}'"
        )
    return 'CASE ' + ' '.join(branches) + ' ELSE NULL END'
