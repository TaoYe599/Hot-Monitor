/**
 * Debug: Is IPv6 the issue? Force IPv4 for HuggingFace.
 */
import dns from "node:dns";

// Test: does setting family=4 help dns.lookup?
console.log("=== dns.lookup family=4 ===");
const hosts = ["huggingface.co", "news.google.com", "api.github.com"];
for (const host of hosts) {
  try {
    const r = await dns.promises.lookup(host, 4);
    console.log(`  ${host} (IPv4): ${r.address}`);
  } catch (e) {
    console.log(`  ${host} (IPv4): FAIL - ${e instanceof Error ? e.message : String(e)}`);
  }
}

console.log("\n=== dns.lookup family=6 ===");
for (const host of hosts) {
  try {
    const r = await dns.promises.lookup(host, 6);
    console.log(`  ${host} (IPv6): ${r.address}`);
  } catch (e) {
    console.log(`  ${host} (IPv6): FAIL - ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Test: can we force IPv4 in fetch?
console.log("\n=== Fetch with agent configured for IPv4 only ===");
try {
  const { ProxyAgent, setGlobalDispatcher, getGlobalDispatcher } = await import("undici");

  // Check current dispatcher
  const dispatcher = getGlobalDispatcher();
  console.log(`  Current dispatcher: ${dispatcher.constructor.name}`);

  // Test HuggingFace with explicit IPv4
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  // Try with a custom agent that forces IPv4
  const r = await fetch("https://huggingface.co/blog/feed.xml", {
    signal: controller.signal,
  });
  clearTimeout(timeout);
  console.log(`  huggingface.co: ${r.status} (${r.headers.get("content-length")} bytes)`);
} catch (e) {
  console.log(`  huggingface.co: FAIL - ${e instanceof Error ? e.message.slice(0,80) : String(e)}`);
  if ((e as NodeJS.ErrnoException).code) {
    console.log(`  code: ${(e as NodeJS.ErrnoException).code}`);
  }
}

// Test: what if we use https-proxy-agent with no_proxy trick?
console.log("\n=== Using https-proxy-agent dispatcher ===");
try {
  const { HttpsProxyAgent } = await import("https-proxy-agent");
  const agent = new HttpsProxyAgent("http://127.0.0.1:7890");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const r = await fetch("https://huggingface.co/blog/feed.xml", {
    dispatcher: agent,
    signal: controller.signal,
  });
  clearTimeout(timeout);
  console.log(`  huggingface.co via proxy: ${r.status}`);
} catch (e) {
  console.log(`  huggingface.co via proxy: FAIL - ${e instanceof Error ? e.message.slice(0,80) : String(e)}`);
  if ((e as NodeJS.ErrnoException).code) {
    console.log(`  code: ${(e as NodeJS.ErrnoException).code}`);
  }
}

// Test: try with NODE_OPTIONS to force IPv4
console.log("\n=== NODE_OPTIONS=--enable-source-maps (test) ===");
console.log(`  Current NODE_OPTIONS: ${process.env.NODE_OPTIONS || "(none)"}`);
