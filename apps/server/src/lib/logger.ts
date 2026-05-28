import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 获取当前模块所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日志目录物理锁定在 Monorepo 项目的根目录下，极大地方便开发者在根目录下直接查阅
const logDir = path.join(__dirname, "..", "..", "..", "..", "logs");
const logFilePath = path.join(logDir, "app.log");

// 确保 logs 目录存在
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (err) {
  process.stderr.write(`[logger] [ERROR] 无法创建日志目录: ${String(err)}\n`);
}

// 格式化时间戳 (精确到毫秒，形如: 2026-05-29 00:52:15.342)
function getFormattedTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}.${ms}`;
}

// 将日志异步/追加写入文件
function writeLogToFile(level: string, message: string) {
  try {
    const timestamp = getFormattedTime();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(logFilePath, logLine, { encoding: "utf8" });
  } catch (err) {
    // 降级容错：写入文件失败时不使进程挂起，仅打印标准错误
    process.stderr.write(`[logger] [ERROR] 追加写入日志文件失败: ${String(err)}\n`);
  }
}

// 精准的高噪声日志过滤器
// 返回 true 代表它是“垃圾噪音日志”，需要从控制台屏蔽过滤，但仍会保留写入物理日志文件中
function isNoiseLog(args: unknown[]): boolean {
  if (args.length === 0) return false;
  const mainMsg = String(args[0]);

  // 1. 过滤 scheduler 任务未到期时的轮询状态日志
  if (mainMsg.includes("[scheduler]") && mainMsg.includes("isDue=false")) {
    return true;
  }

  // 2. 过滤每分钟无动作的订阅简报例行评估日志，但每 10 分钟放行一次作为健康心跳提示，防止产生卡死误会
  if (mainMsg.includes("[订阅调度]") && mainMsg.includes("开始评估定时简报")) {
    const now = new Date();
    const minutes = now.getMinutes();
    // 只有在分钟数是 10 的倍数时（例如整点 00分、10分、20分、30分、40分、50分），才放行打印到控制台
    if (minutes % 10 === 0) {
      return false; 
    }
    return true;
  }

  return false;
}

// 缓存原始的 console 句柄
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

// 设计思路：通过全局改写并重载 console 的四个核心方法，在不侵入业务代码的情况下，
// 实现自动将控制台的输出双写追加至 apps/server/logs/app.log 文件。
// 同时，模块内置了 isNoiseLog 噪声侦测过滤器，将 isDue=false 等刷屏的调度心跳日志在控制台默默隐藏，
// 从而实现“减少控制台刷屏日志”与“日志文件留存追溯”的双重诉求。

console.log = (...args: unknown[]) => {
  const message = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
  writeLogToFile("INFO", message);
  if (!isNoiseLog(args)) {
    originalLog.apply(console, args);
  }
};

console.info = (...args: unknown[]) => {
  const message = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
  writeLogToFile("INFO", message);
  if (!isNoiseLog(args)) {
    originalInfo.apply(console, args);
  }
};

console.warn = (...args: unknown[]) => {
  const message = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
  writeLogToFile("WARN", message);
  if (!isNoiseLog(args)) {
    originalWarn.apply(console, args);
  }
};

console.error = (...args: unknown[]) => {
  const message = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
  writeLogToFile("ERROR", message);
  if (!isNoiseLog(args)) {
    originalError.apply(console, args);
  }
};

originalInfo(`[logger] 全局日志拦截系统初始化成功，控制台噪声过滤器已激活。日志文件: ${logFilePath}`);
