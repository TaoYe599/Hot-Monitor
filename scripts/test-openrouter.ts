/**
 * 最小化测试脚本：验证 OpenRouter API 是否正常工作
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// 正确加载 .env 文件
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
require("dotenv").config({ path: resolve(__dirname, "../.env") });

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";

async function testConnection() {
  console.log("=== 测试 1: 检查 API Key ===");
  console.log("API Key:", API_KEY ? `${API_KEY.substring(0, 20)}...` : "NOT SET");
  console.log("Model:", MODEL);
  console.log();

  if (!API_KEY) {
    console.log("错误: API Key 未设置!");
    return;
  }

  console.log("=== 测试 2: 最简单请求 ===");
  const body = {
    model: MODEL,
    messages: [{ role: "user", content: "Say hello" }],
    max_tokens: 10,
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log("Raw Response:", text.substring(0, 500));
  } catch (err) {
    console.log("Fetch Error:", err.message);
  }
}

testConnection();
