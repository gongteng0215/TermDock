import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir as mkdirLocalDirectory,
  readFile,
  stat as statLocalFile,
  unlink as unlinkLocalFile
} from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import type { Server as NetServer, Socket } from "node:net";
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
import type {
  CreatePortForwardInput,
  PortForwardEventRecord,
  PortForwardRecord,
  PortForwardStatus,
  PortForwardType,
  ServerHealthSnapshot,
  ServerProcessEntry,
  ServerProcessSnapshot,
  TerminalEvent
} from "../../shared/terminal.js";
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

interface ActivePortForwardBase {
  id: string;
  tabId: string;
  type: PortForwardType;
  bindHost: string;
  bindPort: number;
  createdAt: string;
  status: PortForwardStatus;
  totalConnections: number;
  failedConnections: number;
  lastActivityAt?: string;
  lastError?: string;
  lastErrorAt?: string;
}

interface ActiveLocalPortForward extends ActivePortForwardBase {
  type: "local";
  targetHost: string;
  targetPort: number;
  server: NetServer;
}

interface ActiveRemotePortForward extends ActivePortForwardBase {
  type: "remote";
  targetHost: string;
  targetPort: number;
  client: Client;
  listener: (
    details: {
      destIP: string;
      destPort: number;
      srcIP: string;
      srcPort: number;
    },
    accept: () => ClientChannel,
    reject: () => void
  ) => void;
}

interface ActiveDynamicPortForward extends ActivePortForwardBase {
  type: "dynamic";
  server: NetServer;
}

type ActivePortForward =
  | ActiveLocalPortForward
  | ActiveRemotePortForward
  | ActiveDynamicPortForward;

class TransferCanceledError extends Error {
  constructor() {
    super("Transfer canceled.");
    this.name = "TransferCanceledError";
  }
}

export class TerminalService {
  private readonly connections = new Map<string, TerminalConnection>();
  private readonly activePortForwardsByTab = new Map<string, Map<string, ActivePortForward>>();
  private readonly portForwardEventsByTab = new Map<string, PortForwardEventRecord[]>();
  private readonly activeUploadTransfers = new Map<string, ActiveUploadTransfer>();
  private readonly activeDownloadTransfers = new Map<string, ActiveDownloadTransfer>();
  private readonly pendingUploadCancelKeys = new Set<string>();
  private readonly pendingUploadCancelIds = new Set<string>();
  private readonly pendingDownloadCancelKeys = new Set<string>();
  private readonly pendingDownloadCancelIds = new Set<string>();

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
      this.closeAllPortForwardsSync(tabId, connection);
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
      this.closeAllPortForwardsSync(tabId);
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
      this.closeAllPortForwardsSync(tabId);
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
    this.closeAllPortForwardsSync(tabId, connection.mode === "ssh2" ? connection : undefined);
    for (const key of this.pendingUploadCancelKeys) {
      if (key.startsWith(`${tabId}:`)) {
        this.pendingUploadCancelKeys.delete(key);
      }
    }
    for (const key of this.pendingDownloadCancelKeys) {
      if (key.startsWith(`${tabId}:`)) {
        this.pendingDownloadCancelKeys.delete(key);
      }
    }
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

  async getServerHealth(tabId: string): Promise<ServerHealthSnapshot> {
    const connection = this.getConnectedSsh2Connection(tabId, "Server monitor");
    const rawOutput = await this.executeRemoteCommand(connection.client, SERVER_HEALTH_COMMAND, 10_000);
    const parsed = parseServerHealthOutput(rawOutput);
    return {
      tabId,
      collectedAt: new Date().toISOString(),
      ...parsed
    };
  }

  async getServerProcesses(tabId: string): Promise<ServerProcessSnapshot> {
    const connection = this.getConnectedSsh2Connection(tabId, "Server monitor");
    const rawOutput = await this.executeRemoteCommand(
      connection.client,
      SERVER_PROCESS_COMMAND,
      10_000
    );
    const parsed = parseServerProcessOutput(rawOutput);
    return {
      tabId,
      collectedAt: new Date().toISOString(),
      ...parsed
    };
  }

  async listPortForwards(tabId: string): Promise<PortForwardRecord[]> {
    return this.getPortForwardRecords(tabId);
  }

  async listPortForwardEvents(tabId: string, limit?: number): Promise<PortForwardEventRecord[]> {
    const safeLimit =
      typeof limit === "number" && Number.isFinite(limit)
        ? Math.max(1, Math.min(200, Math.trunc(limit)))
        : 40;
    const events = this.portForwardEventsByTab.get(tabId);
    if (!events || events.length === 0) {
      return [];
    }
    return events.slice(0, safeLimit);
  }

  async createPortForward(tabId: string, input: CreatePortForwardInput): Promise<PortForwardRecord> {
    const connection = this.getConnectedSsh2Connection(tabId, "Port forwarding");
    const normalizedInput = normalizePortForwardInput(input);
    this.assertPortForwardBindingAvailable(tabId, normalizedInput.type, normalizedInput.bindHost, normalizedInput.bindPort);

    let created: ActivePortForward;
    if (normalizedInput.type === "local") {
      created = await this.startLocalPortForward(tabId, connection, normalizedInput);
    } else if (normalizedInput.type === "remote") {
      created = await this.startRemotePortForward(tabId, connection, normalizedInput);
    } else {
      created = await this.startDynamicPortForward(tabId, connection, normalizedInput);
    }

    const tabForwards = this.ensurePortForwardMap(tabId);
    tabForwards.set(created.id, created);
    this.appendPortForwardEvent(created, "created", "info", "Port forward created.");
    return this.toPortForwardRecord(created);
  }

  async removePortForward(tabId: string, forwardId: string): Promise<void> {
    const safeForwardId = normalizePortForwardId(forwardId);
    const tabForwards = this.activePortForwardsByTab.get(tabId);
    if (!tabForwards) {
      return;
    }
    const activeForward = tabForwards.get(safeForwardId);
    if (!activeForward) {
      return;
    }
    tabForwards.delete(safeForwardId);
    if (tabForwards.size === 0) {
      this.activePortForwardsByTab.delete(tabId);
    }
    this.appendPortForwardEvent(activeForward, "removed", "info", "Port forward removed.");
    await this.stopPortForward(activeForward);
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
    const normalizedTargetPath = normalizeRemotePath(targetPath);
    assertPathIsNotRoot(normalizedTargetPath);
    assertPathIsSafeForDelete(normalizedTargetPath);
    try {
      if (kind === "directory") {
        await this.deleteDirectoryViaRemoteCommand(connection, normalizedTargetPath);
        return;
      }
      const sftp = await this.ensureSftp(connection);
      await this.unlink(sftp, normalizedTargetPath);
    } catch (error) {
      throw new Error(toDeletePathErrorMessage(normalizedTargetPath, kind, error));
    }
  }

