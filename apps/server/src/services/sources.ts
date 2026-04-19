import type { MonitorRecord, SourceItem, SourceKind } from "@hot-monitor/shared";
import Parser from "rss-parser";
import { load } from "cheerio";

import type { AppConfig } from "../config.js";
import {
  compactText,
  dedupeSourceItems,
  generateQueryVariants,
  matchesMonitorQuery,
  normalizeUrl,
  nowIso,
  promiseTimeout,
} from "../lib/utils.js";

interface FeedSource {
  label: string;
  url: string;
  baseTrust: number;
}

const parser = new Parser();

const OFFICIAL_FEEDS: FeedSource[] = [
  { label: "OpenAI Blog", url: "https://openai.com/news/rss.xml", baseTrust: 0.96 },
  { label: "Anthropic News", url: "https://www.anthropic.com/news/rss.xml", baseTrust: 0.95 },
  { label: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", baseTrust: 0.9 },
  { label: "Google DeepMind Blog", url: "https://deepmind.google/blog/rss.xml", baseTrust: 0.92 },
];

const GITHUB_RELEASE_FEEDS: FeedSource[] = [
  { label: "openai/openai-python", url: "https://github.com/openai/openai-python/releases.atom", baseTrust: 0.92 },
  { label: "openai/openai-node", url: "https://github.com/openai/openai-node/releases.atom", baseTrust: 0.92 },
  { label: "anthropics/anthropic-sdk-typescript", url: "https://github.com/anthropics/anthropic-sdk-typescript/releases.atom", baseTrust: 0.9 },
  { label: "huggingface/transformers", url: "https://github.com/huggingface/transformers/releases.atom", baseTrust: 0.9 },
];

const USER_AGENT = "Hot-Monitor/0.1 (+https://localhost/hot-monitor)";

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return promiseTimeout(
    fetch(url, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init?.headers ?? {}),
      },
    }),
    9000,
  );
}

async function extractReadableContent(url: string): Promise<{ excerpt: string; content: string } | null> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return null;
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) {
      return null;
    }
    const html = await response.text();
    const $ = load(html);
    $("script, style, noscript, svg").remove();
    const title =
      $("article h1").first().text() ||
      $("main h1").first().text() ||
      $("h1").first().text() ||
      $("title").text();
    const paragraphs = $("article p, main p, p")
      .map((_, element) => $(element).text())
      .get()
      .filter((value) => value.trim().length > 40)
      .slice(0, 20);
    const content = compactText([title, ...paragraphs].join(" "), 3200);
    if (!content) {
      return null;
    }
    return {
      excerpt: compactText(paragraphs.slice(0, 2).join(" "), 240),
      content,
    };
  } catch {
    return null;
  }
}

function scoreDomainTrust(url: string, baseTrust = 0.5): number {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("openai.com") || hostname.includes("anthropic.com")) return 0.96;
    if (hostname.includes("github.com")) return 0.92;
    if (hostname.includes("huggingface.co") || hostname.includes("deepmind.google")) return 0.9;
    if (hostname.includes("news.google.com")) return Math.max(baseTrust, 0.65);
    return baseTrust;
  } catch {
    return baseTrust;
  }
}

function estimateEngagement(sourceKind: SourceKind, raw: Record<string, unknown>): number {
  if (sourceKind === "twitter") {
    const likeCount = Number(raw.likeCount ?? 0);
    const retweetCount = Number(raw.retweetCount ?? 0);
    const viewCount = Number(raw.viewCount ?? 0);
    return Math.min(1, ((likeCount * 0.0025) + (retweetCount * 0.01) + (viewCount * 0.00002)));
  }

  return 0.35;
}

async function collectTwitter(config: AppConfig, monitor: MonitorRecord): Promise<SourceItem[]> {
  if (!config.twitterApiKey) {
    return [];
  }

  const variants = generateQueryVariants(monitor).slice(0, 4);
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24)
    .toISOString()
    .replace("T", "_")
    .replace(/\.\d{3}Z$/, "_UTC");
  const query = `${variants.map((variant) => `"${variant}"`).join(" OR ")} since:${since}`;
  const url = new URL("https://api.twitterapi.io/twitter/tweet/advanced_search");
  url.searchParams.set("query", query);
  url.searchParams.set("queryType", "Latest");

  try {
    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        "X-API-Key": config.twitterApiKey,
      },
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      tweets?: Array<Record<string, unknown>>;
    };

    return (payload.tweets ?? []).slice(0, 8).map((tweet) => {
      const text = String(tweet.text ?? "");
      const author = (tweet.author as Record<string, unknown> | undefined)?.name;
      return {
        sourceKind: "twitter",
        sourceLabel: "X / Twitter",
        title: compactText(text, 120),
        url: normalizeUrl(String(tweet.url ?? "")),
        publishedAt: typeof tweet.createdAt === "string" ? tweet.createdAt : null,
        author: typeof author === "string" ? author : null,
        excerpt: compactText(text, 220),
        content: compactText(text, 800),
        engagementScore: estimateEngagement("twitter", tweet),
        trustScore: scoreDomainTrust(String(tweet.url ?? ""), 0.6),
        tags: [],
        raw: tweet,
      } satisfies SourceItem;
    });
  } catch {
    return [];
  }
}

