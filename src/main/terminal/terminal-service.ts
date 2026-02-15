import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir as mkdirLocalDirectory,
  readFile,
  stat as statLocalFile,
  unlink as unlinkLocalFile
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename as basenamePath, dirname as dirnamePath, join as joinPath } from "node:path";
import { posix as posixPath } from "node:path";

import type { WebContents } from "electron";
import { Client } from "ssh2";
import type {
  Attributes,
  ClientChannel,
  ConnectConfig,
  FileEntryWithStats,
  SFTPWrapper
} from "ssh2";

import type { SessionRecord } from "../../shared/session.js";
import type {
  SftpDirectoryListResult,
  SftpEntry,
  SftpEntryKind,
  SftpTransferDirection,
  SftpTransferEvent
} from "../../shared/sftp.js";
import type { TerminalEvent } from "../../shared/terminal.js";
import type { CredentialStore } from "../security/credential-store.js";
import { SessionStore } from "../storage/session-store.js";

interface BaseTerminalConnection {
  tabId: string;
  sender: WebContents;
  mode: "ssh2" | "native";
  closed: boolean;
}

interface Ssh2TerminalConnection extends BaseTerminalConnection {
  mode: "ssh2";
  client: Client;
  shell?: ClientChannel;
  sftp?: SFTPWrapper;
  fallbackTried: boolean;
}

interface NativeTerminalConnection extends BaseTerminalConnection {
  mode: "native";
  process: ChildProcessWithoutNullStreams;
}

type TerminalConnection = Ssh2TerminalConnection | NativeTerminalConnection;

interface ActiveUploadTransfer {
  tabId: string;
  transferId: string;
  remotePath: string;
  canceled: boolean;
  readStream?: NodeJS.ReadableStream;
  writeStream?: NodeJS.WritableStream;
}

interface ActiveDownloadTransfer {
  tabId: string;
  transferId: string;
  localPath: string;
  canceled: boolean;
  readStream?: NodeJS.ReadableStream;
  writeStream?: NodeJS.WritableStream;
}

class TransferCanceledError extends Error {
  constructor() {
    super("Transfer canceled.");
    this.name = "TransferCanceledError";
  }
}

export class TerminalService {
  private readonly connections = new Map<string, TerminalConnection>();
  private readonly activeUploadTransfers = new Map<string, ActiveUploadTransfer>();
  private readonly activeDownloadTransfers = new Map<string, ActiveDownloadTransfer>();

  constructor(
    private readonly sessionStore: SessionStore,
    private readonly credentialStore: CredentialStore
  ) {}

  async connect(tabId: string, sessionId: string, sender: WebContents): Promise<void> {
    await this.close(tabId);

    const session = await this.sessionStore.getById(sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }

    this.emit(sender, {
      tabId,
      type: "status",
      status: "connecting"
    });

    await this.connectViaSsh2(tabId, session, sender);
  }

  private async connectViaSsh2(
    tabId: string,
    session: SessionRecord,
    sender: WebContents
  ): Promise<void> {
    const connectConfig = await this.buildConnectConfig(session);
    const client = new Client();
    const connection: Ssh2TerminalConnection = {
      tabId,
      sender,
      mode: "ssh2",
      client,
      closed: false,
      fallbackTried: false
    };
    this.connections.set(tabId, connection);

    client.on("ready", () => {
      if (this.connections.get(tabId) !== connection || connection.closed) {
        return;
      }
      client.shell(
        {
          term: "xterm-256color",
          cols: 120,
          rows: 36
        },
        (error, shell) => {
          if (error) {
            this.emit(sender, {
              tabId,
              type: "error",
              message: error.message
            });
            void this.close(tabId);
            return;
          }

          if (this.connections.get(tabId) !== connection || connection.closed) {
            shell.end();
            return;
          }

          connection.shell = shell;

          this.emit(sender, {
            tabId,
            type: "status",
            status: "connected"
          });
          void this.markSessionConnected(session.id);

          shell.on("data", (chunk: Buffer) => {
            this.emit(sender, {
              tabId,
              type: "output",
              data: chunk.toString("utf-8")
            });
          });

          shell.stderr.on("data", (chunk: Buffer) => {
            this.emit(sender, {
              tabId,
              type: "output",
              data: chunk.toString("utf-8")
            });
          });

          shell.on("close", () => {
            void this.close(tabId);
          });
        }
      );
    });

    client.on("error", (error: Error) => {
      if (this.connections.get(tabId) !== connection || connection.closed) {
        return;
      }
      if (this.shouldFallbackToNative(error, session, connection)) {
        void this.fallbackToNative(connection, session, error.message);
        return;
      }
      this.emit(sender, {
        tabId,
        type: "error",
        message: error.message
      });
    });

    client.on("close", () => {
      if (this.connections.get(tabId) !== connection) {
        return;
      }
      this.emitClosed(connection);
      this.connections.delete(tabId);
    });

    client.connect(connectConfig);
  }