  async uploadFile(
    tabId: string,
    transferId: string,
    localPath: string,
    remoteDirectory: string
  ): Promise<void> {
    const normalizedLocalPath = normalizeLocalPath(localPath, "Local upload file path");
    const normalizedRemoteDirectory = normalizeRemotePath(remoteDirectory);
    const fileName = basenamePath(normalizedLocalPath);
    if (!fileName) {
      throw new Error("Upload file name is invalid.");
    }
    const remotePath = posixPath.join(normalizedRemoteDirectory, fileName);
    await this.uploadLocalFileToRemotePath(tabId, transferId, normalizedLocalPath, remotePath);
  }

  async uploadFileToPath(
    tabId: string,
    transferId: string,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    const normalizedLocalPath = normalizeLocalPath(localPath, "Local upload file path");
    const normalizedRemotePath = normalizeRemotePath(remotePath);
    assertPathIsNotRoot(normalizedRemotePath);
    await this.uploadLocalFileToRemotePath(
      tabId,
      transferId,
      normalizedLocalPath,
      normalizedRemotePath
    );
  }

  async cancelUpload(tabId: string, transferId: string): Promise<boolean> {
    const safeTransferId = normalizeTransferId(transferId);
    const transferKey = toTransferKey(tabId, safeTransferId);
    const transfer =
      this.activeUploadTransfers.get(transferKey) ??
      this.findActiveUploadTransferById(safeTransferId);
    if (!transfer) {
      // Cancel may race with transfer startup; remember intent and consume it when transfer registers.
      this.pendingUploadCancelKeys.add(transferKey);
      this.pendingUploadCancelIds.add(safeTransferId);
      return true;
    }
    this.pendingUploadCancelKeys.delete(transferKey);
    this.pendingUploadCancelIds.delete(safeTransferId);
    if (transfer.canceled) {
      return true;
    }
    transfer.canceled = true;
    if (transfer.readStream && transfer.writeStream) {
      this.cancelStreamPair(transfer.readStream, transfer.writeStream);
      return true;
    }
    const cancelError = new TransferCanceledError();
    this.destroyStream(transfer.readStream, cancelError);
    this.destroyStream(transfer.writeStream, cancelError);
    return true;
  }

