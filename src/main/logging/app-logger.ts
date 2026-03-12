import { app } from "electron";
import { existsSync, mkdirSync } from "node:fs";
import { appendFile, rename, stat, unlink } from "node:fs/promises";
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
const LOG_ARCHIVE_PREFIX = "termdock.log.";
const LOG_ROTATE_MAX_BYTES = 2 * 1024 * 1024;
const LOG_ARCHIVE_KEEP_FILES = 5;

export class AppLogger {
  private initialized = false;
  private logDirectoryPath = "";
  private logFilePath = "";
  private writeQueue: Promise<void> = Promise.resolve();

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
    const line = `${JSON.stringify(record)}\n`;
    this.writeQueue = this.writeQueue
      .then(() => this.writeRecord(line))
      .catch(() => {
        // Keep logger best-effort; avoid surfacing write errors to callers.
      });
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  private async writeRecord(line: string): Promise<void> {
    await this.rotateLogIfNeeded(line);
    await appendFile(this.logFilePath, line, { encoding: "utf-8" });
  }

  private async rotateLogIfNeeded(nextLine: string): Promise<void> {
    if (!existsSync(this.logFilePath)) {
      return;
    }
    const stats = await stat(this.logFilePath).catch(() => null);
    if (!stats) {
      return;
    }
    const nextLineBytes = Buffer.byteLength(nextLine, "utf-8");
    if (stats.size + nextLineBytes < LOG_ROTATE_MAX_BYTES) {
      return;
    }
    for (let index = LOG_ARCHIVE_KEEP_FILES; index >= 1; index -= 1) {
      const archivePath = join(this.logDirectoryPath, `${LOG_ARCHIVE_PREFIX}${index}`);
      if (!existsSync(archivePath)) {
        continue;
      }
      if (index >= LOG_ARCHIVE_KEEP_FILES) {
        await unlink(archivePath).catch(() => {
          // Best effort cleanup.
        });
        continue;
      }
      const nextArchivePath = join(this.logDirectoryPath, `${LOG_ARCHIVE_PREFIX}${index + 1}`);
      await rename(archivePath, nextArchivePath).catch(() => {
        // Ignore rotate races/errors.
      });
    }
    if (!existsSync(this.logFilePath)) {
      return;
    }
    const firstArchivePath = join(this.logDirectoryPath, `${LOG_ARCHIVE_PREFIX}1`);
    await rename(this.logFilePath, firstArchivePath).catch(() => {
      // Ignore rotate races/errors.
    });
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
