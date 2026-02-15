import { spawn } from "node:child_process";
import { readdir, lstat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

import { dialog, ipcMain, shell } from "electron";

interface LocalUploadPathEntry {
  localPath: string;
  relativeDirectory: string;
}

export function registerSystemHandlers(): void {
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

  ipcMain.handle("system:expandUploadPaths", async (_event, inputPaths: string[]) => {
    if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
      return [] as LocalUploadPathEntry[];
    }
    return collectUploadPathEntries(inputPaths);
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

  ipcMain.handle("system:createTempOpenFilePath", async (_event, defaultName: string) => {
    const safeName = sanitizeLocalFileName(defaultName);
    const tempDirectory = join(tmpdir(), "termdock-open-files");
    await mkdir(tempDirectory, { recursive: true });
    const uniqueToken = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    return join(tempDirectory, `${uniqueToken}-${safeName}`);
  });

  ipcMain.handle(
    "system:openLocalPath",
    async (_event, localPath: string, preferredProgramPath?: string | null) => {
      const normalizedLocalPath = normalizeRequiredPath(localPath, "Local file path");
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
