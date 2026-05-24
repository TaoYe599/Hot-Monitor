import type { EngagementDetails, MonitorRecord, SourceItem, SourceKind } from "@hot-monitor/shared";
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

/** 来源收集结果 - 用于最终汇总输出 */
interface SourceResult {
  name: string;
  success: boolean;
  itemsCount: number;
  errorMessage?: string;
}

interface FeedSource {
  label: string;
  url: string;
  baseTrust: number;
}

/**
 * 包装异步来源收集函数，自动捕获结果并记录日志
 */
async function withSourceResult<T>(
  name: string,
  fn: () => Promise<T>,
  results: SourceResult[],
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const elapsed = Date.now() - start;
    const count = Array.isArray(result) ? result.length : 0;
    results.push({ name, success: true, itemsCount: count });
    console.info(`[source] ✓ ${name}: ${count} items (${elapsed}ms)`);
    return result;
  } catch (err) {
    const elapsed = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, success: false, itemsCount: 0, errorMessage: msg });
    console.warn(`[source] ✗ ${name}: failed (${elapsed}ms) - ${msg}`);
    return [] as unknown as T;
  }
}

/**
 * 输出来源汇总表格
 */
function printSourceSummary(monitorName: string, results: SourceResult[], totalItems: number): void {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.info(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.info(`│  来源汇总: ${monitorName.padEnd(49)}│`);
  console.info(`├─────────────────────────────────────────────────────────────┤`);

  for (const r of results) {
    const status = r.success ? "✓" : "✗";
    const items = r.success ? `${r.itemsCount} items` : r.errorMessage;
    const line = `│  ${status} ${r.name.padEnd(20)} ${String(items).slice(0, 30).padEnd(30)}│`;
    console.info(line);
  }

  console.info(`├─────────────────────────────────────────────────────────────┤`);
  console.info(
    `│  汇总: ${successCount} 个来源成功, ${failCount} 个来源失败, 共 ${totalItems} 条候选 │`,
  );
  console.info(`└─────────────────────────────────────────────────────────────┘\n`);
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

/**
 * 基于各个平台的 90% 百分位基准，计算归一化的互动分 (0.0 - 1.0)
 * 采用 Math.min(1.0, (value / baseline) * 0.9) 的方式映射，确保在该平台上排名前 10% 的内容能够达到 0.9 左右，极高热度可达 1.0。
 */
function normalizePlatformEngagement(value: number, baseline: number): number {
  if (value <= 0) return 0.1;
  return Number(Math.min(1.0, (value / baseline) * 0.9).toFixed(3));
}

function estimateEngagement(sourceKind: SourceKind, raw: Record<string, unknown>): number {
  if (sourceKind === "twitter") {
    const likeCount = Number(raw.likeCount ?? raw.like_count ?? raw.likes ?? 0);
    const retweetCount = Number(raw.retweetCount ?? raw.retweet_count ?? raw.retweets ?? 0);
    // Twitter 综合互动值：以点赞为主，转发和评论按权重折算
    const totalEngagement = likeCount + retweetCount * 3;
    // 基准线设定为 1000 (代表典型高热度帖子的点赞/转发综合互动度)
    return normalizePlatformEngagement(totalEngagement, 1000);
  }

  return 0.35;
}

/**
 * 从原始数据中提取各平台的详细互动数据
 */
function extractEngagementDetails(sourceKind: SourceKind, raw: Record<string, unknown>): EngagementDetails | null {
  switch (sourceKind) {
    case "twitter": {
      // 支持多种字段名格式：驼峰（likeCount）和 snake_case（like_count）
      const likeCount = Number(
        raw.likeCount ?? raw.like_count ?? raw.likes ?? 0,
      );
      const retweetCount = Number(
        raw.retweetCount ?? raw.retweet_count ?? raw.retweets ?? 0,
      );
      const viewCount = Number(
        raw.viewCount ?? raw.view_count ?? raw.views ?? raw.impression_count ?? 0,
      );
      const replyCount = Number(
        raw.replyCount ?? raw.reply_count ?? raw.replies ?? 0,
      );
      // 只有当有实际数据时才返回
      if (likeCount === 0 && retweetCount === 0 && viewCount === 0 && replyCount === 0) {
        return null;
      }
      return {
        likes: likeCount,
        retweets: retweetCount,
        views: viewCount,
        replies: replyCount,
      };
    }
    case "hackernews": {
      const points = Number(raw.points ?? 0);
      const numComments = Number(raw.num_comments ?? 0);
      if (points === 0 && numComments === 0) {
        return null;
      }
      return {
        points,
        comments: numComments,
      };
    }
    case "reddit": {
      const score = Number(raw.score ?? 0);
      const numComments = Number(raw.num_comments ?? 0);
      const ups = Number(raw.ups ?? score);
      const downs = Number(raw.downs ?? 0);
      if (score === 0 && numComments === 0) {
        return null;
      }
      return {
        score,
        upvotes: ups,
        downvotes: downs,
        comments: numComments,
      };
    }
    case "zhihu": {
      const voteCount = Number(raw.vote_count ?? 0);
      const commentCount = Number(raw.comment_count ?? 0);
      if (voteCount === 0 && commentCount === 0) {
        return null;
      }
      return {
        likes: voteCount,
        comments: commentCount,
      };
    }
    default:
      return null;
  }
}

async function collectTwitter(config: AppConfig, monitor: MonitorRecord): Promise<SourceItem[]> {
  if (!config.twitterApiKey) {
    console.warn("[twitter] API key not configured");
    return [];
  }

  const variants = generateQueryVariants(monitor).slice(0, 4);
  const queryTerms = variants.map((variant) => `"${variant}"`).join(" OR ");

  // Twitter quality filters
  const MIN_LIKES = 50;
  const MIN_RETWEETS = 20;
  const MIN_VIEWS = 2000;
  const MIN_FOLLOWERS = 2000;

  const results: SourceItem[] = [];

  // Try Top results first (higher quality), fallback to Latest
  for (const queryType of ["Top", "Latest"] as const) {
    if (results.length >= 10) break;

    const query = `${queryTerms} min_faves:${MIN_LIKES} min_retweets:${MIN_RETWEETS}`;
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
        continue;
      }

      const payload = (await response.json()) as {
        tweets?: Array<Record<string, unknown>>;
        error?: string;
      };

      if (payload.error) {
        continue;
      }

      const tweets = payload.tweets ?? [];

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
          engagementDetails: extractEngagementDetails("twitter", tweet),
        });
      }
    } catch {
      // 静默失败，由上层汇总处理
    }
  }

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
        const duckResponse = await fetchWithTimeout(duckUrl, undefined, 30000);
        if (duckResponse.ok) {
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
          candidates.push(...duckCandidates);
        }
      } catch {
        // 静默失败，由上层汇总处理
      }

      // Google News RSS
      try {
        const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(variant)}&hl=en-US&gl=US&ceid=US:en`;
        const newsFeed = await fetchAndParseFeed(googleNewsUrl);

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
      } catch {
        // 静默失败，由上层汇总处理
      }

      return candidates;
    }),
  );

  const candidates = variantResults.flat();

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
  const CONCURRENCY = 8;
  const results: SourceItem[][] = [];

  for (let i = 0; i < feeds.length; i += CONCURRENCY) {
    const batch = feeds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (feed) => {
        try {
          const parsed = await fetchAndParseFeed(feed.url);
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
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
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
            engagementScore: normalizePlatformEngagement((hit.points ?? 0) + (hit.num_comments ?? 0) * 2, 150),
            trustScore: scoreDomainTrust(hit.url, 0.88),
            tags: [],
            raw: hit as unknown as Record<string, unknown>,
            engagementDetails: extractEngagementDetails("hackernews", { points: hit.points, num_comments: hit.num_comments } as Record<string, unknown>),
          });
        }
      } catch {
        // 静默失败，由上层汇总处理
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
        // 尝试使用知乎热榜 API（不需要认证）
        const hotUrl = `https://www.zhihu.com/api/v3/follow/topics/hot-list-api?desktop=true&limit=20&offset=0`;
        const response = await fetchWithTimeout(hotUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Referer": "https://www.zhihu.com/",
          },
        }, 15000);

        if (!response.ok) {
          return candidates;
        }

        const data = (await response.json()) as {
          data?: Array<{
            id?: string;
            question?: { title?: string; url?: string };
            excerpt?: string;
            vote_count?: number;
            comment_count?: number;
            created_time?: number;
            type?: string;
          }>;
        };

        const items = data?.data ?? [];

        // 过滤与监控关键词相关的内容
        const queryLower = variant.toLowerCase();

        for (const item of items.slice(0, 10)) {
          const questionTitle = item.question?.title ?? "";
          const excerpt = item.excerpt ?? "";

          // 检查是否匹配监控关键词
          const matchesQuery = questionTitle.toLowerCase().includes(queryLower) ||
                             excerpt.toLowerCase().includes(queryLower);

          if (!matchesQuery) continue;

          candidates.push({
            sourceKind: "zhihu",
            sourceLabel: "知乎",
            title: compactText(questionTitle || "知乎热榜", 120),
            url: normalizeUrl(item.question?.url ?? `https://www.zhihu.com/question/${item.id}`),
            publishedAt: item.created_time ? new Date(item.created_time * 1000).toISOString() : null,
            author: null,
            excerpt: compactText(excerpt, 220),
            content: compactText(excerpt, 1000),
            engagementScore: normalizePlatformEngagement((item.vote_count ?? 0) + (item.comment_count ?? 0) * 3, 300),
            trustScore: scoreDomainTrust("zhihu.com", 0.8),
            tags: [],
            raw: item as unknown as Record<string, unknown>,
            engagementDetails: extractEngagementDetails("zhihu", { vote_count: item.vote_count, comment_count: item.comment_count } as Record<string, unknown>),
          });
        }
      } catch {
        // 静默失败，由上层汇总处理
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
        const response = await fetchWithTimeout(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          },
        }, 20000);

        if (!response.ok) {
          return candidates;
        }

        const html = await response.text();
        const $ = load(html);

        // 百度搜索结果有多种可能的容器，尝试多种选择器
        const resultSelectors = [
          ".result",
          ".c-container",
          "[class*='result']",
          "div[data-block-id]",
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const $any = $ as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let results: any = null;

        for (const selector of resultSelectors) {
          const found = $(selector);
          if (found.length > 0) {
            results = found;
            break;
          }
        }

        if (!results) {
          return candidates;
        }

        results.each(function(_index: number, element: unknown) {
          const titleEl = $any(element).find("h3 a, .t a, [class*='title'] a").first();
          const title = titleEl.text().trim() || $any(element).find("h3, .t, [class*='title']").first().text().trim();

          // 尝试多种链接获取方式
          let url = titleEl.attr("href") || "";

          // 百度搜索结果链接通常是重定向链接
          // 如果获取不到直接链接，尝试从 data-url 或其他属性获取
          if (!url || url === "#") {
            url = $any(element).find("a").first().attr("href") || "";
          }

          // 尝试多种摘要选择器
          const snippetSelectors = [
            ".c-abstract",
            ".content-right_8Zs40",
            ".c-span-last",
            "[class*='abstract']",
            "[class*='snippet']",
            ".c-gap-top-small",
          ];

          let snippet = "";
          for (const sel of snippetSelectors) {
            const found = $any(element).find(sel).first().text().trim();
            if (found) {
              snippet = found;
              break;
            }
          }

          // 如果还是没有摘要，获取所有文本内容
          if (!snippet) {
            const paragraphs = $any(element).find("p").map((_: number, p: unknown) => $any(p).text()).get();
            snippet = paragraphs.join(" ").trim();
          }

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
      } catch {
        // 静默失败，由上层汇总处理
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

      const response = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }, 20000); // 20 second timeout

      if (!response.ok) {
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
              ups?: number;
              downs?: number;
              selftext?: string;
              is_self?: boolean;
              link_flair_text?: string;
            };
          }>;
        };
      };

      const posts = data?.data?.children ?? [];

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
          engagementScore: normalizePlatformEngagement(score + numComments * 3, 200),
          trustScore: score >= 100 ? 0.85 : score >= 50 ? 0.78 : 0.7,
          tags: p.link_flair_text ? [p.link_flair_text] : [],
          raw: p as unknown as Record<string, unknown>,
          engagementDetails: extractEngagementDetails("reddit", { score: p.score, num_comments: p.num_comments, ups: p.ups, downs: p.downs } as Record<string, unknown>),
        });
      }
    } catch {
      // 静默失败，由上层汇总处理
    }
  }

  // 2. Search Reddit for better relevance
  for (const variant of variants.slice(0, 2)) {
    try {
      const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(variant)}&sort=relevance&t=week&limit=20`;

      const response = await fetchWithTimeout(searchUrl, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }, 20000);

      if (!response.ok) {
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
              ups?: number;
              downs?: number;
              selftext?: string;
              is_self?: boolean;
              link_flair_text?: string;
            };
          }>;
        };
      };

      const posts = data?.data?.children ?? [];

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
          engagementScore: normalizePlatformEngagement(score + numComments * 3, 200),
          trustScore: score >= 100 ? 0.85 : score >= 50 ? 0.78 : 0.7,
          tags: p.link_flair_text ? [p.link_flair_text] : [],
          raw: p as unknown as Record<string, unknown>,
          engagementDetails: extractEngagementDetails("reddit", { score: p.score, num_comments: p.num_comments, ups: p.ups, downs: p.downs } as Record<string, unknown>),
        });
      }
    } catch {
      // 静默失败，由上层汇总处理
    }
  }

  return candidates;
}

export class SourceService {
  constructor(private readonly config: AppConfig) {}

  async collect(
    monitor: MonitorRecord,
    isCancelled?: () => boolean,
  ): Promise<SourceItem[]> {
    const results: SourceResult[] = [];

    const tasks: Array<{ name: string; promise: Promise<SourceItem[]> }> = [];

    if (isCancelled?.()) return [];
    if (monitor.sources.twitter) tasks.push({ name: "Twitter", promise: collectTwitter(this.config, monitor) });
    if (isCancelled?.()) return [];
    if (monitor.sources.search) tasks.push({ name: "Search (DuckDuckGo + Google)", promise: collectSearch(monitor) });
    if (isCancelled?.()) return [];
    if (monitor.sources.rss) tasks.push({ name: "Official RSS Feeds", promise: collectFeeds(monitor, OFFICIAL_FEEDS, "rss") });
    if (isCancelled?.()) return [];
    if (monitor.sources.github) tasks.push({ name: "GitHub Releases", promise: collectFeeds(monitor, GITHUB_RELEASE_FEEDS, "github") });
    if (isCancelled?.()) return [];
    if (monitor.sources.hackernews) tasks.push({ name: "Hacker News", promise: collectHackerNews(monitor) });
    if (isCancelled?.()) return [];
    if (monitor.sources.zhihu) tasks.push({ name: "知乎", promise: collectZhihu(monitor) });
    if (isCancelled?.()) return [];
    if (monitor.sources.baidu) tasks.push({ name: "百度搜索", promise: collectBaidu(monitor) });
    if (isCancelled?.()) return [];
    if (monitor.sources.reddit) tasks.push({ name: "Reddit", promise: collectReddit(monitor) });
    if (isCancelled?.()) return [];

    // 并行执行所有来源收集，同时记录结果
    const allResults = await Promise.all(
      tasks.map((t) => withSourceResult(t.name, () => t.promise, results)),
    );

    const items = dedupeSourceItems(allResults.flat())
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

    // 输出汇总表格
    printSourceSummary(`"${monitor.query}"`, results, items.length);

    // Increase limit from 24 to 50 for better coverage
    return items.slice(0, 50);
  }
}
