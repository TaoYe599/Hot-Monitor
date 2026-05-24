import { describe, expect, it } from "vitest";

import { AiService } from "./ai-service.js";

const service = new AiService({
  openRouterModel: "deepseek/deepseek-v4-flash",
  openRouterSiteUrl: "http://localhost:5173",
  openRouterAppName: "Hot Monitor Test",
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
});

describe("AiService fallback mode", () => {
  it.skip("accepts credible keyword candidates", async () => {
    const verdict = await service.verifyKeywordCandidate(
      { name: "OpenAI updates", query: "GPT-5.4" },
      {
        sourceKind: "rss",
        sourceLabel: "OpenAI Blog",
        title: "OpenAI releases GPT-5.4 for developers",
        url: "https://openai.com/news/gpt-5-4",
        publishedAt: new Date().toISOString(),
        author: "OpenAI",
        excerpt: "The release adds better reasoning and lower latency for production use.",
        content: "OpenAI officially announced GPT-5.4 and described the production API rollout for developers.",
        engagementScore: 0.6,
        trustScore: 0.96,
        tags: [],
        raw: {},
      },
    );

    expect(verdict.isMatch).toBe(true);
    expect(verdict.authenticityScore).toBeGreaterThan(0.7);
  });

  it.skip("produces hotspot clusters without remote AI", async () => {
    const clusters = await service.discoverHotspots(
      { name: "AI 编程", query: "AI coding" },
      [
        {
          sourceKind: "rss",
          sourceLabel: "OpenAI Blog",
          title: "OpenAI launches a new coding agent",
          url: "https://example.com/openai-coding-agent",
          publishedAt: new Date().toISOString(),
          author: "OpenAI",
          excerpt: "A new coding agent can edit repositories and run checks.",
          content: "The coding agent ships with repository editing and tool usage.",
          engagementScore: 0.7,
          trustScore: 0.94,
          tags: [],
          raw: {},
        },
      ],
    );

    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters[0]?.label.length).toBeGreaterThan(0);
  });
});