  private shouldFallbackToNative(
    error: Error,
    session: SessionRecord,
    connection: Ssh2TerminalConnection
  ): boolean {
    if (connection.fallbackTried || session.authType !== "privateKey") {
      return false;
    }
    const message = error.message.toLowerCase();
    return /before handshake|kex_exchange_identification|connection reset|closed by remote host/.test(
      message
    );
  }

  private async fallbackToNative(
    connection: Ssh2TerminalConnection,
    session: SessionRecord,
    reason: string
  ): Promise<void> {
    if (connection.fallbackTried || connection.closed) {
      return;
    }
    if (this.connections.get(connection.tabId) !== connection) {
      return;
    }
    connection.fallbackTried = true;
    connection.closed = true;
    this.emit(connection.sender, {
      tabId: connection.tabId,
      type: "output",
      data: `\r\n[fallback] SSH library handshake failed (${reason}), retrying with system ssh...\r\n`
    });
    connection.shell?.end();
    connection.sftp?.end();
    connection.client.end();

    try {
      await this.connectViaNative(connection.tabId, session, connection.sender);
    } catch (error) {
      if (this.connections.get(connection.tabId) === connection) {
        this.connections.delete(connection.tabId);
      }
      this.emit(connection.sender, {
        tabId: connection.tabId,
        type: "error",
        message: (error as Error).message
      });
      this.emitClosed({
        ...connection,
        closed: false
      });
    }
  }

  private async connectViaNative(
    tabId: string,
    session: SessionRecord,
    sender: WebContents
  ): Promise<void> {
    if (session.authType !== "privateKey" || !session.privateKeyPath) {
      throw new Error("System ssh fallback currently supports private key sessions only.");
    }
    const keyPath = expandHomePath(session.privateKeyPath);
    const args = [
      "-tt",
      "-o",
      "ConnectTimeout=15",
      "-o",
      "ServerAliveInterval=15",
      "-o",
      "ServerAliveCountMax=3",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-i",
      keyPath,
      "-p",
      `${session.port}`,
      `${session.username}@${session.host}`
    ];
    const process = spawn("ssh", args, {
      stdio: "pipe"
    });
    const nativeConnection: NativeTerminalConnection = {
      tabId,
      sender,
      mode: "native",
      process,
      closed: false
    };
    this.connections.set(tabId, nativeConnection);
    this.emit(sender, {
      tabId,
      type: "status",
      status: "connected"
    });
    void this.markSessionConnected(session.id);

    process.stdout.on("data", (chunk: Buffer) => {
      this.emit(sender, {
        tabId,
        type: "output",
        data: chunk.toString("utf-8")
      });
    });
    process.stderr.on("data", (chunk: Buffer) => {
      this.emit(sender, {
        tabId,
        type: "output",
        data: chunk.toString("utf-8")
      });
    });
    process.on("error", (error: Error) => {
      if (this.connections.get(tabId) !== nativeConnection) {
        return;
      }
      this.emit(sender, {
        tabId,
        type: "error",
        message: error.message
      });
      this.connections.delete(tabId);
      this.emitClosed(nativeConnection);
    });
    process.on("close", () => {
      if (this.connections.get(tabId) !== nativeConnection) {
        return;
      }
      this.connections.delete(tabId);
      this.emitClosed(nativeConnection);
    });
  }

