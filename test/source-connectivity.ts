import { promiseTimeout } from "../apps/server/src/lib/utils.ts";
import { fetch as undiciFetch, ProxyAgent as UndiciProxyAgent } from "undici";
import { execSync } from "node:child_process";

function getWindowsSystemProxy(): string | undefined {
  try {
    const result = execSync(
      'powershell -Command "[System.Net.WebRequest]::GetSystemWebProxy().GetProxy(\'http://example.com\').OriginalString"',
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    if (result && result !== "http://example.com/") {
      return result;
    }
  } catch {
    // Ignore errors
  }

  try {
    const result = execSync(
      'powershell -Command "Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\' | Select-Object -ExpandProperty ProxyServer"',
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    if (result && result !== "0") {
      const portMatch = result.match(/:(\d+)$/);
      if (!portMatch) {
        return `http://${result}:80`;
      }
      return `http://${result}`;
    }
  } catch {
    // Ignore errors
  }

  return undefined;
}

function getUndiciDispatcher(): UndiciProxyAgent | undefined {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    getWindowsSystemProxy();

  if (proxyUrl) {
    console.info(`[proxy] Using proxy: ${proxyUrl}`);
    return new UndiciProxyAgent(proxyUrl);
  }
  return undefined;
}

const dispatcher = getUndiciDispatcher();

function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  if (dispatcher) {
    return undiciFetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      dispatcher,
    });
  }
  return promiseTimeout(fetch(url), timeoutMs);
}

interface SourceTestResult {
  name: string;
  url: string;
  status: "ok" | "failed" | "timeout";
  statusCode?: number;
  duration?: number;
  error?: string;
  items?: number;
}

const RSS_FEEDS = [
  { name: "OpenAI Blog", url: "https://openai.com/news/rss.xml" },
  { name: "Anthropic News", url: "https://www.anthropic.com/news/rss.xml" },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
  { name: "Google DeepMind Blog", url: "https://deepmind.google/blog/rss.xml" },
] as const;

const GITHUB_RELEASES = [
  { name: "openai/openai-python", url: "https://github.com/openai/openai-python/releases.atom" },
  { name: "openai/openai-node", url: "https://github.com/openai/openai-node/releases.atom" },
  { name: "anthropics/anthropic-sdk-typescript", url: "https://github.com/anthropics/anthropic-sdk-typescript/releases.atom" },
  { name: "huggingface/transformers", url: "https://github.com/huggingface/transformers/releases.atom" },
  { name: "huggingface/peft", url: "https://github.com/huggingface/peft/releases.atom" },
  { name: "meta-llama/llama", url: "https://github.com/meta-llama/llama/releases.atom" },
  { name: "mistralai/mistralai-python", url: "https://github.com/mistralai/mistralai-python/releases.atom" },
  { name: "deepseek-ai/DeepSeek-V2", url: "https://github.com/deepseek-ai/DeepSeek-V2/releases.atom" },
  { name: "QwenLM/Qwen", url: "https://github.com/QwenLM/Qwen/releases.atom" },
  { name: "ollama/ollama", url: "https://github.com/ollama/ollama/releases.atom" },
  { name: "vllm-project/vllm", url: "https://github.com/vllm-project/vllm/releases.atom" },
] as const;

const SEARCH_APIS = [
  { name: "DuckDuckGo HTML", url: "https://html.duckduckgo.com/html/?q=test" },
  { name: "Google News", url: "https://news.google.com/rss/search?q=test" },
  { name: "HackerNews", url: "https://hn.algolia.com/api/v1/search?query=test" },
] as const;

async function testSource(name: string, url: string, timeoutMs = 15000): Promise<SourceTestResult> {
  const start = Date.now();
  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    const duration = Date.now() - start;
    const text = await response.text();
    let items: number | undefined;

    if (text.includes("<item>") || text.includes("<entry>")) {
      const matches = text.match(/<item[^>]*>/gi) || text.match(/<entry[^>]*>/gi) || [];
      items = matches.length;
    }

    return {
      name,
      url,
      status: "ok",
      statusCode: response.status,
      duration,
      items,
    };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("Timeout") || errorMessage.includes("timed out")) {
      return { name, url, status: "timeout", duration, error: errorMessage };
    }

    return { name, url, status: "failed", duration, error: errorMessage };
  }
}

async function testGroup(name: string, sources: readonly { name: string; url: string }[], timeoutMs = 15000): Promise<void> {
  console.log(`\n=== ${name} (${sources.length} sources) ===`);
  const results = await Promise.all(sources.map((s) => testSource(s.name, s.url, timeoutMs)));

  const ok = results.filter((r) => r.status === "ok");
  const failed = results.filter((r) => r.status === "failed");
  const timeout = results.filter((r) => r.status === "timeout");

  for (const r of results) {
    const icon = r.status === "ok" ? "[OK]" : r.status === "timeout" ? "[TIMEOUT]" : "[FAIL]";
    const info = r.status === "ok"
      ? `${r.statusCode} (${r.duration}ms${r.items !== undefined ? `, ${r.items} items` : ""})`
      : r.error || "Unknown error";
    console.log(`  ${icon} ${r.name}: ${info}`);
  }

  console.log(`\nSummary: ${ok.length} OK, ${timeout.length} timeout, ${failed.length} failed`);
}

async function main() {
  console.log("Hot Monitor Data Source Connectivity Test");
  console.log("==========================================");
  console.log(`Started at: ${new Date().toISOString()}`);

  await testGroup("Search APIs", SEARCH_APIS, 15000);
  await testGroup("RSS Feeds", RSS_FEEDS, 15000);
  await testGroup("GitHub Releases", GITHUB_RELEASES, 20000);

  console.log("\n==========================================");
  console.log(`Completed at: ${new Date().toISOString()}`);
}

void main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
