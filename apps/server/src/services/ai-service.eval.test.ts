/**
 * AI 相关性审核测试用例集
 *
 * 包含各种场景的测试用例，用于评估 AI 判断的准确度
 */

import { describe, expect, it } from "vitest";

import type { TestCase } from "./ai-service.eval.js";
import { AiService } from "./ai-service.js";
import type { AppConfig } from "../config.js";
import { expandQuery, keywordDensityWithExpansion } from "../lib/utils.js";

// ============================================================
// 测试用例集定义
// ============================================================

export const TEST_CASES: TestCase[] = [
  // ========================================
  // 场景 1: 直接相关 - 标题/首段直接提到关键词
  // ========================================
  {
    id: "direct_01",
    query: "Claude Sonnet 4.6",
    title: "Anthropic 发布 Claude Sonnet 4.6: 更强的推理能力",
    content: "Anthropic 今天发布了 Claude Sonnet 4.6，这是其最新的 AI 模型。该版本在推理能力上有显著提升，支持更长的上下文窗口。",
    expectedRelevance: true,
    expectedMatchType: "direct",
    expectedAuthenticity: true,
    description: "官方发布公告，直接提到关键词",
  },
  {
    id: "direct_02",
    query: "Claude Opus",
    title: "Claude Opus 4 发布 - 全新一代旗舰模型",
    content: "Anthropic 宣布推出 Claude Opus 4，这是其 Opus 系列的最新旗舰模型。新模型在多项基准测试中创下新纪录。",
    expectedRelevance: true,
    expectedMatchType: "direct",
    expectedAuthenticity: true,
    description: "官方发布公告，提到 Claude Opus",
  },
  {
    id: "direct_03",
    query: "GPT-4",
    title: "OpenAI GPT-4 开放 API 访问",
    content: "OpenAI 宣布 GPT-4 模型现已开放 API 访问，开发者可以通过 OpenAI 平台使用这一强大的语言模型。",
    expectedRelevance: true,
    expectedMatchType: "direct",
    expectedAuthenticity: true,
    description: "官方 API 发布公告",
  },
  {
    id: "direct_04",
    query: "DeepSeek V2",
    title: "DeepSeek V2: 开源 MoE 模型新选择",
    content: "DeepSeek AI 发布了 DeepSeek V2，这是一款开源的混合专家模型，在性能和效率之间取得了很好的平衡。",
    expectedRelevance: true,
    expectedMatchType: "direct",
    expectedAuthenticity: true,
    description: "开源模型发布，直接提到版本号",
  },

  // ========================================
  // 场景 2: 语义相关 - 讨论主题与关键词相关
  // ========================================
  {
    id: "semantic_01",
    query: "Claude Sonnet",
    title: "Claude 与 GPT-4 性能对比评测",
    content: "最新评测显示，Claude Sonnet 在代码生成任务上表现优于 GPT-4，但在数学推理方面略逊一筹。",
    expectedRelevance: true,
    expectedMatchType: "semantic",
    expectedAuthenticity: true,
    description: "竞品对比评测，讨论 Claude",
  },
  {
    id: "semantic_02",
    query: "OpenAI",
    title: "AI 模型竞争格局: 谁将成为下一个领导者",
    content: "随着 GPT-5 即将发布，OpenAI、Anthropic 和 Google 之间的竞争愈发激烈。本文分析了各家的技术优势和市场策略。",
    expectedRelevance: true,
    expectedMatchType: "semantic",
    expectedAuthenticity: true,
    description: "行业分析，提到 OpenAI 及其竞品",
  },
  {
    id: "semantic_03",
    query: "LLaMA",
    title: "开源大模型新选择: LLaMA 3 性能解析",
    content: "Meta 发布的 LLaMA 3 在多项任务上接近 GPT-4 的表现，为开源社区提供了新的可能性。",
    expectedRelevance: true,
    expectedMatchType: "semantic",
    expectedAuthenticity: true,
    description: "竞品分析，提到 LLaMA 与 GPT-4 对比",
  },
  {
    id: "semantic_04",
    query: "Mistral AI",
    title: "Mistral: 欧洲 AI 独角兽的崛起",
    content: "Mistral AI 作为欧洲领先的 AI 公司，发布了多款开源模型，成为 OpenAI 的有力竞争者。",
    expectedRelevance: true,
    expectedMatchType: "semantic",
    expectedAuthenticity: true,
    description: "公司介绍，提到与 OpenAI 竞争",
  },

  // ========================================
  // 场景 3: 间接相关 - 同一公司其他产品/轻微关联
  // ========================================
  {
    id: "indirect_01",
    query: "Claude",
    title: "Anthropic 完成新一轮融资估值达 180 亿美元",
    content: "AI 初创公司 Anthropic 宣布完成新一轮融资，估值达到 180 亿美元。资金将用于扩大计算能力和招聘更多研究人员。",
    expectedRelevance: true,
    expectedMatchType: "indirect",
    expectedAuthenticity: true,
    description: "公司融资新闻，提到了 Anthropic",
  },
  {
    id: "indirect_02",
    query: "ChatGPT",
    title: "OpenAI 推出 ChatGPT 企业版安全功能",
    content: "OpenAI 为 ChatGPT 企业版增加了新的安全功能，帮助企业更好地保护敏感数据。",
    expectedRelevance: true,
    expectedMatchType: "indirect",
    expectedAuthenticity: true,
    description: "ChatGPT 功能更新，公司新闻",
  },
  {
    id: "indirect_03",
    query: "GPT-5",
    title: "OpenAI 员工谈 AI 安全性与未来发展",
    content: "OpenAI 首席科学家接受采访，讨论 AI 安全性问题以及 GPT-5 的开发进展。",
    expectedRelevance: true,
    expectedMatchType: "indirect",
    expectedAuthenticity: true,
    description: "公司新闻，提到 OpenAI 但未直接说 GPT-5",
  },

  // ========================================
  // 场景 4: 不相关 - 列表/排行中简单提及
  // ========================================
  {
    id: "irrelevant_01",
    query: "Claude Sonnet 4.6",
    title: "2024 年最佳 AI 聊天机器人排行榜",
    content: "本文列出了 2024 年最受欢迎的 AI 聊天机器人，Claude Sonnet 4.6 位列第三，ChatGPT 继续领跑。",
    expectedRelevance: false,
    description: "排行榜文章，关键词只在列表中提及",
  },
  {
    id: "irrelevant_02",
    query: "GPT-4",
    title: "AI 工具合集: 你不能错过的 10 款应用",
    content: "本文介绍了 10 款热门的 AI 工具，包括 GPT-4、Claude、DALL-E 等。",
    expectedRelevance: false,
    description: "工具合集，关键词只是列举之一",
  },
  {
    id: "irrelevant_03",
    query: "Claude",
    title: "AI 时代: 我们需要关注的 5 个趋势",
    content: "本文讨论了 AI 发展的五个主要趋势，包括 GPT-4、DALL-E、Claude 等模型的影响。",
    expectedRelevance: false,
    description: "趋势文章，关键词只是列举之一",
  },

  // ========================================
  // 场景 5: 不相关 - 完全没有提到关键词
  // ========================================
  {
    id: "irrelevant_04",
    query: "Claude Sonnet",
    title: "OpenAI 发布全新推理模型 o1",
    content: "OpenAI 发布了其最新的推理模型 o1，该模型在数学和科学任务上表现出色。",
    expectedRelevance: false,
    description: "完全不相关的竞品发布",
  },
  {
    id: "irrelevant_05",
    query: "GPT-5",
    title: "Anthropic 发布 Claude 3.5 Sonnet",
    content: "Anthropic 宣布 Claude 3.5 Sonnet 正式发布，在编程能力上有显著提升。",
    expectedRelevance: false,
    description: "完全不同的产品发布",
  },
  {
    id: "irrelevant_06",
    query: "LLaMA",
    title: "Google Gemini 1.5 刷新多项基准测试记录",
    content: "Google 发布的 Gemini 1.5 在长文本理解任务上创下新纪录。",
    expectedRelevance: false,
    description: "竞品新闻，未提到 LLaMA",
  },

  // ========================================
  // 场景 6: 不相关 - 恶搞/模仿/谣言
  // ========================================
  {
    id: "fake_01",
    query: "GPT-5",
    title: "GPT-5 泄露: 惊人的新功能曝光",
    content: "网上流传的 GPT-5 截图显示新功能，但实际上这只是一个恶搞项目。",
    expectedRelevance: true,
    expectedMatchType: "direct",
    expectedAuthenticity: false,
    description: "谣言/恶搞内容",
  },
  {
    id: "fake_02",
    query: "Claude",
    title: "Claude 官方澄清: 从未计划发布移动应用",
    content: "Anthropic 官方澄清，网上流传的 Claude 移动应用是假冒产品。",
    expectedRelevance: true,
    expectedMatchType: "indirect",
    expectedAuthenticity: false,
    description: "官方辟谣，假冒产品",
  },

  // ========================================
  // 场景 7: 边缘情况
  // ========================================
  {
    id: "edge_01",
    query: "OpenAI",
    title: "AI 安全性讨论升温",
    content: "随着 AI 技术的发展，OpenAI、Anthropic 和 Google 等公司都在加强 AI 安全研究。",
    expectedRelevance: true,
    expectedMatchType: "semantic",
    expectedAuthenticity: true,
    description: "行业讨论，提到了 OpenAI",
  },
  {
    id: "edge_02",
    query: "DeepSeek",
    title: "中国 AI 发展: DeepSeek 和百度的新进展",
    content: "DeepSeek 发布了新的开源模型，与百度的文心一言形成竞争。",
    expectedRelevance: true,
    expectedMatchType: "direct",
    expectedAuthenticity: true,
    description: "中国 AI 新闻，直接提到 DeepSeek",
  },
];

