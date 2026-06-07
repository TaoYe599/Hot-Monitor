import fs from "node:fs";
import path from "node:path";

export const LOG_FILE_PREFIX = "app";
export const LOG_FILE_EXTENSION = ".log";
export const LOG_RETENTION_DAYS = 14;

const DAILY_LOG_FILE_PATTERN = /^app-(\d{4}-\d{2}-\d{2})\.log$/;

export function getLogDateStamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyLogFilePath(logDir: string, date = new Date()): string {
  return path.join(logDir, `${LOG_FILE_PREFIX}-${getLogDateStamp(date)}${LOG_FILE_EXTENSION}`);
}

export function ensureLogDirectory(logDir: string): void {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

export function cleanupExpiredLogFiles(
  logDir: string,
  now = new Date(),
  retentionDays = LOG_RETENTION_DAYS
): string[] {
  if (!fs.existsSync(logDir)) {
    return [];
  }

  const cutoff = startOfLocalDay(now);
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const deletedFiles: string[] = [];
  for (const entry of fs.readdirSync(logDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const match = DAILY_LOG_FILE_PATTERN.exec(entry.name);
    if (!match) {
      continue;
    }

    const logDate = parseDateStamp(match[1]);
    if (!logDate || logDate >= cutoff) {
      continue;
    }

    const filePath = path.join(logDir, entry.name);
    fs.unlinkSync(filePath);
    deletedFiles.push(filePath);
  }

  return deletedFiles;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateStamp(stamp: string): Date | null {
  const [yearText, monthText, dayText] = stamp.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}
