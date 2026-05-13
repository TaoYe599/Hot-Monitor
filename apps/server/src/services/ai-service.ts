import type {
  HotspotClusterOutput,
  MonitorRecord,
  SourceItem,
  VerifyKeywordOutput,
} from "@hot-monitor/shared";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import {
  buildQueryTerms,
  compactText,
  computeFreshnessScore,
  expandQuery,
  keywordDensity,
  keywordDensityWithExpansion,
} from "../lib/utils.js";

// ============================================================
// Step 1: 相关性判断 Schema
// ============================================================
const relevanceSchema = z.object({
  isRelated: z.boolean(),
  relevanceScore: z.number().min(0).max(1),
  matchType: z.enum(["direct", "semantic", "indirect"]),
  evidence: z.object({
    matchedTerms: z.array(z.string()),
    context: z.string(),
  }),
  reason: z.string(),
});

// ============================================================
// Step 2: 真实性判断 Schema
// ============================================================
const verifyAuthenticitySchema = z.object({
  isAuthentic: z.boolean(),
  authenticityScore: z.number().min(0).max(1),
  summary: z.string(),
  reason: z.string(),
  evidence: z
    .array(
      z.object({
        quote: z.string(),
        reason: z.string(),
      }),
    )
    .max(3),
});

const verifyKeywordSchema = z.object({
  isMatch: z.boolean(),
  authenticityScore: z.number().min(0).max(1),
  relevanceScore: z.number().min(0).max(1),
  matchType: z.enum(["direct", "semantic", "indirect"]).optional(),
  reason: z.string(),
  summary: z.string(),
  evidence: z
    .array(
      z.object({
        quote: z.string(),
        reason: z.string(),
      }),
    )
    .max(3),
});

const discoverHotspotsSchema = z.object({
  clusters: z.array(
    z.object({
      label: z.string(),
      summary: z.string(),
      score: z.number().min(0).max(1),
      diversityScore: z.number().min(0).max(1),
      freshnessScore: z.number().min(0).max(1),
      engagementScore: z.number().min(0).max(1),
      shouldNotify: z.boolean(),
      reason: z.string(),
      supportingUrls: z.array(z.string()).min(1),
    }),
  ),
});

export class AiService {
  constructor(private readonly config: AppConfig) {}