  async cancelDownload(tabId: string, transferId: string): Promise<boolean> {
    const safeTransferId = normalizeTransferId(transferId);
    const transferKey = toTransferKey(tabId, safeTransferId);
    const transfer =
      this.activeDownloadTransfers.get(transferKey) ??
      this.findActiveDownloadTransferById(safeTransferId);
    if (!transfer) {
      // Cancel may race with transfer startup; remember intent and consume it when transfer registers.
      this.pendingDownloadCancelKeys.add(transferKey);
      this.pendingDownloadCancelIds.add(safeTransferId);
      return true;
    }
    this.pendingDownloadCancelKeys.delete(transferKey);
    this.pendingDownloadCancelIds.delete(safeTransferId);
    if (transfer.canceled) {
      return true;
    }
    transfer.canceled = true;
    if (transfer.readStream && transfer.writeStream) {
      this.cancelStreamPair(transfer.readStream, transfer.writeStream);
      return true;
    }
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
    if (this.consumePendingDownloadCancel(transferKey, safeTransferId)) {
      activeTransfer.canceled = true;
    }

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
        isCanceled: () => activeTransfer.canceled,
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

  private getPortForwardRecords(tabId: string): PortForwardRecord[] {
    const tabForwards = this.activePortForwardsByTab.get(tabId);
    if (!tabForwards) {
      return [];
    }
    return Array.from(tabForwards.values())
      .map((forward) => this.toPortForwardRecord(forward))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private toPortForwardRecord(forward: ActivePortForward): PortForwardRecord {
    return {
      id: forward.id,
      tabId: forward.tabId,
      type: forward.type,
      bindHost: forward.bindHost,
      bindPort: forward.bindPort,
      targetHost:
        forward.type === "local" || forward.type === "remote"
          ? forward.targetHost
          : undefined,
      targetPort:
        forward.type === "local" || forward.type === "remote"
          ? forward.targetPort
          : undefined,
      createdAt: forward.createdAt,
      status: forward.status,
      totalConnections: forward.totalConnections,
      failedConnections: forward.failedConnections,
      lastActivityAt: forward.lastActivityAt,
      lastError: forward.lastError,
      lastErrorAt: forward.lastErrorAt
    };
  }

  private appendPortForwardEvent(
    forward: Pick<ActivePortForwardBase, "id" | "tabId" | "type" | "bindHost" | "bindPort">,
    type: PortForwardEventRecord["type"],
    level: PortForwardEventRecord["level"],
    message: string
  ): void {
    const entry: PortForwardEventRecord = {
      id: createPortForwardEventId(),
      tabId: forward.tabId,
      forwardId: forward.id,
      forwardType: forward.type,
      bindHost: forward.bindHost,
      bindPort: forward.bindPort,
      level,
      type,
      message,
      createdAt: new Date().toISOString()
    };
    const existing = this.portForwardEventsByTab.get(forward.tabId) ?? [];
    existing.unshift(entry);
    if (existing.length > 200) {
      existing.length = 200;
    }
    this.portForwardEventsByTab.set(forward.tabId, existing);
  }

  private markPortForwardConnectionSuccess(tabId: string, forwardId: string): void {
    const forward = this.activePortForwardsByTab.get(tabId)?.get(forwardId);
    if (!forward) {
      return;
    }
    const wasDegraded = forward.status === "degraded";
    forward.totalConnections += 1;
    forward.lastActivityAt = new Date().toISOString();
    forward.status = "active";
    if (wasDegraded) {
      this.appendPortForwardEvent(
        forward,
        "statusRecovered",
        "info",
        "Port forward recovered and is accepting connections."
      );
    }
  }

  private markPortForwardConnectionFailure(tabId: string, forwardId: string, error?: unknown): void {
    const forward = this.activePortForwardsByTab.get(tabId)?.get(forwardId);
    if (!forward) {
      return;
    }
    const now = new Date().toISOString();
    const wasActive = forward.status === "active";
    forward.totalConnections += 1;
    forward.failedConnections += 1;
    forward.lastActivityAt = now;
    forward.status = "degraded";
    const message = toPortForwardRuntimeErrorMessage(error);
    if (message) {
      forward.lastError = message;
      forward.lastErrorAt = now;
    }
    if (wasActive) {
      this.appendPortForwardEvent(
        forward,
        "statusDegraded",
        "error",
        message || "Port forward failed to proxy a connection."
      );
    }
  }

  private ensurePortForwardMap(tabId: string): Map<string, ActivePortForward> {
    const existing = this.activePortForwardsByTab.get(tabId);
    if (existing) {
      return existing;
    }
    const created = new Map<string, ActivePortForward>();
    this.activePortForwardsByTab.set(tabId, created);
    return created;
  }

  private assertPortForwardBindingAvailable(
    tabId: string,
    type: PortForwardType,
    bindHost: string,
    bindPort: number
  ): void {
    const tabForwards = this.activePortForwardsByTab.get(tabId);
    if (!tabForwards) {
      return;
    }
    for (const forward of tabForwards.values()) {
      if (forward.type !== type) {
        continue;
      }
      if (forward.bindPort !== bindPort) {
        continue;
      }
      if (forward.bindHost.toLowerCase() !== bindHost.toLowerCase()) {
        continue;
      }
      throw new Error(`Port forwarding already exists on ${bindHost}:${bindPort}.`);
    }
  }

  private async startLocalPortForward(
    tabId: string,
    connection: Ssh2TerminalConnection,
    input: NormalizedCreatePortForwardInput & { type: "local" }
  ): Promise<ActiveLocalPortForward> {
    const forwardId = createPortForwardId("L");
    const createdAt = new Date().toISOString();
    const server = createServer((localSocket) => {
      if (connection.closed || this.connections.get(tabId) !== connection) {
        localSocket.destroy();
        return;
      }
      const sourceHost = localSocket.remoteAddress ?? input.bindHost;
      const sourcePort = localSocket.remotePort ?? 0;
      connection.client.forwardOut(
        sourceHost,
        sourcePort,
        input.targetHost,
        input.targetPort,
        (error, sshStream) => {
          if (error || !sshStream) {
            this.markPortForwardConnectionFailure(tabId, forwardId, error);
            localSocket.destroy(error ?? new Error("Port forward channel rejected."));
            return;
          }
          this.markPortForwardConnectionSuccess(tabId, forwardId);
          bridgeDuplexStreams(localSocket, sshStream);
        }
      );
    });
    server.on("error", () => {
      // Keep listener attached to avoid unhandled server errors after startup.
    });
    await listenTcpServer(server, input.bindHost, input.bindPort);
    const boundPort = resolveListeningPort(server, input.bindPort);
    return {
      id: forwardId,
      tabId,
      type: "local",
      bindHost: input.bindHost,
      bindPort: boundPort,
      targetHost: input.targetHost,
      targetPort: input.targetPort,
      createdAt,
      status: "active",
      totalConnections: 0,
      failedConnections: 0,
      server
    };
  }

  private async startRemotePortForward(
    tabId: string,
    connection: Ssh2TerminalConnection,
    input: NormalizedCreatePortForwardInput & { type: "remote" }
  ): Promise<ActiveRemotePortForward> {
    const forwardId = createPortForwardId("R");
    const createdAt = new Date().toISOString();
    let activeBindPort = input.bindPort;
    const listener: ActiveRemotePortForward["listener"] = (details, accept, reject) => {
      if (!matchesRemoteForwardBinding(details, input.bindHost, activeBindPort)) {
        reject();
        return;
      }
      let sshStream: ClientChannel;
      try {
        sshStream = accept();
      } catch {
        this.markPortForwardConnectionFailure(tabId, forwardId, new Error("Remote forward channel rejected."));
        reject();
        return;
      }
      const localSocket = createConnection({
        host: input.targetHost,
        port: input.targetPort
      });
      localSocket.once("connect", () => {
        this.markPortForwardConnectionSuccess(tabId, forwardId);
        bridgeDuplexStreams(localSocket, sshStream);
      });
      localSocket.once("error", (error) => {
        this.markPortForwardConnectionFailure(tabId, forwardId, error);
        safeEndSshChannel(sshStream);
      });
      sshStream.once("error", () => {
        localSocket.destroy();
      });
      sshStream.once("close", () => {
        localSocket.destroy();
      });
    };

    connection.client.on("tcp connection" as any, listener as any);
    try {
      const boundPort = await forwardIn(connection.client, input.bindHost, input.bindPort);
      if (Number.isFinite(boundPort) && boundPort > 0) {
        activeBindPort = Math.trunc(boundPort);
      }
    } catch (error) {
      connection.client.removeListener("tcp connection" as any, listener as any);
      throw error;
    }

    return {
      id: forwardId,
      tabId,
      type: "remote",
      bindHost: input.bindHost,
      bindPort: activeBindPort,
      targetHost: input.targetHost,
      targetPort: input.targetPort,
      createdAt,
      status: "active",
      totalConnections: 0,
      failedConnections: 0,
      client: connection.client,
      listener
    };
  }

  private async startDynamicPortForward(
    tabId: string,
    connection: Ssh2TerminalConnection,
    input: NormalizedCreatePortForwardInput & { type: "dynamic" }
  ): Promise<ActiveDynamicPortForward> {
    const forwardId = createPortForwardId("D");
    const createdAt = new Date().toISOString();
    const server = createServer((socket) => {
      this.handleDynamicSocksConnection(socket, tabId, forwardId, connection);
    });
    server.on("error", () => {
      // Keep listener attached to avoid unhandled server errors after startup.
    });
    await listenTcpServer(server, input.bindHost, input.bindPort);
    const boundPort = resolveListeningPort(server, input.bindPort);
    return {
      id: forwardId,
      tabId,
      type: "dynamic",
      bindHost: input.bindHost,
      bindPort: boundPort,
      createdAt,
      status: "active",
      totalConnections: 0,
      failedConnections: 0,
      server
    };
  }

  private async stopPortForward(forward: ActivePortForward): Promise<void> {
    if (forward.type === "local" || forward.type === "dynamic") {
      await closeTcpServer(forward.server);
      return;
    }
    forward.client.removeListener("tcp connection" as any, forward.listener as any);
    try {
      await unforwardIn(forward.client, forward.bindHost, forward.bindPort);
    } catch {
      // Connection may already be closed; treat as best effort.
    }
  }

  private closeAllPortForwardsSync(tabId: string, _connection?: Ssh2TerminalConnection): void {
    const tabForwards = this.activePortForwardsByTab.get(tabId);
    if (!tabForwards) {
      return;
    }
    this.activePortForwardsByTab.delete(tabId);
    for (const forward of tabForwards.values()) {
      this.appendPortForwardEvent(
        forward,
        "removed",
        "info",
        "Port forward stopped because terminal tab disconnected or closed."
      );
      if (forward.type === "local" || forward.type === "dynamic") {
        closeTcpServerNoWait(forward.server);
        continue;
      }
      forward.client.removeListener(
        "tcp connection" as any,
        forward.listener as any
      );
      try {
        forward.client.unforwardIn(forward.bindHost, forward.bindPort, () => {
          // Best effort release.
        });
      } catch {
        // Connection likely already closed.
      }
    }
  }

  private handleDynamicSocksConnection(
    socket: Socket,
    tabId: string,
    forwardId: string,
    connection: Ssh2TerminalConnection
  ): void {
    let state: "greeting" | "request" | "proxy" = "greeting";
    let pending = Buffer.alloc(0);
    let remoteStream: ClientChannel | null = null;

    const destroySocket = (error?: Error) => {
      if (error) {
        socket.destroy(error);
        return;
      }
      socket.destroy();
    };

    const closeRemote = () => {
      if (!remoteStream) {
        return;
      }
      safeEndSshChannel(remoteStream);
      remoteStream = null;
    };

    const onSocketData = (chunk: Buffer) => {
      if (state === "proxy") {
        return;
      }
      pending = Buffer.concat([pending, chunk]);
      while (true) {
        if (state === "greeting") {
          if (pending.length < 2) {
            return;
          }
          const version = pending[0];
          const methodsLength = pending[1];
          if (pending.length < 2 + methodsLength) {
            return;
          }
          const methods = pending.subarray(2, 2 + methodsLength);
          pending = pending.subarray(2 + methodsLength);
          if (version !== 0x05) {
            destroySocket();
            return;
          }
          if (!methods.includes(0x00)) {
            socket.write(Buffer.from([0x05, 0xff]));
            destroySocket();
            return;
          }
          socket.write(Buffer.from([0x05, 0x00]));
          state = "request";
          continue;
        }

        if (pending.length < 4) {
          return;
        }
        const version = pending[0];
        const command = pending[1];
        const addressType = pending[3];
        if (version !== 0x05) {
          destroySocket();
          return;
        }
        if (command !== 0x01) {
          socket.write(buildSocksReply(0x07));
          destroySocket();
          return;
        }

        let offset = 4;
        let destinationHost = "";
        if (addressType === 0x01) {
          if (pending.length < offset + 4 + 2) {
            return;
          }
          destinationHost = `${pending[offset]}.${pending[offset + 1]}.${pending[offset + 2]}.${pending[offset + 3]}`;
          offset += 4;
        } else if (addressType === 0x03) {
          if (pending.length < offset + 1) {
            return;
          }
          const hostLength = pending[offset];
          if (pending.length < offset + 1 + hostLength + 2) {
            return;
          }
          destinationHost = pending.subarray(offset + 1, offset + 1 + hostLength).toString("utf-8");
          offset += 1 + hostLength;
        } else if (addressType === 0x04) {
          if (pending.length < offset + 16 + 2) {
            return;
          }
          destinationHost = parseIpv6Buffer(pending.subarray(offset, offset + 16));
          offset += 16;
        } else {
          socket.write(buildSocksReply(0x08));
          destroySocket();
          return;
        }
        const destinationPort = (pending[offset] << 8) + pending[offset + 1];
        offset += 2;
        pending = pending.subarray(offset);

        if (!destinationHost || destinationPort < 1 || destinationPort > 65535) {
          socket.write(buildSocksReply(0x04));
          destroySocket();
          return;
        }
        if (connection.closed || this.connections.get(tabId) !== connection) {
          socket.write(buildSocksReply(0x01));
          destroySocket();
          return;
        }

        const sourceHost = socket.localAddress ?? "127.0.0.1";
        const sourcePort = socket.localPort ?? 0;
        connection.client.forwardOut(
          sourceHost,
          sourcePort,
          destinationHost,
          destinationPort,
          (error, stream) => {
            if (error || !stream) {
              this.markPortForwardConnectionFailure(tabId, forwardId, error);
              socket.write(buildSocksReply(0x05));
              destroySocket();
              return;
            }
            this.markPortForwardConnectionSuccess(tabId, forwardId);
            remoteStream = stream;
            socket.write(buildSocksReply(0x00));
            if (pending.length > 0) {
              stream.write(pending);
              pending = Buffer.alloc(0);
            }
            state = "proxy";
            bridgeDuplexStreams(socket, stream);
          }
        );
        return;
      }
    };

    socket.on("data", onSocketData);
    socket.once("error", () => {
      closeRemote();
    });
    socket.once("close", () => {
      closeRemote();
    });
  }

  private async uploadLocalFileToRemotePath(
    tabId: string,
    transferId: string,
    normalizedLocalPath: string,
    remotePath: string
  ): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const safeTransferId = normalizeTransferId(transferId);
    const localStats = await statLocalFile(normalizedLocalPath);
    if (!localStats.isFile()) {
      throw new Error("Upload source must be a file.");
    }
    const fileName = posixPath.basename(remotePath) || basenamePath(normalizedLocalPath);
    if (!fileName) {
      throw new Error("Upload file name is invalid.");
    }
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
    if (this.consumePendingUploadCancel(transferKey, safeTransferId)) {
      activeTransfer.canceled = true;
    }
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
        isCanceled: () => activeTransfer.canceled,
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

  private async executeRemoteCommand(
    client: Client,
    command: string,
    timeoutMs: number
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let channelRef: ClientChannel | null = null;

      const finalize = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          clearTimeout(timer);
        }
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      };

      const timer = setTimeout(() => {
        channelRef?.close();
        finalize(new Error("Server monitor command timed out."));
      }, timeoutMs);

      client.exec(command, (error, channel) => {
        if (error) {
          finalize(error);
          return;
        }
        channelRef = channel;

        channel.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf-8");
        });
        channel.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf-8");
        });
        channel.once("error", (channelError: Error) => {
          finalize(channelError);
        });
        channel.once("close", (code: number | null) => {
          if (code && code !== 0) {
            const message = stderr.trim();
            finalize(new Error(message || `Remote command failed with code ${code}.`));
            return;
          }
          finalize();
        });
      });
    });
  }

  private getConnectedConnection(tabId: string): TerminalConnection {
    const connection = this.connections.get(tabId);
    if (!connection || connection.closed) {
      throw new Error("Terminal tab is not connected.");
    }
    return connection;
  }

  private getConnectedSsh2Connection(
    tabId: string,
    featureName = "SFTP"
  ): Ssh2TerminalConnection {
    const connection = this.getConnectedConnection(tabId);
    if (connection.mode !== "ssh2") {
      throw new Error(
        `${featureName} is unavailable in system ssh fallback mode. Reconnect when direct SSH is available.`
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

  private async deleteDirectoryRecursively(
    sftp: SFTPWrapper,
    directoryPath: string
  ): Promise<void> {
    const rows = await this.readDirectory(sftp, directoryPath);
    for (const row of rows) {
      const name = typeof row.filename === "string" ? row.filename.trim() : "";
      if (!name || name === "." || name === "..") {
        continue;
      }
      const childPath = posixPath.join(directoryPath, name);
      const kind = detectSftpEntryKind(row.attrs);
      if (kind === "directory") {
        await this.deleteDirectoryRecursively(sftp, childPath);
        continue;
      }
      await this.unlink(sftp, childPath);
    }
    await this.rmdir(sftp, directoryPath);
  }

  private async deleteDirectoryViaRemoteCommand(
    connection: Ssh2TerminalConnection,
    directoryPath: string
  ): Promise<void> {
    const command = buildDeleteDirectoryCommand(directoryPath);
    try {
      await this.executeRemoteCommand(
        connection.client,
        command,
        REMOTE_DELETE_DIRECTORY_TIMEOUT_MS
      );
      return;
    } catch (error) {
      if (!shouldFallbackToSftpDirectoryDelete(error)) {
        throw error;
      }
    }
    const sftp = await this.ensureSftp(connection);
    await this.deleteDirectoryRecursively(sftp, directoryPath);
  }

  private destroyStream(
    stream: NodeJS.ReadableStream | NodeJS.WritableStream | undefined,
    error?: Error
  ): void {
    if (!stream) {
      return;
    }
    const withEvents = stream as NodeJS.ReadableStream & {
      once?: (event: "error", listener: (caughtError: Error) => void) => void;
    };
    const destroyable = stream as NodeJS.ReadableStream & {
      destroy?: (reason?: Error) => void;
    };
    try {
      if (error) {
        // Keep a local error listener during destroy to avoid uncaught stream errors
        // when canceling both sides of a pipe nearly simultaneously.
        withEvents.once?.("error", () => {
          // Cancellation is expected.
        });
        destroyable.destroy?.(error);
        return;
      }
      destroyable.destroy?.();
    } catch {
      // Best effort cancellation.
    }
  }

  private async pipeWithProgress(options: {
    readStream: NodeJS.ReadableStream;
    writeStream: NodeJS.WritableStream;
    isCanceled?: () => boolean;
    onChunk: (chunkSize: number) => void;
  }): Promise<void> {
    const { readStream, writeStream, isCanceled, onChunk } = options;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const cancelPollTimer = setInterval(() => {
        if (!isCanceled?.()) {
          return;
        }
        this.cancelStreamPair(readStream, writeStream);
        close(new TransferCanceledError());
      }, 80);
      const close = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearInterval(cancelPollTimer);
        readStream.removeListener("data", onData);
        readStream.removeListener("error", onReadError);
        readStream.removeListener("close", onReadClose);
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
        if (isCanceled?.()) {
          this.cancelStreamPair(readStream, writeStream);
          close(new TransferCanceledError());
          return;
        }
        if (typeof chunk === "string") {
          onChunk(Buffer.byteLength(chunk));
          return;
        }
        onChunk(chunk.length);
      };
      const onReadError = (error: Error) => {
        close(error);
      };
      const onReadClose = () => {
        if (isCanceled?.()) {
          close(new TransferCanceledError());
        }
      };
      const onWriteError = (error: Error) => {
        close(error);
      };
      const onDone = () => {
        close();
      };

      readStream.on("data", onData);
      readStream.once("error", onReadError);
      readStream.once("close", onReadClose);
      writeStream.once("error", onWriteError);
      writeStream.once("finish", onDone);
      writeStream.once("close", onDone);
      if (isCanceled?.()) {
        this.cancelStreamPair(readStream, writeStream);
        close(new TransferCanceledError());
        return;
      }
      readStream.pipe(writeStream);
    });
  }

  private cancelStreamPair(readStream: NodeJS.ReadableStream, writeStream: NodeJS.WritableStream): void {
    const readable = readStream as NodeJS.ReadableStream & {
      unpipe?: (destination?: NodeJS.WritableStream) => void;
      pause?: () => void;
    };
    const writable = writeStream as NodeJS.WritableStream & {
      end?: () => void;
    };
    try {
      readable.unpipe?.(writeStream);
    } catch {
      // Best effort.
    }
    try {
      readable.pause?.();
    } catch {
      // Best effort.
    }
    try {
      writable.end?.();
    } catch {
      // Best effort.
    }
    const cancelError = new TransferCanceledError();
    this.destroyStream(readStream, cancelError);
    this.destroyStream(writeStream, cancelError);
  }

  private findActiveUploadTransferById(transferId: string): ActiveUploadTransfer | undefined {
    for (const transfer of this.activeUploadTransfers.values()) {
      if (transfer.transferId === transferId) {
        return transfer;
      }
    }
    return undefined;
  }

  private findActiveDownloadTransferById(transferId: string): ActiveDownloadTransfer | undefined {
    for (const transfer of this.activeDownloadTransfers.values()) {
      if (transfer.transferId === transferId) {
        return transfer;
      }
    }
    return undefined;
  }

  private consumePendingUploadCancel(transferKey: string, transferId: string): boolean {
    const byKey = this.pendingUploadCancelKeys.delete(transferKey);
    const byId = this.pendingUploadCancelIds.delete(transferId);
    return byKey || byId;
  }

  private consumePendingDownloadCancel(transferKey: string, transferId: string): boolean {
    const byKey = this.pendingDownloadCancelKeys.delete(transferKey);
    const byId = this.pendingDownloadCancelIds.delete(transferId);
    return byKey || byId;
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

type NormalizedCreatePortForwardInput =
  | {
      type: "local";
      bindHost: string;
      bindPort: number;
      targetHost: string;
      targetPort: number;
    }
  | {
      type: "remote";
      bindHost: string;
      bindPort: number;
      targetHost: string;
      targetPort: number;
    }
  | {
      type: "dynamic";
      bindHost: string;
      bindPort: number;
    };

function normalizePortForwardInput(input: CreatePortForwardInput): NormalizedCreatePortForwardInput {
  const type = normalizePortForwardType(input.type);
  const bindHostRaw = typeof input.bindHost === "string" ? input.bindHost.trim() : "";
  const bindHost = bindHostRaw || "127.0.0.1";
  const bindPort = normalizePortValue(input.bindPort, "Bind port");
  if (type === "dynamic") {
    return {
      type,
      bindHost,
      bindPort
    };
  }
  const targetHostRaw = typeof input.targetHost === "string" ? input.targetHost.trim() : "";
  if (!targetHostRaw) {
    throw new Error(`${type === "local" ? "Remote target host" : "Local target host"} is required.`);
  }
  const targetPort = normalizePortValue(
    input.targetPort,
    type === "local" ? "Remote target port" : "Local target port"
  );
  return {
    type,
    bindHost,
    bindPort,
    targetHost: targetHostRaw,
    targetPort
  };
}

function normalizePortForwardType(value: unknown): PortForwardType {
  if (value === "local" || value === "remote" || value === "dynamic") {
    return value;
  }
  throw new Error("Invalid port forwarding type.");
}

function normalizePortValue(value: unknown, label: string): number {
  const raw =
    typeof value === "string"
      ? Number.parseInt(value, 10)
      : typeof value === "number"
        ? Math.trunc(value)
        : Number.NaN;
  if (!Number.isFinite(raw) || raw < 1 || raw > 65535) {
    throw new Error(`${label} must be between 1 and 65535.`);
  }
  return raw;
}

function normalizePortForwardId(value: unknown): string {
  const safe = typeof value === "string" ? value.trim() : "";
  if (!safe) {
    throw new Error("Port forwarding id is required.");
  }
  return safe;
}

function createPortForwardId(prefix: "L" | "R" | "D"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createPortForwardEventId(): string {
  return `pfe-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function resolveListeningPort(server: NetServer, fallbackPort: number): number {
  const address = server.address();
  if (address && typeof address !== "string" && Number.isFinite(address.port)) {
    return Math.max(1, Math.trunc(address.port));
  }
  return fallbackPort;
}

async function listenTcpServer(server: NetServer, host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function closeTcpServer(server: NetServer): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function closeTcpServerNoWait(server: NetServer): void {
  if (!server.listening) {
    return;
  }
  try {
    server.close(() => {
      // Best-effort release.
    });
  } catch {
    // Best-effort release.
  }
}

async function forwardIn(client: Client, host: string, port: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    client.forwardIn(host, port, (error, realPort) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(typeof realPort === "number" ? realPort : port);
    });
  });
}

async function unforwardIn(client: Client, host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.unforwardIn(host, port, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function matchesRemoteForwardBinding(
  details: {
    destIP: string;
    destPort: number;
  },
  bindHost: string,
  bindPort: number
): boolean {
  if (details.destPort !== bindPort) {
    return false;
  }
  const normalizedBindHost = bindHost.trim().toLowerCase();
  if (
    !normalizedBindHost ||
    normalizedBindHost === "0.0.0.0" ||
    normalizedBindHost === "::" ||
    normalizedBindHost === "*"
  ) {
    return true;
  }
  return (details.destIP || "").trim().toLowerCase() === normalizedBindHost;
}

function safeEndSshChannel(channel: ClientChannel): void {
  try {
    channel.end();
  } catch {
    // Best effort.
  }
}

function bridgeDuplexStreams(socket: Socket, sshStream: ClientChannel): void {
  socket.pipe(sshStream).pipe(socket);
  socket.once("error", () => {
    safeEndSshChannel(sshStream);
  });
  socket.once("close", () => {
    safeEndSshChannel(sshStream);
  });
  sshStream.once("error", () => {
    socket.destroy();
  });
  sshStream.once("close", () => {
    socket.destroy();
  });
}

function buildSocksReply(replyCode: number): Buffer {
  return Buffer.from([0x05, replyCode & 0xff, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

function parseIpv6Buffer(input: Buffer): string {
  if (input.length !== 16) {
    return "::";
  }
  const groups: string[] = [];
  for (let index = 0; index < input.length; index += 2) {
    groups.push(input.readUInt16BE(index).toString(16));
  }
  return groups.join(":");
}

const SERVER_HEALTH_COMMAND = [
  "echo '__TD_HOST__'",
  "hostname 2>/dev/null || uname -n || echo unknown",
  "echo '__TD_UPTIME__'",
  "cat /proc/uptime 2>/dev/null || echo '0 0'",
  "echo '__TD_LOAD__'",
  "cat /proc/loadavg 2>/dev/null || echo '0 0 0'",
  "echo '__TD_MEM__'",
  "cat /proc/meminfo 2>/dev/null || echo ''",
  "echo '__TD_DISK__'",
  "df -B1 -P / 2>/dev/null || echo ''",
  "echo '__TD_CPU__'",
  "cat /proc/stat 2>/dev/null || echo ''",
  "echo '__TD_NET__'",
  "cat /proc/net/dev 2>/dev/null || echo ''",
  "echo '__TD_END__'"
].join("; ");

const SERVER_PROCESS_COMMAND = [
  "echo '__TD_PROC__'",
  "ps -eo pid,user,pcpu,pmem,comm --sort=-pcpu 2>/dev/null | sed -n '2,11p'",
  "echo '__TD_FAILED__'",
  "(command -v systemctl >/dev/null 2>&1 && systemctl --failed --no-legend --no-pager --plain 2>/dev/null | head -n 8) || true",
  "echo '__TD_END__'"
].join("; ");

const REMOTE_DELETE_DIRECTORY_TIMEOUT_MS = 30 * 60_000;

type ServerHealthSectionName =
  | "__TD_HOST__"
  | "__TD_UPTIME__"
  | "__TD_LOAD__"
  | "__TD_MEM__"
  | "__TD_DISK__"
  | "__TD_CPU__"
  | "__TD_NET__";

const SERVER_HEALTH_SECTION_NAMES: ServerHealthSectionName[] = [
  "__TD_HOST__",
  "__TD_UPTIME__",
  "__TD_LOAD__",
  "__TD_MEM__",
  "__TD_DISK__",
  "__TD_CPU__",
  "__TD_NET__"
];
const SERVER_HEALTH_SECTION_SET = new Set<string>(SERVER_HEALTH_SECTION_NAMES);

type ServerProcessSectionName = "__TD_PROC__" | "__TD_FAILED__";
const SERVER_PROCESS_SECTION_NAMES: ServerProcessSectionName[] = [
  "__TD_PROC__",
  "__TD_FAILED__"
];
const SERVER_PROCESS_SECTION_SET = new Set<string>(SERVER_PROCESS_SECTION_NAMES);

function parseServerHealthOutput(
  rawOutput: string
): Omit<ServerHealthSnapshot, "tabId" | "collectedAt"> {
  const sectionLines = new Map<ServerHealthSectionName, string[]>(
    SERVER_HEALTH_SECTION_NAMES.map((name) => [name, []])
  );
  let activeSection: ServerHealthSectionName | null = null;

  for (const rawLine of rawOutput.replaceAll("\r", "").split("\n")) {
    const line = rawLine.trimEnd();
    if (line === "__TD_END__") {
      break;
    }
    if (SERVER_HEALTH_SECTION_SET.has(line)) {
      activeSection = line as ServerHealthSectionName;
      continue;
    }
    if (!activeSection) {
      continue;
    }
    sectionLines.get(activeSection)?.push(line);
  }

  const host = getFirstNonEmptyLine(sectionLines.get("__TD_HOST__")) ?? "unknown";
  const uptimeParts = (getFirstNonEmptyLine(sectionLines.get("__TD_UPTIME__")) ?? "0").split(/\s+/);
  const uptimeSeconds = toSafeInteger(Number.parseFloat(uptimeParts[0] ?? "0"));

  const loadParts = (getFirstNonEmptyLine(sectionLines.get("__TD_LOAD__")) ?? "0 0 0")
    .trim()
    .split(/\s+/);
  const load1 = toSafeNumber(Number.parseFloat(loadParts[0] ?? "0"));
  const load5 = toSafeNumber(Number.parseFloat(loadParts[1] ?? "0"));
  const load15 = toSafeNumber(Number.parseFloat(loadParts[2] ?? "0"));

  const memory = parseMemInfoSection(sectionLines.get("__TD_MEM__") ?? []);
  const disk = parseDiskSection(sectionLines.get("__TD_DISK__") ?? []);
  const cpu = parseCpuSection(sectionLines.get("__TD_CPU__") ?? []);
  const network = parseNetworkSection(sectionLines.get("__TD_NET__") ?? []);

  return {
    hostname: host,
    uptimeSeconds,
    load1,
    load5,
    load15,
    memoryTotalBytes: memory.totalBytes,
    memoryUsedBytes: memory.usedBytes,
    diskPath: disk.path,
    diskTotalBytes: disk.totalBytes,
    diskUsedBytes: disk.usedBytes,
    diskAvailableBytes: disk.availableBytes,
    cpuTotalTicks: cpu.totalTicks,
    cpuIdleTicks: cpu.idleTicks,
    networkRxBytes: network.rxBytes,
    networkTxBytes: network.txBytes
  };
}

function parseServerProcessOutput(
  rawOutput: string
): Omit<ServerProcessSnapshot, "tabId" | "collectedAt"> {
  const sectionLines = new Map<ServerProcessSectionName, string[]>(
    SERVER_PROCESS_SECTION_NAMES.map((name) => [name, []])
  );
  let activeSection: ServerProcessSectionName | null = null;

  for (const rawLine of rawOutput.replaceAll("\r", "").split("\n")) {
    const line = rawLine.trimEnd();
    if (line === "__TD_END__") {
      break;
    }
    if (SERVER_PROCESS_SECTION_SET.has(line)) {
      activeSection = line as ServerProcessSectionName;
      continue;
    }
    if (!activeSection) {
      continue;
    }
    sectionLines.get(activeSection)?.push(line);
  }

  return {
    processes: parseProcessRows(sectionLines.get("__TD_PROC__") ?? []),
    failedServices: parseFailedServiceRows(sectionLines.get("__TD_FAILED__") ?? [])
  };
}

function parseProcessRows(lines: string[]): ServerProcessEntry[] {
  const result: ServerProcessEntry[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const fields = line.split(/\s+/);
    if (fields.length < 5) {
      continue;
    }
    const pid = Number.parseInt(fields[0], 10);
    const user = fields[1];
    const cpuPercent = Number.parseFloat(fields[2]);
    const memoryPercent = Number.parseFloat(fields[3]);
    const command = fields.slice(4).join(" ");
    if (!Number.isFinite(pid) || pid <= 0 || !command) {
      continue;
    }
    result.push({
      pid: Math.trunc(pid),
      user: user || "-",
      cpuPercent: Number.isFinite(cpuPercent) ? Math.max(0, cpuPercent) : 0,
      memoryPercent: Number.isFinite(memoryPercent) ? Math.max(0, memoryPercent) : 0,
      command
    });
  }
  return result.slice(0, 8);
}

function parseFailedServiceRows(lines: string[]): string[] {
  const result: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const name = line.split(/\s+/)[0];
    if (!name || !name.includes(".")) {
      continue;
    }
    if (!result.includes(name)) {
      result.push(name);
    }
  }
  return result.slice(0, 8);
}

function parseMemInfoSection(lines: string[]): {
  totalBytes: number;
  usedBytes: number;
} {
  let totalKb = 0;
  let availableKb = 0;
  let freeKb = 0;
  let bufferKb = 0;
  let cachedKb = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Za-z()]+):\s+(\d+)/);
    if (!match) {
      continue;
    }
    const value = toSafeInteger(Number.parseInt(match[2], 10));
    switch (match[1]) {
      case "MemTotal":
        totalKb = value;
        break;
      case "MemAvailable":
        availableKb = value;
        break;
      case "MemFree":
        freeKb = value;
        break;
      case "Buffers":
        bufferKb = value;
        break;
      case "Cached":
        cachedKb = value;
        break;
      default:
        break;
    }
  }
  if (availableKb <= 0) {
    availableKb = freeKb + bufferKb + cachedKb;
  }
  const totalBytes = toSafeInteger(totalKb * 1024);
  const availableBytes = toSafeInteger(availableKb * 1024);
  const usedBytes = Math.max(0, totalBytes - availableBytes);
  return {
    totalBytes,
    usedBytes
  };
}

function parseDiskSection(lines: string[]): {
  path: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
} {
  const dataLine = lines.find((line) =>
    /^\S+\s+\d+\s+\d+\s+\d+\s+\d+%\s+\S+/.test(line.trim())
  );
  if (!dataLine) {
    return {
      path: "/",
      totalBytes: 0,
      usedBytes: 0,
      availableBytes: 0
    };
  }
  const tokens = dataLine.trim().split(/\s+/);
  return {
    path: tokens[tokens.length - 1] || "/",
    totalBytes: toSafeInteger(Number.parseInt(tokens[1] ?? "0", 10)),
    usedBytes: toSafeInteger(Number.parseInt(tokens[2] ?? "0", 10)),
    availableBytes: toSafeInteger(Number.parseInt(tokens[3] ?? "0", 10))
  };
}

function parseCpuSection(lines: string[]): {
  totalTicks: number;
  idleTicks: number;
} {
  const cpuLine = lines.find((line) => line.trimStart().startsWith("cpu "));
  if (!cpuLine) {
    return {
      totalTicks: 0,
      idleTicks: 0
    };
  }
  const fields = cpuLine
    .trim()
    .split(/\s+/)
    .slice(1)
    .map((part) => toSafeInteger(Number.parseInt(part, 10)));
  const totalTicks = fields.reduce((sum, value) => sum + value, 0);
  const idleTicks = (fields[3] ?? 0) + (fields[4] ?? 0);
  return {
    totalTicks: toSafeInteger(totalTicks),
    idleTicks: toSafeInteger(idleTicks)
  };
}

function parseNetworkSection(lines: string[]): {
  rxBytes: number;
  txBytes: number;
} {
  let rxBytes = 0;
  let txBytes = 0;
  let loopbackRxBytes = 0;
  let loopbackTxBytes = 0;
  let nonLoopbackCount = 0;

  for (const rawLine of lines) {
    if (!rawLine.includes(":")) {
      continue;
    }
    const [interfaceNameRaw, payloadRaw] = rawLine.split(":");
    if (!payloadRaw) {
      continue;
    }
    const interfaceName = interfaceNameRaw.trim();
    const values = payloadRaw.trim().split(/\s+/);
    if (values.length < 9) {
      continue;
    }
    const lineRxBytes = toSafeInteger(Number.parseInt(values[0] ?? "0", 10));
    const lineTxBytes = toSafeInteger(Number.parseInt(values[8] ?? "0", 10));
    if (interfaceName === "lo") {
      loopbackRxBytes += lineRxBytes;
      loopbackTxBytes += lineTxBytes;
      continue;
    }
    nonLoopbackCount += 1;
    rxBytes += lineRxBytes;
    txBytes += lineTxBytes;
  }

  if (nonLoopbackCount === 0) {
    rxBytes = loopbackRxBytes;
    txBytes = loopbackTxBytes;
  }
  return {
    rxBytes: toSafeInteger(rxBytes),
    txBytes: toSafeInteger(txBytes)
  };
}

function getFirstNonEmptyLine(lines: string[] | undefined): string | null {
  if (!lines || lines.length === 0) {
    return null;
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function toSafeNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function toSafeInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.trunc(value);
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

function toDeletePathErrorMessage(targetPath: string, kind: SftpEntryKind, error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : String(error ?? "").trim();
  const subject = kind === "directory" ? "directory" : "path";
  if (!message || /^failure\.?$/i.test(message)) {
    return `Failed to delete ${subject} "${targetPath}". Server returned a generic failure (possible permissions, lock, or unsupported entry type).`;
  }
  return `Failed to delete ${subject} "${targetPath}": ${message}`;
}

function toPortForwardRuntimeErrorMessage(error: unknown): string {
  const rawMessage =
    error instanceof Error
      ? error.message.trim()
      : typeof error === "string"
        ? error.trim()
        : String(error ?? "").trim();
  if (!rawMessage) {
    return "";
  }
  if (/EADDRINUSE|address already in use/i.test(rawMessage)) {
    return "Listen address already in use.";
  }
  if (/EACCES|EPERM|permission denied/i.test(rawMessage)) {
    return "Permission denied for listen/target endpoint.";
  }
  if (/ENOTFOUND|getaddrinfo/i.test(rawMessage)) {
    return "Target host could not be resolved.";
  }
  if (/ECONNREFUSED|connection refused/i.test(rawMessage)) {
    return "Target refused the forwarded connection.";
  }
  if (/ETIMEDOUT|timed out/i.test(rawMessage)) {
    return "Target connection timed out.";
  }
  if (/administratively prohibited|open failed/i.test(rawMessage)) {
    return "SSH server rejected the forwarded channel.";
  }
  return rawMessage;
}

function assertPathIsSafeForDelete(targetPath: string): void {
  const trimmed = targetPath.trim();
  if (!trimmed) {
    throw new Error("Delete path is required.");
  }
  if (trimmed === "." || trimmed === "..") {
    throw new Error("Refusing to delete current or parent directory.");
  }
}

function buildDeleteDirectoryCommand(directoryPath: string): string {
  return `rm -rf -- ${toPosixShellSingleQuoted(directoryPath)}`;
}

function toPosixShellSingleQuoted(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function shouldFallbackToSftpDirectoryDelete(error: unknown): boolean {
  const message = (error as Error)?.message?.toLowerCase?.() ?? String(error ?? "").toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("unknown command") ||
    message.includes("not recognized")
  );
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
