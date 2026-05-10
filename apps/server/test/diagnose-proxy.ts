/**
 * Proxy diagnostic script - check proxy configuration before testing sources.
 * Run: npx tsx test/diagnose-proxy.ts
 */
import { execSync } from "node:child_process";

console.log("=".repeat(60));
console.log("PROXY DIAGNOSTIC");
console.log("=".repeat(60));

// 1. Check environment variables
console.log("\n[1] Environment Variables");
const envVars = [
  "HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy",
  "GLOBAL_AGENT_HTTP_PROXY", "GLOBAL_AGENT_HTTPS_PROXY",
  "NO_PROXY", "no_proxy",
  "NODE_TLS_REJECT_UNAUTHORIZED",
];
for (const key of envVars) {
  const val = process.env[key];
  console.log(`  ${key.padEnd(35)} ${val ? val : "(not set)"}`);
}

// 2. Check Windows registry proxy settings
console.log("\n[2] Windows Registry Proxy Settings");
try {
  const proxyEnable = execSync(
    'powershell -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\').ProxyEnable"',
    { encoding: "utf8", timeout: 5000 }
  ).trim();

  const proxyServer = execSync(
    'powershell -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\').ProxyServer"',
    { encoding: "utf8", timeout: 5000 }
  ).trim();

  const proxyOverride = execSync(
    'powershell -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\').ProxyOverride"',
    { encoding: "utf8", timeout: 5000 }
  ).trim();

  console.log(`  ProxyEnable: ${proxyEnable === "1" ? "ENABLED" : "DISABLED (" + proxyEnable + ")"}`);
  console.log(`  ProxyServer: ${proxyServer || "(not set)"}`);
  console.log(`  ProxyOverride: ${proxyOverride || "(not set)"}`);
} catch (e) {
  console.log(`  Error reading registry: ${e instanceof Error ? e.message : String(e)}`);
}

