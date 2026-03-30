import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { watchFile, unwatchFile } from "node:fs";
import { lstat, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { cpus, homedir, hostname, release, tmpdir, totalmem } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

import { app, clipboard, dialog, ipcMain, shell } from "electron";
import type { Stats } from "node:fs";
import type { WebContents } from "electron";
import JSZip from "jszip";

import { appLogger } from "../logging/app-logger.js";
import type {
  RemoteOpenFileAutoSyncEvent,
  RemoteOpenFileLocalDraftState,
  RemoteOpenFilePrepareOptions,
  RemoteOpenFilePrepareResult
} from "../../shared/system.js";
import { TerminalService } from "../terminal/terminal-service.js";
import type { RemotePathMetadata } from "../terminal/terminal-service.js";

interface LocalUploadPathEntry {
  localPath: string;
  relativeDirectory: string;
}

interface LocalPathScanResult {
  kind: "file" | "directory" | "other" | "missing";
  path: string;
  files: string[];
  directories: string[];
}

interface RemoteOpenFileSession {
  key: string;
  tabId: string;
  remotePath: string;
  localPath: string;
  sender: WebContents;
  debounceTimer: NodeJS.Timeout | null;
  uploadInFlight: boolean;
  pendingUpload: boolean;
  localHasPendingChanges: boolean;
  baseRemoteMetadata: RemotePathMetadata | null;
  lastUiNotificationKey: string | null;
  disposed: boolean;
}

interface BugReportExportInput {
  settingsSnapshot?: unknown;
  runtimeSnapshot?: unknown;
  disconnectReports?: unknown;
}

interface BugReportExportResult {
  canceled: boolean;
  outputPath: string | null;
  generatedAtIso?: string;
  logFileCount?: number;
}

interface SaveTextFileInput {
  title?: string;
  defaultFileName?: string;
  text: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
}

interface SaveTextFileResult {
  canceled: boolean;
  outputPath: string | null;
}

interface PickAndReadTextFileInput {
  title?: string;
  buttonLabel?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
}

interface PickAndReadTextFileResult {
  canceled: boolean;
  filePath: string | null;
  text: string;
}

interface BugReportLogFile {
  name: string;
  contents: Buffer;
  sizeBytes: number;
}

const LOCAL_UPLOAD_DIRECTORY_SCAN_CONCURRENCY = 8;

const REMOTE_OPEN_FILE_UPLOAD_DEBOUNCE_MS = 450;
const REMOTE_OPEN_FILE_TEMP_DIRECTORY = "termdock-open-files";
const REMOTE_OPEN_FILE_CLEANUP_RETRY_DELAYS_MS = [400, 1500, 4000];
const BUG_REPORT_MAX_DEPTH = 5;
const BUG_REPORT_MAX_ARRAY_ITEMS = 64;
const BUG_REPORT_MAX_OBJECT_KEYS = 64;
const BUG_REPORT_MAX_STRING_LENGTH = 4096;
const BUG_REPORT_MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;
const remoteOpenFileSessions = new Map<string, RemoteOpenFileSession>();

export function registerSystemHandlers(terminalService: TerminalService): void {
  ipcMain.handle("system:pickPrivateKey", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select SSH Private Key",
      buttonLabel: "Select",
      properties: ["openFile", "showHiddenFiles"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("system:pickUploadFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select File to Upload",
      buttonLabel: "Upload",
      properties: ["openFile"],
      filters: [
        {
          name: "All Files",
          extensions: ["*"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("system:pickDownloadTarget", async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: "Save Downloaded File",
      buttonLabel: "Save",
      defaultPath: defaultName
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  ipcMain.handle("system:pickSshConfigFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select SSH Config File",
      buttonLabel: "Select",
      defaultPath: join(homedir(), ".ssh", "config"),
      properties: ["openFile", "showHiddenFiles"],
      filters: [
        {
          name: "SSH Config",
          extensions: ["config", "*"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("system:pickDownloadDirectory", async (_event, defaultName?: string) => {
    const normalizedDefaultName =
      typeof defaultName === "string" ? defaultName.trim() : "";
    const result = await dialog.showOpenDialog({
      title: "Select Download Folder",
      buttonLabel: "Select Folder",
      defaultPath: normalizedDefaultName || undefined,
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("system:expandUploadPaths", async (_event, inputPaths: string[]) => {
    if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
      return [] as LocalUploadPathEntry[];
    }
    return collectUploadPathEntries(inputPaths);
  });

  ipcMain.handle("system:scanLocalPathEntries", async (_event, inputPath: string) => {
    return scanLocalPathEntries(inputPath);
  });

  ipcMain.handle("system:pickOpenProgram", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Program to Open Files",
      buttonLabel: "Select",
      properties: ["openFile", "showHiddenFiles"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("system:readClipboardText", async () => clipboard.readText());

  ipcMain.handle("system:writeClipboardText", async (_event, value: string) => {
    const text = typeof value === "string" ? value : "";
    clipboard.writeText(text);
  });

  ipcMain.handle(
    "system:writeLog",
    async (_event, level: string, source: string, message: string, details?: unknown) => {
      appLogger.log(
        normalizeLogLevel(level),
        normalizeLogText(source, "renderer"),
        normalizeLogText(message, "Empty log message."),
        details
      );
    }
  );

  ipcMain.handle("system:getLogInfo", async () => appLogger.getLogInfo());

  ipcMain.handle(
    "system:exportBugReport",
    async (_event, payload?: BugReportExportInput): Promise<BugReportExportResult> => {
      const generatedAtIso = new Date().toISOString();
      const saveResult = await dialog.showSaveDialog({
        title: "Export Bug Report",
        buttonLabel: "Export",
        defaultPath: buildBugReportFileName(generatedAtIso),
        filters: [
          {
            name: "ZIP Archive",
            extensions: ["zip"]
          }
        ]
      });
      if (saveResult.canceled || !saveResult.filePath) {
        return {
          canceled: true,
          outputPath: null
        };
      }
      const outputPath = ensureZipFileExtension(saveResult.filePath);
      const logInfo = appLogger.getLogInfo();
      const logFiles = await collectBugReportLogFiles(logInfo.logDirectoryPath);

      const zip = new JSZip();
      const metadata = buildBugReportMetadata(generatedAtIso, logInfo, logFiles, payload);
      zip.file("metadata.json", `${JSON.stringify(metadata, null, 2)}\n`);
      const disconnectReportsPayload = sanitizeForBugReport(payload?.disconnectReports);
      if (disconnectReportsPayload !== undefined && disconnectReportsPayload !== null) {
        zip.file(
          "disconnect-reports.json",
          `${JSON.stringify(
            {
              generatedAtIso,
              disconnectReports: disconnectReportsPayload
            },
            null,
            2
          )}\n`
        );
      }
      for (const logFile of logFiles) {
        zip.file(`logs/${logFile.name}`, logFile.contents);
      }
      const archiveBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      await writeFile(outputPath, archiveBuffer);
      appLogger.log("info", "main:diagnostics", "Exported bug report bundle.", {
        outputPath,
        generatedAtIso,
        logFileCount: logFiles.length,
        hasDisconnectReportSnapshot:
          disconnectReportsPayload !== undefined && disconnectReportsPayload !== null
      });
      return {
        canceled: false,
        outputPath,
        generatedAtIso,
        logFileCount: logFiles.length
      };
    }
  );

  ipcMain.handle(
    "system:saveTextFile",
    async (_event, payload: SaveTextFileInput): Promise<SaveTextFileResult> => {
      const text = typeof payload?.text === "string" ? payload.text : "";
      if (!text.trim()) {
        throw new Error("Text content is empty.");
      }
      const title =
        typeof payload?.title === "string" && payload.title.trim()
          ? payload.title.trim()
          : "Save Text File";
      const defaultFileName =
        typeof payload?.defaultFileName === "string" && payload.defaultFileName.trim()
          ? payload.defaultFileName.trim()
          : `termdock-export-${Date.now()}.txt`;
      const filters =
        Array.isArray(payload?.filters) && payload.filters.length > 0
          ? payload.filters.filter(
              (filter) =>
                !!filter &&
                typeof filter.name === "string" &&
                filter.name.trim().length > 0 &&
                Array.isArray(filter.extensions) &&
                filter.extensions.length > 0
            )
          : [
              {
                name: "Text",
                extensions: ["txt"]
              }
            ];
      const saveResult = await dialog.showSaveDialog({
        title,
        buttonLabel: "Save",
        defaultPath: defaultFileName,
        filters
      });
      if (saveResult.canceled || !saveResult.filePath) {
        return {
          canceled: true,
          outputPath: null
        };
      }
      await writeFile(saveResult.filePath, text, "utf-8");
      return {
        canceled: false,
        outputPath: saveResult.filePath
      };
    }
  );

  ipcMain.handle(
    "system:pickAndReadTextFile",
    async (_event, payload?: PickAndReadTextFileInput): Promise<PickAndReadTextFileResult> => {
      const title =
        typeof payload?.title === "string" && payload.title.trim()
          ? payload.title.trim()
          : "Select Text File";
      const buttonLabel =
        typeof payload?.buttonLabel === "string" && payload.buttonLabel.trim()
          ? payload.buttonLabel.trim()
          : "Open";
      const filters =
        Array.isArray(payload?.filters) && payload.filters.length > 0
          ? payload.filters.filter(
              (filter) =>
                !!filter &&
                typeof filter.name === "string" &&
                filter.name.trim().length > 0 &&
                Array.isArray(filter.extensions) &&
                filter.extensions.length > 0
            )
          : [
              {
                name: "JSON",
                extensions: ["json"]
              },
              {
                name: "Text",
                extensions: ["txt", "log", "md", "cfg", "conf"]
              },
              {
                name: "All Files",
                extensions: ["*"]
              }
            ];
      const openResult = await dialog.showOpenDialog({
        title,
        buttonLabel,
        properties: ["openFile"],
        filters
      });
      if (openResult.canceled || openResult.filePaths.length === 0) {
        return {
          canceled: true,
          filePath: null,
          text: ""
        };
      }
      const filePath = openResult.filePaths[0];
      const text = await readFile(filePath, "utf-8");
      return {
        canceled: false,
        filePath,
        text
      };
    }
  );

  ipcMain.handle("system:readTextFileAtPath", async (_event, inputPath: string) => {
    const filePath = normalizeRequiredPath(inputPath, "File path");
    return readFile(filePath, "utf-8");
  });

  ipcMain.handle("system:writeTextFileAtPath", async (_event, inputPath: string, text: string) => {
    const filePath = normalizeRequiredPath(inputPath, "File path");
    await writeFile(filePath, typeof text === "string" ? text : "", "utf-8");
  });

  ipcMain.handle("system:createTempOpenFilePath", async (_event, defaultName: string) => {
    const safeName = sanitizeLocalFileName(defaultName);
    const tempDirectory = join(tmpdir(), REMOTE_OPEN_FILE_TEMP_DIRECTORY);
    await mkdir(tempDirectory, { recursive: true });
    const uniqueToken = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    return join(tempDirectory, `${uniqueToken}-${safeName}`);
  });

  ipcMain.handle(
    "system:prepareRemoteOpenFile",
    async (
      _event,
      tabId: string,
      remotePath: string,
      defaultName: string,
      options?: RemoteOpenFilePrepareOptions
    ): Promise<RemoteOpenFilePrepareResult> => {
      const normalizedTabId = normalizeRequiredPath(tabId, "Tab id");
      const normalizedRemotePath = normalizeRemoteOpenFilePath(remotePath);
      const discardLocalChanges = options?.discardLocalChanges === true;
      const key = toRemoteOpenFileKey(normalizedTabId, normalizedRemotePath);
      const existingSession = remoteOpenFileSessions.get(key);
      if (existingSession && !existingSession.disposed) {
        const reuseDecision = await evaluateRemoteOpenFileSessionReuse(
          existingSession,
          terminalService
        );
        if (reuseDecision.kind === "reuse-clean") {
          return {
            localPath: existingSession.localPath,
            alreadyOpen: true,
            reuseState: "reuse-clean"
          };
        }
        if (reuseDecision.kind === "reuse-local-draft" && !discardLocalChanges) {
          return {
            localPath: existingSession.localPath,
            alreadyOpen: true,
            reuseState: "reuse-local-draft",
            localDraftState: reuseDecision.localDraftState
          };
        }
        disposeRemoteOpenFileSession(existingSession, {
          removeLocalFile: true
        });
        remoteOpenFileSessions.delete(key);
        const localPath = await createUniqueTempOpenFilePath(defaultName);
        return {
          localPath,
          alreadyOpen: false,
          reuseState: "new"
        };
      }
      const localPath = await createStableTempOpenFilePath(key, defaultName);
      return {
        localPath,
        alreadyOpen: false,
        reuseState: "new"
      };
    }
  );

  ipcMain.handle(
    "system:enableRemoteFileAutoSync",
    async (event, tabId: string, remotePath: string, localPath: string) => {
      const normalizedTabId = normalizeRequiredPath(tabId, "Tab id");
      const normalizedRemotePath = normalizeRemoteOpenFilePath(remotePath);
      const normalizedLocalPath = normalizeRequiredPath(localPath, "Local file path");
      const key = toRemoteOpenFileKey(normalizedTabId, normalizedRemotePath);
      const existingSession = remoteOpenFileSessions.get(key);
      if (existingSession && !existingSession.disposed) {
        existingSession.sender = event.sender;
        if (existingSession.localPath !== normalizedLocalPath) {
          unwatchFile(existingSession.localPath);
          scheduleRemoteOpenFileLocalPathCleanup(existingSession.localPath);
          existingSession.localPath = normalizedLocalPath;
          watchRemoteOpenFileSession(existingSession, terminalService);
        }
        existingSession.localHasPendingChanges = false;
        existingSession.baseRemoteMetadata = await readRemotePathMetadataSafely(
          terminalService,
          normalizedTabId,
          normalizedRemotePath
        );
        existingSession.lastUiNotificationKey = null;
        return;
      }
      const baseRemoteMetadata = await readRemotePathMetadataSafely(
        terminalService,
        normalizedTabId,
        normalizedRemotePath
      );
      const session: RemoteOpenFileSession = {
        key,
        tabId: normalizedTabId,
        remotePath: normalizedRemotePath,
        localPath: normalizedLocalPath,
        sender: event.sender,
        debounceTimer: null,
        uploadInFlight: false,
        pendingUpload: false,
        localHasPendingChanges: false,
        baseRemoteMetadata,
        lastUiNotificationKey: null,
        disposed: false
      };
      remoteOpenFileSessions.set(key, session);
      watchRemoteOpenFileSession(session, terminalService);
    }
  );

  ipcMain.handle("system:disposeRemoteOpenFiles", async (_event, tabId?: string | null) => {
    const normalizedTabId = typeof tabId === "string" ? tabId.trim() : "";
    if (normalizedTabId) {
      disposeRemoteOpenFileSessionsByTab(normalizedTabId);
      return;
    }
    disposeAllRemoteOpenFileSessions();
  });

  ipcMain.handle(
    "system:openLocalPath",
    async (_event, localPath: string, preferredProgramPath?: string | null) => {
      const normalizedLocalPath = normalizeRequiredPath(localPath, "Local file path");
      if (hasActiveRemoteOpenSessionForLocalPath(normalizedLocalPath)) {
        const focused = await focusExistingRemoteFileWindow(normalizedLocalPath);
        if (focused) {
          return;
        }
      }
      const normalizedProgramPath =
        typeof preferredProgramPath === "string" ? preferredProgramPath.trim() : "";
      if (!normalizedProgramPath) {
        const errorMessage = await shell.openPath(normalizedLocalPath);
        if (errorMessage) {
          throw new Error(errorMessage);
        }
        return;
      }
      await openPathWithProgram(normalizedProgramPath, normalizedLocalPath);
    }
  );
}

async function scanLocalPathEntries(inputPath: string): Promise<LocalPathScanResult> {
  const trimmed = typeof inputPath === "string" ? inputPath.trim() : "";
  if (!trimmed) {
    return {
      kind: "missing",
      path: "",
      files: [],
      directories: []
    };
  }
  const absolutePath = resolve(trimmed);
  try {
    const stats = await lstat(absolutePath);
    if (stats.isFile()) {
      return {
        kind: "file",
        path: absolutePath,
        files: [],
        directories: []
      };
    }
    if (!stats.isDirectory()) {
      return {
        kind: "other",
        path: absolutePath,
        files: [],
        directories: []
      };
    }
    const rows = await readdir(absolutePath, { withFileTypes: true });
    rows.sort((left, right) => left.name.localeCompare(right.name));
    const files: string[] = [];
    const directories: string[] = [];
    for (const row of rows) {
      const nextPath = join(absolutePath, row.name);
      if (row.isFile()) {
        files.push(nextPath);
        continue;
      }
      if (row.isDirectory()) {
        directories.push(nextPath);
      }
    }
    return {
      kind: "directory",
      path: absolutePath,
      files,
      directories
    };
  } catch {
    return {
      kind: "missing",
      path: absolutePath,
      files: [],
      directories: []
    };
  }
}

async function collectUploadPathEntries(inputPaths: string[]): Promise<LocalUploadPathEntry[]> {
  const collected: LocalUploadPathEntry[] = [];
  for (const rawPath of inputPaths) {
    const trimmed = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!trimmed) {
      continue;
    }
    try {
      const absolutePath = resolve(trimmed);
      const stats = await lstat(absolutePath);
      if (stats.isFile()) {
        collected.push({
          localPath: absolutePath,
          relativeDirectory: ""
        });
        continue;
      }
      if (!stats.isDirectory()) {
        continue;
      }
      const topName = basename(absolutePath);
      const directoryEntries = await collectDirectoryFiles(absolutePath);
      for (const filePath of directoryEntries) {
        const relativePath = relative(absolutePath, filePath);
        const parentRelativePath = dirname(relativePath);
        const relativeDirectory =
          parentRelativePath === "."
            ? topName
            : join(topName, parentRelativePath);
        collected.push({
          localPath: filePath,
          relativeDirectory
        });
      }
    } catch {
      continue;
    }
  }
  return collected;
}

async function collectDirectoryFiles(directoryPath: string): Promise<string[]> {
  const stack = [directoryPath];
  const files: string[] = [];
  while (stack.length > 0) {
    const batch = stack.splice(
      Math.max(0, stack.length - LOCAL_UPLOAD_DIRECTORY_SCAN_CONCURRENCY),
      LOCAL_UPLOAD_DIRECTORY_SCAN_CONCURRENCY
    );
    const batchResults = await Promise.all(
      batch.map(async (currentPath) => {
        const rows = await readdir(currentPath, { withFileTypes: true });
        rows.sort((left, right) => left.name.localeCompare(right.name));
        const nextDirectories: string[] = [];
        const nextFiles: string[] = [];
        for (const row of rows) {
          const nextPath = join(currentPath, row.name);
          if (row.isDirectory()) {
            nextDirectories.push(nextPath);
            continue;
          }
          if (row.isFile()) {
            nextFiles.push(nextPath);
          }
        }
        nextDirectories.sort((left, right) => left.localeCompare(right));
        nextFiles.sort((left, right) => left.localeCompare(right));
        return {
          directories: nextDirectories,
          files: nextFiles
        };
      })
    );
    for (const result of batchResults) {
      stack.push(...result.directories);
      files.push(...result.files);
    }
  }
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

async function collectBugReportLogFiles(logDirectoryPath: string): Promise<BugReportLogFile[]> {
  try {
    const rows = await readdir(logDirectoryPath, { withFileTypes: true });
    const files = rows
      .filter((row) => row.isFile())
      .map((row) => row.name)
      .sort((left, right) => left.localeCompare(right));
    const collected: BugReportLogFile[] = [];
    for (const fileName of files) {
      const lowerCaseName = fileName.toLowerCase();
      if (!lowerCaseName.startsWith("termdock.log")) {
        continue;
      }
      const absolutePath = join(logDirectoryPath, fileName);
      let fileStats;
      try {
        fileStats = await stat(absolutePath);
      } catch {
        continue;
      }
      if (!fileStats.isFile() || fileStats.size > BUG_REPORT_MAX_LOG_FILE_BYTES) {
        continue;
      }
      const contents = await readFile(absolutePath);
      collected.push({
        name: fileName,
        contents,
        sizeBytes: fileStats.size
      });
    }
    return collected;
  } catch {
    return [];
  }
}

function buildBugReportMetadata(
  generatedAtIso: string,
  logInfo: { logDirectoryPath: string; logFilePath: string },
  logFiles: BugReportLogFile[],
  payload?: BugReportExportInput
): Record<string, unknown> {
  return {
    generatedAtIso,
    app: {
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged
    },
    runtime: {
      platform: process.platform,
      arch: process.arch,
      osRelease: release(),
      hostName: hostname(),
      cpuCount: cpus().length,
      totalMemoryMb: Math.round(totalmem() / 1024 / 1024),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      pid: process.pid
    },
    diagnostics: {
      logDirectoryPath: logInfo.logDirectoryPath,
      logFilePath: logInfo.logFilePath,
      includedLogs: logFiles.map((entry) => ({
        name: entry.name,
        sizeBytes: entry.sizeBytes
      }))
    },
    payload: sanitizeForBugReport(payload)
  };
}

function buildBugReportFileName(generatedAtIso: string): string {
  const date = new Date(generatedAtIso);
  const stamp = [
    `${date.getFullYear()}`,
    padBugReportDatePart(date.getMonth() + 1),
    padBugReportDatePart(date.getDate())
  ].join("");
  const time = [
    padBugReportDatePart(date.getHours()),
    padBugReportDatePart(date.getMinutes()),
    padBugReportDatePart(date.getSeconds())
  ].join("");
  return `termdock-bug-report-${stamp}-${time}.zip`;
}

function padBugReportDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function ensureZipFileExtension(inputPath: string): string {
  if (inputPath.toLowerCase().endsWith(".zip")) {
    return inputPath;
  }
  return `${inputPath}.zip`;
}

function sanitizeForBugReport(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (typeof value === "string") {
    if (value.length <= BUG_REPORT_MAX_STRING_LENGTH) {
      return value;
    }
    return `${value.slice(0, BUG_REPORT_MAX_STRING_LENGTH)}...`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (depth >= BUG_REPORT_MAX_DEPTH) {
    return "[DepthLimit]";
  }
  if (Array.isArray(value)) {
    const next = value
      .slice(0, BUG_REPORT_MAX_ARRAY_ITEMS)
      .map((entry) => sanitizeForBugReport(entry, depth + 1));
    if (value.length > BUG_REPORT_MAX_ARRAY_ITEMS) {
      next.push(`[Truncated ${value.length - BUG_REPORT_MAX_ARRAY_ITEMS} items]`);
    }
    return next;
  }
  if (typeof value === "object") {
    const inputRecord = value as Record<string, unknown>;
    const outputRecord: Record<string, unknown> = {};
    const keys = Object.keys(inputRecord).sort();
    for (const key of keys.slice(0, BUG_REPORT_MAX_OBJECT_KEYS)) {
      outputRecord[key] = sanitizeForBugReport(inputRecord[key], depth + 1);
    }
    if (keys.length > BUG_REPORT_MAX_OBJECT_KEYS) {
      outputRecord.__truncatedKeys = keys.length - BUG_REPORT_MAX_OBJECT_KEYS;
    }
    return outputRecord;
  }
  try {
    return String(value);
  } catch {
    return "[Unserializable]";
  }
}

function normalizeRemoteOpenFilePath(value: string): string {
  const normalized = normalizeRequiredPath(value, "Remote file path");
  return normalized.replaceAll("\\", "/");
}

function toRemoteOpenFileKey(tabId: string, remotePath: string): string {
  return `${tabId}:${remotePath}`;
}

async function createStableTempOpenFilePath(key: string, defaultName: string): Promise<string> {
  const safeName = sanitizeLocalFileName(defaultName);
  const tempDirectory = join(tmpdir(), REMOTE_OPEN_FILE_TEMP_DIRECTORY);
  await mkdir(tempDirectory, { recursive: true });
  const stableToken = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return join(tempDirectory, `${stableToken}-${safeName}`);
}

async function createUniqueTempOpenFilePath(defaultName: string): Promise<string> {
  const safeName = sanitizeLocalFileName(defaultName);
  const tempDirectory = join(tmpdir(), REMOTE_OPEN_FILE_TEMP_DIRECTORY);
  await mkdir(tempDirectory, { recursive: true });
  const uniqueToken = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return join(tempDirectory, `${uniqueToken}-${safeName}`);
}

function watchRemoteOpenFileSession(
  session: RemoteOpenFileSession,
  terminalService: TerminalService
): void {
  watchFile(session.localPath, { persistent: false, interval: 700 }, (current, previous) => {
    if (session.disposed) {
      return;
    }
    if (!isMeaningfulLocalFileChange(current, previous)) {
      return;
    }
    session.localHasPendingChanges = true;
    scheduleRemoteOpenFileUpload(session, terminalService);
  });
}

function isMeaningfulLocalFileChange(current: Stats, previous: Stats): boolean {
  if (!current.isFile()) {
    return false;
  }
  return current.mtimeMs !== previous.mtimeMs || current.size !== previous.size;
}

async function evaluateRemoteOpenFileSessionReuse(
  session: RemoteOpenFileSession,
  terminalService: TerminalService
): Promise<
  | { kind: "reuse-clean" }
  | { kind: "reuse-local-draft"; localDraftState: RemoteOpenFileLocalDraftState }
  | { kind: "replace-session" }
> {
  try {
    const localStats = await lstat(session.localPath);
    if (!localStats.isFile()) {
      return {
        kind: "replace-session"
      };
    }
  } catch {
    return {
      kind: "replace-session"
    };
  }
  if (session.uploadInFlight || session.pendingUpload) {
    return {
      kind: "reuse-local-draft",
      localDraftState: "syncing"
    };
  }
  if (session.localHasPendingChanges) {
    return {
      kind: "reuse-local-draft",
      localDraftState: "modified"
    };
  }
  const currentRemoteMetadata = await readRemotePathMetadataSafely(
    terminalService,
    session.tabId,
    session.remotePath
  );
  if (isRemotePathMetadataCompatible(session.baseRemoteMetadata, currentRemoteMetadata)) {
    return {
      kind: "reuse-clean"
    };
  }
  appLogger.log(
    "info",
    "main:remote-open-file",
    "Discarded stale remote open file session because remote metadata changed.",
    {
      tabId: session.tabId,
      remotePath: session.remotePath,
      localPath: session.localPath,
      baseline: session.baseRemoteMetadata,
      current: currentRemoteMetadata
    }
  );
  return {
    kind: "replace-session"
  };
}

function scheduleRemoteOpenFileUpload(
  session: RemoteOpenFileSession,
  terminalService: TerminalService
): void {
  if (session.disposed) {
    return;
  }
  if (session.debounceTimer) {
    clearTimeout(session.debounceTimer);
  }
  session.debounceTimer = setTimeout(() => {
    session.debounceTimer = null;
    void flushRemoteOpenFileUpload(session, terminalService);
  }, REMOTE_OPEN_FILE_UPLOAD_DEBOUNCE_MS);
}

async function flushRemoteOpenFileUpload(
  session: RemoteOpenFileSession,
  terminalService: TerminalService
): Promise<void> {
  if (session.disposed) {
    return;
  }
  if (session.uploadInFlight) {
    session.pendingUpload = true;
    return;
  }
  if (!session.localHasPendingChanges) {
    return;
  }
  session.uploadInFlight = true;
  try {
    const currentRemoteMetadata = await readRemotePathMetadataSafely(
      terminalService,
      session.tabId,
      session.remotePath
    );
    if (!isRemotePathMetadataCompatible(session.baseRemoteMetadata, currentRemoteMetadata)) {
      notifyRemoteOpenFileAutoSyncEvent(
        session,
        {
          type: "conflict-remote-changed",
          tabId: session.tabId,
          remotePath: session.remotePath,
          localPath: session.localPath,
          message: `Remote file changed before save-back. Local changes were not synced: ${session.remotePath}`
        },
        `conflict:${session.remotePath}:${serializeRemotePathMetadata(session.baseRemoteMetadata)}:${serializeRemotePathMetadata(currentRemoteMetadata)}`
      );
      appLogger.log(
        "warn",
        "main:remote-open-file",
        "Skipped remote open file auto-sync because remote file changed.",
        {
          tabId: session.tabId,
          remotePath: session.remotePath,
          baseline: session.baseRemoteMetadata,
          current: currentRemoteMetadata
        }
      );
      return;
    }
    await terminalService.uploadFileToPath(
      session.tabId,
      createRemoteOpenFileTransferId(),
      session.localPath,
      session.remotePath
    );
    session.localHasPendingChanges = false;
    session.baseRemoteMetadata = await readRemotePathMetadataSafely(
      terminalService,
      session.tabId,
      session.remotePath
    );
    session.lastUiNotificationKey = null;
    appLogger.log("info", "main:remote-open-file", "Auto-synced local edit to remote path.", {
      tabId: session.tabId,
      remotePath: session.remotePath,
      localPath: session.localPath
    });
  } catch (error) {
    appLogger.log(
      "warn",
      "main:remote-open-file",
      "Remote open file auto-sync upload failed.",
      {
        tabId: session.tabId,
        remotePath: session.remotePath,
        localPath: session.localPath,
        message: (error as Error).message
      }
    );
    notifyRemoteOpenFileAutoSyncEvent(
      session,
      {
        type: "upload-failed",
        tabId: session.tabId,
        remotePath: session.remotePath,
        localPath: session.localPath,
        message: `Failed to sync local edit back to remote file: ${session.remotePath}. ${(error as Error).message}`
      },
      `upload-failed:${session.remotePath}:${(error as Error).message}`
    );
  } finally {
    session.uploadInFlight = false;
    if (session.disposed) {
      return;
    }
    if (session.pendingUpload) {
      session.pendingUpload = false;
      scheduleRemoteOpenFileUpload(session, terminalService);
    }
  }
}

function createRemoteOpenFileTransferId(): string {
  return `open-save-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function notifyRemoteOpenFileAutoSyncEvent(
  session: RemoteOpenFileSession,
  payload: RemoteOpenFileAutoSyncEvent,
  notificationKey: string
): void {
  if (session.lastUiNotificationKey === notificationKey) {
    return;
  }
  session.lastUiNotificationKey = notificationKey;
  if (session.sender.isDestroyed()) {
    return;
  }
  session.sender.send("system:remoteOpenFileEvent", payload);
}

function serializeRemotePathMetadata(metadata: RemotePathMetadata | null): string {
  if (!metadata) {
    return "null";
  }
  return `${metadata.exists ? "1" : "0"}:${metadata.size}:${metadata.modifiedTimeMs}`;
}

async function readRemotePathMetadataSafely(
  terminalService: TerminalService,
  tabId: string,
  remotePath: string
): Promise<RemotePathMetadata | null> {
  try {
    return await terminalService.getRemotePathMetadata(tabId, remotePath);
  } catch (error) {
    appLogger.log(
      "warn",
      "main:remote-open-file",
      "Failed to read remote file metadata for auto-sync guard.",
      {
        tabId,
        remotePath,
        message: (error as Error).message
      }
    );
    return null;
  }
}

function isRemotePathMetadataCompatible(
  baseline: RemotePathMetadata | null,
  current: RemotePathMetadata | null
): boolean {
  if (!baseline || !current) {
    // Keep autosync best-effort when metadata probe is unavailable.
    return true;
  }
  return (
    baseline.exists === current.exists &&
    baseline.size === current.size &&
    baseline.modifiedTimeMs === current.modifiedTimeMs
  );
}

function disposeRemoteOpenFileSession(
  session: RemoteOpenFileSession,
  options?: {
    removeLocalFile?: boolean;
  }
): void {
  if (session.debounceTimer) {
    clearTimeout(session.debounceTimer);
    session.debounceTimer = null;
  }
  session.pendingUpload = false;
  session.disposed = true;
  unwatchFile(session.localPath);
  if (options?.removeLocalFile) {
    scheduleRemoteOpenFileLocalPathCleanup(session.localPath);
  }
}

function disposeRemoteOpenFileSessionsByTab(tabId: string): void {
  for (const [key, session] of remoteOpenFileSessions.entries()) {
    if (session.tabId !== tabId) {
      continue;
    }
    disposeRemoteOpenFileSession(session, {
      removeLocalFile: true
    });
    remoteOpenFileSessions.delete(key);
  }
}

function disposeAllRemoteOpenFileSessions(): void {
  for (const [key, session] of remoteOpenFileSessions.entries()) {
    disposeRemoteOpenFileSession(session, {
      removeLocalFile: true
    });
    remoteOpenFileSessions.delete(key);
  }
}

function scheduleRemoteOpenFileLocalPathCleanup(localPath: string, attempt = 0): void {
  void rm(localPath, { force: true }).catch((error) => {
    const errorCode = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (errorCode === "ENOENT") {
      return;
    }
    if (attempt < REMOTE_OPEN_FILE_CLEANUP_RETRY_DELAYS_MS.length && isRetryableLocalCleanupError(errorCode)) {
      setTimeout(() => {
        scheduleRemoteOpenFileLocalPathCleanup(localPath, attempt + 1);
      }, REMOTE_OPEN_FILE_CLEANUP_RETRY_DELAYS_MS[attempt]);
      return;
    }
    appLogger.log("warn", "main:remote-open-file", "Failed to clean up local remote-open temp file.", {
      localPath,
      attempt,
      code: errorCode,
      message: error instanceof Error ? error.message : String(error)
    });
  });
}

function isRetryableLocalCleanupError(code: string): boolean {
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

function hasActiveRemoteOpenSessionForLocalPath(localPath: string): boolean {
  for (const session of remoteOpenFileSessions.values()) {
    if (session.disposed) {
      continue;
    }
    if (session.localPath === localPath) {
      return true;
    }
  }
  return false;
}

async function focusExistingRemoteFileWindow(localPath: string): Promise<boolean> {
  if (process.platform !== "win32") {
    return false;
  }
  const fileName = basename(localPath).replace(/'/g, "''");
  const script = `
try {
  $needle = '${fileName}'
  $process = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and
    $_.MainWindowTitle -and
    $_.MainWindowTitle.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  } | Select-Object -First 1
  if (-not $process) { exit 1 }

  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class TermDockWin32 {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

  [TermDockWin32]::ShowWindowAsync($process.MainWindowHandle, 9) | Out-Null
  if ([TermDockWin32]::SetForegroundWindow($process.MainWindowHandle)) {
    exit 0
  }
  exit 2
} catch {
  exit 3
}
`;
  const code = await runPowerShellScript(script);
  return code === 0;
}

function runPowerShellScript(script: string): Promise<number> {
  return new Promise((resolve) => {
    const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        encodedCommand
      ],
      {
        windowsHide: true,
        stdio: "ignore"
      }
    );
    child.once("error", () => resolve(-1));
    child.once("exit", (code) => resolve(typeof code === "number" ? code : -1));
  });
}

function sanitizeLocalFileName(name: string): string {
  const base = basename(typeof name === "string" ? name.trim() : "");
  const normalized = base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "remote-file";
}

function normalizeRequiredPath(value: string, label: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

async function openPathWithProgram(programPath: string, targetPath: string): Promise<void> {
  if (process.platform === "darwin" && programPath.toLowerCase().endsWith(".app")) {
    await spawnDetached("open", ["-a", programPath, targetPath]);
    return;
  }
  if (process.platform === "win32") {
    const resolvedLaunchSpec = await resolveWindowsProgramLaunchSpec(programPath);
    const launchArgs = [...resolvedLaunchSpec.args, targetPath];
    appLogger.log("info", "main:file-open", "Launching local path with configured Windows opener.", {
      programSpec: programPath,
      resolvedCommand: resolvedLaunchSpec.command,
      resolvedArgs: launchArgs
    });
    const code = await runPowerShellScript(`
try {
  Start-Process -FilePath ${toPowerShellSingleQuotedLiteral(resolvedLaunchSpec.command)} -ArgumentList ${toPowerShellStringArrayLiteral(launchArgs)}
  exit 0
} catch {
  Write-Error $_
  exit 1
}
`);
    if (code !== 0) {
      appLogger.log(
        "warn",
        "main:file-open",
        "Failed to launch configured Windows opener.",
        {
          programSpec: programPath,
          resolvedCommand: resolvedLaunchSpec.command,
          resolvedArgs: launchArgs
        }
      );
      throw new Error(`Failed to open path with program: ${programPath}`);
    }
    return;
  }
  await spawnDetached(programPath, [targetPath]);
}

interface WindowsProgramLaunchSpec {
  command: string;
  args: string[];
}

async function resolveWindowsProgramLaunchSpec(
  programSpec: string
): Promise<WindowsProgramLaunchSpec> {
  const normalizedSpec = normalizeRequiredPath(programSpec, "Open program");
  const exactProgramPath = await normalizeExistingProgramPath(normalizedSpec);
  if (exactProgramPath) {
    return {
      command: exactProgramPath,
      args: []
    };
  }
  const parsedSegments = splitWindowsCommandLine(normalizedSpec).map(stripWrappingQuotes);
  if (parsedSegments.length === 0) {
    throw new Error("Open program is required.");
  }
  const resolvedCommandPath = await normalizeExistingProgramPath(parsedSegments[0]);
  if (resolvedCommandPath) {
    return {
      command: resolvedCommandPath,
      args: parsedSegments.slice(1)
    };
  }
  if (looksLikeExplicitWindowsProgramPath(parsedSegments[0])) {
    throw new Error(
      `Configured Windows opener was not found: ${parsedSegments[0]}. Quote paths with spaces or select the executable directly.`
    );
  }
  return {
    command: parsedSegments[0],
    args: parsedSegments.slice(1)
  };
}

async function normalizeExistingProgramPath(programPath: string): Promise<string | null> {
  const normalizedPath = stripWrappingQuotes(programPath.trim());
  if (!normalizedPath) {
    return null;
  }
  try {
    const fileStats = await lstat(normalizedPath);
    if (fileStats.isFile()) {
      return normalizedPath;
    }
  } catch {
    return null;
  }
  return null;
}

function splitWindowsCommandLine(input: string): string[] {
  const segments: string[] = [];
  let current = "";
  let withinDoubleQuotes = false;
  let pendingBackslashes = 0;
  let sawTokenContent = false;
  for (let index = 0; index < input.length; index += 1) {
    const nextCharacter = input[index];
    if (nextCharacter === "\\") {
      pendingBackslashes += 1;
      continue;
    }
    if (nextCharacter === '"') {
      current += "\\".repeat(Math.floor(pendingBackslashes / 2));
      if (pendingBackslashes % 2 === 1) {
        current += '"';
      } else {
        withinDoubleQuotes = !withinDoubleQuotes;
        sawTokenContent = true;
      }
      pendingBackslashes = 0;
      continue;
    }
    if (pendingBackslashes > 0) {
      current += "\\".repeat(pendingBackslashes);
      pendingBackslashes = 0;
    }
    if (!withinDoubleQuotes && /\s/.test(nextCharacter)) {
      if (sawTokenContent || current.length > 0) {
        segments.push(current);
        current = "";
        sawTokenContent = false;
      }
      continue;
    }
    current += nextCharacter;
    sawTokenContent = true;
  }
  if (pendingBackslashes > 0) {
    current += "\\".repeat(pendingBackslashes);
  }
  if (sawTokenContent || current.length > 0) {
    segments.push(current);
  }
  return segments;
}

function looksLikeExplicitWindowsProgramPath(value: string): boolean {
  if (!value) {
    return false;
  }
  return (
    value.includes("\\") ||
    value.includes("/") ||
    /^[A-Za-z]:/.test(value) ||
    value.startsWith(".")
  );
}

function stripWrappingQuotes(input: string): string {
  const normalized = input.trim();
  if (normalized.length < 2) {
    return normalized;
  }
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  if ((first === '"' || first === "'") && last === first) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function toPowerShellSingleQuotedLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toPowerShellStringArrayLiteral(values: string[]): string {
  if (values.length === 0) {
    return "@()";
  }
  return `@(${values.map((value) => toPowerShellSingleQuotedLiteral(value)).join(", ")})`;
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.once("error", (error) => {
      reject(error);
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function normalizeLogLevel(value: string): "debug" | "info" | "warn" | "error" {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

function normalizeLogText(value: string, fallback: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return fallback;
  }
  if (normalized.length <= 2000) {
    return normalized;
  }
  return `${normalized.slice(0, 2000)}...`;
}


