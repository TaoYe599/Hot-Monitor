import "dotenv/config";

// Detect Windows system proxy and set env vars before bootstrapping global-agent
import { execSync } from "node:child_process";
import { buildApp } from "./app.js";
const existingProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
if (!existingProxy) {
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
      }
    }
  } catch {
    // Ignore proxy detection errors
  }
}

// 强制指定 global-agent 忽略代理的白名单域名（包含 QQ 邮箱、Gmail 等主流发信服务器及本地回路），解决代理发信冲突
process.env.GLOBAL_AGENT_NO_PROXY = "smtp.qq.com,smtp.gmail.com,127.0.0.1,localhost";

// Bootstrap global-agent to route Node.js fetch through HTTPS_PROXY (must be before other imports)
import globalAgent from "global-agent";
globalAgent.bootstrap();

if (process.env.HTTPS_PROXY) {
  console.info(`[proxy] Using HTTPS_PROXY: ${process.env.HTTPS_PROXY}`);
}

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[server] Uncaught exception:", error);
});

const { app, services, config } = await buildApp();

await app.listen({
  host: "0.0.0.0",
  port: config.port,
});

services.scheduler.start();

console.log(`Hot Monitor server listening on ${config.publicUrl}`);