// 3. Check if proxy port is open
console.log("\n[3] Proxy Port Connectivity");
try {
  const proxyServer = execSync(
    'powershell -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\').ProxyServer"',
    { encoding: "utf8", timeout: 5000 }
  ).trim();

  if (proxyServer) {
    const hostPort = proxyServer.split(":");
    const host = hostPort[0] || "127.0.0.1";
    const port = parseInt(hostPort[1] || "7890");

    const result = execSync(
      `powershell -Command "Test-NetConnection -ComputerName ${host} -Port ${port} | Select-Object -ExpandProperty TcpTestSucceeded"`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();

    console.log(`  ${host}:${port} -> ${result === "True" ? "OPEN" : "CLOSED"}`);
  }
} catch (e) {
  console.log(`  Error: ${e instanceof Error ? e.message : String(e)}`);
}

// 4. Identify proxy software
console.log("\n[4] Identify Proxy Software");
try {
  const netstat = execSync(
    'powershell -Command "Get-NetTCPConnection -LocalPort 7890 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"',
    { encoding: "utf8", timeout: 5000 }
  ).trim();

  if (netstat) {
    const pid = netstat.split("\n")[0].trim();
    if (pid && pid !== "") {
      const procInfo = execSync(
        `powershell -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue) | Select-Object ProcessName, Path | ConvertTo-Json -Compress"`,
        { encoding: "utf8", timeout: 5000 }
      ).trim();

      if (procInfo) {
        try {
          const info = JSON.parse(procInfo);
          console.log(`  PID: ${pid}`);
          console.log(`  Process: ${info.ProcessName}`);
          console.log(`  Path: ${info.Path || "(unknown)"}`);
        } catch {
          console.log(`  ${procInfo}`);
        }
      }
    }
  } else {
    console.log(`  No process on port 7890`);
  }
} catch (e) {
  console.log(`  Error: ${e instanceof Error ? e.message : String(e)}`);
}

// 5. Test sites via PowerShell proxy (gold standard)
console.log("\n[5] PowerShell Proxy Test (reference)");
const curlTests = [
  { name: "GitHub (api.github.com)", url: "https://api.github.com" },
  { name: "HuggingFace", url: "https://huggingface.co" },
  { name: "Google", url: "https://google.com" },
  { name: "DuckDuckGo", url: "https://duckduckgo.com" },
  { name: "Twitter", url: "https://twitter.com" },
  { name: "Google News", url: "https://news.google.com" },
  { name: "ModelScope", url: "https://modelscope.cn" },
  { name: "Weibo", url: "https://weibo.com" },
  { name: "Zhihu", url: "https://zhihu.com" },
  { name: "Baidu", url: "https://baidu.com" },
];

console.log("  Via proxy (http://127.0.0.1:7890):");
for (const t of curlTests) {
  const start = Date.now();
  try {
    const out = execSync(
      `powershell -Command "Invoke-WebRequest -Uri '${t.url}' -Proxy 'http://127.0.0.1:7890' -TimeoutSec 8 -UseBasicParsing -Method HEAD"`,
      { encoding: "utf8", timeout: 10000 }
    ).trim();
    const ms = Date.now() - start;
    const status = out.includes("200") ? "OK" : "FAIL";
    console.log(`    ${t.name.padEnd(30)} ${status} (${ms}ms)`);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const match = err.match(/403|405|407|500|502|503|The remote name could not be resolved|timeout|refused/i);
    const reason = match ? match[0].slice(0, 40) : "failed";
    console.log(`    ${t.name.padEnd(30)} FAIL (${reason})`);
  }
}

console.log("\n  Direct (no proxy):");
for (const t of curlTests) {
  const start = Date.now();
  try {
    const out = execSync(
      `powershell -Command "Invoke-WebRequest -Uri '${t.url}' -TimeoutSec 8 -UseBasicParsing -Method HEAD"`,
      { encoding: "utf8", timeout: 10000 }
    ).trim();
    const ms = Date.now() - start;
    const status = out.includes("200") ? "OK" : "FAIL";
    console.log(`    ${t.name.padEnd(30)} ${status} (${ms}ms)`);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const match = err.match(/403|405|timeout|timed out|refused|The operation has timed|DNS|Unable to connect/i);
    const reason = match ? match[0].slice(0, 40) : "failed";
    console.log(`    ${t.name.padEnd(30)} FAIL (${reason})`);
  }
}

// 6. Node.js fetch() interception tests
console.log("\n[6] Node.js fetch() Interception Tests");

// 6a. Direct (no agent)
console.log("\n  [6a] Node.js fetch() - direct (no agent):");
for (const t of curlTests.slice(0, 4)) {
  const start = Date.now();
  try {
    const r = await fetch(t.url, { signal: AbortSignal.timeout(8000) });
    console.log(`    ${t.name.padEnd(30)} ${r.status} (${Date.now()-start}ms)`);
  } catch (e) {
    console.log(`    ${t.name.padEnd(30)} FAIL (${e instanceof Error ? e.message.slice(0,50) : "timeout"})`);
  }
}

// 6b. global-agent
console.log("\n  [6b] global-agent.bootstrap():");
import globalAgent from "global-agent";
process.env["GLOBAL_AGENT.HTTP_PROXY"] = "http://127.0.0.1:7890";
process.env["GLOBAL_AGENT.HTTPS_PROXY"] = "http://127.0.0.1:7890";
process.env.HTTPS_PROXY = "http://127.0.0.1:7890";
process.env.HTTP_PROXY = "http://127.0.0.1:7890";
process.env.NO_PROXY = "*";
process.env["GLOBAL_AGENT.NO_PROXY"] = "";
globalAgent.bootstrap();
console.log(`    NO_PROXY=${process.env.NO_PROXY}`);

for (const t of curlTests.slice(0, 4)) {
  const start = Date.now();
  try {
    const r = await fetch(t.url, { signal: AbortSignal.timeout(8000) });
    console.log(`    ${t.name.padEnd(30)} ${r.status} (${Date.now()-start}ms)`);
  } catch (e) {
    console.log(`    ${t.name.padEnd(30)} FAIL (${e instanceof Error ? e.message.slice(0,50) : "timeout"})`);
  }
}

// 6c. https-proxy-agent dispatcher
console.log("\n  [6c] https-proxy-agent dispatcher:");
try {
  const { HttpsProxyAgent } = await import("https-proxy-agent");
  const agent = new HttpsProxyAgent("http://127.0.0.1:7890");
  for (const t of curlTests.slice(0, 4)) {
    const start = Date.now();
    try {
      const r = await fetch(t.url, { dispatcher: agent, signal: AbortSignal.timeout(8000) });
      console.log(`    ${t.name.padEnd(30)} ${r.status} (${Date.now()-start}ms)`);
    } catch (e) {
      console.log(`    ${t.name.padEnd(30)} FAIL (${e instanceof Error ? e.message.slice(0,50) : "timeout"})`);
    }
  }
} catch (e) {
  console.log(`    https-proxy-agent import failed: ${e instanceof Error ? e.message.slice(0,80) : String(e)}`);
}

// 6d. Undici ProxyAgent
console.log("\n  [6d] Undici ProxyAgent:");
try {
  const { ProxyAgent, fetch: undiciFetch } = await import("undici");
  const agent = new ProxyAgent("http://127.0.0.1:7890");
  for (const t of curlTests.slice(0, 4)) {
    const start = Date.now();
    try {
      const r = await undiciFetch(t.url, { dispatcher: agent, signal: AbortSignal.timeout(8000) });
      console.log(`    ${t.name.padEnd(30)} ${r.status} (${Date.now()-start}ms)`);
    } catch (e) {
      console.log(`    ${t.name.padEnd(30)} FAIL (${e instanceof Error ? e.message.slice(0,50) : "timeout"})`);
    }
  }
} catch (e) {
  console.log(`    Undici ProxyAgent not available: ${e instanceof Error ? e.message.slice(0,80) : String(e)}`);
}

// Diagnosis
console.log("\n  [6e] Diagnosis Guide:");
console.log(`    [6a] all FAIL -> No direct internet (must use proxy)`);
console.log(`    [6b] all FAIL -> global-agent v4 incompatible with Node.js 22`);
console.log(`    [6c] all FAIL -> https-proxy-agent incompatible with Undici`);
console.log(`    [6d] all FAIL -> Undici ProxyAgent incompatible`);
console.log(`    [6b/6c/6d] some OK -> that approach works, use it`);

// Summary
console.log("\n" + "=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
console.log("Compare results across all sections to determine:");
console.log("  1. Which sites are reachable (PowerShell proxy = ground truth)");
console.log("  2. Which Node.js approach works for that site");
console.log("  3. The correct proxy strategy for the server code");
