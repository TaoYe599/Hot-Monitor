/**
 * Debug VPN DNS and routing.
 */
import { execSync } from "node:child_process";
import dns from "node:dns";

console.log("=== DNS Resolver Configuration ===");
console.log("process.env.RES_OPTIONS:", process.env.RES_OPTIONS || "(not set)");
console.log("process.version:", process.version);

// Check system DNS servers
console.log("\n=== System DNS Servers ===");
try {
  const dnsServers = execSync(
    'powershell -Command "Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses -ne $null -and $_.ServerAddresses.Count -gt 0 } | Select-Object InterfaceAlias, ServerAddresses | ConvertTo-Json -Depth 2"',
    { encoding: "utf8", timeout: 5000 }
  ).trim();
  const parsed = JSON.parse(dnsServers);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  for (const iface of list) {
    console.log(`  ${iface.InterfaceAlias}: ${(iface.ServerAddresses || []).join(", ")}`);
  }
} catch (e) {
  console.log(`  Error: ${e instanceof Error ? e.message : String(e)}`);
}

// Test DNS via different methods
console.log("\n=== DNS Lookup Methods ===");
const hosts = ["huggingface.co", "news.google.com", "api.github.com"];

for (const host of hosts) {
  console.log(`\n  ${host}:`);

  // Method 1: dns.promises.resolve4
  try {
    const addrs = await dns.promises.resolve4(host);
    console.log(`    resolve4: ${addrs.join(", ") || "(empty)"}`);
  } catch (e) {
    console.log(`    resolve4: ERROR - ${e instanceof Error ? e.message.slice(0,60) : String(e)}`);
  }

  // Method 2: dns.lookup
  try {
    const result = await dns.promises.lookup(host);
    console.log(`    lookup: ${result.address} (family: ${result.family})`);
  } catch (e) {
    console.log(`    lookup: ${e instanceof Error ? e.message.slice(0,60) : String(e)}`);
  }
}

// Check routing table
console.log("\n=== Routing Table (Default Gateway) ===");
try {
  const routes = execSync(
    `powershell -Command "Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 3 | ConvertTo-Json"`,
    { encoding: "utf8", timeout: 3000 }
  ).trim();
  const parsed = JSON.parse(routes);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  for (const route of list) {
    console.log(`  Gateway: ${route.NextHop} Interface: ${route.InterfaceAlias}`);
  }
} catch { /* ignore */ }

// Test if api.github.com works via a specific IP
console.log("\n=== Direct IP Fetch Test ===");
const ipTests = [
  { name: "api.github.com", ip: "140.82.121.6" },
  { name: "huggingface.co", ip: "34.203.69.200" },
];
for (const t of ipTests) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://${t.ip}/`, {
      headers: { "Host": t.name, "User-Agent": "curl/7.88.1" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    console.log(`  ${t.name} (via IP ${t.ip}): ${res.status}`);
  } catch (e) {
    console.log(`  ${t.name} (via IP ${t.ip}): FAIL - ${e instanceof Error ? e.message.slice(0,60) : "timeout"}`);
  }
}
