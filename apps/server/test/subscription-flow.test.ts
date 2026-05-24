import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { SubscriptionRuleRecord } from "@hot-monitor/shared";

function createTestConfig() {
  return {
    openRouterModel: "deepseek/deepseek-v4-flash",
    openRouterSiteUrl: "http://localhost:5173",
    openRouterAppName: "Hot Monitor Test",
    webhookUrls: [],
    emailTo: ["test@example.com"],
    smtp: { secure: false },
    vapid: { subject: "mailto:test@example.com" },
    port: 8787,
    publicUrl: "http://localhost:8787",
    databasePath: ":memory:",
    thresholds: {
      preFilter: 0.1,
      relevance: 0.3,
      authenticity: 0.3,
    }
  };
}

describe("智能订阅分流与热点关联集成测试 (Subscription Flow & Relations)", () => {
  
  it("验证 1: 物理事件关联热点回填 (确保 cluster_id 完美指向 hotspot.id)", async () => {
    // 1. 初始化 Fastify 与内存 SQLite 数据库
    const { app, services } = await buildApp({ config: createTestConfig() });
    const { repository, runner } = services;

    try {
      // 2. 建立一个 Mock 监控任务
      const monitor = await repository.createMonitor({
        name: "Harness Test",
        query: "Harness, Hermes",
        description: "watch harness releases",
        intervalMinutes: 15,
        cooldownMinutes: 60,
        enabled: true,
        sources: {
          twitter: true,
          search: true,
          rss: true,
          github: true,
          hackernews: false,
          zhihu: false,
          baidu: false,
          weibo: false,
          reddit: false
        }
      });

      // 3. 建立 2 个 Mock 采集信源 (满足关键词密度)
      const mockCandidates = [
        {
          sourceKind: "rss" as const,
          sourceLabel: "官方博客",
          title: "Harness releases new developer agent",
          url: "https://harness.io/blog/agent-release",
          publishedAt: new Date().toISOString(),
          author: "Harness Team",
          excerpt: "Harness officially announced the next-gen Hermes Agent with logical reasoning.",
          content: "The Harness agent integrates deep MoE routing and enables instant command execution.",
          engagementScore: 0.8,
          trustScore: 0.95,
          tags: ["agent", "Harness"],
          raw: {},
        }
      ];

      // 4. 重写 ScanRunner 内部的数据源收集逻辑，使其只返回我们的 Mock 候选数据
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runner as any).sourceService.collect = async () => mockCandidates;

      // 5. 触发扫描，运行 AI 验证和 Heuristic 聚类
      const summary = await runner.runMonitor(monitor);

      expect(summary.acceptedEvents.length).toBeGreaterThan(0);
      expect(summary.hotspots.length).toBeGreaterThan(0);

      const createdEvent = summary.acceptedEvents[0];
      const createdHotspot = summary.hotspots[0];

      // 6. 强力断言：从数据库中查出被生成的事件，断言其 cluster_id 已完美指回 hotspot_id！
      const eventsInDb = await repository.listEvents(10, undefined, { monitorId: monitor.id });
      const targetEvent = eventsInDb.find(e => e.id === createdEvent.id);

      expect(targetEvent).toBeDefined();
      expect(targetEvent?.clusterId).not.toBeNull();
      expect(targetEvent?.clusterId).toBe(createdHotspot.id);

    } finally {
      await app.close();
    }
  });

  it("验证 2: 订阅分流 5 大门槛判定 (信源可信度 0.40 降级拦截 vs 0.85 成功放行)", async () => {
    const { app, services } = await buildApp({ config: createTestConfig() });
    const { repository, notificationService } = services;

    try {
      // 1. 建立一个最低可信度设为 0.55 的智能订阅规则
      const rule: SubscriptionRuleRecord = {
        id: 999,
        name: "安全订阅白皮书",
        enabled: true,
        monitorIds: [100],
        includeKeywords: [],
        andKeywords: [],
        excludeKeywords: [],
        minScore: 0.70,
        minTrustScore: 0.55, // 要求最低信源可信度 55%
        minSupportingSources: 1,
        deliveryFrequency: "instant",
        deliveryTime: null,
        prefetchMinutes: null,
        recipients: ["cto@company.com"],
        lastDispatchedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 2. 【测试边界 A】：关联事件数为 0 的热点 (降级兜底值为 0.40)
      const mockHotspotA = await repository.createHotspot({
        monitorId: 100,
        label: "Harness MoE 突破性更新",
        summary: "Harness 开发套件 MoE 开源大步走。",
        score: 0.80,
        diversityScore: 0.6,
        freshnessScore: 0.8,
        engagementScore: 0.7,
        status: "candidate",
        supportingUrls: ["https://harness.io/1"],
        createdAt: new Date().toISOString()
      });

      // 关联事件为 0，因为 0.40 < 0.55，断言其必被拦截过滤！
      const isMatchedA = await notificationService.matchSubscriptionRule(mockHotspotA, rule);
      expect(isMatchedA).toBe(false);

      // 3. 【测试边界 B】：关联事件最大可信度为 0.85 的热点 (满足 >= 0.55 门槛)
      const mockHotspotB = await repository.createHotspot({
        monitorId: 100,
        label: "Hermes Agent 权威发布",
        summary: "Hermes Agent 官方认证成功。",
        score: 0.85,
        diversityScore: 0.6,
        freshnessScore: 0.8,
        engagementScore: 0.7,
        status: "candidate",
        supportingUrls: ["https://hermes.io/2"],
        createdAt: new Date().toISOString()
      });

      // 强关联一个可信度为 0.85 的原始事件
      await repository.createEvent({
        monitorId: 100,
        title: "Hermes Agent 官方白皮书",
        summary: "Hermes Agent 白皮书内容。",
        originalExcerpt: "Excerpt",
        sourceUrl: "https://hermes.io/2",
        sourceType: "rss",
        sourceLabel: "官方博客",
        author: "Hermes Team",
        publishedAt: new Date().toISOString(),
        authenticityScore: 0.85, // 85% 真实度，大于 55% 门槛
        relevanceScore: 0.90,
        evidence: [],
        clusterId: mockHotspotB.id, // 建立物理关联
        status: "accepted",
        reason: "Matches monitor criteria",
        engagementDetails: null,
        isRead: false
      });

      // 信源最大分 0.85 >= 0.55，且其他条件均符合，断言其必须完美通过，允许发信！
      const isMatchedB = await notificationService.matchSubscriptionRule(mockHotspotB, rule);
      expect(isMatchedB).toBe(true);

    } finally {
      await app.close();
    }
  });

});
