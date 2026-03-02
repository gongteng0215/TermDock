import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { watchFile, unwatchFile } from "node:fs";
import { readdir, lstat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

import { clipboard, dialog, ipcMain, shell } from "electron";
import type { Stats } from "node:fs";

import { TerminalService } from "../terminal/terminal-service.js";

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
  debounceTimer: NodeJS.Timeout | null;
  uploadInFlight: boolean;
  pendingUpload: boolean;
  disposed: boolean;
}

const REMOTE_OPEN_FILE_UPLOAD_DEBOUNCE_MS = 450;
const REMOTE_OPEN_FILE_TEMP_DIRECTORY = "termdock-open-files";
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

  ipcMain.handle("system:createTempOpenFilePath", async (_event, defaultName: string) => {
    const safeName = sanitizeLocalFileName(defaultName);
    const tempDirectory = join(tmpdir(), REMOTE_OPEN_FILE_TEMP_DIRECTORY);
    await mkdir(tempDirectory, { recursive: true });
    const uniqueToken = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    return join(tempDirectory, `${uniqueToken}-${safeName}`);
  });

  ipcMain.handle(
    "system:prepareRemoteOpenFile",
    async (_event, tabId: string, remotePath: string, defaultName: string) => {
      const normalizedTabId = normalizeRequiredPath(tabId, "Tab id");
      const normalizedRemotePath = normalizeRemoteOpenFilePath(remotePath);
      const key = toRemoteOpenFileKey(normalizedTabId, normalizedRemotePath);
      const existingSession = remoteOpenFileSessions.get(key);
      if (existingSession && !existingSession.disposed) {
        try {
          const localStats = await lstat(existingSession.localPath);
          if (localStats.isFile()) {
            return {
              localPath: existingSession.localPath,
              alreadyOpen: true
            };
          }
        } catch {
          // Fall through and recreate local temp file path.
        }
        disposeRemoteOpenFileSession(existingSession);
        remoteOpenFileSessions.delete(key);
      }
      const localPath = await createStableTempOpenFilePath(key, defaultName);
      return {
        localPath,
        alreadyOpen: false
      };
    }
  );

  ipcMain.handle(
    "system:enableRemoteFileAutoSync",
    async (_event, tabId: string, remotePath: string, localPath: string) => {
      const normalizedTabId = normalizeRequiredPath(tabId, "Tab id");
      const normalizedRemotePath = normalizeRemoteOpenFilePath(remotePath);
      const normalizedLocalPath = normalizeRequiredPath(localPath, "Local file path");
      const key = toRemoteOpenFileKey(normalizedTabId, normalizedRemotePath);
      const existingSession = remoteOpenFileSessions.get(key);
      if (existingSession && !existingSession.disposed) {
        if (existingSession.localPath !== normalizedLocalPath) {
          unwatchFile(existingSession.localPath);
          existingSession.localPath = normalizedLocalPath;
          watchRemoteOpenFileSession(existingSession, terminalService);
        }
        return;
      }
      const session: RemoteOpenFileSession = {
        key,
        tabId: normalizedTabId,
        remotePath: normalizedRemotePath,
        localPath: normalizedLocalPath,
        debounceTimer: null,
        uploadInFlight: false,
        pendingUpload: false,
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
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }
    const rows = await readdir(currentPath, { withFileTypes: true });
    rows.sort((left, right) => left.name.localeCompare(right.name));
    for (const row of rows) {
      const nextPath = join(currentPath, row.name);
      if (row.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (row.isFile()) {
        files.push(nextPath);
      }
    }
  }
  files.sort((left, right) => left.localeCompare(right));
  return files;
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
    scheduleRemoteOpenFileUpload(session, terminalService);
  });
}

function isMeaningfulLocalFileChange(current: Stats, previous: Stats): boolean {
  if (!current.isFile()) {
    return false;
  }
  return current.mtimeMs !== previous.mtimeMs || current.size !== previous.size;
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
  session.uploadInFlight = true;
  try {
    await terminalService.uploadFileToPath(
      session.tabId,
      createRemoteOpenFileTransferId(),
      session.localPath,
      session.remotePath
    );
  } catch (error) {
    console.error(
      `[TermDock] Auto-upload failed for ${session.remotePath}: ${(error as Error).message}`
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

function disposeRemoteOpenFileSession(session: RemoteOpenFileSession): void {
  if (session.debounceTimer) {
    clearTimeout(session.debounceTimer);
    session.debounceTimer = null;
  }
  session.pendingUpload = false;
  session.disposed = true;
  unwatchFile(session.localPath);
}

function disposeRemoteOpenFileSessionsByTab(tabId: string): void {
  for (const [key, session] of remoteOpenFileSessions.entries()) {
    if (session.tabId !== tabId) {
      continue;
    }
    disposeRemoteOpenFileSession(session);
    remoteOpenFileSessions.delete(key);
  }
}

function disposeAllRemoteOpenFileSessions(): void {
  for (const [key, session] of remoteOpenFileSessions.entries()) {
    disposeRemoteOpenFileSession(session);
    remoteOpenFileSessions.delete(key);
  }
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
  await spawnDetached(programPath, [targetPath]);
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
