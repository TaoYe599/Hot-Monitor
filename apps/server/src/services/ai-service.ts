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

  /**
   * 提交结构化的 AI 提示词请求
   * 
   * @param schemaName 校验模式名称，主要用于日志追踪与降级标记
   * @param schema Zod 校验 Schema，用于强约束 AI 响应格式
   * @param messages 包含 System 与 User 的结构化对话消息数组
   * @returns 校验通过并符合 Zod 类型定义的响应数据，或在无 API 配置时返回 null
   */
  private async postStructuredPrompt<TSchema extends z.ZodTypeAny>(
    schemaName: string,
    schema: TSchema,
    messages: Array<{ role: "system" | "user"; content: string }>,
  ): Promise<z.infer<TSchema> | null> {
    if (!this.config.openRouterApiKey && !this.config.mimoApiKey) {
      console.warn("[ai] [WARNING] 未配置 OpenRouter 或小米 MIMO API 密钥，将采用启发式备用解析 (Heuristic Fallback)");
      return null;
    }

    const body = {
      model: this.config.openRouterModel, // 默认配置模型，在 postToMimo 中会被 mimoModel 覆盖
      messages,
      // 使用 json_object 并在 system prompt 中硬性要求 JSON 输出，以供 zod 在客户端解析校验
      response_format: {
        type: "json_object",
      },
    };

    return this.executeWithRetry(schemaName, schema, body);
  }

  /**
   * 解析并验证 AI 返回的 JSON 字符串是否符合指定的 Zod Schema 格式
   * 
   * @param content AI 返回的原始内容字符串
   * @param schema Zod 校验 Schema
   * @returns 校验通过的解析对象
   * @throws 当解析出错或不符合 Zod schema 格式时抛出异常
   */
  private parseAndValidate<TSchema extends z.ZodTypeAny>(
    content: string,
    schema: TSchema,
  ): z.infer<TSchema> {
    try {
      // 1. 尝试直接进行整串 JSON 解析
      try {
        const parsed = JSON.parse(content);
        return schema.parse(parsed);
      } catch {
        // 2. 如果直接解析失败，尝试通过正则表达式提取首个 {...} 的 JSON 结构体
        // 部分 LLM 在返回 JSON 时可能会夹带 Markdown 标识符或解释性前缀后缀
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return schema.parse(parsed);
        }
        throw new Error("未能从返回内容中提取到合法的 JSON 格式");
      }
    } catch (err) {
      console.error(`[ai] [ERROR] JSON 解析或 Schema 验证失败，原始响应内容为: ${content.slice(0, 300)}...`);
      throw new Error(`AI 返回内容解析校验失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 通过小米 MIMO API 提交结构化对话请求（主首选端点）
   * 
   * @param schemaName 校验模式名称
   * @param schema Zod 校验 Schema
   * @param body 请求主体内容
   * @param attempt 当前重试次数
   * @param maxRetries 最大重试次数
   */
  private async postToMimo<TSchema extends z.ZodTypeAny>(
    schemaName: string,
    schema: TSchema,
    body: Record<string, unknown>,
    attempt = 1,
    maxRetries = 3,
  ): Promise<z.infer<TSchema> | null> {
    // 覆盖配置模型为小米 MIMO 平台指定的模型（如 deepseek-v3 / MiMo-V2.5-Pro）
    // 注意：部分中转或国内模型不支持 response_format: { type: "json_object" } 字段，直接传入会导致 400 Param Incorrect 错误。
    // 我们在这里使用解构赋值剔除 response_format，只传递 messages 等标准主体，
    // 底层的 parseAndValidate 具备高度弹性的正则提取逻辑，即使模型带有 Markdown 块返回也能稳健提取。
    const { response_format, ...restBody } = body;
    const mimoBody = {
      ...restBody,
      model: this.config.mimoModel,
    };
    const bodyStr = JSON.stringify(mimoBody);
    console.info(`[ai] [INFO] 调用小米 MIMO 接口 (${this.config.mimoModel}) - 尝试 ${attempt}/${maxRetries}, 请求体大小: ${bodyStr.length} 字符`);

    let response: Response;
    let responseText: string | null = null;

    // 动态拼接专属 Base URL，如果 Base URL 末尾有斜杠则剔除，避免重复的双斜杠
    const normalizedBaseUrl = this.config.mimoBaseUrl.replace(/\/+$/, "");
    const requestUrl = `${normalizedBaseUrl}/chat/completions`;

    try {
      response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "api-key": this.config.mimoApiKey!,
          "Content-Type": "application/json",
        },
        body: bodyStr,
      });
    } catch (err) {
      throw new Error(`小米 MIMO 网络错误 (请求地址: ${requestUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      responseText = await response.text();
    } catch {
      // 无法读取 Body 时，继续向下处理，让后续判定捕获异常
    }

    // 处理频控与超载状态进行平滑重试（429 / 503）
    if (response.status === 429 || response.status === 503) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      if (attempt < maxRetries) {
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt;
        console.warn(`[ai] [WARNING] 小米 MIMO 接口触发频控或过载限制 (${response.status})，将在 ${waitMs}ms 后发起第 ${attempt + 1} 次重试...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return this.postToMimo(schemaName, schema, body, attempt + 1, maxRetries);
      }
      throw new Error(`小米 MIMO 接口在 ${maxRetries} 次重试后仍然频控超载限制`);
    }

    // 处理其他非 200 的 HTTP 错误响应
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

      // 500+ 服务器错误通常是瞬时抖动，可以进行重试
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(`[ai] [WARNING] 小米 MIMO 服务端故障 ${response.status}: ${errorDetail.slice(0, 200)}，准备重试...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return this.postToMimo(schemaName, schema, body, attempt + 1, maxRetries);
      }

      console.error(`[ai] [ERROR] 小米 MIMO 接口报错 ${response.status}: ${errorDetail.slice(0, 500)}`);
      throw new Error(`小米 MIMO 请求失败 (${response.status}): ${errorDetail.slice(0, 200)}`);
    }

    if (!responseText) {
      console.warn("[ai] [WARNING] 小米 MIMO 接口返回空数据");
      return null;
    }

    let payload: { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } };
    try {
      payload = JSON.parse(responseText);
    } catch {
      console.error(`[ai] [ERROR] 无法将小米 MIMO 响应成功解析为 JSON 结构: ${responseText.slice(0, 300)}...`);
      throw new Error("小米 MIMO 响应解析 JSON 失败");
    }

    if (payload.error) {
      console.error(`[ai] [ERROR] 小米 MIMO 服务端返回 API-level 错误: ${payload.error.message}`);
      throw new Error(`小米 MIMO API 错误: ${payload.error.message}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.warn("[ai] [WARNING] 小米 MIMO 接口返回的 choices message content 为空");
      return null;
    }

    return this.parseAndValidate(content, schema);
  }

  /**
   * 通过 OpenRouter API 提交结构化对话请求（备份兜底端点）
   * 
   * @param schemaName 校验模式名称
   * @param schema Zod 校验 Schema
   * @param body 请求主体内容
   * @param attempt 当前重试次数
   * @param maxRetries 最大重试次数
   */
  private async postToOpenRouter<TSchema extends z.ZodTypeAny>(
    schemaName: string,
    schema: TSchema,
    body: Record<string, unknown>,
    attempt = 1,
    maxRetries = 3,
  ): Promise<z.infer<TSchema> | null> {
    const bodyStr = JSON.stringify(body);
    console.info(`[ai] [INFO] 调用 OpenRouter 备份接口 (${this.config.openRouterModel}) - 尝试 ${attempt}/${maxRetries}, 请求体大小: ${bodyStr.length} 字符`);

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
      throw new Error(`OpenRouter 备份网络错误: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      responseText = await response.text();
    } catch {
      // 无法读取 Body 时，继续向下处理，让后续判定捕获异常
    }

    // 频控与超载重试（429 / 503）
    if (response.status === 429 || response.status === 503) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      if (attempt < maxRetries) {
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt;
        console.warn(`[ai] [WARNING] OpenRouter 备份接口触发频控或过载限制 (${response.status})，将在 ${waitMs}ms 后发起第 ${attempt + 1} 次重试...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return this.postToOpenRouter(schemaName, schema, body, attempt + 1, maxRetries);
      }
      throw new Error(`OpenRouter 备份接口在 ${maxRetries} 次重试后仍然频控超载限制`);
    }

    // 其他 HTTP 错误状态处理
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

      // 500+ 服务器错误通常是瞬时抖动，可以进行重试
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(`[ai] [WARNING] OpenRouter 服务端故障 ${response.status}: ${errorDetail.slice(0, 200)}，准备重试...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return this.postToOpenRouter(schemaName, schema, body, attempt + 1, maxRetries);
      }

      console.error(`[ai] [ERROR] OpenRouter 备份接口报错 ${response.status}: ${errorDetail.slice(0, 500)}`);
      throw new Error(`OpenRouter 备份请求失败 (${response.status}): ${errorDetail.slice(0, 200)}`);
    }

    if (!responseText) {
      console.warn("[ai] [WARNING] OpenRouter 备份接口返回空数据");
      return null;
    }

    let payload: { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } };
    try {
      payload = JSON.parse(responseText);
    } catch {
      console.error(`[ai] [ERROR] 无法将 OpenRouter 备份响应成功解析为 JSON 结构: ${responseText.slice(0, 300)}...`);
      throw new Error("OpenRouter 备份响应解析 JSON 失败");
    }

    if (payload.error) {
      console.error(`[ai] [ERROR] OpenRouter 备份服务端返回 API-level 错误: ${payload.error.message}`);
      throw new Error(`OpenRouter API 错误: ${payload.error.message}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.warn("[ai] [WARNING] OpenRouter 备份接口返回的 choices message content 为空");
      return null;
    }

    return this.parseAndValidate(content, schema);
  }

  /**
   * 双核双轨高可用 AI 灾备请求执行器
   * 
   * 在 mimoApiKey 配置存在时，将优先请求小米 MIMO API。
   * 一旦小米 MIMO 平台在运行中抛出网络超时、频控 429、503、API 解析或额度用尽错误，
   * 系统将以非破坏性方式精准捕获该异常，并打印 WARNING 告警，随后无缝、平滑地将数据流
   * 熔断降级切换至配置的 OpenRouter 备份接口中进行完美兜底，确保持续可用性。
   * 
   * @param schemaName 校验模式名称，主要用于日志追踪与降级标记
   * @param schema Zod 校验 Schema，用于强约束 AI 响应格式
   * @param body 请求主体内容，包含模型提示词和约束选项
   * @returns 成功经过 Zod 检验过滤后的格式化对象，或在所有管道均故障时返回 null
   */
  private async executeWithRetry<TSchema extends z.ZodTypeAny>(
    schemaName: string,
    schema: TSchema,
    body: Record<string, unknown>,
  ): Promise<z.infer<TSchema> | null> {
    // 1. 如果配置了首选的小米 MIMO API 密钥，则优先执行主请求流
    if (this.config.mimoApiKey) {
      try {
        const result = await this.postToMimo(schemaName, schema, body);
        if (result !== null) {
          return result;
        }
      } catch (err) {
        // 捕获小米 MIMO API 的一切抖动、429、503、超时和额度用尽等错误，并开始降级熔断流
        console.warn(
          `[ai] [WARNING] 小米 MIMO 优先请求发生异常，正启动熔断灾备，自动切换降级至 OpenRouter。异常详情: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    // 2. 如果未配置小米 MIMO 密钥，或者首选的小米 MIMO 服务发生故障导致熔断，则进入 OpenRouter 备份管道进行兜底
    if (this.config.openRouterApiKey) {
      return this.postToOpenRouter(schemaName, schema, body);
    }

    console.warn("[ai] [WARNING] 当前没有任何可用的 AI 接口配置（小米 MIMO / OpenRouter 均失效或未配置），无法完成请求");
    return null;
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
              `你验证一条内容是否值得被监控系统捕获。请适度宽松判断，只要内容与监控关键词有一定关联且看起来是真实内容就应该通过。

**重要：必须严格遵循以下 JSON 输出格式，不要添加或省略任何字段：**
\`\`\`json
{
  "isMatch": true,
  "authenticityScore": 0.85,
  "relevanceScore": 0.9,
  "matchType": "direct",
  "reason": "判断理由",
  "summary": "摘要内容",
  "evidence": [
    {"quote": "引用的原文", "reason": "引用理由"}
  ]
}
\`\`\`

**字段说明：**
- isMatch: boolean - 是否匹配监控关键词
- authenticityScore: number - 真实性评分 0.0-1.0
- relevanceScore: number - 相关性评分 0.0-1.0
- matchType: "direct" | "semantic" | "indirect" - 匹配类型
- reason: string - 简短判断理由
- summary: string - 180字以内的摘要
- evidence: array - 最多3个证据，每个包含 quote 和 reason

**宽松原则**：
- 如果标题或正文包含关键词，或者讨论关键词所在领域/相关话题 -> isMatch=true
- 如果内容来自可信来源（trustScore >= 0.5）且与关键词相关 -> isMatch=true
- 只有在内容明显不相关、完全是广告、或明确标注为恶搞/假消息时才拒绝

**summary 生成规则（重要）**：
- 生成摘要时，**必须保留英文专有名词的原始拼写**，不要翻译成中文
- 例如：关键词 "Harness" → 摘要中仍写 "Harness"，不要写成 "马具"
- 例如：关键词 "Cursor" → 摘要中仍写 "Cursor"，不要写成 "光标"
- 常见要保留的词汇：框架名、工具名、品牌名、公司名、项目名等专有名词`,
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
          (candidate.trustScore * 0.4) +
            (candidate.engagementScore * 0.3) +
            (computeFreshnessScore(candidate.publishedAt) * 0.3),
        ).toFixed(3),
      ),
      diversityScore: 0.45,
      freshnessScore: computeFreshnessScore(candidate.publishedAt),
      engagementScore: candidate.engagementScore,
      shouldNotify: candidate.trustScore >= 0.55,
      reason: "Heuristic 降级模式下的热点聚类，基于统一的计分公式 (0.4 信任分, 0.3 互动分, 0.3 新鲜分)。",
      supportingUrls: [candidate.url],
      // 标记为 Heuristic 模式生成
      isHeuristic: true,
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
              `你是一个AI热点信号梳理专家。请将候选内容整理为4到8个高价值热点。
              
**智能模式自适应（精准词 vs 泛化词）**：
- 当监控关键词（query）是一个非常精准的产品名、版本号或特定实体（例如："DeepSeek-v4"、"Claude Code"、"Llama-3.1"）时，系统自动识别为 **精准提取模式**。在此模式下，你需要：
  - 降低对“来源多样性”的硬性要求，即使该热点只有一个高可信信源支撑，也应该将其提取为独立的热点簇，避免高价值精准情报被泛化背景淹没或被强行合并到大主题中。
  - 热点标题（label）应极其精准地聚焦在此产品或版本上。
- 当监控关键词是一个宽泛的主题（例如："多模态模型"、"AI 编程工具"、"大模型推理"）时，采用 **宽泛主题聚类模式**。在此模式下，你需要：
  - 将讨论同一技术趋势或行业动态的多个候选源进行合并归纳，提炼出有代表性、跨渠道的主题热点。
  - 热点标题（label）和摘要（summary）应该体现高水平的抽象和行业洞察。

**重要：必须严格遵循以下 JSON 输出格式，不要添加或省略任何字段：**
\`\`\`json
{
  "clusters": [
    {
      "label": "热点标题（中文，不带编号）",
      "summary": "热点描述（180字以内）",
      "score": 0.75,
      "diversityScore": 0.6,
      "freshnessScore": 0.8,
      "engagementScore": 0.7,
      "shouldNotify": true,
      "reason": "判断理由",
      "supportingUrls": ["url1", "url2"]
    }
  ]
}
\`\`\`

**字段说明：**
- clusters: array - 热点数组，至少1个热点
- label: string - 中文标题，不带编号或前缀
- summary: string - 180字以内的描述
- score: number - 综合热度 0.0-1.0
- diversityScore: number - 来源多样性 0.0-1.0
- freshnessScore: number - 新鲜度 0.0-1.0
- engagementScore: number - 互动热度 0.0-1.0
- shouldNotify: boolean - 是否通知
- reason: string - 判断理由
- supportingUrls: array - 支持的 URL 列表

**评分标准（必须严格执行）：**
- score: 综合热度评分。计算方式：(信任分×0.4 + 互动分×0.3 + 新鲜分×0.3)
  - 信任分(trustScore): 来自官方源(>0.9)给高分，社交媒体(<0.7)给低分
  - 互动分(engagementScore): 点赞/评论/转发多的给高分
  - 新鲜分(freshnessScore): 3小时内=1.0，24小时内=0.64，72小时内=0.48，更久=0.24
- **重要**: 大多数候选内容的score应该在0.5-0.7之间。只有真正的热点才能达到0.8以上。
- diversityScore: 来源多样性。跨多个不同平台/领域=高，重复内容=低
- shouldNotify: 仅当score>=0.7且来源可信时才为true`,
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
