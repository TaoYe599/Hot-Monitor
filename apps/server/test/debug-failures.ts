/**
 * Quick test for the 8 failing sources.
 */
import { config } from "dotenv";
import Parser from "rss-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const parser = new Parser();

async function fetchWithTimeout(url: string, headers?: Record<string, string>, timeoutMs = 15000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Hot-Monitor/0.1 (+https://localhost/hot-monitor)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(headers ?? {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return await res.text();
}

const tests = [
  {
    name: "Anthropic News RSS",
    url: "https://www.anthropic.com/news/rss.xml",
    type: "feed",
  },
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    type: "feed",
  },
  {
    name: "anthropics/anthropic-sdk-ts releases",
    url: "https://github.com/anthropics/anthropic-sdk-typescript/releases.atom",
    type: "feed",
  },
  {
    name: "mistralai/mistralai releases",
    url: "https://github.com/mistralai/mistralai/releases.atom",
    type: "feed",
  },
  {
    name: "Twitter API (twitterapi.io)",
    url: "https://api.twitterapi.io/twitter/tweet/advanced_search?query=AI&queryType=Latest",
    type: "json",
    headers: { "x-api-key": process.env.TWITTERAPI_IO_KEY ?? "" },
  },
  {
    name: "ModelScope Blog RSS",
    url: "https://modelscope.cn/blog/rss",
    type: "feed",
  },
  {
    name: "Weibo search API",
    url: "https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3Dai&page_type=searchall",
    type: "json",
    headers: { Referer: "https://m.weibo.cn" },
  },
  {
    name: "TechCrunch RSS",
    url: "https://techcrunch.com/feed/",
    type: "feed",
  },
];

for (const t of tests) {
  const start = Date.now();
  try {
    const text = await fetchWithTimeout(t.url, t.headers);
    const ms = Date.now() - start;

    if (t.type === "json") {
      try {
        JSON.parse(text);
        console.log(`✓ ${t.name}: JSON OK (${ms}ms, ${text.length} bytes)`);
      } catch {
        console.log(`✗ ${t.name}: JSON parse failed (${ms}ms)`);
        console.log(`   First 200 chars: ${text.slice(0, 200)}`);
      }
    } else if (t.type === "feed") {
      try {
        const feed = await parser.parseString(text);
        console.log(`✓ ${t.name}: Feed OK (${ms}ms, ${feed.items?.length ?? 0} items)`);
      } catch (e) {
        console.log(`✗ ${t.name}: ${e instanceof Error ? e.message.slice(0, 80) : String(e)} (${ms}ms)`);
        console.log(`   First 300 chars: ${text.slice(0, 300)}`);
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.log(`✗ ${t.name}: FAIL - ${err.slice(0, 100)}`);
  }
}