  private async postStructuredPrompt<TSchema extends z.ZodTypeAny>(
    schemaName: string,
    schema: TSchema,
    messages: Array<{ role: "system" | "user"; content: string }>,
  ): Promise<z.infer<TSchema> | null> {
    if (!this.config.openRouterApiKey) {
      console.warn("[ai] OpenRouter API key not configured, using heuristic fallback");
      return null;
    }

    const body = {
      model: this.config.openRouterModel,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema: z.toJSONSchema(schema),
        },
      },
    };

    return this.executeWithRetry(schemaName, schema, body);
  }

  private async executeWithRetry<TSchema extends z.ZodTypeAny>(
    schemaName: string,
    schema: TSchema,
    body: Record<string, unknown>,
    attempt = 1,
    maxRetries = 3,
  ): Promise<z.infer<TSchema> | null> {
    const bodyStr = JSON.stringify(body);
    console.info(`[ai] calling OpenRouter (${this.config.openRouterModel}) - attempt ${attempt}/${maxRetries}, body size: ${bodyStr.length} chars`);

    let response: Response;
    let responseText: string | null = null;

    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": this.config.openRouterSiteUrl,
          "X-Title": this.config.openRouterAppName,
        },
        body: bodyStr,
      });
    } catch (err) {
      throw new Error(`OpenRouter network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Read response body once and reuse
    try {
      responseText = await response.text();
    } catch {
      // If we can't read the body, continue with what we have
    }

    // Handle rate limiting with retry
    if (response.status === 429 || response.status === 503) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      if (attempt < maxRetries) {
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt;
        console.warn(`[ai] Rate limited (${response.status}), waiting ${waitMs}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return this.executeWithRetry(schemaName, schema, body, attempt + 1, maxRetries);
      }
      throw new Error(`OpenRouter rate limited after ${maxRetries} attempts`);
    }

    // Handle other HTTP errors
    if (!response.ok) {
      let errorDetail = "";
      try {
        if (responseText) {
          const errorPayload = JSON.parse(responseText) as {
            error?: { message?: string; code?: string };
            message?: string;
          };
          errorDetail = errorPayload.error?.message || errorPayload.message || "";
        }
      } catch {
        errorDetail = responseText || "";
      }

      // 500 errors are often transient, retry once
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(`[ai] Server error ${response.status}: ${errorDetail.slice(0, 200)}, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return this.executeWithRetry(schemaName, schema, body, attempt + 1, maxRetries);
      }

      console.error(`[ai] OpenRouter error ${response.status}: ${errorDetail.slice(0, 500)}`);
      throw new Error(`OpenRouter request failed (${response.status}): ${errorDetail.slice(0, 200)}`);
    }

    // Parse successful response
    if (!responseText) {
      console.warn("[ai] OpenRouter returned empty response");
      return null;
    }

    let payload: { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } };
    try {
      payload = JSON.parse(responseText);
    } catch {
      console.error(`[ai] Failed to parse response as JSON: ${responseText.slice(0, 300)}...`);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Check for API-level errors in response body
    if (payload.error) {
      console.error(`[ai] OpenRouter API error: ${payload.error.message}`);
      throw new Error(`OpenRouter API error: ${payload.error.message}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.warn("[ai] OpenRouter returned empty content");
      return null;
    }

  // Parse and validate JSON against schema
  try {
    // Try direct parse first
    try {
      const parsed = JSON.parse(content);
      return schema.parse(parsed);
    } catch {
      // If direct parse fails, try to find JSON in the content
      // Models sometimes add text before/after JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return schema.parse(parsed);
      }
      throw new Error("No valid JSON found in content");
    }
  } catch (err) {
    console.error(`[ai] Failed to parse content: ${content.slice(0, 300)}...`);
    throw new Error(`Failed to parse AI content: ${err instanceof Error ? err.message : String(err)}`);
  }
}

  private heuristicVerify(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidate: SourceItem,
  ): VerifyKeywordOutput {
    const text = `${candidate.title}\n${candidate.excerpt}\n${candidate.content}`.toLowerCase();
    const suspiciousMarkers = ["parody", "concept", "mockup", "fake", "rumor", "unofficial"];
    const suspicion = suspiciousMarkers.some((marker) => text.includes(marker)) ? 0.3 : 0;
    const relevance = Math.min(1, keywordDensity(monitor.query, text) + (candidate.trustScore * 0.15));
    const authenticity = Math.max(
      0,
      Math.min(1, (candidate.trustScore * 0.55) + (computeFreshnessScore(candidate.publishedAt) * 0.2) + 0.25 - suspicion),
    );
    const isMatch = relevance >= 0.4 && authenticity >= 0.35;

    return {
      isMatch,
      authenticityScore: Number(authenticity.toFixed(3)),
      relevanceScore: Number(relevance.toFixed(3)),
      reason: isMatch
        ? "The content aligns with the monitor query and comes from a credible signal."
        : "The content is either weakly related or has low authenticity signals.",
      summary: compactText(candidate.excerpt || candidate.title, 180),
      evidence: [
        {
          quote: compactText(candidate.title, 120),
          reason: "Title overlap with the monitored query.",
        },
        {
          quote: compactText(candidate.excerpt || candidate.content, 180),
          reason: "Body text used for the heuristic relevance check.",
        },
      ],
    };
  }

  async verifyKeywordCandidate(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidate: SourceItem,
  ): Promise<VerifyKeywordOutput> {
    let structured: z.infer<typeof verifyKeywordSchema> | null | undefined;
    try {
      structured = await this.postStructuredPrompt(
        "verify_keyword_candidate",
        verifyKeywordSchema,
        [
          {
            role: "system",
            content:
              "你验证一条内容是否值得被监控系统捕获。请适度宽松判断，只要内容与监控关键词有一定关联且看起来是真实内容就应该通过。\n\n**宽松原则**：\n- 如果标题或正文包含关键词，或者讨论关键词所在领域/相关话题 -> isMatch=true\n- 如果内容来自可信来源（trustScore >= 0.5）且与关键词相关 -> isMatch=true\n- 只有在内容明显不相关、完全是广告、或明确标注为恶搞/假消息时才拒绝\n\n**matchType 判断**：\n- direct: 标题或正文直接提到关键词\n- semantic: 没有直接提关键词，但讨论同一领域/竞品/相关技术\n- indirect: 关联公司/产品中提及\n\n**authenticity 判断**：\n- 如果内容看起来像正常的新闻/博客/讨论 -> isAuthentic=true\n- 只要内容不是明确标注的假消息 -> isAuthentic=true\n- 可以接受：社交媒体讨论、评测文章、分析报告、技术博客\n\n**summary 生成规则（重要）**：\n- 生成摘要时，**必须保留英文专有名词的原始拼写**，不要翻译成中文\n- 例如：关键词 \"Harness\" → 摘要中仍写 \"Harness\"，不要写成 \"马具\"\n- 例如：关键词 \"Cursor\" → 摘要中仍写 \"Cursor\"，不要写成 \"光标\"\n- 常见要保留的词汇：框架名、工具名、品牌名、公司名、项目名等专有名词\n- 如果原标题是英文，可以直接使用原标题作为摘要主体\n- 可以用中文解释内容，但专有名词必须保留英文原形",
          },
          {
            role: "user",
            content: JSON.stringify({
              monitor,
              candidate: {
                sourceKind: candidate.sourceKind,
                sourceLabel: candidate.sourceLabel,
                title: candidate.title,
                url: candidate.url,
                publishedAt: candidate.publishedAt,
                author: candidate.author,
                excerpt: candidate.excerpt,
                content: compactText(candidate.content, 2800),
                trustScore: candidate.trustScore,
                engagementScore: candidate.engagementScore,
              },
            }),
          },
        ],
      );
    } catch (err) {
      console.warn(`[ai] verifyKeywordCandidate failed, falling back to heuristic: ${err instanceof Error ? err.message : String(err)}`);
    }

    return structured ?? this.heuristicVerify(monitor, candidate);
  }

  /**
   * Step 1: 使用 AI 判断内容与关键词的相关性
   */
  async checkRelevance(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidate: SourceItem,
  ) {
    const expandedTerms = expandQuery(monitor.query);

    return this.postStructuredPrompt(
      "check_relevance",
      relevanceSchema,
      [
        {
          role: "system",
          content: `你是一个关键词相关性分析专家。请适度宽松判断，只要内容与监控关键词有一定关联就认为相关。

**宽松原则**：
- 标题提到关键词 -> direct
- 正文讨论关键词所在领域/应用/竞品 -> direct 或 semantic
- 仅在列表/排行中简单提及 -> 如果正文有相关内容也可以接受
- 只有内容完全没有提到关键词且不在同一领域时才拒绝

**matchType 判断标准**：
- direct: 标题或正文直接提到关键词，或讨论关键词的直接变化/更新
- semantic: 没有直接提到关键词，但讨论的是同一领域/竞品/相关技术
- indirect: 仅在关联公司、关联产品的背景下提及`,
        },
        {
          role: "user",
          content: JSON.stringify({
            monitor: {
              name: monitor.name,
              query: monitor.query,
              expandedTerms,
            },
            candidate: {
              title: candidate.title,
              excerpt: candidate.excerpt,
              content: compactText(candidate.content, 2000),
              url: candidate.url,
            },
          }),
        },
      ],
    );
  }

  /**
   * Step 2: 使用 AI 判断内容的真实性（仅在相关性判断通过后调用）
   */
  async checkAuthenticity(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidate: SourceItem,
  ) {
    return this.postStructuredPrompt(
      "check_authenticity",
      verifyAuthenticitySchema,
      [
        {
          role: "system",
          content: `你是一个信息真实性验证专家。请宽松判断，只拒绝明显的虚假内容。

应该接受的内容：
- 官方公告、技术博客发布的内容
- 新闻媒体报道的内容
- 社交媒体上的分享和讨论
- 评测文章和分析

应该拒绝的内容（需要明确证据）：
- 明确标注为"恶搞"、"parody"、"fake"、"谣言"的内容
- 明确说明是"概念验证"但无法验证的内容

关键原则：
- 如果内容看起来像是正常的新闻/博客/讨论，应该接受
- 如果无法确定，宁可接受也不要过度拒绝`,
        },
        {
          role: "user",
          content: JSON.stringify({
            monitor,
            candidate: {
              sourceKind: candidate.sourceKind,
              sourceLabel: candidate.sourceLabel,
              title: candidate.title,
              url: candidate.url,
              publishedAt: candidate.publishedAt,
              author: candidate.author,
              excerpt: candidate.excerpt,
              content: compactText(candidate.content, 2800),
              trustScore: candidate.trustScore,
              engagementScore: candidate.engagementScore,
            },
          }),
        },
      ],
    );
  }

  private heuristicDiscover(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidates: SourceItem[],
  ): HotspotClusterOutput[] {
    const terms = buildQueryTerms(monitor.query);
    const shortlisted = candidates
      .filter((candidate) => terms.length === 0 || keywordDensity(monitor.query, `${candidate.title} ${candidate.excerpt}`) > 0.2)
      .sort((left, right) => {
        const leftScore = left.trustScore + left.engagementScore + computeFreshnessScore(left.publishedAt);
        const rightScore = right.trustScore + right.engagementScore + computeFreshnessScore(right.publishedAt);
        return rightScore - leftScore;
      })
      .slice(0, 5);

    return shortlisted.map((candidate) => ({
      label: compactText(candidate.title, 72),
      summary: compactText(candidate.excerpt || candidate.content, 180),
      score: Number(
        Math.min(
          1,
          (candidate.trustScore * 0.45) +
            (candidate.engagementScore * 0.25) +
            (computeFreshnessScore(candidate.publishedAt) * 0.3),
        ).toFixed(3),
      ),
      diversityScore: 0.45,
      freshnessScore: computeFreshnessScore(candidate.publishedAt),
      engagementScore: candidate.engagementScore,
      shouldNotify: candidate.trustScore >= 0.55,
      reason: "Fallback hotspot clustering based on freshness, trust, and engagement.",
      supportingUrls: [candidate.url],
    }));
  }

  async discoverHotspots(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidates: SourceItem[],
  ): Promise<HotspotClusterOutput[]> {
    let structured: z.infer<typeof discoverHotspotsSchema> | null | undefined;
    try {
      structured = await this.postStructuredPrompt(
        "discover_hotspots",
        discoverHotspotsSchema,
        [
          {
            role: "system",
            content:
              `你是一个AI热点信号梳理专家。请将候选内容整理为4到8个高价值热点，每个热点需要给出简短的label（中文标题，不带编号或前缀）和Summary（中文描述）。

**评分标准（必须严格执行）：**
- score: 综合热度评分，0.0-1.0。计算方式：(信任分×0.4 + 互动分×0.3 + 新鲜分×0.3)
  - 信任分(trustScore): 来自官方源(>0.9)给高分，社交媒体(<0.7)给低分
  - 互动分(engagementScore): 点赞/评论/转发多的给高分
  - 新鲜分(freshnessScore): 3小时内=1.0，24小时内=0.64，72小时内=0.48，更久=0.24
- **重要**: 大多数候选内容的score应该在0.5-0.7之间。只有真正的热点才能达到0.8以上。如果候选内容普遍质量一般，不要强行给高分。
- diversityScore: 来源多样性。跨多个不同平台/领域=高，重复内容=低
- freshnessScore: 内容新鲜度（见上方计算）
- engagementScore: 互动热度（见上方计算）
- shouldNotify: 仅当score>=0.7且来源可信时才为true

**示例评分**：
- 官方发布的重要更新 + 多平台报道 → score 0.75-0.95
- 单个来源的普通更新 → score 0.5-0.65
- 重复或低质量内容 → score 0.3-0.5`,
          },
          {
            role: "user",
            content: JSON.stringify({
              monitor,
              candidates: candidates.slice(0, 16).map((candidate) => ({
                sourceKind: candidate.sourceKind,
                sourceLabel: candidate.sourceLabel,
                title: candidate.title,
                url: candidate.url,
                publishedAt: candidate.publishedAt,
                excerpt: candidate.excerpt,
                trustScore: candidate.trustScore,
                engagementScore: candidate.engagementScore,
              })),
            }),
          },
        ],
      );
    } catch (err) {
      console.warn(`[ai] discoverHotspots failed, falling back to heuristic: ${err instanceof Error ? err.message : String(err)}`);
    }

    return structured?.clusters ?? this.heuristicDiscover(monitor, candidates);
  }
}
