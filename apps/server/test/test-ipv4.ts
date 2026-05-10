/**
 * Test: Force IPv4 for Node.js fetch.
 * Hypothesis: HuggingFace fails because undici uses IPv6 (which is blocked).
 * GitHub works because lookup() returns IPv4.
 */
import dns from "node:dns";

console.log("=== Test: Force IPv4 with dns.setDefaultResultOrder ===");
dns.setDefaultResultOrder("ipv4first");

// Verify
console.log("DNS default order set to ipv4first");

// Now lookup
for (const host of ["huggingface.co", "news.google.com", "api.github.com"]) {
  const r = await dns.promises.lookup(host);
  console.log(`  ${host}: ${r.address} (family: ${r.family})`);
}

// Fetch test
console.log("\n=== Fetch Test (with IPv4 forced) ===");
const targets = [
  { name: "huggingface.co/blog/feed.xml", url: "https://huggingface.co/blog/feed.xml" },
  { name: "news.google.com RSS", url: "https://news.google.com/rss/search?q=AI" },
  { name: "api.github.com", url: "https://api.github.com" },
  { name: "openai.com/rss", url: "https://openai.com/news/rss.xml" },
];

for (const t of targets) {
  const start = Date.now();
  try {
    const res = await fetch(t.url, { signal: AbortSignal.timeout(15000) });
    console.log(`  ${t.name}: ${res.status} (${Date.now()-start}ms)`);
  } catch (e) {
    console.log(`  ${t.name}: FAIL (${Date.now()-start}ms) - ${e instanceof Error ? e.message.slice(0,60) : String(e)}`);
  }
}
