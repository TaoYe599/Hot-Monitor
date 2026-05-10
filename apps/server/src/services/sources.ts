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
  { label: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", baseTrust: 0.9 },
  { label: "Google DeepMind Blog", url: "https://deepmind.google/blog/rss.xml", baseTrust: 0.92 },
];

const GITHUB_RELEASE_FEEDS: FeedSource[] = [
  // OpenAI & Anthropic
  { label: "openai/openai-python", url: "https://github.com/openai/openai-python/releases.atom", baseTrust: 0.92 },
  { label: "openai/openai-node", url: "https://github.com/openai/openai-node/releases.atom", baseTrust: 0.92 },
  { label: "anthropics/anthropic-sdk-typescript", url: "https://github.com/anthropics/anthropic-sdk-typescript/releases.atom", baseTrust: 0.9 },
  // Hugging Face
  { label: "huggingface/transformers", url: "https://github.com/huggingface/transformers/releases.atom", baseTrust: 0.9 },
  { label: "huggingface/peft", url: "https://github.com/huggingface/peft/releases.atom", baseTrust: 0.88 },
  { label: "huggingface/accelerate", url: "https://github.com/huggingface/accelerate/releases.atom", baseTrust: 0.88 },
  { label: "huggingface/datasets", url: "https://github.com/huggingface/datasets/releases.atom", baseTrust: 0.88 },
  { label: "huggingface/tokenizers", url: "https://github.com/huggingface/tokenizers/releases.atom", baseTrust: 0.88 },
  // Meta Llama
  { label: "meta-llama/llama", url: "https://github.com/meta-llama/llama/releases.atom", baseTrust: 0.91 },
  { label: "meta-llama/llama-recipes", url: "https://github.com/meta-llama/llama-recipes/releases.atom", baseTrust: 0.88 },
  // Mistral AI
  { label: "mistralai/cookbook", url: "https://github.com/mistralai/cookbook/releases.atom", baseTrust: 0.85 },
  // Chinese LLMs
  { label: "THUDM/chatglm3", url: "https://github.com/THUDM/ChatGLM3/releases.atom", baseTrust: 0.88 },
  { label: "THUDM/ChatGLM", url: "https://github.com/THUDM/ChatGLM/releases.atom", baseTrust: 0.88 },
  { label: "deepseek-ai/DeepSeek-V2", url: "https://github.com/deepseek-ai/DeepSeek-V2/releases.atom", baseTrust: 0.89 },
  { label: "deepseek-ai/deepseek-mcp", url: "https://github.com/deepseek-ai/deepseek-mcp/releases.atom", baseTrust: 0.85 },
  { label: "QwenLM/Qwen", url: "https://github.com/QwenLM/Qwen/releases.atom", baseTrust: 0.89 },
  { label: "QwenLM/qwen-turbo", url: "https://github.com/QwenLM/qwen-turbo/releases.atom", baseTrust: 0.85 },
  // Stability AI
  { label: "Stability-AI/stability-sdk", url: "https://github.com/Stability-AI/stability-sdk/releases.atom", baseTrust: 0.86 },
  // LangChain & Agents
  { label: "langchain-ai/langchain", url: "https://github.com/langchain-ai/langchain/releases.atom", baseTrust: 0.87 },
  { label: "langchain-ai/langgraph", url: "https://github.com/langchain-ai/langgraph/releases.atom", baseTrust: 0.86 },
  { label: "microsoft/autogen", url: "https://github.com/microsoft/autogen/releases.atom", baseTrust: 0.88 },
  // Google
  { label: "google/generative-ai-python", url: "https://github.com/google/generative-ai-python/releases.atom", baseTrust: 0.9 },
  { label: "google/gemma-pytorch", url: "https://github.com/google/gemma-pytorch/releases.atom", baseTrust: 0.88 },
  { label: "google/maxtext", url: "https://github.com/google/maxtext/releases.atom", baseTrust: 0.85 },
  // Microsoft
  { label: "microsoft/TypeChat", url: "https://github.com/microsoft/TypeChat/releases.atom", baseTrust: 0.86 },
  { label: "microsoft/onnxruntime", url: "https://github.com/microsoft/onnxruntime/releases.atom", baseTrust: 0.85 },
  { label: "microsoft/guidance", url: "https://github.com/microsoft/guidance/releases.atom", baseTrust: 0.84 },
  // Embeddings & Vector
  { label: "embeddings-benchmark/mteb", url: "https://github.com/embeddings-benchmark/mteb/releases.atom", baseTrust: 0.83 },
  { label: "chromadb/chroma", url: "https://github.com/chromadb/chroma/releases.atom", baseTrust: 0.84 },
  // Open Source Models
  { label: "ollama/ollama", url: "https://github.com/ollama/ollama/releases.atom", baseTrust: 0.87 },
  { label: "lmstudio-ai/lmstudio", url: "https://github.com/lmstudio-ai/lmstudio/releases.atom", baseTrust: 0.82 },
  // AI Infrastructure
  { label: "vllm-project/vllm", url: "https://github.com/vllm-project/vllm/releases.atom", baseTrust: 0.89 },
  { label: "predibase/lorax", url: "https://github.com/predibase/lorax/releases.atom", baseTrust: 0.82 },
  // Multimodal
  { label: "llava-onevision/lmms", url: "https://github.com/llava-onevision/lmms/releases.atom", baseTrust: 0.84 },
  { label: "IDEA-Research/GroundingDINO", url: "https://github.com/IDEA-Research/GroundingDINO/releases.atom", baseTrust: 0.82 },
];

