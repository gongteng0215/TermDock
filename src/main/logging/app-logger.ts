import { app } from "electron";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export type AppLogLevel = "debug" | "info" | "warn" | "error";

interface AppLogRecord {
  at: string;
  level: AppLogLevel;
  source: string;
  message: string;
  details?: unknown;
}

interface AppLogInfo {
  logDirectoryPath: string;
  logFilePath: string;
}

const LOG_DIRECTORY_NAME = "logs";
const LOG_FILE_NAME = "termdock.log";
const LOG_ARCHIVE_NAME = "termdock.log.1";
const LOG_ROTATE_MAX_BYTES = 2 * 1024 * 1024;

export class AppLogger {
  private initialized = false;
  private logDirectoryPath = "";
  private logFilePath = "";

  initialize(): void {
    if (this.initialized) {
      return;
    }
    const basePath = app.isReady() ? app.getPath("userData") : process.cwd();
    this.logDirectoryPath = join(basePath, LOG_DIRECTORY_NAME);
    this.logFilePath = join(this.logDirectoryPath, LOG_FILE_NAME);
    mkdirSync(this.logDirectoryPath, { recursive: true });
    this.initialized = true;
    this.log("info", "main:logger", "Logger initialized.", this.getLogInfo());
  }

  getLogInfo(): AppLogInfo {
    this.ensureInitialized();
    return {
      logDirectoryPath: this.logDirectoryPath,
      logFilePath: this.logFilePath
    };
  }

  log(level: AppLogLevel, source: string, message: string, details?: unknown): void {
    this.ensureInitialized();
    const safeSource = normalizeLogText(source, "unknown");
    const safeMessage = normalizeLogText(message, "Empty log message");
    const record: AppLogRecord = {
      at: new Date().toISOString(),
      level,
      source: safeSource,
      message: safeMessage
    };
    if (details !== undefined) {
      record.details = sanitizeLogDetails(details);
    }
    this.rotateLogIfNeeded();
    appendFileSync(this.logFilePath, `${JSON.stringify(record)}\n`, { encoding: "utf-8" });
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  private rotateLogIfNeeded(): void {
    if (!existsSync(this.logFilePath)) {
      return;
    }
    const stats = statSync(this.logFilePath);
    if (stats.size < LOG_ROTATE_MAX_BYTES) {
      return;
    }
    const archivedLogPath = join(this.logDirectoryPath, LOG_ARCHIVE_NAME);
    if (existsSync(archivedLogPath)) {
      unlinkSync(archivedLogPath);
    }
    renameSync(this.logFilePath, archivedLogPath);
  }
}

export const appLogger = new AppLogger();

function normalizeLogText(value: string, fallback: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return fallback;
  }
  if (normalized.length <= 2000) {
    return normalized;
  }
  return `${normalized.slice(0, 2000)}…`;
}

function sanitizeLogDetails(details: unknown): unknown {
  if (details instanceof Error) {
    return {
      name: details.name,
      message: details.message,
      stack: details.stack
    };
  }
  return toSafeSerializableValue(details);
}

function toSafeSerializableValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  try {
    const encoded = JSON.stringify(value);
    if (!encoded) {
      return String(value);
    }
    return JSON.parse(encoded) as unknown;
  } catch {
    return String(value);
  }
}