  async write(tabId: string, data: string): Promise<void> {
    const connection = this.connections.get(tabId);
    if (!connection || connection.closed) {
      return;
    }
    if (connection.mode === "ssh2") {
      connection.shell?.write(data);
      return;
    }
    if (!connection.process.stdin.destroyed) {
      connection.process.stdin.write(data);
    }
  }

  async resize(tabId: string, cols: number, rows: number): Promise<void> {
    const connection = this.connections.get(tabId);
    if (!connection || connection.closed || connection.mode !== "ssh2") {
      return;
    }
    connection.shell?.setWindow(rows, cols, 0, 0);
  }

  async close(tabId: string): Promise<void> {
    const connection = this.connections.get(tabId);
    if (!connection) {
      return;
    }

    this.connections.delete(tabId);
    if (connection.mode === "ssh2") {
      connection.shell?.end();
      connection.sftp?.end();
      connection.client.end();
    } else {
      if (!connection.process.stdin.destroyed) {
        connection.process.stdin.end();
      }
      if (!connection.process.killed) {
        connection.process.kill("SIGTERM");
      }
    }

    this.emitClosed(connection);
  }

  async listDirectory(tabId: string, targetPath?: string): Promise<SftpDirectoryListResult> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const lookupPath = normalizeRemotePath(targetPath);
    const cwd = await this.realPath(sftp, lookupPath);
    const rows = await this.readDirectory(sftp, cwd);
    const entries = rows
      .filter((row) => row.filename !== "." && row.filename !== "..")
      .map((row) => this.toSftpEntry(cwd, row))
      .sort(compareSftpEntries);