const USER_AGENT = "Hot-Monitor/0.1 (+https://localhost/hot-monitor)";

type ParserFeed = Awaited<ReturnType<typeof parser.parseURL>>;

async function fetchAndParseFeed(url: string, timeoutMs = 30000): Promise<ParserFeed> {
  const response = await fetchWithTimeout(url, undefined, timeoutMs);
  const xml = await response.text();
  return parser.parseString(xml);
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
  return promiseTimeout(
    fetch(url, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init?.headers ?? {}),
      },
    }),
    timeoutMs,
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
    if (hostname.includes("news.ycombinator.com")) return 0.88;
    if (hostname.includes("zhihu.com")) return 0.8;
    if (hostname.includes("baidu.com")) return Math.max(baseTrust, 0.6);
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) return 0.82;
    if (hostname.includes("t.co")) return 0.78;
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
    console.warn("[twitter] API key not configured");
    return [];
  }

  console.info(`[twitter] API key configured: ${config.twitterApiKey.substring(0, 8)}...`);

  const variants = generateQueryVariants(monitor).slice(0, 4);
  const queryTerms = variants.map((variant) => `"${variant}"`).join(" OR ");

  // Twitter quality filters
  const MIN_LIKES = 50;
  const MIN_RETWEETS = 20;
  const MIN_VIEWS = 2000;
  const MIN_FOLLOWERS = 2000;

  console.info(`[twitter] filters: likes>=${MIN_LIKES}, retweets>=${MIN_RETWEETS}, views>=${MIN_VIEWS}, followers>=${MIN_FOLLOWERS}`);

  const results: SourceItem[] = [];

  // Try Top results first (higher quality), fallback to Latest
  for (const queryType of ["Top", "Latest"] as const) {
    if (results.length >= 10) break;

    const query = `${queryTerms} min_faves:${MIN_LIKES} min_retweets:${MIN_RETWEETS}`;
    console.info(`[twitter] searching with query: ${query} (${queryType})`);

    const url = new URL("https://api.twitterapi.io/twitter/tweet/advanced_search");
    url.searchParams.set("query", query);
    url.searchParams.set("queryType", queryType);

    try {
      const response = await fetchWithTimeout(url.toString(), {
        headers: {
          "X-API-Key": config.twitterApiKey,
        },
      });
      if (!response.ok) {
        console.warn(`[twitter] API returned ${response.status} for query: ${query}`);
        continue;
      }

      const payload = (await response.json()) as {
        tweets?: Array<Record<string, unknown>>;
        error?: string;
      };

      if (payload.error) {
        console.warn(`[twitter] API error: ${payload.error}`);
        continue;
      }

      const tweets = payload.tweets ?? [];
      console.info(`[twitter] fetched ${tweets.length} tweets (${queryType})`);

      for (const tweet of tweets) {
        // Skip replies (only keep original tweets)
        if (tweet.isReply) {
          continue;
        }

        const text = String(tweet.text ?? "");
        const authorObj = tweet.author as Record<string, unknown> | undefined;
        const authorName = typeof authorObj?.name === "string"
          ? authorObj.name
          : typeof authorObj?.displayName === "string"
            ? authorObj.displayName
            : null;

        // Extract engagement metrics
        const likeCount = Number(tweet.likeCount ?? 0);
        const retweetCount = Number(tweet.retweetCount ?? 0);
        const viewCount = Number(tweet.viewCount ?? 0);
        const followers = Number(authorObj?.followers ?? 0);
        const isBlueVerified = Boolean(authorObj?.isBlueVerified);

        // Apply quality filters
        if (likeCount < MIN_LIKES) continue;
        if (retweetCount < MIN_RETWEETS) continue;
        if (viewCount < MIN_VIEWS && followers < MIN_FOLLOWERS && !isBlueVerified) continue;
        if (followers < MIN_FOLLOWERS && !isBlueVerified && likeCount < MIN_LIKES * 3) continue;

        // Calculate trust score: base + blue verified bonus + follower bonus
        let trustScore = 0.6;
        if (isBlueVerified) trustScore += 0.2;
        if (followers >= 1000) trustScore += 0.05;
        if (followers >= 10000) trustScore += 0.05;
        trustScore = Math.min(0.95, trustScore);

        results.push({
          sourceKind: "twitter",
          sourceLabel: "X / Twitter",
          title: compactText(text, 120),
          url: normalizeUrl(String(tweet.url ?? "")),
          publishedAt: typeof tweet.createdAt === "string" ? tweet.createdAt : null,
          author: authorName,
          excerpt: compactText(text, 220),
          content: compactText(text, 800),
          engagementScore: estimateEngagement("twitter", tweet),
          trustScore,
          tags: [],
          raw: tweet,
        });
      }
    } catch {
      console.warn(`[twitter] ${queryType} search failed`);
    }
  }

  console.info(`[twitter] processed ${results.length} tweets into candidates`);
  return results;
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

  const variantResults = await Promise.all(
    variants.map(async (variant) => {
      const candidates: SourceItem[] = [];

      // DuckDuckGo search
      try {
        const duckUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(variant)}`;
        console.info(`[search] fetching DuckDuckGo for "${variant}"`);
        const duckResponse = await fetchWithTimeout(duckUrl, undefined, 30000);
        if (duckResponse.ok) {
          const html = await duckResponse.text();
          const duckResults = parseDuckDuckGoResults(html).slice(0, 4);
          console.info(`[search] DuckDuckGo got ${duckResults.length} results for "${variant}"`);

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
          candidates.push(...duckCandidates);
        }
      } catch (err) {
        console.warn(`[search] DuckDuckGo failed for "${variant}": ${err instanceof Error ? err.message : String(err)}`);
      }

      // Google News RSS
      try {
        const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(variant)}&hl=en-US&gl=US&ceid=US:en`;
        console.info(`[search] fetching Google News for "${variant}"`);
        const newsFeed = await fetchAndParseFeed(googleNewsUrl);
        console.info(`[search] Google News got ${newsFeed.items.length} items for "${variant}"`);

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
        candidates.push(...newsCandidates);
      } catch (err) {
        console.warn(`[search] Google News failed for "${variant}": ${err instanceof Error ? err.message : String(err)}`);
      }

      return candidates;
    }),
  );

  const candidates = variantResults.flat();
  const duckCount = candidates.filter((c) => c.sourceLabel === "DuckDuckGo").length;
  const newsCount = candidates.filter((c) => c.sourceLabel === "Google News RSS").length;
  console.info(`[search] fetched ${duckCount} duck + ${newsCount} news candidates for ${variants.join(", ")}`);

  const matchedCandidates = candidates.filter((candidate) =>
    matchesMonitorQuery(
      monitor,
      `${candidate.title}\n${candidate.excerpt}\n${candidate.content}`,
    ),
  );
  console.info(`[search] filtered to ${matchedCandidates.length}/${candidates.length} candidates after matchesMonitorQuery`);

  return matchedCandidates;
}