// ============================================================
// 单元测试
// ============================================================

describe("测试用例集验证", () => {
  it("包含足够的测试用例", () => {
    expect(TEST_CASES.length).toBeGreaterThanOrEqual(20);
  });

  it("每个用例都有唯一 ID", () => {
    const ids = TEST_CASES.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("直接相关的用例都有 expectedMatchType", () => {
    const relevantCases = TEST_CASES.filter((c) => c.expectedRelevance);
    for (const c of relevantCases) {
      expect(c.expectedMatchType).toBeDefined();
    }
  });
});

describe("Query Expansion 功能验证", () => {
  it("能正确拓展版本号", () => {
    const terms = expandQuery("Claude Sonnet 4.6");
    expect(terms).toContain("claude");
    expect(terms).toContain("sonnet");
    expect(terms).toContain("4.6");
  });

  it("能正确计算扩展后的关键词密度", () => {
    const terms = expandQuery("Claude Sonnet");
    const text = "Anthropic 发布 Claude Sonnet 4.6";
    const density = keywordDensityWithExpansion(terms, text);
    expect(density).toBeGreaterThan(0.5);
  });

  it("能正确过滤不相关文本", () => {
    const terms = expandQuery("GPT-5");
    const text = "OpenAI 发布 GPT-4 和 Claude 3";
    const density = keywordDensityWithExpansion(terms, text);
    expect(density).toBeLessThan(0.5);
  });
});

// ============================================================
// 集成测试（需要 API Key）
// ============================================================

const createAiService = (): AiService => {
  const config: AppConfig = {
    openRouterModel: "deepseek/deepseek-v4-flash",
    openRouterSiteUrl: "http://localhost:5173",
    openRouterAppName: "Hot Monitor Test",
    mimoBaseUrl: "https://api.xiaomimimo.com/v1",
    mimoModel: "mimo-v2.5-pro",
    emailTo: [],
    smtp: { secure: false },
    port: 8787,
    publicUrl: "http://localhost:8787",
    databasePath: ":memory:",
    thresholds: {
      preFilter: 0.1,
      relevance: 0.3,
      authenticity: 0.3,
    }
  };
  return new AiService(config);
};

describe("AI 集成测试（需要 API Key）", () => {
  it.skip("使用 AI 评估单个测试用例", async () => {
    const service = createAiService();

    const testCase = TEST_CASES[0]; // direct_01
    const result = await service.checkRelevance(
      { name: "test", query: testCase.query },
      {
        sourceKind: "rss",
        sourceLabel: "Test",
        title: testCase.title,
        url: "https://example.com",
        publishedAt: new Date().toISOString(),
        author: "Test",
        excerpt: testCase.content,
        content: testCase.content,
        trustScore: 0.9,
        engagementScore: 0.5,
        tags: [],
        raw: {},
      },
    );

    console.info("AI 返回结果:", JSON.stringify(result, null, 2));

    if (result) {
      expect(result.isRelated).toBe(testCase.expectedRelevance);
    }
  });

  it.skip("运行完整测试集评估", async () => {
    const service = createAiService();
    const results: Array<{ case: TestCase; result: unknown }> = [];

    for (const testCase of TEST_CASES) {
      const result = await service.checkRelevance(
        { name: "test", query: testCase.query },
        {
          sourceKind: "rss",
          sourceLabel: "Test",
          title: testCase.title,
          url: "https://example.com",
          publishedAt: new Date().toISOString(),
          author: "Test",
          excerpt: testCase.content,
          content: testCase.content,
          trustScore: 0.9,
          engagementScore: 0.5,
          tags: [],
          raw: {},
        },
      );

      results.push({ case: testCase, result });

      // 避免 API 限流
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.info("\n测试结果汇总:");
    console.info("=".repeat(60));

    for (const { case: testCase, result } of results) {
      const r = result as { isRelated?: boolean; matchType?: string };
      const passed = r.isRelated === testCase.expectedRelevance;
      console.info(
        `${passed ? "✓" : "✗"} ${testCase.id}: 预期=${testCase.expectedRelevance}, 实际=${r.isRelated}`,
      );
    }
  });
});