    const parent = cwd === "/" ? null : dirnamePosix(cwd);
    return {
      tabId,
      cwd,
      parent,
      entries
    };
  }

  async createDirectory(tabId: string, parentPath: string, name: string): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const safeName = normalizeEntryName(name, "Directory name");
    const basePath = normalizeRemotePath(parentPath);
    const targetPath = posixPath.join(basePath, safeName);
    await this.mkdir(sftp, targetPath);
  }

  async renamePath(tabId: string, sourcePath: string, nextName: string): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const normalizedSourcePath = normalizeRemotePath(sourcePath);
    assertPathIsNotRoot(normalizedSourcePath);
    const safeName = normalizeEntryName(nextName, "New name");
    const parentPath = posixPath.dirname(normalizedSourcePath);
    const targetPath = posixPath.join(parentPath, safeName);
    if (targetPath === normalizedSourcePath) {
      return;
    }
    await this.rename(sftp, normalizedSourcePath, targetPath);
  }

  async deletePath(tabId: string, targetPath: string, kind: SftpEntryKind): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const normalizedTargetPath = normalizeRemotePath(targetPath);
    assertPathIsNotRoot(normalizedTargetPath);
    if (kind === "directory") {
      await this.rmdir(sftp, normalizedTargetPath);
      return;
    }
    await this.unlink(sftp, normalizedTargetPath);
  }

  async uploadFile(
    tabId: string,
    transferId: string,
    localPath: string,
    remoteDirectory: string
  ): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const safeTransferId = normalizeTransferId(transferId);
    const normalizedLocalPath = normalizeLocalPath(localPath, "Local upload file path");
    const fileName = basenamePath(normalizedLocalPath);
    if (!fileName) {
      throw new Error("Upload file name is invalid.");
    }
    const localStats = await statLocalFile(normalizedLocalPath);
    if (!localStats.isFile()) {
      throw new Error("Upload source must be a file.");
    }

    const normalizedRemoteDirectory = normalizeRemotePath(remoteDirectory);
    const remotePath = posixPath.join(normalizedRemoteDirectory, fileName);
    const totalBytes = Math.max(0, localStats.size);
    const transferKey = toTransferKey(tabId, safeTransferId);
    if (this.activeUploadTransfers.has(transferKey)) {
      throw new Error("Upload transfer is already running.");
    }
    const activeTransfer: ActiveUploadTransfer = {
      tabId,
      transferId: safeTransferId,
      remotePath,
      canceled: false
    };
    this.activeUploadTransfers.set(transferKey, activeTransfer);
    let transferredBytes = 0;

    try {
      this.emitTransfer(
        connection,
        this.createTransferEvent({
          tabId,
          transferId: safeTransferId,
          direction: "upload",
          status: "queued",
          name: fileName,
          localPath: normalizedLocalPath,
          remotePath,
          transferredBytes: 0,
          totalBytes,
          message: "queued"
        })
      );

      const reportProgress = () => {
        this.emitTransfer(
          connection,
          this.createTransferEvent({
            tabId,
            transferId: safeTransferId,
            direction: "upload",
            status: "running",
            name: fileName,
            localPath: normalizedLocalPath,
            remotePath,
            transferredBytes,
            totalBytes
          })
        );
      };

      reportProgress();
      const readStream = createReadStream(normalizedLocalPath);
      const writeStream = sftp.createWriteStream(remotePath);
      activeTransfer.readStream = readStream;
      activeTransfer.writeStream = writeStream;
      if (activeTransfer.canceled) {
        throw new TransferCanceledError();
      }

      await this.pipeWithProgress({
        readStream,
        writeStream,
        onChunk: (chunkSize) => {
          transferredBytes += chunkSize;
          reportProgress();
        }
      });
      if (activeTransfer.canceled) {
        throw new TransferCanceledError();
      }
      this.emitTransfer(
        connection,
        this.createTransferEvent({
          tabId,
          transferId: safeTransferId,
          direction: "upload",
          status: "completed",
          name: fileName,
          localPath: normalizedLocalPath,
          remotePath,
          transferredBytes: totalBytes,
          totalBytes,
          message: "completed"
        })
      );
    } catch (error) {
      if (activeTransfer.canceled || error instanceof TransferCanceledError) {
        await this.unlinkIgnoreMissing(sftp, remotePath);
        this.emitTransfer(
          connection,
          this.createTransferEvent({
            tabId,
            transferId: safeTransferId,
            direction: "upload",
            status: "canceled",
            name: fileName,
            localPath: normalizedLocalPath,
            remotePath,
            transferredBytes,
            totalBytes,
            message: "canceled"
          })
        );
        return;
      }
      this.emitTransfer(
        connection,
        this.createTransferEvent({
          tabId,
          transferId: safeTransferId,
          direction: "upload",
          status: "failed",
          name: fileName,
          localPath: normalizedLocalPath,
          remotePath,
          transferredBytes,
          totalBytes,
          message: (error as Error).message
        })
      );
      throw error;
    } finally {
      this.activeUploadTransfers.delete(transferKey);
    }
  }

  async cancelUpload(tabId: string, transferId: string): Promise<boolean> {
    const safeTransferId = normalizeTransferId(transferId);
    const transfer = this.activeUploadTransfers.get(toTransferKey(tabId, safeTransferId));
    if (!transfer) {
      return false;
    }
    if (transfer.canceled) {
      return true;
    }
    transfer.canceled = true;
    const cancelError = new TransferCanceledError();
    this.destroyStream(transfer.readStream, cancelError);
    this.destroyStream(transfer.writeStream, cancelError);
    return true;
  }

  async cancelDownload(tabId: string, transferId: string): Promise<boolean> {
    const safeTransferId = normalizeTransferId(transferId);
    const transfer = this.activeDownloadTransfers.get(toTransferKey(tabId, safeTransferId));
    if (!transfer) {
      return false;
    }
    if (transfer.canceled) {
      return true;
    }
    transfer.canceled = true;
    const cancelError = new TransferCanceledError();
    this.destroyStream(transfer.readStream, cancelError);
    this.destroyStream(transfer.writeStream, cancelError);
    return true;
  }

  async downloadFile(
    tabId: string,
    transferId: string,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const safeTransferId = normalizeTransferId(transferId);
    const normalizedRemotePath = normalizeRemotePath(remotePath);
    const normalizedLocalPath = normalizeLocalPath(localPath, "Local download path");
    const fileName = posixPath.basename(normalizedRemotePath);
    if (!fileName) {
      throw new Error("Remote file path is invalid.");
    }

    const remoteStats = await this.statRemote(sftp, normalizedRemotePath);
    if (((remoteStats.mode ?? 0) & 0o170000) === 0o040000) {
      throw new Error("Downloading directories is not supported yet.");
    }
    const totalBytes =
      typeof remoteStats.size === "number" && remoteStats.size > 0
        ? remoteStats.size
        : 0;
    const transferKey = toTransferKey(tabId, safeTransferId);
    if (this.activeDownloadTransfers.has(transferKey)) {
      throw new Error("Download transfer is already running.");
    }
    const activeTransfer: ActiveDownloadTransfer = {
      tabId,
      transferId: safeTransferId,
      localPath: normalizedLocalPath,
      canceled: false
    };
    this.activeDownloadTransfers.set(transferKey, activeTransfer);

    await mkdirLocalDirectory(dirnamePath(normalizedLocalPath), { recursive: true });

    let transferredBytes = 0;
    try {
      this.emitTransfer(
        connection,
        this.createTransferEvent({
          tabId,
          transferId: safeTransferId,
          direction: "download",
          status: "queued",
          name: fileName,
          localPath: normalizedLocalPath,
          remotePath: normalizedRemotePath,
          transferredBytes: 0,
          totalBytes,
          message: "queued"
        })
      );

      const reportProgress = () => {
        this.emitTransfer(
          connection,
          this.createTransferEvent({
            tabId,
            transferId: safeTransferId,
            direction: "download",
            status: "running",
            name: fileName,
            localPath: normalizedLocalPath,
            remotePath: normalizedRemotePath,
            transferredBytes,
            totalBytes
          })
        );
      };

      reportProgress();
      const readStream = sftp.createReadStream(normalizedRemotePath);
      const writeStream = createWriteStream(normalizedLocalPath);
      activeTransfer.readStream = readStream;
      activeTransfer.writeStream = writeStream;
      if (activeTransfer.canceled) {
        throw new TransferCanceledError();
      }

      await this.pipeWithProgress({
        readStream,
        writeStream,
        onChunk: (chunkSize) => {
          transferredBytes += chunkSize;
          reportProgress();
        }
      });
      if (activeTransfer.canceled) {
        throw new TransferCanceledError();
      }
      this.emitTransfer(
        connection,
        this.createTransferEvent({
          tabId,
          transferId: safeTransferId,
          direction: "download",
          status: "completed",
          name: fileName,
          localPath: normalizedLocalPath,
          remotePath: normalizedRemotePath,
          transferredBytes: totalBytes || transferredBytes,
          totalBytes: totalBytes || transferredBytes,
          message: "completed"
        })
      );
    } catch (error) {
      if (activeTransfer.canceled || error instanceof TransferCanceledError) {
        await this.unlinkLocalIgnoreMissing(normalizedLocalPath);
        this.emitTransfer(
          connection,
          this.createTransferEvent({
            tabId,
            transferId: safeTransferId,
            direction: "download",
            status: "canceled",
            name: fileName,
            localPath: normalizedLocalPath,
            remotePath: normalizedRemotePath,
            transferredBytes,
            totalBytes: totalBytes || transferredBytes,
            message: "canceled"
          })
        );
        return;
      }
      this.emitTransfer(
        connection,
        this.createTransferEvent({
          tabId,
          transferId: safeTransferId,
          direction: "download",
          status: "failed",
          name: fileName,
          localPath: normalizedLocalPath,
          remotePath: normalizedRemotePath,
          transferredBytes,
          totalBytes: totalBytes || transferredBytes,
          message: (error as Error).message
        })
      );
      throw error;
    } finally {
      this.activeDownloadTransfers.delete(transferKey);
    }
  }

  private async buildConnectConfig(session: SessionRecord): Promise<ConnectConfig> {
    const config: ConnectConfig = {
      host: session.host,
      port: session.port,
      username: session.username,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 3,
      readyTimeout: 15_000
    };

    if (session.authType === "password") {
      const password = await this.credentialStore.getSessionSecret(session.id);
      if (!password) {
        throw new Error("Session password not found in secure storage.");
      }
      config.password = password;
      return config;
    }

    if (!session.privateKeyPath) {
      throw new Error("Private key path is required for key-based authentication.");
    }

    const privateKeyPath = expandHomePath(session.privateKeyPath);
    config.privateKey = await readFile(privateKeyPath, "utf-8");
    const passphrase = await this.credentialStore.getSessionSecret(session.id);
    if (passphrase) {
      config.passphrase = passphrase;
    }

    return config;
  }

  private async ensureSftp(connection: Ssh2TerminalConnection): Promise<SFTPWrapper> {
    if (connection.sftp) {
      return connection.sftp;
    }

    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      connection.client.sftp((error, nextSftp) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(nextSftp);
      });
    });

    connection.sftp = sftp;
    return sftp;
  }

  private getConnectedConnection(tabId: string): TerminalConnection {
    const connection = this.connections.get(tabId);
    if (!connection || connection.closed) {
      throw new Error("Terminal tab is not connected.");
    }
    return connection;
  }

  private getConnectedSsh2Connection(tabId: string): Ssh2TerminalConnection {
    const connection = this.getConnectedConnection(tabId);
    if (connection.mode !== "ssh2") {
      throw new Error(
        "SFTP is unavailable in system ssh fallback mode. Reconnect when direct SSH is available."
      );
    }
    return connection;
  }

  private async realPath(sftp: SFTPWrapper, targetPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      sftp.realpath(targetPath, (error, absolutePath) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(absolutePath);
      });
    });
  }

  private async statRemote(sftp: SFTPWrapper, targetPath: string): Promise<Attributes> {
    return new Promise<Attributes>((resolve, reject) => {
      sftp.stat(targetPath, (error, stats) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stats);
      });
    });
  }

  private async readDirectory(
    sftp: SFTPWrapper,
    targetPath: string
  ): Promise<FileEntryWithStats[]> {
    return new Promise<FileEntryWithStats[]>((resolve, reject) => {
      sftp.readdir(targetPath, (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows ?? []);
      });
    });
  }

  private async mkdir(sftp: SFTPWrapper, targetPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      sftp.mkdir(targetPath, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async rename(
    sftp: SFTPWrapper,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      sftp.rename(sourcePath, targetPath, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async unlink(sftp: SFTPWrapper, targetPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      sftp.unlink(targetPath, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async unlinkIgnoreMissing(sftp: SFTPWrapper, targetPath: string): Promise<void> {
    try {
      await this.unlink(sftp, targetPath);
    } catch {
      // Best-effort cleanup for canceled uploads; ignore missing/permission errors.
    }
  }

  private async unlinkLocalIgnoreMissing(targetPath: string): Promise<void> {
    try {
      await unlinkLocalFile(targetPath);
    } catch {
      // Best-effort cleanup for canceled downloads; ignore missing/permission errors.
    }
  }

  private async rmdir(sftp: SFTPWrapper, targetPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      sftp.rmdir(targetPath, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private destroyStream(stream: NodeJS.ReadableStream | NodeJS.WritableStream | undefined, error: Error): void {
    if (!stream) {
      return;
    }
    const destroyable = stream as NodeJS.ReadableStream & {
      destroy?: (reason?: Error) => void;
    };
    destroyable.destroy?.(error);
  }

  private async pipeWithProgress(options: {
    readStream: NodeJS.ReadableStream;
    writeStream: NodeJS.WritableStream;
    onChunk: (chunkSize: number) => void;
  }): Promise<void> {
    const { readStream, writeStream, onChunk } = options;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const close = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        readStream.removeListener("data", onData);
        readStream.removeListener("error", onReadError);
        writeStream.removeListener("error", onWriteError);
        writeStream.removeListener("finish", onDone);
        writeStream.removeListener("close", onDone);
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };
      const onData = (chunk: Buffer | string) => {
        if (typeof chunk === "string") {
          onChunk(Buffer.byteLength(chunk));
          return;
        }
        onChunk(chunk.length);
      };
      const onReadError = (error: Error) => {
        close(error);
      };
      const onWriteError = (error: Error) => {
        close(error);
      };
      const onDone = () => {
        close();
      };

      readStream.on("data", onData);
      readStream.once("error", onReadError);
      writeStream.once("error", onWriteError);
      writeStream.once("finish", onDone);
      writeStream.once("close", onDone);
      readStream.pipe(writeStream);
    });
  }

  private toSftpEntry(parentPath: string, row: FileEntryWithStats): SftpEntry {
    const kind = detectSftpEntryKind(row.attrs);
    const modifiedAt =
      typeof row.attrs.mtime === "number" && row.attrs.mtime > 0
        ? new Date(row.attrs.mtime * 1000).toISOString()
        : undefined;
    const mode = typeof row.attrs.mode === "number" ? row.attrs.mode : 0;
    return {
      name: row.filename,
      path: posixPath.join(parentPath, row.filename),
      kind,
      permissions: formatPosixMode(mode, kind),
      links: parseLinkCountFromLongname(row.longname),
      owner: typeof row.attrs.uid === "number" ? String(row.attrs.uid) : "-",
      group: typeof row.attrs.gid === "number" ? String(row.attrs.gid) : "-",
      size: typeof row.attrs.size === "number" ? row.attrs.size : 0,
      modifiedAt
    };
  }

  private emit(sender: WebContents, payload: TerminalEvent): void {
    if (sender.isDestroyed()) {
      return;
    }
    sender.send("terminal:event", payload);
  }

  private async markSessionConnected(sessionId: string): Promise<void> {
    try {
      await this.sessionStore.markConnected(sessionId);
    } catch {
      // Best-effort metadata update; do not disrupt terminal connect flow.
    }
  }

  private emitTransfer(connection: TerminalConnection, payload: SftpTransferEvent): void {
    if (connection.sender.isDestroyed()) {
      return;
    }
    connection.sender.send("sftp:transfer:event", payload);
  }

  private createTransferEvent(payload: {
    tabId: string;
    transferId: string;
    direction: SftpTransferDirection;
    status: SftpTransferEvent["status"];
    name: string;
    localPath: string;
    remotePath: string;
    transferredBytes: number;
    totalBytes: number;
    message?: string;
  }): SftpTransferEvent {
    const safeTotalBytes = Math.max(0, Math.trunc(payload.totalBytes));
    const safeTransferredBytes = Math.max(
      0,
      Math.min(Math.trunc(payload.transferredBytes), safeTotalBytes || Math.trunc(payload.transferredBytes))
    );
    return {
      tabId: payload.tabId,
      transferId: payload.transferId,
      direction: payload.direction,
      status: payload.status,
      name: payload.name,
      localPath: payload.localPath,
      remotePath: payload.remotePath,
      transferredBytes: safeTransferredBytes,
      totalBytes: safeTotalBytes,
      message: payload.message
    };
  }

  private emitClosed(connection: TerminalConnection): void {
    if (connection.closed) {
      return;
    }
    connection.closed = true;
    this.emit(connection.sender, {
      tabId: connection.tabId,
      type: "status",
      status: "closed"
    });
  }
}

function expandHomePath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return joinPath(homedir(), filePath.slice(2));
  }
  return filePath;
}

function normalizeRemotePath(targetPath?: string): string {
  const trimmed = targetPath?.trim();
  if (!trimmed) {
    return ".";
  }
  return trimmed;
}

function normalizeLocalPath(pathValue: string, label: string): string {
  const trimmed = pathValue.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function normalizeTransferId(transferId: string): string {
  const trimmed = transferId.trim();
  if (trimmed) {
    return trimmed;
  }
  return `tx-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function toTransferKey(tabId: string, transferId: string): string {
  return `${tabId}:${transferId}`;
}

function normalizeEntryName(name: string, label: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} is required.`);
  }
  if (trimmed === "." || trimmed === "..") {
    throw new Error(`${label} cannot be "." or "..".`);
  }
  if (trimmed.includes("/")) {
    throw new Error(`${label} cannot contain "/".`);
  }
  return trimmed;
}

function assertPathIsNotRoot(targetPath: string): void {
  if (targetPath === "/") {
    throw new Error("Operation on root path is not allowed.");
  }
}

function dirnamePosix(pathValue: string): string | null {
  const next = posixPath.dirname(pathValue);
  if (next === "." || next === pathValue) {
    return pathValue === "/" ? null : "/";
  }
  return next;
}

function detectSftpEntryKind(attrs: Attributes): SftpEntryKind {
  const mode = attrs.mode ?? 0;
  const fileType = mode & 0o170000;
  if (fileType === 0o040000) {
    return "directory";
  }
  if (fileType === 0o100000) {
    return "file";
  }
  if (fileType === 0o120000) {
    return "symlink";
  }
  return "other";
}

function compareSftpEntries(left: SftpEntry, right: SftpEntry): number {
  if (left.kind === "directory" && right.kind !== "directory") {
    return -1;
  }
  if (left.kind !== "directory" && right.kind === "directory") {
    return 1;
  }
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function formatPosixMode(mode: number, fallbackKind: SftpEntryKind): string {
  const fileType = mode & 0o170000;
  const typeChar =
    fileType === 0o040000
      ? "d"
      : fileType === 0o120000
        ? "l"
        : fileType === 0o100000
          ? "-"
          : fallbackKind === "directory"
            ? "d"
            : fallbackKind === "symlink"
              ? "l"
              : "-";

  const perms = [
    0o400,
    0o200,
    0o100,
    0o040,
    0o020,
    0o010,
    0o004,
    0o002,
    0o001
  ];
  const chars = ["r", "w", "x", "r", "w", "x", "r", "w", "x"];
  let permissionBits = "";
  for (let index = 0; index < perms.length; index += 1) {
    permissionBits += (mode & perms[index]) !== 0 ? chars[index] : "-";
  }

  if ((mode & 0o4000) !== 0) {
    permissionBits = permissionBits.slice(0, 2) + (permissionBits[2] === "x" ? "s" : "S") + permissionBits.slice(3);
  }
  if ((mode & 0o2000) !== 0) {
    permissionBits = permissionBits.slice(0, 5) + (permissionBits[5] === "x" ? "s" : "S") + permissionBits.slice(6);
  }
  if ((mode & 0o1000) !== 0) {
    permissionBits = permissionBits.slice(0, 8) + (permissionBits[8] === "x" ? "t" : "T");
  }

  return `${typeChar}${permissionBits}`;
}

function parseLinkCountFromLongname(longname: string | undefined): number {
  if (typeof longname !== "string" || longname.trim().length === 0) {
    return 1;
  }
  const hit = longname.match(/^\S+\s+(\d+)/);
  if (!hit) {
    return 1;
  }
  const parsed = Number.parseInt(hit[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
