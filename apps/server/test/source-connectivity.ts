import "dotenv/config";
import Parser from "rss-parser";
import { load } from "cheerio";

// Bootstrap global-agent for proxy support
import globalAgent from "global-agent";
globalAgent.bootstrap();

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
  console.info(`[proxy] Using: ${proxyUrl}`);
}

const parser = new Parser();
const results: Array<{ name: string; ok: boolean; message: string; ms: number }> = [];

async function test(name: string, fn: () => Promise<unknown>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, message: "OK", ms: Date.now() - start });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, message: msg.slice(0, 120), ms: Date.now() - start });
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Hot-Monitor/0.1 (+https://localhost/hot-monitor)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

async function extractReadableContent(url: string): Promise<void> {
  const res = await fetchWithTimeout(url);
  const html = await res.text();
  const $ = load(html);
  $("script, style").remove();
  $("article p, main p, p")
    .map((_, el) => $(el).text())
    .get()
    .filter((t) => t.trim().length > 40)
    .slice(0, 5);
}

// === Run all tests ===
console.log("\n=== Official Feeds ===");
await test("OpenAI Blog RSS", () => fetchFeed("https://openai.com/news/rss.xml"));
await test("Anthropic News RSS", () => fetchFeed("https://www.anthropic.com/news/rss.xml"));
await test("Hugging Face Blog", () => fetchFeed("https://huggingface.co/blog/feed.xml"));
await test("Google DeepMind Blog", () => fetchFeed("https://deepmind.google/blog/rss.xml"));

console.log("\n=== GitHub Release Feeds (sample) ===");
await test("openai/openai-python releases", () => fetchFeed("https://github.com/openai/openai-python/releases.atom"));
await test("meta-llama/llama releases", () => fetchFeed("https://github.com/meta-llama/llama/releases.atom"));
await test("QwenLM/Qwen releases", () => fetchFeed("https://github.com/QwenLM/Qwen/releases.atom"));
await test("deepseek-ai/DeepSeek-V2 releases", () => fetchFeed("https://github.com/deepseek-ai/DeepSeek-V2/releases.atom"));
await test("mistralai/mistralai-python releases", () => fetchFeed("https://github.com/mistralai/mistralai-python/releases.atom"));
await test("huggingface/transformers releases", () => fetchFeed("https://github.com/huggingface/transformers/releases.atom"));
await test("ollama/ollama releases", () => fetchFeed("https://github.com/ollama/ollama/releases.atom"));
await test("vllm-project/vllm releases", () => fetchFeed("https://github.com/vllm-project/vllm/releases.atom"));
await test("langchain-ai/langchain releases", () => fetchFeed("https://github.com/langchain-ai/langchain/releases.atom"));

console.log("\n=== Search Sources ===");
await test("DuckDuckGo HTML search", async () => {
  const res = await fetchWithTimeout("https://html.duckduckgo.com/html/?q=AI+LLM");
  const html = await res.text();
  const $ = load(html);
  const count = $(".result").length;
  if (count === 0) throw new Error("No results found");
});

await test("Google News RSS", () => fetchFeed("https://news.google.com/rss/search?q=AI+LLM&hl=en-US&gl=US&ceid=US:en"));

console.log("\n=== Social / Community ===");
await test("Hacker News Algolia API", async () => {
  const res = await fetchWithTimeout("https://hn.algolia.com/api/v1/search?query=AI&tags=story&hitsPerPage=3");
  const data = await res.json() as { hits?: unknown[] };
  if (!data.hits) throw new Error("No hits returned");
});

await test("Twitter API (twitterapi.io)", async () => {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) {
    throw new Error("TWITTERAPI_IO_KEY not set in .env");
  }
  const res = await fetchWithTimeout(
    `https://api.twitterapi.io/twitter/tweet/advanced_search?query="AI"&queryType=Latest`,
    30000
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

await test("Weibo mobile API", async () => {
  const res = await fetchWithTimeout(
    "https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3Dai&page_type=searchall",
    { headers: { "Referer": "https://m.weibo.cn", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" } } as RequestInit
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

await test("Zhihu API", async () => {
  const res = await fetchWithTimeout(
    "https://www.zhihu.com/api/v4/search_v3?t=general&q=AI&correction=1&offset=0&limit=5",
    { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.zhihu.com", "X-API-VERSION": "3.0.91" } } as RequestInit
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

console.log("\n=== Google Search (HTML scraping) ===");
await test("Google News HTML", async () => {
  const res = await fetchWithTimeout("https://www.google.com/search?q=AI+LLM&tbm=nws&num=5", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.5",
    },
  } as RequestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = load(html);
  const count = $("div.SoaBEf").length;
  if (count === 0) throw new Error("No results found");
});

console.log("\n=== Baidu Search ===");
await test("Baidu search", async () => {
  const res = await fetchWithTimeout("https://www.baidu.com/s?wd=AI+LLM&rn=5&ie=utf-8", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  } as RequestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = load(html);
  const count = $(".result").length;
  if (count === 0) throw new Error("No results found");
});

console.log("\n=== ModelScope ===");
await test("ModelScope Blog RSS", () => fetchFeed("https://modelscope.cn/blog/rss"));

console.log("\n=== Article Extraction ===");
await test("Extract article content (openai.com)", () => extractReadableContent("https://openai.com/news/"));

// === Summary ===
console.log("\n" + "=".repeat(70));
console.log("TEST SUMMARY");
console.log("=".repeat(70));
const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

for (const r of results) {
  const icon = r.ok ? "✓" : "✗";
  const status = r.ok ? "\x1b[32mOK\x1b[0m" : `\x1b[31mFAIL\x1b[0m`;
  console.log(`${icon} [${status}] ${r.name.padEnd(45)} ${r.ms}ms`);
  if (!r.ok) {
    console.log(`  └─ ${r.message}`);
  }
}

console.log("\n" + "-".repeat(70));
console.log(`Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);
if (failed.length > 0) {
  console.log(`\n\x1b[31m${failed.length} source(s) FAILED\x1b[0m - fix before restarting server`);
  process.exit(1);
} else {
  console.log(`\n\x1b[32mAll sources OK - safe to restart server!\x1b[0m`);
}