async function collectFeeds(
  monitor: MonitorRecord,
  feeds: FeedSource[],
  sourceKind: SourceKind,
): Promise<SourceItem[]> {
  const CONCURRENCY = 8;
  const results: SourceItem[][] = [];

  for (let i = 0; i < feeds.length; i += CONCURRENCY) {
    const batch = feeds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (feed) => {
        try {
          console.info(`[feeds] fetching ${feed.label} (${feed.url})`);
          const parsed = await fetchAndParseFeed(feed.url);
          console.info(`[feeds] ${feed.label} got ${parsed.items.length} items`);
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
        } catch (err) {
          console.warn(`[feeds] ${feed.label} failed: ${err instanceof Error ? err.message : String(err)}`);
          return [];
        }
      }),
    );
    results.push(...batchResults);
  }

  return results
    .flat()
    .filter((candidate) =>
      matchesMonitorQuery(
        monitor,
        `${candidate.title}\n${candidate.excerpt}\n${candidate.content}`,
      ),
    );
}

async function collectHackerNews(monitor: MonitorRecord): Promise<SourceItem[]> {
  const variants = generateQueryVariants(monitor).slice(0, 3);

  const variantResults = await Promise.all(
    variants.map(async (variant) => {
      const candidates: SourceItem[] = [];
      try {
        const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(variant)}&tags=story&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 48 * 3600}&hitsPerPage=10`;
        console.info(`[hackernews] fetching for "${variant}"`);
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
          console.warn(`[hackernews] API returned ${response.status} for "${variant}"`);
          return candidates;
        }

        const data = (await response.json()) as {
          hits?: Array<{
            title?: string;
            url?: string;
            objectID?: string;
            author?: string;
            created_at?: string;
            points?: number;
            num_comments?: number;
            _highlightResult?: Record<string, { value?: string }>;
          }>;
        };

        const hits = data.hits ?? [];
        console.info(`[hackernews] fetched ${hits.length} results for "${variant}"`);

        for (const hit of hits.slice(0, 6)) {
          if (!hit.url) continue;
          candidates.push({
            sourceKind: "hackernews",
            sourceLabel: "Hacker News",
            title: compactText(hit.title ?? "Untitled", 120),
            url: normalizeUrl(hit.url),
            publishedAt: hit.created_at ?? null,
            author: hit.author ?? null,
            excerpt: compactText(hit._highlightResult?.title?.value ?? hit.title ?? "", 220),
            content: compactText(hit.title ?? "", 800),
            engagementScore: Math.min(1, ((hit.points ?? 0) * 0.001) + ((hit.num_comments ?? 0) * 0.002)),
            trustScore: scoreDomainTrust(hit.url, 0.88),
            tags: [],
            raw: hit as unknown as Record<string, unknown>,
          });
        }
      } catch (err) {
        console.warn(`[hackernews] failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return candidates;
    }),
  );

  return variantResults.flat();
}

