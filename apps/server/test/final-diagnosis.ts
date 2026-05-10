/**
 * Final diagnostic: understand the exact VPN proxy setup.
 * Focus: why HuggingFace gets Fake IP but can't connect.
 */
import { execSync } from "node:child_process";
import dns from "node:dns";

console.log("=== 1. Clash DNS (Fake IP) Analysis ===");
const hosts = ["huggingface.co", "news.google.com", "api.github.com"];
for (const host of hosts) {
  const [a, aaaa] = await Promise.allSettled([
    dns.promises.resolve4(host),
    dns.promises.resolve6(host),
  ]);
  const aRecord = a.status === "fulfilled" ? a.value : [];
  const isFakeIP = aRecord.length > 0 && aRecord[0].startsWith("198.18.");
  console.log(`  ${host}:`);
  console.log(`    A (IPv4): ${aRecord.join(", ") || "(none)"} ${isFakeIP ? "[FAKE IP]" : ""}`);
  if (aaaa.status === "fulfilled") {
    console.log(`    AAAA (IPv6): ${aaaa.value.join(", ") || "(none)"}`);
  }
}

console.log("\n=== 2. Clash TUN Mode Check ===");
try {
  const tapAdapters = execSync(
    `powershell -Command "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Where-Object { $_.Name -match 'TAP|TUN|cfw|clash|meta|mihomo|TUN\\(|wintun' } | Select-Object Name, InterfaceDescription | ConvertTo-Json"`,
    { encoding: "utf8", timeout: 5000 }
  ).trim();
  if (tapAdapters) {
    const parsed = JSON.parse(tapAdapters);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const a of list) {
      console.log(`  UP: ${a.Name} - ${a.InterfaceDescription}`);
    }
  } else {
    console.log("  No TUN adapters found (TUN mode likely OFF)");
  }
} catch { console.log("  TUN check error"); }

try {
  const allUp = execSync(
    `powershell -Command "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object Name, InterfaceDescription | ConvertTo-Json -Depth 1"`,
    { encoding: "utf8", timeout: 5000 }
  ).trim();
  const parsed = JSON.parse(allUp);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  console.log("\n  All UP adapters:");
  for (const a of list) {
    console.log(`    ${a.Name}: ${a.InterfaceDescription}`);
  }
} catch { /* ignore */ }

console.log("\n=== 3. System Proxy vs TUN ===");
try {
  const proxyEnable = execSync(
    'powershell -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\').ProxyEnable"',
    { encoding: "utf8", timeout: 3000 }
  ).trim();
  const proxyServer = execSync(
    'powershell -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\').ProxyServer"',
    { encoding: "utf8", timeout: 3000 }
  ).trim();
  console.log(`  ProxyEnable: ${proxyEnable === "1" ? "ON (system proxy)" : "OFF"}`);
  console.log(`  ProxyServer: ${proxyServer}`);
} catch { /* ignore */ }

console.log("\n=== 4. The Core Problem ===");
console.log("  DNS:    resolve4() -> 198.18.x.x (Fake IP via Clash DNS 10.0.0.1)");
console.log("  DNS:    lookup()   -> real IPv4 (no fake IP)");
console.log("  undici uses lookup() -> gets real IPv4 -> goes DIRECT -> blocked");
console.log("");
console.log("  Why GitHub works: lookup() returns IPv4 (not fake IP), undici connects directly");
console.log("  Why HuggingFace fails: lookup() returns IPv6 only, undici tries IPv6 -> blocked");
console.log("");
console.log("  ROOT CAUSE: undici does NOT use the fake IP from resolve4(),");
console.log("  it uses lookup() which returns real IPs that bypass the proxy.");

console.log("\n=== 5. Solution Approaches ===");
console.log("  A) Use https-proxy-agent dispatcher: works but needs explicit per-request");
console.log("  B) Set system proxy env vars: global-agent tried but incompatible with Node 22");
console.log("  C) Use SOCKS5 proxy (Clash often supports it on a different port)");
console.log("  D) Enable TUN mode in Clash: routes ALL traffic through VPN (recommended)");
console.log("  E) Disable fake IP in Clash config: use real IPs directly");

console.log("\n=== 6. Test: Use global-agent with FORCE_GLOBAL=true ===");
// Test with GLOBAL_AGENT.FORCE_GLOBAL
import globalAgent from "global-agent";
process.env["GLOBAL_AGENT.HTTP_PROXY"] = "http://127.0.0.1:7890";
process.env["GLOBAL_AGENT.HTTPS_PROXY"] = "http://127.0.0.1:7890";
process.env.HTTPS_PROXY = "http://127.0.0.1:7890";
process.env.HTTP_PROXY = "http://127.0.0.1:7890";
process.env["GLOBAL_AGENT.NO_PROXY"] = "";
process.env.NO_PROXY = "";
globalAgent.bootstrap();

for (const host of ["huggingface.co", "api.github.com"]) {
  const start = Date.now();
  try {
    const r = await fetch(`https://${host}`, { signal: AbortSignal.timeout(10000) });
    console.log(`  ${host}: ${r.status} (${Date.now()-start}ms)`);
  } catch (e) {
    console.log(`  ${host}: FAIL (${Date.now()-start}ms) - ${e instanceof Error ? e.message.slice(0,60) : String(e)}`);
  }
}
