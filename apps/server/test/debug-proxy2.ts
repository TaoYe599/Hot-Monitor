import globalAgent from "global-agent";

// Try with NO_PROXY to force all through proxy
process.env.NO_PROXY = "";
process.env.HTTPS_PROXY = "http://127.0.0.1:7890";
process.env.HTTP_PROXY = "http://127.0.0.1:7890";

globalAgent.bootstrap();

console.log("NO_PROXY:", process.env.NO_PROXY);
console.log("GLOBAL_AGENT.NO_PROXY:", process.env["GLOBAL_AGENT.NO_PROXY"]);

// Test various domains
const tests = [
  "https://api.github.com",
  "https://huggingface.co",
  "https://google.com",
  "https://news.google.com",
  "https://duckduckgo.com",
];

for (const url of tests) {
  const start = Date.now();
  try {
    const r = await fetch(url);
    console.log(`  ${url}: ${r.status} (${Date.now()-start}ms)`);
  } catch (e) {
    console.log(`  ${url}: FAIL - ${e instanceof Error ? e.message.slice(0,80) : String(e)}`);
  }
}
