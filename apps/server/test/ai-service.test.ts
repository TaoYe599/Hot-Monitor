import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AiService } from "../src/services/ai-service.js";
import type { AppConfig } from "../src/config.js";

// 定义用于测试验证的 Schema 规范
const testResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

describe("AiService 双轨高可用灾备机制测试", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("当配置了 mimoApiKey 时，优先调用小米 MIMO 接口，并且成功返回", async () => {
    const mockConfig: AppConfig = {
      mimoApiKey: "mimo_test_key_123",
      mimoBaseUrl: "https://api.xiaomimimo.com/v1",
      mimoModel: "MiMo-V2.5-Pro",
      openRouterApiKey: "openrouter_test_key_456",
      openRouterModel: "openai/gpt-4.1-mini",
      openRouterSiteUrl: "http://localhost:5173",
      openRouterAppName: "Hot Monitor Test",
      port: 8787,
      publicUrl: "http://localhost:8787",
      databasePath: "file:./test.db",
      thresholds: { preFilter: 0.2, relevance: 0.4, authenticity: 0.35 },
    };

    const aiService = new AiService(mockConfig);
    aiService["openRouterHealth"] = {
      configured: true,
      available: true,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
      lastStatus: 200,
    };

    // 模拟 fetch 仅对小米 MIMO 接口返回成功
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (url === "https://api.xiaomimimo.com/v1/chat/completions") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ success: true, message: "来自小米 API 的响应" }),
                  },
                },
              ],
            }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    const result = await aiService["postStructuredPrompt"](
      "test_schema",
      testResponseSchema,
      [{ role: "user", content: "hello" }],
    );

    // 验证返回数据是否正确，并且请求只发给了小米 MIMO，没有走向 OpenRouter 备份
    expect(result).toEqual({ success: true, message: "来自小米 API 的响应" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect((calledInit?.headers as Record<string, string>)["api-key"]).toBe("mimo_test_key_123");

    // 确保绝对不向小米 API 传递 response_format，以杜绝 400 Param Incorrect 兼容错误
    const calledBody = JSON.parse(calledInit?.body as string);
    expect(calledBody.response_format).toBeUndefined();
  });

  it("当小米 MIMO 接口发生网络超时或 500 等故障时，自动熔断并平滑降级到 OpenRouter 兜底", async () => {
    const mockConfig: AppConfig = {
      mimoApiKey: "mimo_test_key_123",
      mimoBaseUrl: "https://api.xiaomimimo.com/v1",
      mimoModel: "MiMo-V2.5-Pro",
      openRouterApiKey: "openrouter_test_key_456",
      openRouterModel: "openai/gpt-4.1-mini",
      openRouterSiteUrl: "http://localhost:5173",
      openRouterAppName: "Hot Monitor Test",
      port: 8787,
      publicUrl: "http://localhost:8787",
      databasePath: "file:./test.db",
      thresholds: { preFilter: 0.2, relevance: 0.4, authenticity: 0.35 },
    };

    const aiService = new AiService(mockConfig);
    aiService["openRouterHealth"] = {
      configured: true,
      available: true,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
      lastStatus: 200,
    };

    // 模拟 fetch：第一阶段小米 MIMO 抛出网络异常，第二阶段 OpenRouter 成功处理
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (url === "https://api.xiaomimimo.com/v1/chat/completions") {
        throw new Error("小米 MIMO 平台额度不足或网络超时");
      }
      if (url === "https://openrouter.ai/api/v1/chat/completions") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ success: true, message: "来自 OpenRouter 备份接口" }),
                  },
                },
              ],
            }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    const result = await aiService["postStructuredPrompt"](
      "test_schema",
      testResponseSchema,
      [{ role: "user", content: "hello" }],
    );

    // 验证是否在小米故障后成功回退到 OpenRouter 兜底，并成功返回预期格式数据
    expect(result).toEqual({ success: true, message: "来自 OpenRouter 备份接口" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const callUrls = fetchSpy.mock.calls.map(([url]) => url);
    expect(callUrls[0]).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(callUrls[1]).toBe("https://openrouter.ai/api/v1/chat/completions");

    // 验证第一阶段的小米请求中 response_format 被解构剔除，但第二阶段的 OpenRouter 中 response_format 依然保留以进行强校验
    const callBodies = fetchSpy.mock.calls.map(([_, init]) => JSON.parse(init?.body as string));
    expect(callBodies[0].response_format).toBeUndefined();
    expect(callBodies[1].response_format).toEqual({ type: "json_object" });
  });

  it("当未配置 mimoApiKey 时，跳过小米 MIMO，直接进入 OpenRouter 通道", async () => {
    const mockConfig: AppConfig = {
      openRouterApiKey: "openrouter_test_key_456",
      openRouterModel: "openai/gpt-4.1-mini",
      openRouterSiteUrl: "http://localhost:5173",
      openRouterAppName: "Hot Monitor Test",
      port: 8787,
      publicUrl: "http://localhost:8787",
      databasePath: "file:./test.db",
      thresholds: { preFilter: 0.2, relevance: 0.4, authenticity: 0.35 },
      mimoBaseUrl: "https://api.xiaomimimo.com/v1",
      mimoModel: "MiMo-V2.5-Pro", // mimoApiKey 未配置
    };

    const aiService = new AiService(mockConfig);
    aiService["openRouterHealth"] = {
      configured: true,
      available: true,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
      lastStatus: 200,
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (url === "https://openrouter.ai/api/v1/chat/completions") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ success: true, message: "直通 OpenRouter" }),
                  },
                },
              ],
            }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    const result = await aiService["postStructuredPrompt"](
      "test_schema",
      testResponseSchema,
      [{ role: "user", content: "hello" }],
    );

    // 验证在无 mimoApiKey 状态下直接发向 OpenRouter 备份，未请求小米
    expect(result).toEqual({ success: true, message: "直通 OpenRouter" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });
});
