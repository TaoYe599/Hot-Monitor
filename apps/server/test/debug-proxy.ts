import "dotenv/config";
import globalAgent from "global-agent";
globalAgent.bootstrap();

console.log("GLOBAL_AGENT.HTTP_PROXY:", process.env["GLOBAL_AGENT.HTTP_PROXY"]);
console.log("GLOBAL_AGENT.HTTPS_PROXY:", process.env["GLOBAL_AGENT.HTTPS_PROXY"]);
console.log("HTTPS_PROXY:", process.env.HTTPS_PROXY);
console.log("HTTP_PROXY:", process.env.HTTP_PROXY);
console.log("NO_PROXY:", process.env.NO_PROXY);

// Test direct fetch
console.log("\n--- Test 1: Direct fetch without dispatcher ---");
const start1 = Date.now();
try {
  const r = await fetch("https://api.github.com");
  console.log(`  api.github.com: ${r.status} (${Date.now()-start1}ms)`);
} catch (e) {
  console.log(`  api.github.com: FAIL - ${e instanceof Error ? e.message : String(e)}`);
}

// Test via fetch with explicit https proxy
console.log("\n--- Test 2: Via https proxy ---");
const start2 = Date.now();
try {
  const r2 = await fetch("https://api.github.com");
  console.log(`  api.github.com: ${r2.status} (${Date.now()-start2}ms)`);
} catch (e) {
  console.log(`  api.github.com: FAIL - ${e instanceof Error ? e.message : String(e)}`);
}

// Test huggingface
console.log("\n--- Test 3: HuggingFace ---");
const start3 = Date.now();
try {
  const r3 = await fetch("https://huggingface.co/blog/feed.xml");
  console.log(`  huggingface.co: ${r3.status} (${Date.now()-start3}ms)`);
} catch (e) {
  console.log(`  huggingface.co: FAIL - ${e instanceof Error ? e.message : String(e)}`);
}
