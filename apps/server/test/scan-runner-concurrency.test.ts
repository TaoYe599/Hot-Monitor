import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

function createTestConfig() {
  return {
    openRouterModel: "deepseek/deepseek-v4-flash",
    openRouterSiteUrl: "http://localhost:5173",
    openRouterAppName: "Hot Monitor Test",
    port: 8787,
    publicUrl: "http://localhost:8787",
    databasePath: ":memory:", // 物理隔离，使用纯内存库
    thresholds: {
      preFilter: 0.0, // 设为 0，防止关键词密度过滤，使所有候选均进入 AI 并发层
      relevance: 0.1,
      authenticity: 0.1,
    },
  };
}

describe("ScanRunner 并发调度与取消刹车安全性专项测试", () => {

  it("并发调度有效性验证：多个候选事件应限制并发运行并大幅压缩总体耗时", async () => {
    const { app, services } = await buildApp({ config: createTestConfig() });
    const { repository, runner } = services;

    try {
      const monitor = await repository.createMonitor({
        name: "并发测试任务",
        query: "AI",
        description: "watch AI high concurrency",
        intervalMinutes: 15,
        cooldownMinutes: 60,
        enabled: true,
        sources: {
          twitter: false,
          search: false,
          rss: true,
          github: false,
          hackernews: false,
          zhihu: false,
          baidu: false,
          weibo: false,
          reddit: false,
        },
      });

      // 准备 5 个需要调用 AI 的候选热点
      const mockCandidates = Array.from({ length: 5 }, (_, i) => ({
        sourceKind: "rss" as const,
        sourceLabel: "博客源",
        title: `AI 科技重大突破 ${i}`,
        url: `https://ai-news.org/story-${i}`,
        publishedAt: new Date().toISOString(),
        author: "AI 记者",
        excerpt: "AI 候选摘要",
        content: "这是并发测试的物理大段内容",
        engagementScore: 0.8,
        trustScore: 0.9,
        tags: ["AI"],
        raw: {},
      }));

      (runner as any).sourceService.collect = async () => mockCandidates;

      // 模拟 verifyKeywordCandidate：人为注入 50 毫秒延迟，以便精确测量时间压缩率
      let activeRequests = 0;
      let maxActiveRequests = 0;
      
      vi.spyOn((runner as any).aiService, "verifyKeywordCandidate").mockImplementation(async () => {
        activeRequests++;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 50)); // 延迟 50ms
        activeRequests--;
        return {
          isMatch: true,
          authenticityScore: 0.8,
          relevanceScore: 0.85,
          reason: "通过并发测试",
          summary: "AI 摘要内容",
          evidence: [],
        };
      });

      const startTime = Date.now();
      const summary = await runner.runMonitor(monitor);
      const totalTime = Date.now() - startTime;

      console.log(`[test] [INFO] 5 个候选热点在最大并发为 3 时的总消耗时间: ${totalTime} 毫秒`);
      console.log(`[test] [INFO] 扫描期间的最大并发请求数: ${maxActiveRequests}`);

      // 1. 验证 5 个候选热点均成功通过研判并落库
      expect(summary.acceptedEvents.length).toBe(5);

      // 2. 强力断言：最大并发路数必须为并发限制上限（即 3），绝对不可以是一股脑并发 5 个（那会打爆 429 RPM 频控）
      expect(maxActiveRequests).toBe(3);

      // 3. 时间压缩断言：如果是串行处理，5 * 50ms 最少需要 250ms。
      // 在限制并发度为 3 的情况下，第一批 3 个（50ms），第二批 2 个（50ms），理论时间只需要 ~100ms！
      // 我们在此断言总时间必定小于 200 毫秒，证明并发机制确实发挥了 2 倍以上的效率提升作用！
      expect(totalTime).toBeLessThan(200);

    } finally {
      await app.close();
    }
  });

  it("取消刹车安全性验证：如果在并发研判途中触发取消信号，并发池应该立即挂起并刹车，防止后续请求", async () => {
    const { app, services } = await buildApp({ config: createTestConfig() });
    const { repository, runner } = services;

    try {
      const monitor = await repository.createMonitor({
        name: "取消测试任务",
        query: "AI",
        description: "watch cancel safety",
        intervalMinutes: 15,
        cooldownMinutes: 60,
        enabled: true,
        sources: {
          twitter: false,
          search: false,
          rss: true,
          github: false,
          hackernews: false,
          zhihu: false,
          baidu: false,
          weibo: false,
          reddit: false,
        },
      });

      const mockCandidates = Array.from({ length: 6 }, (_, i) => ({
        sourceKind: "rss" as const,
        sourceLabel: "博客源",
        title: `AI 科技重大突破 ${i}`,
        url: `https://ai-news.org/story-${i}`,
        publishedAt: new Date().toISOString(),
        author: "AI 记者",
        excerpt: "AI 候选摘要",
        content: "这是取消测试的物理大段内容",
        engagementScore: 0.8,
        trustScore: 0.9,
        tags: ["AI"],
        raw: {},
      }));

      (runner as any).sourceService.collect = async () => mockCandidates;

      let callCount = 0;
      
      // 模拟 AI 请求：在第 2 个任务返回时，突然调用 cancel 注入取消信号
      vi.spyOn((runner as any).aiService, "verifyKeywordCandidate").mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          console.log("[test] [INFO] 第 2 个任务执行中，突发注入 Cancel 取消信号！");
          runner.cancel(monitor.id);
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          isMatch: true,
          authenticityScore: 0.8,
          relevanceScore: 0.85,
          reason: "测试取消",
          summary: "摘要",
          evidence: [],
        };
      });

      // 触发扫描，期待因为 cancel 抛出 Scan cancelled 异常并终止
      await expect(runner.runMonitor(monitor)).rejects.toThrow("Scan cancelled");

      console.log(`[test] [INFO] 取消刹车触发后的总 API 拦截调用数: ${callCount}`);

      // 强力断言：因为最大并发度是 3，当第 2 个任务触发 cancel 时，第一批启动的 3 个任务已经被派发。
      // 但随后并发池检测到 cancel 信号被激活，后面的第 4、5、6 个任务应该彻底被阻断拦截，绝对不可以再次发起请求！
      // 故总调用数必须 <= 3，绝对不能到 6，成功保障了不会多消耗哪怕一个 Token 的 API 账单！
      expect(callCount).toBeLessThanOrEqual(3);

    } finally {
      await app.close();
    }
  });
});
