import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupExpiredLogFiles,
  ensureLogDirectory,
  getDailyLogFilePath,
  getLogDateStamp,
  LOG_RETENTION_DAYS,
} from "./log-rotation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep physical logs in the monorepo root for easy inspection during dev.
const logDir = path.join(__dirname, "..", "..", "..", "..", "logs");
let lastCleanupDate: string | undefined;

try {
  ensureLogDirectory(logDir);
} catch (err) {
  process.stderr.write(`[logger] [ERROR] Failed to create log directory: ${String(err)}\n`);
}

function getFormattedTime(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

function prepareLogFile(now = new Date()): string {
  ensureLogDirectory(logDir);

  const today = getLogDateStamp(now);
  if (lastCleanupDate !== today) {
    try {
      const deletedFiles = cleanupExpiredLogFiles(logDir, now, LOG_RETENTION_DAYS);
      if (deletedFiles.length > 0) {
        process.stderr.write(`[logger] Cleaned ${deletedFiles.length} expired log file(s).\n`);
      }
    } catch (err) {
      process.stderr.write(`[logger] [ERROR] Failed to clean expired logs: ${String(err)}\n`);
    } finally {
      lastCleanupDate = today;
    }
  }

  return getDailyLogFilePath(logDir, now);
}

function writeLogToFile(level: string, message: string): void {
  try {
    const now = new Date();
    const logLine = `[${getFormattedTime(now)}] [${level}] ${message}\n`;
    fs.appendFileSync(prepareLogFile(now), logLine, { encoding: "utf8" });
  } catch (err) {
    process.stderr.write(`[logger] [ERROR] Failed to append log file: ${String(err)}\n`);
  }
}

// Return true for high-volume logs that should stay in files but stay off stdout.
function isNoiseLog(args: unknown[]): boolean {
  if (args.length === 0) return false;
  const mainMsg = String(args[0]);

  if (mainMsg.includes("[scheduler]") && mainMsg.includes("isDue=false")) {
    return true;
  }

  if (mainMsg.includes("[订阅调度]") && mainMsg.includes("开始评估定时简报")) {
    const minutes = new Date().getMinutes();
    return minutes % 10 !== 0;
  }

  return false;
}

function formatConsoleArgs(args: unknown[]): string {
  return args.map(formatConsoleArg).join(" ");
}

function formatConsoleArg(arg: unknown): string {
  if (arg instanceof Error) {
    return arg.stack ?? arg.message;
  }

  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }

  return String(arg);
}

const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: unknown[]) => {
  writeLogToFile("INFO", formatConsoleArgs(args));
  if (!isNoiseLog(args)) {
    originalLog.apply(console, args);
  }
};

console.info = (...args: unknown[]) => {
  writeLogToFile("INFO", formatConsoleArgs(args));
  if (!isNoiseLog(args)) {
    originalInfo.apply(console, args);
  }
};

console.warn = (...args: unknown[]) => {
  writeLogToFile("WARN", formatConsoleArgs(args));
  if (!isNoiseLog(args)) {
    originalWarn.apply(console, args);
  }
};

console.error = (...args: unknown[]) => {
  writeLogToFile("ERROR", formatConsoleArgs(args));
  if (!isNoiseLog(args)) {
    originalError.apply(console, args);
  }
};

originalInfo(
  `[logger] Global console logger initialized. Daily log file: ${getDailyLogFilePath(logDir)}; retention: ${LOG_RETENTION_DAYS} days.`
);
