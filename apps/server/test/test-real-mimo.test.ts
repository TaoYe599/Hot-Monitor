import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { describe, it } from "vitest";

import { loadConfig } from "../src/config.js";
import { AiService } from "../src/services/ai-service.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// apps/server/test/ -> project root = 3 levels up
const rootEnv = path.resolve(__dirname, "../../../.env");

// 1. 加载本地真实的 .env 环境变量
config({ path: rootEnv });

const appConfig = loadConfig();

describe("小米 MIMO 物理真实通道连通性实测", () => {
  it("发起真实网络调用并检验解析", { timeout: 30000 }, async () => {
    console.log("\n=== 小米 MIMO API 物理连通性实测 ===");
    console.log("专属 Base URL:", appConfig.mimoBaseUrl);
    console.log("调用模型:", appConfig.mimoModel);
    console.log("API Key 是否配置:", appConfig.mimoApiKey ? "已配置 (已掩码)" : "未配置");

    if (!appConfig.mimoApiKey) {
      console.warn("\n[WARNING] 提示: 检测到您本地的 .env 文件中尚未配置 MIMO_API_KEY！");
      console.warn("请先在 .env 中填写 MIMO_API_KEY 后，再运行此测试进行物理连通性实测。\n");
      return;
    }

    const testResponseSchema = z.object({
      success: z.boolean(),
      message: z.string(),
    });

    // 2. 实例化我们本次重构的核心 AiService 服务
    const aiService = new AiService(appConfig);

    console.log("\n[INFO] 正在向小米 MIMO 接口发送真实网络请求...");

    try {
      // 3. 绕过 TS 的 private 限制，实打实地调用我们重构的 postStructuredPrompt 链路进行真实交互
      const result = await aiService["postStructuredPrompt"](
        "test_real_mimo_connectivity",
        testResponseSchema,
        [
          {
            role: "system",
            content: "你是一个接口测试助手。请严格返回一个 JSON 格式的对象，格式必须完全符合: { \"success\": true, \"message\": \"测试物理接口连通性成功\" } 且不要夹带任何其他废话。",
          },
          {
            role: "user",
            content: "ping",
          },
        ],
      );

      console.log("\n[SUCCESS] 物理接口触发并调用成功！");
      console.log("经过 Zod 精准反序列化解析后的结果体如下：");
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("\n[ERROR] 物理接口调用或解析失败！异常详情：");
      console.error(err instanceof Error ? err.message : String(err));
      console.error("\n提示: 如果上面的报错信息是 401 提示未授权，则说明您的小米 API_Key 填错或额度透支；如果是网络超时，请检查您的代理或网络代理连接配置。");
      throw err;
    }
  });
});