async function collectZhihu(monitor: MonitorRecord): Promise<SourceItem[]> {
  const variants = generateQueryVariants(monitor).slice(0, 2);

  const variantResults = await Promise.all(
    variants.map(async (variant) => {
      const candidates: SourceItem[] = [];
      try {
        const url = `https://www.zhihu.com/api/v4/search_v3?t=general&q=${encodeURIComponent(variant)}&correction=1&offset=0&limit=20&filter_fields=&lc_idx=0&show_all_topics=0`;
        console.info(`[zhihu] fetching for "${variant}"`);

        const response = await fetchWithTimeout(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.zhihu.com",
            "X-API-VERSION": "3.0.91",
          },
        });

        if (!response.ok) {
          console.warn(`[zhihu] API returned ${response.status} for "${variant}"`);
          return candidates;
        }

        const data = (await response.json()) as {
          data?: Array<{
            object?: {
              question?: { title?: string; url?: string };
              answer?: { excerpt?: string; created_time?: number; voteup_count?: number; comment_count?: number };
              article?: { title?: string; excerpt?: string; created_at?: number; voteup_count?: number };
              type?: string;
            };
          }>;
        };

        const items = data?.data ?? [];
        console.info(`[zhihu] fetched ${items.length} results for "${variant}"`);

        for (const item of items.slice(0, 6)) {
          const obj = item.object;
          if (!obj) continue;

          if (obj.question && obj.answer) {
            candidates.push({
              sourceKind: "zhihu",
              sourceLabel: "知乎",
              title: compactText(obj.question.title ?? "Untitled", 120),
              url: normalizeUrl(obj.question.url ?? ""),
              publishedAt: obj.answer.created_time ? new Date(obj.answer.created_time * 1000).toISOString() : null,
              author: null,
              excerpt: compactText(obj.answer.excerpt ?? "", 220),
              content: compactText(obj.answer.excerpt ?? "", 1000),
              engagementScore: Math.min(1, ((obj.answer.voteup_count ?? 0) * 0.001) + ((obj.answer.comment_count ?? 0) * 0.002)),
              trustScore: scoreDomainTrust("zhihu.com", 0.8),
              tags: [],
              raw: obj as unknown as Record<string, unknown>,
            });
          } else if (obj.article) {
            candidates.push({
              sourceKind: "zhihu",
              sourceLabel: "知乎",
              title: compactText(obj.article.title ?? "Untitled", 120),
              url: normalizeUrl(`https://zhuanlan.zhihu.com/p/${obj.article?.title ?? ""}`),
              publishedAt: obj.article.created_at ? new Date(obj.article.created_at * 1000).toISOString() : null,
              author: null,
              excerpt: compactText(obj.article.excerpt ?? "", 220),
              content: compactText(obj.article.excerpt ?? "", 1000),
              engagementScore: Math.min(1, (obj.article.voteup_count ?? 0) * 0.001),
              trustScore: scoreDomainTrust("zhihu.com", 0.8),
              tags: [],
              raw: obj as unknown as Record<string, unknown>,
            });
          }
        }
      } catch (err) {
        console.warn(`[zhihu] failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return candidates;
    }),
  );

  return variantResults.flat();
}

async function collectBaidu(monitor: MonitorRecord): Promise<SourceItem[]> {
  const variants = generateQueryVariants(monitor).slice(0, 2);

  const variantResults = await Promise.all(
    variants.map(async (variant) => {
      const candidates: SourceItem[] = [];
      try {
        const url = `https://www.baidu.com/s?wd=${encodeURIComponent(variant)}&rn=10&ie=utf-8`;
        console.info(`[baidu] fetching for "${variant}"`);
        const response = await fetchWithTimeout(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          console.warn(`[baidu] API returned ${response.status} for "${variant}"`);
          return candidates;
        }

        const html = response.text();
        const $ = load(await html);

        $(".result").each((_, element) => {
          const titleEl = $(element).find("h3 a").first();
          const title = titleEl.text().trim();
          const url = titleEl.attr("href") ?? "";
          const snippet = $(element).find(".c-abstract, .content-right_8Zs40").first().text().trim();

          if (title && url) {
            candidates.push({
              sourceKind: "baidu",
              sourceLabel: "百度搜索",
              title: compactText(title, 120),
              url: normalizeUrl(url),
              publishedAt: null,
              author: null,
              excerpt: compactText(snippet, 220),
              content: compactText(snippet, 1000),
              engagementScore: 0.35,
              trustScore: scoreDomainTrust(url, 0.6),
              tags: [],
              raw: { title, url, snippet } as unknown as Record<string, unknown>,
            });
          }
        });

        console.info(`[baidu] fetched ${candidates.length} results for "${variant}"`);
      } catch (err) {
        console.warn(`[baidu] failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return candidates;
    }),
  );

  return variantResults.flat();
}

// Reddit subreddits to monitor for AI/tech content
const REDDIT_SUBREDDITS = [
  { name: "MachineLearning", label: "r/MachineLearning" },
  { name: "LocalLLaMA", label: "r/LocalLLaMA" },
  { name: "technology", label: "r/technology" },
  { name: "programming", label: "r/programming" },
];

async function collectReddit(monitor: MonitorRecord): Promise<SourceItem[]> {
  const candidates: SourceItem[] = [];
  const variants = generateQueryVariants(monitor);

  // Try both hot posts and search to get better coverage
  // 1. Fetch hot posts from each subreddit (for trending AI news)
  for (const subreddit of REDDIT_SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${subreddit.name}/hot.json?limit=25`;
      console.info(`[reddit] fetching r/${subreddit.name}/hot`);

      const response = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }, 20000); // 20 second timeout

      if (!response.ok) {
        console.warn(`[reddit] r/${subreddit.name} returned ${response.status}`);
        continue;
      }

      const data = (await response.json()) as {
        data?: {
          children?: Array<{
            data?: {
              title?: string;
              url?: string;
              permalink?: string;
              created_utc?: number;
              author?: string;
              subreddit?: string;
              score?: number;
              num_comments?: number;
              selftext?: string;
              is_self?: boolean;
              link_flair_text?: string;
            };
          }>;
        };
      };

      const posts = data?.data?.children ?? [];
      console.info(`[reddit] r/${subreddit.name} got ${posts.length} posts`);

      for (const post of posts) {
        const p = post.data;
        if (!p?.title) continue;

        const titleLower = p.title.toLowerCase();
        // Check if post matches monitor query
        const matchesQuery = variants.some((v) => titleLower.includes(v.toLowerCase()));

        // Also check selftext if it's a self post
        const contentLower = p.selftext?.toLowerCase() ?? "";
        const matchesContent = matchesQuery || (p.is_self && variants.some((v) => contentLower.includes(v.toLowerCase())));

        if (!matchesQuery && !matchesContent) continue;

        const score = p.score ?? 0;
        const numComments = p.num_comments ?? 0;

        // Filter very low-engagement posts
        if (score < 3 && numComments < 2) continue;

        candidates.push({
          sourceKind: "reddit",
          sourceLabel: subreddit.label,
          title: compactText(p.title, 120),
          url: normalizeUrl(p.is_self ? `https://www.reddit.com${p.permalink}` : (p.url ?? `https://www.reddit.com${p.permalink}`)),
          publishedAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
          author: p.author ?? null,
          excerpt: compactText(p.selftext ?? p.title, 220),
          content: compactText(p.selftext ?? p.title, 1000),
          engagementScore: Math.min(1, ((score * 0.0008) + (numComments * 0.002))),
          trustScore: score >= 100 ? 0.85 : score >= 50 ? 0.78 : 0.7,
          tags: p.link_flair_text ? [p.link_flair_text] : [],
          raw: p as unknown as Record<string, unknown>,
        });
      }
    } catch (err) {
      console.warn(`[reddit] r/${subreddit.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Search Reddit for better relevance
  for (const variant of variants.slice(0, 2)) {
    try {
      const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(variant)}&sort=relevance&t=week&limit=20`;
      console.info(`[reddit] searching for "${variant}"`);

      const response = await fetchWithTimeout(searchUrl, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }, 20000);

      if (!response.ok) {
        console.warn(`[reddit] search returned ${response.status}`);
        continue;
      }

      const data = (await response.json()) as {
        data?: {
          children?: Array<{
            data?: {
              title?: string;
              url?: string;
              permalink?: string;
              created_utc?: number;
              author?: string;
              subreddit?: string;
              score?: number;
              num_comments?: number;
              selftext?: string;
              is_self?: boolean;
              link_flair_text?: string;
            };
          }>;
        };
      };

      const posts = data?.data?.children ?? [];
      console.info(`[reddit] search got ${posts.length} posts for "${variant}"`);

      for (const post of posts) {
        const p = post.data;
        if (!p?.title) continue;

        const score = p.score ?? 0;
        const numComments = p.num_comments ?? 0;

        // Filter very low-engagement posts
        if (score < 2 && numComments < 1) continue;

        candidates.push({
          sourceKind: "reddit",
          sourceLabel: `r/${p.subreddit ?? "unknown"}`,
          title: compactText(p.title, 120),
          url: normalizeUrl(p.is_self ? `https://www.reddit.com${p.permalink}` : (p.url ?? `https://www.reddit.com${p.permalink}`)),
          publishedAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
          author: p.author ?? null,
          excerpt: compactText(p.selftext ?? p.title, 220),
          content: compactText(p.selftext ?? p.title, 1000),
          engagementScore: Math.min(1, ((score * 0.0008) + (numComments * 0.002))),
          trustScore: score >= 100 ? 0.85 : score >= 50 ? 0.78 : 0.7,
          tags: p.link_flair_text ? [p.link_flair_text] : [],
          raw: p as unknown as Record<string, unknown>,
        });
      }
    } catch (err) {
      console.warn(`[reddit] search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.info(`[reddit] collected ${candidates.length} candidates for monitor ${monitor.query}`);
  return candidates;
}

async function collectGoogle(monitor: MonitorRecord): Promise<SourceItem[]> {
  const variants = generateQueryVariants(monitor).slice(0, 2);

  const variantResults = await Promise.all(
    variants.map(async (variant) => {
      const candidates: SourceItem[] = [];
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(variant)}&tbm=nws&num=10`;
        console.info(`[google] fetching for "${variant}"`);
        const response = await fetchWithTimeout(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
        });

        if (!response.ok) {
          console.warn(`[google] API returned ${response.status} for "${variant}"`);
          return candidates;
        }

        const html = await response.text();
        const $ = load(html);

        $("div.SoaBEf").each((_, element) => {
          const titleEl = $(element).find("div.MBeuO").first();
          const linkEl = $(element).find("a");
          const snippetEl = $(element).find("div.GI74Re").first();
          const sourceEl = $(element).find("div.CEMjEf span").first();

          const title = titleEl.text().trim();
          const link = linkEl.attr("href") ?? "";
          const snippet = snippetEl.text().trim();
          const source = sourceEl.text().trim();

          if (title) {
            candidates.push({
              sourceKind: "google",
              sourceLabel: "Google News",
              title: compactText(title, 120),
              url: normalizeUrl(link.startsWith("/") ? `https://www.google.com${link}` : link),
              publishedAt: null,
              author: source || null,
              excerpt: compactText(snippet, 220),
              content: compactText(`${title} ${snippet}`, 1000),
              engagementScore: 0.45,
              trustScore: scoreDomainTrust("google.com", 0.82),
              tags: [],
              raw: { title, link, snippet, source } as unknown as Record<string, unknown>,
            });
          }
        });

        console.info(`[google] fetched ${candidates.length} results for "${variant}"`);
      } catch (err) {
        console.warn(`[google] failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return candidates;
    }),
  );

  return variantResults.flat();
}

export class SourceService {
  constructor(private readonly config: AppConfig) {}

  async collect(monitor: MonitorRecord): Promise<SourceItem[]> {
    const tasks: Array<Promise<SourceItem[]>> = [];

    console.info(`[source] sources config for monitor ${monitor.id}:`, JSON.stringify(monitor.sources));

    if (monitor.sources.twitter) tasks.push(collectTwitter(this.config, monitor));
    if (monitor.sources.search) tasks.push(collectSearch(monitor));
    if (monitor.sources.google) tasks.push(collectGoogle(monitor));
    if (monitor.sources.rss) tasks.push(collectFeeds(monitor, OFFICIAL_FEEDS, "rss"));
    if (monitor.sources.github) tasks.push(collectFeeds(monitor, GITHUB_RELEASE_FEEDS, "github"));
    if (monitor.sources.hackernews) tasks.push(collectHackerNews(monitor));
    if (monitor.sources.zhihu) tasks.push(collectZhihu(monitor));
    if (monitor.sources.baidu) tasks.push(collectBaidu(monitor));
    if (monitor.sources.reddit) tasks.push(collectReddit(monitor));

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

    // Increase limit from 24 to 50 for better coverage
    return items.slice(0, 50);
  }
}
