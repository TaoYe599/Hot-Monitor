/**
 * Source connectivity test - PowerShell proxy reference.
 * Tests all data sources via PowerShell's Invoke-WebRequest with proxy.
 * Run: npx tsx test/source-test-ps.ts
 */
import { execSync } from "node:child_process";

const PROXY = "http://127.0.0.1:7890";

interface SourceTest {
  name: string;
  type: "feed" | "api" | "html" | "html-json";
  url: string;
  headers?: Record<string, string>;
  validate?: (html: string) => string | null; // returns error or null
}

const sources: SourceTest[] = [
  // === Official Feeds ===
  { name: "OpenAI Blog RSS", type: "feed", url: "https://openai.com/news/rss.xml" },
  { name: "Anthropic News RSS", type: "feed", url: "https://www.anthropic.com/news/rss.xml" },
  { name: "Hugging Face Blog", type: "feed", url: "https://huggingface.co/blog/feed.xml" },
  { name: "Google DeepMind Blog", type: "feed", url: "https://deepmind.google/blog/rss.xml" },

  // === GitHub Releases ===
  { name: "openai/openai-python releases", type: "feed", url: "https://github.com/openai/openai-python/releases.atom" },
  { name: "anthropics/anthropic-sdk-ts releases", type: "feed", url: "https://github.com/anthropics/anthropic-sdk-typescript/releases.atom" },
  { name: "meta-llama/llama releases", type: "feed", url: "https://github.com/meta-llama/llama/releases.atom" },
  { name: "mistralai/mistralai-python releases", type: "feed", url: "https://github.com/mistralai/mistralai-python/releases.atom" },
  { name: "QwenLM/Qwen releases", type: "feed", url: "https://github.com/QwenLM/Qwen/releases.atom" },
  { name: "deepseek-ai/DeepSeek-V2 releases", type: "feed", url: "https://github.com/deepseek-ai/DeepSeek-V2/releases.atom" },
  { name: "huggingface/transformers releases", type: "feed", url: "https://github.com/huggingface/transformers/releases.atom" },
  { name: "huggingface/accelerate releases", type: "feed", url: "https://github.com/huggingface/accelerate/releases.atom" },
  { name: "huggingface/datasets releases", type: "feed", url: "https://github.com/huggingface/datasets/releases.atom" },
  { name: "langchain-ai/langchain releases", type: "feed", url: "https://github.com/langchain-ai/langchain/releases.atom" },
  { name: "microsoft/autogen releases", type: "feed", url: "https://github.com/microsoft/autogen/releases.atom" },
  { name: "google/generative-ai-python releases", type: "feed", url: "https://github.com/google/generative-ai-python/releases.atom" },
  { name: "ollama/ollama releases", type: "feed", url: "https://github.com/ollama/ollama/releases.atom" },
  { name: "vllm-project/vllm releases", type: "feed", url: "https://github.com/vllm-project/vllm/releases.atom" },
  { name: "chromadb/chroma releases", type: "feed", url: "https://github.com/chromadb/chroma/releases.atom" },
  { name: "ModelScope Blog RSS", type: "feed", url: "https://modelscope.cn/blog/rss" },

  // === Search APIs ===
  { name: "Google News RSS", type: "feed", url: "https://news.google.com/rss/search?q=AI+LLM&hl=en-US&gl=US&ceid=US:en" },
  { name: "Hacker News Algolia API", type: "api", url: "https://hn.algolia.com/api/v1/search?query=AI&tags=story&hitsPerPage=3",
    validate: (text) => text.includes('"hits"') ? null : 'No "hits" in response' },

  // === HTML Scraping ===
  { name: "DuckDuckGo HTML", type: "html",
    url: "https://html.duckduckgo.com/html/?q=AI+LLM",
    validate: (html) => html.includes("result") || html.includes("web-result") ? null : 'No search results' },
  { name: "Google News HTML", type: "html",
    url: "https://www.google.com/search?q=AI+LLM&tbm=nws&num=5",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.5" },
    validate: (html) => (html.includes("SoaBEf") || html.includes("article") || html.includes("href=\"/url?q=")) ? null : 'No news results' },
  { name: "Baidu search", type: "html",
    url: "https://www.baidu.com/s?wd=AI+LLM&rn=5&ie=utf-8",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    validate: (html) => html.includes("result") || html.includes("c-container") ? null : 'No search results' },

  // === Social APIs ===
  { name: "Twitter API (twitterapi.io)", type: "api", url: "https://api.twitterapi.io/twitter/tweet/advanced_search?query=AI&queryType=Latest",
    validate: () => null }, // Will fail without API key
  { name: "Weibo mobile API", type: "html-json",
    url: "https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3Dai&page_type=searchall",
    headers: { "Referer": "https://m.weibo.cn", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" },
    validate: (text) => text.includes('"ok"') ? null : 'No JSON ok in response' },
  { name: "Zhihu API", type: "api",
    url: "https://www.zhihu.com/api/v4/search_v3?t=general&q=AI&correction=1&offset=0&limit=5",
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.zhihu.com", "X-API-VERSION": "3.0.91" },
    validate: (text) => text.includes('"data"') || text.includes('"error"') ? null : 'Unknown response format' },

  // === Article extraction ===
  { name: "Extract openai.com/news", type: "html",
    url: "https://openai.com/news/",
    validate: (html) => html.includes("<article") || html.includes("<p>") || html.includes("blog") ? null : 'No article content' },
];

function buildHeaders(headers?: Record<string, string>): string {
  if (!headers) return "";
  return Object.entries(headers)
    .map(([k, v]) => `-H '${k}: ${v}'`)
    .join(" ");
}

async function testSourcePS(s: SourceTest): Promise<{ ok: boolean; status?: number; ms: number; error?: string }> {
  const start = Date.now();
  const h = buildHeaders(s.headers);
  const cmd = `powershell -Command "Invoke-WebRequest -Uri '${s.url}' -Proxy '${PROXY}' -TimeoutSec 15 -UseBasicParsing ${h}"`;

  try {
    const out = execSync(cmd, { encoding: "utf8", timeout: 20000 }).trim();
    const ms = Date.now() - start;

    // Extract status code
    const statusMatch = out.match(/StatusCode\s*:\s*(\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 0;

    // Check if valid response
    if (status >= 200 && status < 400) {
      // Try to get content length
      const lenMatch = out.match(/Content-Length\s*:\s*(\d+)/);
      const len = lenMatch ? parseInt(lenMatch[1]) : 0;

      if (len === 0) {
        return { ok: false, status, ms, error: "Empty response (0 bytes)" };
      }

      return { ok: true, status, ms };
    } else {
      return { ok: false, status, ms, error: `HTTP ${status}` };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const ms = Date.now() - start;
    const match = err.match(/403|405|407|400|401|500|502|503|The remote server returned an error|Unable to connect|DNS|TIMEOUT|timeout/i);
    const error = match ? match[0] : err.slice(0, 80);
    return { ok: false, ms, error };
  }
}

async function testDirect(s: SourceTest): Promise<{ ok: boolean; status?: number; ms: number; error?: string }> {
  const start = Date.now();
  const h = buildHeaders(s.headers);
  const cmd = `powershell -Command "Invoke-WebRequest -Uri '${s.url}' -TimeoutSec 15 -UseBasicParsing ${h}"`;

  try {
    const out = execSync(cmd, { encoding: "utf8", timeout: 20000 }).trim();
    const ms = Date.now() - start;
    const statusMatch = out.match(/StatusCode\s*:\s*(\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 0;

    if (status >= 200 && status < 400) {
      return { ok: true, status, ms };
    } else {
      return { ok: false, status, ms, error: `HTTP ${status}` };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const ms = Date.now() - start;
    const match = err.match(/403|405|407|400|401|500|502|503|The remote server returned an error|Unable to connect|DNS|TIMEOUT|timeout/i);
    const error = match ? match[0] : err.slice(0, 80);
    return { ok: false, ms, error };
  }
}

// Run tests
console.log("=".repeat(75));
console.log("SOURCE CONNECTIVITY TEST REPORT");
console.log("=".repeat(75));
console.log(`Proxy: ${PROXY}`);
console.log("");

const results: Array<SourceTest & { viaProxy: { ok: boolean; ms: number; error?: string; status?: number }; direct: { ok: boolean; ms: number; error?: string; status?: number } }> = [];

for (const s of sources) {
  process.stdout.write(`Testing: ${s.name.padEnd(50)} `);

  const [viaProxy, direct] = await Promise.all([
    testSourcePS(s),
    testDirect(s),
  ]);

  results.push({ ...s, viaProxy, direct });

  const proxyIcon = viaProxy.ok ? "✓" : "✗";
  const directIcon = direct.ok ? "✓" : "✗";
  console.log(`[Proxy:${proxyIcon} Direct:${directIcon}]`);
  if (!viaProxy.ok) console.log(`  Proxy: ${viaProxy.error} (${viaProxy.ms}ms)`);
  if (!direct.ok) console.log(`  Direct: ${direct.error} (${direct.ms}ms)`);
}

// Summary by category
console.log("\n" + "=".repeat(75));
console.log("SUMMARY BY CATEGORY");
console.log("=".repeat(75));

const categories = [
  "Official Feeds",
  "GitHub Releases",
  "Search APIs",
  "HTML Scraping",
  "Social APIs",
  "Article extraction",
];

let catName = "";
let catResults: typeof results = [];
for (const r of results) {
  if (r.name.includes("RSS") && !r.name.includes("GitHub")) catName = "Official Feeds";
  else if (r.name.includes("releases")) catName = "GitHub Releases";
  else if (r.name.includes("Algolia") || r.name.includes("Google News RSS")) catName = "Search APIs";
  else if (r.name.includes("DuckDuckGo") || r.name.includes("Google News HTML") || r.name.includes("Baidu")) catName = "HTML Scraping";
  else if (r.name.includes("Twitter") || r.name.includes("Weibo") || r.name.includes("Zhihu")) catName = "Social APIs";
  else if (r.name.includes("Extract")) catName = "Article extraction";
  else catName = "Other";

  if (catName !== catResults[0]?.cat) {
    if (catResults.length > 0) {
      console.log(`\n  Via Proxy: ${catResults.filter(r => r.viaProxy.ok).length}/${catResults.length}`);
      console.log(`  Direct:    ${catResults.filter(r => r.direct.ok).length}/${catResults.length}`);
      for (const r of catResults) {
        const p = r.viaProxy.ok ? "✓" : "✗";
        const d = r.direct.ok ? "✓" : "✗";
        const note = !r.viaProxy.ok ? ` (${r.viaProxy.error})` : "";
        console.log(`    ${p}/${d} ${r.name}${note}`);
      }
    }
    catResults = [];
  }
  catResults.push({ cat: catName, ...r } as typeof results[0]);
}
if (catResults.length > 0) {
  console.log(`\n  Via Proxy: ${catResults.filter(r => r.viaProxy.ok).length}/${catResults.length}`);
  console.log(`  Direct:    ${catResults.filter(r => r.direct.ok).length}/${catResults.length}`);
  for (const r of catResults) {
    const p = r.viaProxy.ok ? "✓" : "✗";
    const d = r.direct.ok ? "✓" : "✗";
    const note = !r.viaProxy.ok ? ` (${r.viaProxy.error})` : "";
    console.log(`    ${p}/${d} ${r.name}${note}`);
  }
}

// Overall summary
const proxyOk = results.filter(r => r.viaProxy.ok).length;
const directOk = results.filter(r => r.direct.ok).length;
const bothOk = results.filter(r => r.viaProxy.ok && r.direct.ok).length;
const onlyProxy = results.filter(r => r.viaProxy.ok && !r.direct.ok).length;
const onlyDirect = results.filter(r => r.direct.ok && !r.viaProxy.ok).length;
const neither = results.filter(r => !r.viaProxy.ok && !r.direct.ok).length;

console.log("\n" + "=".repeat(75));
console.log("OVERALL");
console.log("=".repeat(75));
console.log(`  Total sources:       ${results.length}`);
console.log(`  Via Proxy:           ${proxyOk} OK / ${results.length - proxyOk} FAIL`);
console.log(`  Direct:              ${directOk} OK / ${results.length - directOk} FAIL`);
console.log(`  Both OK:             ${bothOk}`);
console.log(`  Only via Proxy:      ${onlyProxy}`);
console.log(`  Only Direct:         ${onlyDirect}`);
console.log(`  Neither:             ${neither}`);

console.log("\n" + "=".repeat(75));
console.log("RECOMMENDATION");
console.log("=".repeat(75));
if (onlyProxy > 0) {
  console.log(`  ${onlyProxy} sources ONLY work via proxy (${PROXY})`);
  console.log(`  -> Must use proxy for these sources`);
  console.log(`  -> Node.js global-agent does NOT intercept these, needs fix`);
}
if (onlyDirect > 0) {
  console.log(`  ${onlyDirect} sources ONLY work direct (no proxy)`);
  console.log(`  -> These should bypass proxy`);
}
if (neither > 0) {
  console.log(`  ${neither} sources NOT accessible at all`);
  console.log(`  -> May be blocked by VPN or require different endpoints`);
}
