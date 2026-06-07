import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupExpiredLogFiles,
  ensureLogDirectory,
  getDailyLogFilePath,
  getLogDateStamp,
} from "./log-rotation.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hot-monitor-logs-"));
  tempDirs.push(tempDir);
  return tempDir;
}

function touch(filePath: string): void {
  fs.writeFileSync(filePath, "test\n", "utf8");
}

describe("log rotation", () => {
  it("generates one log file per local day", () => {
    const date = new Date(2026, 5, 7, 13, 14, 15);

    expect(getLogDateStamp(date)).toBe("2026-06-07");
    expect(path.basename(getDailyLogFilePath("logs", date))).toBe("app-2026-06-07.log");
  });

  it("creates the log directory when missing", () => {
    const tempDir = makeTempDir();
    const logDir = path.join(tempDir, "nested", "logs");

    ensureLogDirectory(logDir);

    expect(fs.statSync(logDir).isDirectory()).toBe(true);
  });

  it("removes daily log files older than the retention window", () => {
    const logDir = makeTempDir();
    const files = [
      "app-2026-05-23.log",
      "app-2026-05-24.log",
      "app-2026-06-07.log",
      "app.log",
      "other-2026-05-01.log",
      "app-2026-99-99.log",
    ];

    for (const file of files) {
      touch(path.join(logDir, file));
    }

    const deletedFiles = cleanupExpiredLogFiles(logDir, new Date(2026, 5, 7, 12), 14);

    expect(deletedFiles.map((file) => path.basename(file))).toEqual(["app-2026-05-23.log"]);
    expect(fs.existsSync(path.join(logDir, "app-2026-05-23.log"))).toBe(false);
    expect(fs.existsSync(path.join(logDir, "app-2026-05-24.log"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "app-2026-06-07.log"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "app.log"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "other-2026-05-01.log"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "app-2026-99-99.log"))).toBe(true);
  });
});