export function parseDuckDuckGoResults(html: string): Array<{ title: string; url: string; snippet: string }> {
  const $ = load(html);
  return $(".result")
    .map((_, element) => {
      const title = $(element).find(".result__title a, a.result__a").first().text().trim();
      const url = $(element).find(".result__title a, a.result__a").first().attr("href") ?? "";
      const snippet = $(element).find(".result__snippet").first().text().trim();
      return { title, url, snippet };
    })
    .get()
    .filter((result) => result.title && result.url);
}

async function collectSearch(monitor: MonitorRecord): Promise<SourceItem[]> {
  const variants = generateQueryVariants(monitor).slice(0, 3);
  const candidates: SourceItem[] = [];

  try {
    for (const variant of variants) {
      const duckUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(variant)}`;
      const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(variant)}&hl=en-US&gl=US&ceid=US:en`;

      const [duckResponse, newsFeed] = await Promise.all([
        fetchWithTimeout(duckUrl),
        promiseTimeout(parser.parseURL(googleNewsUrl), 9000),
      ]);
      const html = await duckResponse.text();
      const duckResults = parseDuckDuckGoResults(html).slice(0, 4);

      const duckCandidates = await Promise.all(
        duckResults.map(async (result) => {
          const article = await extractReadableContent(result.url);
          return {
            sourceKind: "search",
            sourceLabel: "DuckDuckGo",
            title: compactText(result.title, 120),
            url: normalizeUrl(result.url),
            publishedAt: null,
            author: null,
            excerpt: compactText(result.snippet || article?.excerpt || result.title, 220),
            content: compactText(article?.content || result.snippet || result.title, 2200),
            engagementScore: 0.35,
            trustScore: scoreDomainTrust(result.url, 0.55),
            tags: [],
            raw: result as unknown as Record<string, unknown>,
          } satisfies SourceItem;
        }),
      );

      const newsCandidates = await Promise.all(
        newsFeed.items.slice(0, 5).map(async (item) => {
          const link = normalizeUrl(item.link ?? item.guid ?? "");
          const article = await extractReadableContent(link);
          return {
            sourceKind: "search",
            sourceLabel: "Google News RSS",
            title: compactText(item.title ?? "Untitled", 120),
            url: link,
            publishedAt: item.pubDate ?? null,
            author: item.creator ?? null,
            excerpt: compactText(item.contentSnippet ?? article?.excerpt ?? item.title ?? "", 220),
            content: compactText(article?.content ?? item.contentSnippet ?? item.title ?? "", 2200),
            engagementScore: 0.4,
            trustScore: scoreDomainTrust(link, 0.65),
            tags: [],
            raw: item as unknown as Record<string, unknown>,
          } satisfies SourceItem;
        }),
      );

      candidates.push(...duckCandidates, ...newsCandidates);
    }
  } catch {
    return [];
  }

  return candidates.filter((candidate) =>
    matchesMonitorQuery(
      monitor,
      `${candidate.title}\n${candidate.excerpt}\n${candidate.content}`,
    ),
  );
}

async function collectFeeds(
  monitor: MonitorRecord,
  feeds: FeedSource[],
  sourceKind: SourceKind,
): Promise<SourceItem[]> {
  const resultSets = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const parsed = await promiseTimeout(parser.parseURL(feed.url), 9000);
        return parsed.items.slice(0, 8).map((item) => {
          const link = normalizeUrl(item.link ?? item.guid ?? feed.url);
          const body = compactText(item.contentSnippet ?? item.content ?? item.title ?? "", 1800);
          return {
            sourceKind,
            sourceLabel: feed.label,
            title: compactText(item.title ?? "Untitled", 120),
            url: link,
            publishedAt: item.pubDate ?? null,
            author: item.creator ?? null,
            excerpt: compactText(item.contentSnippet ?? item.title ?? "", 220),
            content: body,
            engagementScore: 0.38,
            trustScore: feed.baseTrust,
            tags: [],
            raw: item as unknown as Record<string, unknown>,
          } satisfies SourceItem;
        });
      } catch {
        return [];
      }
    }),
  );

  return resultSets
    .flat()
    .filter((candidate) =>
      matchesMonitorQuery(
        monitor,
        `${candidate.title}\n${candidate.excerpt}\n${candidate.content}`,
      ),
    );
}

export class SourceService {
  constructor(private readonly config: AppConfig) {}

  async collect(monitor: MonitorRecord): Promise<SourceItem[]> {
    const tasks: Array<Promise<SourceItem[]>> = [];

    if (monitor.sources.twitter) tasks.push(collectTwitter(this.config, monitor));
    if (monitor.sources.search) tasks.push(collectSearch(monitor));
    if (monitor.sources.rss) tasks.push(collectFeeds(monitor, OFFICIAL_FEEDS, "rss"));
    if (monitor.sources.github) tasks.push(collectFeeds(monitor, GITHUB_RELEASE_FEEDS, "github"));

    const items = dedupeSourceItems((await Promise.all(tasks)).flat())
      .map((item) => ({
        ...item,
        raw: {
          ...item.raw,
          collectedAt: nowIso(),
        },
      }))
      .sort((left, right) => {
        const leftScore = left.trustScore + left.engagementScore;
        const rightScore = right.trustScore + right.engagementScore;
        return rightScore - leftScore;
      });

    console.info(
      `[source] collected ${items.length} candidates for monitor ${monitor.id} (${monitor.query})`,
    );

    return items.slice(0, 24);
  }
}
