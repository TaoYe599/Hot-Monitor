/**
 * Debug HuggingFace / Google News - why Node.js fetch fails but PowerShell works.
 */
import { load } from "cheerio";
import dns from "node:dns";

// Test 1: DNS resolution
console.log("=== DNS Resolution ===");
for (const host of ["huggingface.co", "news.google.com", "api.github.com", "openai.com"]) {
  try {
    const { address } = await dns.promises.resolve4(host);
    console.log(`  ${host}: ${address}`);
  } catch (e) {
    try {
      const { address } = await dns.promises.resolve6(host);
      console.log(`  ${host} (IPv6): ${address}`);
    } catch {
      console.log(`  ${host}: DNS FAILED - ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// Test 2: Simple HTTPS fetch with verbose error
console.log("\n=== Simple Fetch Test ===");
const targets = [
  "https://huggingface.co/blog/feed.xml",
  "https://news.google.com/rss/search?q=AI",
  "https://api.github.com",
];

for (const url of targets) {
  console.log(`\n  ${url}`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      headers: { "User-Agent": "curl/7.88.1" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    console.log(`    Status: ${res.status}`);
    console.log(`    OK`);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.log(`    FAIL: ${err.name}: ${err.message.slice(0, 120)}`);
    if (err.cause) {
      console.log(`    Cause: ${(err.cause as Error).message || String(err.cause)}`);
    }
  }
}

// Test 3: Check if IPv6 is the issue
console.log("\n=== IPv6 Test ===");
try {
  const res = await fetch("https://[::1]:443", { signal: AbortSignal.timeout(3000) });
  console.log("  IPv6 local: works");
} catch {
  console.log("  IPv6 local: not reachable (normal)");
}
