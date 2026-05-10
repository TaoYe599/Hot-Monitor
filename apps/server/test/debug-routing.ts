/**
 * Debug VPN routing - why TCP fails despite DNS resolving.
 */
import { execSync } from "node:child_process";

console.log("=== All listening ports on local machine ===");
try {
  const ports = execSync(
    'powershell -Command "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -eq \'127.0.0.1\' -or $_.LocalAddress -eq \'::1\' } | Select-Object LocalPort | Sort-Object LocalPort | Get-Unique | Select-Object -ExpandProperty LocalPort"',
    { encoding: "utf8", timeout: 5000 }
  ).trim();

  const portList = ports.split("\n").map(p => parseInt(p.trim())).filter(p => !isNaN(p));
  const interesting = portList.filter(p => p >= 7000 && p <= 8000);
  console.log(`  Listening ports (7000-8000): ${interesting.join(", ") || "(none)"}`);
  console.log(`  All listening ports: ${portList.slice(0, 30).join(", ")}${portList.length > 30 ? "..." : ""}`);
} catch (e) {
  console.log(`  Error: ${e instanceof Error ? e.message : String(e)}`);
}

// Check process on port 7890
console.log("\n=== Process on port 7890 ===");
try {
  const pid = execSync(
    'powershell -Command "(Get-NetTCPConnection -LocalPort 7890 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1"',
    { encoding: "utf8", timeout: 3000 }
  ).trim();
  if (pid) {
    const info = execSync(
      `powershell -Command "(Get-Process -Id ${pid}).ProcessName; (Get-Process -Id ${pid}).Path"`,
      { encoding: "utf8", timeout: 3000 }
    ).trim();
    console.log(`  PID ${pid}: ${info.replace(/\n/g, " | ")}`);
  }
} catch (e) {
  console.log(`  Error: ${e instanceof Error ? e.message : String(e)}`);
}

// Check Clash Verge config for ports
console.log("\n=== Clash Verge Config Ports ===");
try {
  const clashConfigs = execSync(
    `powershell -Command "Get-ChildItem -Path '$env:APPDATA' -Recurse -File -Filter '*.yaml' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'clash|verge|mihomo|meta' } | Select-Object -First 5 FullName"`,
    { encoding: "utf8", timeout: 5000 }
  ).trim();

  if (clashConfigs) {
    for (const configPath of clashConfigs.split("\n").filter(l => l.trim())) {
      console.log(`  Checking: ${configPath.trim()}`);
      try {
        const mixed = execSync(
          `powershell -Command "type '"'"${configPath.trim()}'"'" | findstr /i mixed-port tproxy-port redir-port"`,
          { encoding: "utf8", timeout: 3000 }
        ).trim();
        if (mixed) console.log(`    ${mixed}`);
      } catch { /* ignore */ }
    }
  } else {
    console.log(`  No Clash config found`);
  }
} catch (e) {
  console.log(`  Error: ${e instanceof Error ? e.message : String(e)}`);
}

// Test direct TCP connection to those IPs
console.log("\n=== TCP Connection Test (PowerShell) ===");
const targets = [
  { name: "huggingface.co", ip: "199.96.58.105", port: 443 },
  { name: "news.google.com", ip: "142.250.196.206", port: 443 },
  { name: "github.com", ip: "140.82.121.6", port: 443 },
];
for (const t of targets) {
  try {
    const result = execSync(
      `powershell -Command "Test-NetConnection -ComputerName ${t.ip} -Port ${t.port} -WarningAction SilentlyContinue | Select-Object TcpTestSucceeded, PingSucceeded | ConvertTo-Json"`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    const r = JSON.parse(result);
    console.log(`  ${t.name} (${t.ip}:${t.port}): TCP=${r.TcpTestSucceeded}, Ping=${r.PingSucceeded}`);
  } catch (e) {
    console.log(`  ${t.name}: Error - ${e instanceof Error ? e.message.slice(0,60) : String(e)}`);
  }
}

// Test via proxy (SOCKS5 vs HTTP)
console.log("\n=== Proxy Port Tests ===");
try {
  const mixed = execSync(
    'powershell -Command "(Get-NetTCPConnection -LocalPort 7890 -RemotePort 80 -ErrorAction SilentlyContinue).Count"',
    { encoding: "utf8", timeout: 3000 }
  ).trim();
  console.log(`  Port 7890 connections: ${mixed}`);
} catch { /* ignore */ }
