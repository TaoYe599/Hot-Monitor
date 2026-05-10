/**
 * OpenRouter API 测试用例 (CommonJS 兼容版)
 * 用于测试 AI 服务的结构化输出功能
 *
 * 运行方式:
 *   cd apps/server
 *   node test/ai-service.test.cjs
 *
 * 或者指定模型:
 *   MODEL=deepseek/deepseek-v3.2 node test/ai-service.test.cjs
 */

const https = require("https");
const { z } = require("zod");

const apiKey = process.env.OPENROUTER_API_KEY || "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";
const model = process.env.MODEL || "deepseek/deepseek-v3.2";

const testSchema = z.object({
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
    })
  ),
});

function extractJSON(content) {
  if (!content) return null;
  try {
    JSON.parse(content);
    return content;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        JSON.parse(match[0]);
        return match[0];
      } catch {}
    }
    return null;
  }
}

function callOpenRouter(schema, messages, attempt = 1, maxRetries = 3) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const body = JSON.stringify({
      model,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test",
          strict: true,
          schema: z.toJSONSchema(schema),
        },
      },
    });

    const options = {
      hostname: "openrouter.ai",
      port: 443,
      path: "/api/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        const latency = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Handle 500 errors with retry
        if (statusCode === 500 && attempt < maxRetries) {
          console.log(`  Rate limited (500), retrying...`);
          setTimeout(() => {
            callOpenRouter(schema, messages, attempt + 1, maxRetries).then(resolve);
          }, 1000 * attempt);
          return;
        }

        // Handle HTTP errors
        if (statusCode >= 400) {
          resolve({ success: false, attempt, latency, error: `HTTP ${statusCode}: ${data.slice(0, 200)}` });
          return;
        }

        // Parse response
        try {
          const payload = JSON.parse(data);
          const content = payload.choices?.[0]?.message?.content;

          if (!content || content.trim() === "") {
            resolve({ success: false, attempt, latency, error: "Empty content in response" });
            return;
          }

          const jsonContent = extractJSON(content);
          if (!jsonContent) {
            resolve({ success: false, attempt, latency, rawContent: content, error: "No valid JSON found" });
            return;
          }

          const parsed = JSON.parse(jsonContent);
          const validated = schema.parse(parsed);
          resolve({ success: true, attempt, latency, response: validated, rawContent: jsonContent });
        } catch (e) {
          resolve({ success: false, attempt, latency, error: e.message, rawContent: data.slice(0, 500) });
        }
      });
    });

    req.on("error", (e) => {
      resolve({ success: false, attempt, latency: Date.now() - startTime, error: e.message });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({ success: false, attempt, latency: Date.now() - startTime, error: "Timeout" });
    });

    req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log("=".repeat(55));
  console.log("OpenRouter API 测试");
  console.log("=".repeat(55));
  console.log(`模型: ${model}`);
  console.log(`API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`);

  // Test 1: Hotspot clustering
  console.log("\n--- 测试 1: 热点聚类 (discover_hotspots) ---");
  const result1 = await callOpenRouter(testSchema, [
    { role: "system", content: "You are a data structuring assistant. Return ONLY valid JSON matching the schema." },
    { role: "user", content: JSON.stringify({
      candidates: [
        { title: "GPT-5 发布", url: "https://github.com/openai/gpt-5", trustScore: 0.9, engagementScore: 0.8 },
        { title: "Claude 4 发布", url: "https://anthropic.com/claude-4", trustScore: 0.85, engagementScore: 0.75 }
      ]
    })}
  ]);

  if (result1.success) {
    console.log(`\n✅ 成功 (${result1.attempt} 次尝试, ${result1.latency}ms)`);
    console.log(`   返回 ${result1.response.clusters.length} 个热点:`);
    result1.response.clusters.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.label} (score: ${c.score}, notify: ${c.shouldNotify})`);
    });
  } else {
    console.log(`\n❌ 失败: ${result1.error}`);
    if (result1.rawContent) console.log(`   原始内容: ${result1.rawContent.slice(0, 300)}`);
  }

  // Test 2: Keyword verification
  const verifySchema = z.object({
    isMatch: z.boolean(),
    authenticityScore: z.number().min(0).max(1),
    relevanceScore: z.number().min(0).max(1),
    reason: z.string(),
    summary: z.string(),
  });

  console.log("\n--- 测试 2: 关键词验证 (verify_keyword) ---");
  const result2 = await callOpenRouter(verifySchema, [
    { role: "system", content: "You are a verification assistant. Return ONLY valid JSON matching the schema." },
    { role: "user", content: JSON.stringify({
      candidate: { title: "GPT-5 发布重要更新", trustScore: 0.9 }
    })}
  ]);

  if (result2.success) {
    console.log(`\n✅ 成功 (${result2.attempt} 次尝试, ${result2.latency}ms)`);
    console.log(`   isMatch: ${result2.response.isMatch}`);
    console.log(`   真实性: ${result2.response.authenticityScore}`);
    console.log(`   相关性: ${result2.response.relevanceScore}`);
  } else {
    console.log(`\n❌ 失败: ${result2.error}`);
    if (result2.rawContent) console.log(`   原始内容: ${result2.rawContent.slice(0, 300)}`);
  }

  console.log("\n" + "=".repeat(55));
  const allPassed = result1.success && result2.success;
  console.log(`结果: ${allPassed ? "✅ 全部通过" : "⚠️ 部分失败"}`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(console.error);
