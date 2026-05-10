/**
 * Source connectivity test - Node.js native fetch (no proxy agent).
 * Tests all data sources with Node.js's built-in fetch (undici-based).
 * Run: npx tsx test/source-connectivity.test.ts
 */
import { config } from "dotenv";
import Parser from "rss-parser";
import { load } from "cheerio";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// Load .env from project root (apps/server/test/ -> 3 levels up to project root)
const rootEnv = path.resolve(__dirname, "../../../.env");
config({ path: rootEnv });

const results: Array<{ name: string; ok: boolean; message: string; ms: number; status?: number }> = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, message: "OK", ms: Date.now() - start });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const statusMatch = msg.match(/HTTP (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
    results.push({ name, ok: false, message: msg.slice(0, 120), ms: Date.now() - start, status });
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "Hot-Monitor/0.1 (+https://localhost/hot-monitor)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFeed(url: string): Promise<void> {
  const res = await fetchWithTimeout(url);
  const xml = await res.text();
  await parser.parseString(xml);
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchWithTimeout(url, init);
  return await res.json();
}

const parser = new Parser();

// === Official Feeds ===
console.log("=== Official Feeds ===");
await test("OpenAI Blog RSS", () => fetchFeed("https://openai.com/news/rss.xml"));
await test("Anthropic News RSS", () => fetchFeed("https://www.anthropic.com/news/rss.xml"));
await test("Hugging Face Blog", () => fetchFeed("https://huggingface.co/blog/feed.xml"));
await test("Google DeepMind Blog", () => fetchFeed("https://deepmind.google/blog/rss.xml"));

// === GitHub Releases ===
console.log("\n=== GitHub Release Feeds ===");
await test("openai/openai-python releases", () => fetchFeed("https://github.com/openai/openai-python/releases.atom"));
await test("anthropics/anthropic-sdk-ts releases", () => fetchFeed("https://github.com/anthropics/anthropic-sdk-typescript/releases.atom"));
await test("meta-llama/llama releases", () => fetchFeed("https://github.com/meta-llama/llama/releases.atom"));
await test("QwenLM/Qwen releases", () => fetchFeed("https://github.com/QwenLM/Qwen/releases.atom"));
await test("deepseek-ai/DeepSeek-V2 releases", () => fetchFeed("https://github.com/deepseek-ai/DeepSeek-V2/releases.atom"));
await test("huggingface/transformers releases", () => fetchFeed("https://github.com/huggingface/transformers/releases.atom"));
await test("huggingface/accelerate releases", () => fetchFeed("https://github.com/huggingface/accelerate/releases.atom"));
await test("huggingface/datasets releases", () => fetchFeed("https://github.com/huggingface/datasets/releases.atom"));
await test("langchain-ai/langchain releases", () => fetchFeed("https://github.com/langchain-ai/langchain/releases.atom"));
await test("microsoft/autogen releases", () => fetchFeed("https://github.com/microsoft/autogen/releases.atom"));
await test("google/generative-ai-python releases", () => fetchFeed("https://github.com/google/generative-ai-python/releases.atom"));
await test("ollama/ollama releases", () => fetchFeed("https://github.com/ollama/ollama/releases.atom"));
await test("vllm-project/vllm releases", () => fetchFeed("https://github.com/vllm-project/vllm/releases.atom"));
await test("mistralai/mistralai releases", () => fetchFeed("https://github.com/mistralai/mistralai/releases.atom"));

// === Search Sources ===
console.log("\n=== Search Sources ===");
await test("Google News RSS", () => fetchFeed("https://news.google.com/rss/search?q=AI+LLM&hl=en-US&gl=US&ceid=US:en"));
await test("Hacker News Algolia API", async () => {
  const data = await fetchJson("https://hn.algolia.com/api/v1/search?query=AI&tags=story&hitsPerPage=3") as { hits?: unknown[] };
  if (!data.hits) throw new Error("No hits in response");
});

// === Social / Community ===
console.log("\n=== Social / Community ===");
await test("Twitter API (twitterapi.io)", async () => {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  console.log(`    Twitter API key: ${apiKey ? apiKey.slice(0, 8) + "..." : "NOT FOUND"}`);
  if (!apiKey) throw new Error("TWITTERAPI_IO_KEY not set");
  const res = await fetchWithTimeout(
    "https://api.twitterapi.io/twitter/tweet/advanced_search?query=AI&queryType=Latest",
    { headers: { "x-api-key": apiKey } },
    30000
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await res.json();
});

// === Chinese Sources ===
console.log("\n=== Chinese Sources ===");
await test("ModelScope Blog RSS", () => fetchFeed("https://modelscope.cn/blog/rss"));
await test("Weibo search API", async () => {
  const res = await fetchWithTimeout(
    "https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3Dai&page_type=searchall",
    { headers: { "Referer": "https://m.weibo.cn", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as { ok?: number };
  if (json.ok !== 1) throw new Error(`Weibo API returned ok=${json.ok}`);
});

// === RSS / Blog Aggregators ===
console.log("\n=== Aggregators ===");
await test("TechCrunch RSS", () => fetchFeed("https://techcrunch.com/feed/"));
await test("VentureBeat AI RSS", () => fetchFeed("https://venturebeat.com/category/ai/feed/"));

// === Summary ===
console.log("\n" + "=".repeat(70));
console.log("TEST SUMMARY");
console.log("=".repeat(70));
const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

for (const r of results) {
  const icon = r.ok ? "✓" : "✗";
  const status = r.ok ? "\x1b[32mOK\x1b[0m" : `\x1b[31mFAIL\x1b[0m`;
  const statusDetail = r.status ? ` (HTTP ${r.status})` : "";
  console.log(`${icon} [${status}] ${r.name.padEnd(50)} ${r.ms}ms${statusDetail}`);
  if (!r.ok) {
    console.log(`  └─ ${r.message}`);
  }
}

console.log("\n" + "-".repeat(70));
console.log(`Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);

if (failed.length > 0) {
  console.log(`\n\x1b[31m${failed.length} source(s) FAILED\x1b[0m`);
} else {
  console.log(`\n\x1b[32mAll sources OK!\x1b[0m`);
}
