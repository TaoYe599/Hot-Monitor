/**
 * Wrapper that detects Windows proxy and runs source-connectivity.test.ts
 * Usage: npx tsx test/source-connectivity-wrapper.ts
 */
import { execSync } from "node:child_process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect Windows system proxy
try {
  const proxyEnable = execSync(
    'powershell -Command "Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\' | Select-Object -ExpandProperty ProxyEnable"',
    { encoding: "utf8", timeout: 5000 }
  ).trim();

  if (proxyEnable === "1") {
    const proxyServer = execSync(
      'powershell -Command "Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\' | Select-Object -ExpandProperty ProxyServer"',
      { encoding: "utf8", timeout: 5000 }
    ).trim();

    if (proxyServer && proxyServer !== "0") {
      const proxyUrl = proxyServer.includes(":") ? `http://${proxyServer}` : `http://${proxyServer}:80`;
      process.env.HTTPS_PROXY = proxyUrl;
      process.env.HTTP_PROXY = proxyUrl;
      process.env["GLOBAL_AGENT.HTTP_PROXY"] = proxyUrl;
      process.env["GLOBAL_AGENT.HTTPS_PROXY"] = proxyUrl;
      console.info(`[proxy] Detected Windows system proxy: ${proxyUrl}`);
    } else {
      console.info("[proxy] Proxy enabled but no server configured");
    }
  } else {
    console.info("[proxy] Windows system proxy is disabled");
  }
} catch {
  console.info("[proxy] Could not detect Windows proxy");
}

// Check if HTTPS_PROXY already set (e.g., from .env)
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) {
  console.info(`[proxy] Using: ${proxy}`);
  process.env["GLOBAL_AGENT.HTTP_PROXY"] = proxy;
  process.env["GLOBAL_AGENT.HTTPS_PROXY"] = proxy;
} else {
  console.info("[proxy] No proxy configured - requests may fail");
}

console.info("");

// Spawn the actual test in a child process with env vars inherited
const testFile = resolve(__dirname, "source-connectivity.test.ts");
const child = spawn(
  "npx",
  ["tsx", testFile],
  {
    stdio: "inherit",
    env: { ...process.env },
    cwd: resolve(__dirname, ".."),
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
