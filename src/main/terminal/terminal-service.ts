import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import { once } from "node:events";
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
import { finished } from "node:stream/promises";

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
import { formatSshConnectionError } from "../../shared/ssh-error-diagnostics.js";
import type {
  PrivilegedUploadSaveResult,
  RemotePathWriteAccess,
  SftpDirectoryListResult,
  SftpEntry,
  SftpEntryKind,
  SftpTransferDirection,
  SftpTransferEvent,
  SftpTransferRunOptions,
  StagePrivilegedUploadResult
} from "../../shared/sftp.js";
import {
  buildPrivilegedInstallCommand,
  buildPrivilegedStagingRelativePath,
  isPrivilegedSystemRemotePath,
  REMOTE_PRIVILEGED_STAGING_DIRECTORY
} from "../../shared/sftp.js";
import {
  canWriteWithIdentity,
  computeEffectiveWritable,
  formatModeOctal,
  isDirectoryMode,
  type RemoteIdentity
} from "../../shared/remote-write-access.js";
import type {
  CreatePortForwardInput,
  PortForwardEventRecord,
  PortForwardRecord,
  PortForwardStatus,
  PortForwardType,
  ServerFailedServiceEntry,
  ServerFilesystemUsage,
  ServerHealthSnapshot,
  ServerNetworkInterfaceUsage,
  ServerProcessEntry,
  ServerProcessSnapshot,
  TerminalEvent
} from "../../shared/terminal.js";
import type { CredentialStore } from "../security/credential-store.js";
import type { DualWriteSessionStore } from "../storage/dual-write-session-store.js";
import type { SessionStore } from "../storage/session-store.js";
import {
  shouldReportTransferProgress,
  TRANSFER_PROGRESS_REPORT_BYTES,
  TRANSFER_PROGRESS_REPORT_INTERVAL_MS
} from "./transfer-progress.js";

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
  sftp?: SFTPWrapper;
  readStream?: NodeJS.ReadableStream;
  writeStream?: NodeJS.WritableStream;
}

interface ActiveDownloadTransfer {
  tabId: string;
  transferId: string;
  localPath: string;
  canceled: boolean;
  sftp?: SFTPWrapper;
  readStream?: NodeJS.ReadableStream;
  writeStream?: NodeJS.WritableStream;
}

interface ReusableUploadSftpEntry {
  tabId: string;
  sftp: SFTPWrapper;
  releasedAt: number;
}

interface ReusableDownloadSftpEntry {
  tabId: string;
  sftp: SFTPWrapper;
  releasedAt: number;
}

const MAX_IDLE_REUSABLE_UPLOAD_SFTP_PER_TAB = 8;
// The renderer exposes up to 32 transfer threads. Keep the channel gate in
// sync so a user-selected value above 2 can take effect; renderer-side
// backpressure handling reduces concurrency when a server rejects channels.
const MAX_IN_FLIGHT_UPLOAD_SFTP_PER_TAB = 32;
const MAX_IDLE_REUSABLE_DOWNLOAD_SFTP_PER_TAB = 8;
const MAX_IN_FLIGHT_DOWNLOAD_SFTP_PER_TAB = 32;
const REUSABLE_SFTP_IDLE_TTL_MS = 45_000;

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

export interface RemotePathMetadata {
  exists: boolean;
  size: number | null;
  modifiedTimeMs: number | null;
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

class DeleteCanceledError extends Error {
  constructor() {
    super("Delete canceled.");
    this.name = "DeleteCanceledError";
  }
}

interface ActiveDeleteOperation {
  tabId: string;
  targetPath: string;
  canceled: boolean;
  channelRef: ClientChannel | null;
}

export class TerminalService {
  private readonly connections = new Map<string, TerminalConnection>();
  private readonly activePortForwardsByTab = new Map<string, Map<string, ActivePortForward>>();
  private readonly portForwardEventsByTab = new Map<string, PortForwardEventRecord[]>();
  private readonly portForwardConnectionCounters = new Map<string, number>();
  private readonly activeUploadTransfers = new Map<string, ActiveUploadTransfer>();
  private readonly activeDownloadTransfers = new Map<string, ActiveDownloadTransfer>();
  private readonly activeDeletes = new Map<string, ActiveDeleteOperation>();
  private readonly pendingDeleteCancelKeys = new Set<string>();
  private readonly reusableUploadSftpByTab = new Map<string, ReusableUploadSftpEntry[]>();
  private readonly reusableUploadSftpExpiryTimersByTab = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly reservedUploadSftpSlotsByTab = new Map<string, number>();
  private readonly uploadSftpSlotWaitersByTab = new Map<string, Set<() => void>>();
  private readonly reusableDownloadSftpByTab = new Map<string, ReusableDownloadSftpEntry[]>();
  private readonly reusableDownloadSftpExpiryTimersByTab = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly reservedDownloadSftpSlotsByTab = new Map<string, number>();
  private readonly downloadSftpSlotWaitersByTab = new Map<string, Set<() => void>>();
  private readonly pendingUploadCancelKeys = new Set<string>();
  private readonly pendingUploadCancelIds = new Set<string>();
  private readonly pendingDownloadCancelKeys = new Set<string>();
  private readonly pendingDownloadCancelIds = new Set<string>();
  private readonly remoteIdentityByTab = new Map<string, RemoteIdentity>();
  private readonly remoteHomeByTab = new Map<string, string>();

  constructor(
    private readonly sessionStore: SessionStore | DualWriteSessionStore,
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
              message: formatSshConnectionError(error)
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
        message: formatSshConnectionError(error)
      });
    });

    client.on("close", () => {
      if (this.connections.get(tabId) !== connection) {
        return;
      }
      this.closeAllPortForwardsSync(tabId, connection);
      this.clearReusableUploadSftp(tabId);
      this.clearReusableDownloadSftp(tabId);
      this.clearSftpSlotState(tabId);
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
    this.clearReusableUploadSftp(connection.tabId);
    this.clearReusableDownloadSftp(connection.tabId);
    this.clearSftpSlotState(connection.tabId);
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
        message: formatSshConnectionError(error)
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
        message: formatSshConnectionError(error)
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
    this.clearSftpSlotState(tabId);
    if (!connection) {
      return;
    }

    this.connections.delete(tabId);
    this.remoteIdentityByTab.delete(tabId);
    this.remoteHomeByTab.delete(tabId);
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
      this.clearReusableUploadSftp(connection.tabId);
      this.clearReusableDownloadSftp(connection.tabId);
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
    this.appendPortForwardEvent(created, "created", "info", "Port forward created.", {
      targetEndpoint: toPortForwardTargetEndpoint(created)
    });
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
    this.appendPortForwardEvent(activeForward, "removed", "info", "Port forward removed.", {
      targetEndpoint: toPortForwardTargetEndpoint(activeForward)
    });
    this.portForwardConnectionCounters.delete(activeForward.id);
    await this.stopPortForward(activeForward);
  }

  async listDirectory(tabId: string, targetPath?: string): Promise<SftpDirectoryListResult> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const lookupPath = await this.resolveRemoteLookupPath(connection, targetPath);
    let cwd: string;
    try {
      cwd = await this.realPath(sftp, lookupPath);
    } catch (error) {
      const message = error instanceof Error ? error.message.trim() : String(error ?? "");
      if (/no such file/i.test(message)) {
        throw new Error(
          `Remote path not found: ${lookupPath}. Use an absolute path (for example /home/user) or ~ for home.`
        );
      }
      throw error;
    }
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
    const deleteKey = toTransferKey(tabId, normalizedTargetPath);
    const activeDelete: ActiveDeleteOperation = {
      tabId,
      targetPath: normalizedTargetPath,
      canceled: false,
      channelRef: null
    };
    this.activeDeletes.set(deleteKey, activeDelete);
    if (this.pendingDeleteCancelKeys.has(deleteKey)) {
      this.pendingDeleteCancelKeys.delete(deleteKey);
      activeDelete.canceled = true;
    }
    const isCanceled = () => activeDelete.canceled;
    try {
      if (activeDelete.canceled) {
        throw new DeleteCanceledError();
      }
      if (kind === "directory") {
        await this.deleteDirectoryViaRemoteCommand(
          connection,
          normalizedTargetPath,
          activeDelete,
          isCanceled
        );
        return;
      }
      const sftp = await this.ensureSftp(connection);
      if (activeDelete.canceled) {
        throw new DeleteCanceledError();
      }
      await this.unlink(sftp, normalizedTargetPath);
    } catch (error) {
      if (error instanceof DeleteCanceledError || activeDelete.canceled) {
        throw new DeleteCanceledError();
      }
      throw new Error(toDeletePathErrorMessage(normalizedTargetPath, kind, error));
    } finally {
      this.activeDeletes.delete(deleteKey);
    }
  }

  async cancelDeletePath(tabId: string, targetPath: string): Promise<boolean> {
    const normalizedTargetPath = normalizeRemotePath(targetPath);
    const deleteKey = toTransferKey(tabId, normalizedTargetPath);
    const activeDelete = this.activeDeletes.get(deleteKey);
    if (!activeDelete) {
      this.pendingDeleteCancelKeys.add(deleteKey);
      return false;
    }
    activeDelete.canceled = true;
    try {
      activeDelete.channelRef?.close();
    } catch {
      // Best effort cancel.
    }
    return true;
  }

  async uploadFile(
    tabId: string,
    transferId: string,
    localPath: string,
    remoteDirectory: string,
    options?: SftpTransferRunOptions
  ): Promise<void> {
    const normalizedLocalPath = normalizeLocalPath(localPath, "Local upload file path");
    const normalizedRemoteDirectory = normalizeRemotePath(remoteDirectory);
    const fileName = basenamePath(normalizedLocalPath);
    if (!fileName) {
      throw new Error("Upload file name is invalid.");
    }
    const remotePath = posixPath.join(normalizedRemoteDirectory, fileName);
    await this.uploadLocalFileToRemotePath(
      tabId,
      transferId,
      normalizedLocalPath,
      remotePath,
      options
    );
  }

  async uploadFileToPath(
    tabId: string,
    transferId: string,
    localPath: string,
    remotePath: string,
    options?: SftpTransferRunOptions
  ): Promise<void> {
    const normalizedLocalPath = normalizeLocalPath(localPath, "Local upload file path");
    const normalizedRemotePath = normalizeRemotePath(remotePath);
    assertPathIsNotRoot(normalizedRemotePath);
    await this.uploadLocalFileToRemotePath(
      tabId,
      transferId,
      normalizedLocalPath,
      normalizedRemotePath,
      options
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
    this.notifySftpSlotWaiters(this.uploadSftpSlotWaitersByTab, transfer.tabId);
    if (transfer.sftp) {
      safeEndSftp(transfer.sftp);
      return true;
    }
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
    this.notifySftpSlotWaiters(this.downloadSftpSlotWaitersByTab, transfer.tabId);
    if (transfer.sftp) {
      safeEndSftp(transfer.sftp);
      return true;
    }
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
    localPath: string,
    options?: SftpTransferRunOptions
  ): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const safeTransferId = normalizeTransferId(transferId);
    const normalizedRemotePath = normalizeRemotePath(remotePath);
    const normalizedLocalPath = normalizeLocalPath(localPath, "Local download path");
    const fileName = posixPath.basename(normalizedRemotePath);
    if (!fileName) {
      throw new Error("Remote file path is invalid.");
    }
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
    let totalBytes = 0;
    let downloadSftp: SFTPWrapper | undefined;
    let reusableDownloadSftp = false;
    const rateLimitBytesPerSecond = normalizeSftpTransferRateLimitBytesPerSecond(
      options?.rateLimitBytesPerSecond
    );
    try {
      const releaseDownloadSlot = await this.reserveDownloadSftpSlot(tabId, () => activeTransfer.canceled);
      try {
        if (activeTransfer.canceled) {
          throw new TransferCanceledError();
        }
        downloadSftp = this.acquireReusableDownloadSftp(connection);
        reusableDownloadSftp = Boolean(downloadSftp);
        if (!downloadSftp) {
          downloadSftp = await this.openSftpChannel(connection);
        }
        activeTransfer.sftp = downloadSftp;
      } finally {
        releaseDownloadSlot();
      }
      const statSftp = downloadSftp;
      const remoteStats = await this.statRemote(statSftp, normalizedRemotePath);
      if (((remoteStats.mode ?? 0) & 0o170000) === 0o040000) {
        throw new Error("Downloading directories is not supported yet.");
      }
      totalBytes =
        typeof remoteStats.size === "number" && remoteStats.size > 0
          ? remoteStats.size
          : 0;

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

      let lastReportedBytes = -1;
      let lastReportedAt = 0;
      const reportProgress = (force = false) => {
        const now = Date.now();
        if (
          !shouldReportTransferProgress(
            {
              lastReportedBytes,
              lastReportedAt
            },
            transferredBytes,
            totalBytes || transferredBytes,
            now,
            force
          )
        ) {
          return;
        }
        lastReportedBytes = transferredBytes;
        lastReportedAt = now;
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

      reportProgress(true);
      if (activeTransfer.canceled) {
        throw new TransferCanceledError();
      }

      if (rateLimitBytesPerSecond) {
        const sftp = statSftp;
        const readStream = sftp.createReadStream(normalizedRemotePath, {
          highWaterMark: 64 * 1024
        });
        const writeStream = createWriteStream(normalizedLocalPath, { highWaterMark: 64 * 1024 });
        activeTransfer.readStream = readStream;
        activeTransfer.writeStream = writeStream;
        await this.pipeWithProgress({
          readStream,
          writeStream,
          isCanceled: () => activeTransfer.canceled,
          onChunk: (chunkSize) => {
            transferredBytes += chunkSize;
            reportProgress();
          },
          rateLimitBytesPerSecond
        });
      } else {
        const activeSftp = statSftp;
        if (activeTransfer.canceled) {
          throw new TransferCanceledError();
        }
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          let cancelRequested = false;
          const requestCancel = () => {
            if (cancelRequested) {
              return;
            }
            cancelRequested = true;
            safeEndSftp(activeSftp);
          };
          const finalize = (error?: Error) => {
            if (settled) {
              return;
            }
            settled = true;
            clearInterval(cancelPollTimer);
            if (error) {
              reject(error);
              return;
            }
            resolve();
          };
          const cancelPollTimer = setInterval(() => {
            if (!activeTransfer.canceled) {
              return;
            }
            requestCancel();
          }, 80);
          activeSftp.fastGet(
            normalizedRemotePath,
            normalizedLocalPath,
            {
              fileSize: totalBytes,
              step: (totalTransferred) => {
                transferredBytes = Math.max(transferredBytes, totalTransferred);
                reportProgress();
                if (activeTransfer.canceled) {
                  requestCancel();
                }
              }
            },
            (error) => {
              if (activeTransfer.canceled) {
                finalize(new TransferCanceledError());
                return;
              }
              if (error) {
                finalize(error);
                return;
              }
              finalize();
            }
          );
        });
      }
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
      if (rateLimitBytesPerSecond === undefined) {
        this.releaseReusableDownloadSftp(connection, downloadSftp);
        reusableDownloadSftp = false;
        downloadSftp = undefined;
      }
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
      if (shouldResetCachedSftp(error)) {
        if (connection.sftp === downloadSftp) {
          connection.sftp = undefined;
        }
        reusableDownloadSftp = false;
        try {
          downloadSftp?.end();
        } catch {
          // Ignore cleanup failure for an already-broken channel.
        }
        downloadSftp = undefined;
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
      activeTransfer.readStream = undefined;
      activeTransfer.writeStream = undefined;
      activeTransfer.sftp = undefined;
      if (!reusableDownloadSftp) {
        safeEndSftp(downloadSftp);
      }
      this.activeDownloadTransfers.delete(transferKey);
      this.notifySftpSlotWaiters(this.downloadSftpSlotWaitersByTab, tabId);
    }
  }

  async getRemotePathMetadata(tabId: string, remotePath: string): Promise<RemotePathMetadata> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const normalizedRemotePath = normalizeRemotePath(remotePath);
    try {
      const remoteStats = await this.statRemote(sftp, normalizedRemotePath);
      const size =
        typeof remoteStats.size === "number" && Number.isFinite(remoteStats.size)
          ? Math.max(0, remoteStats.size)
          : null;
      const modifiedTimeMs =
        typeof remoteStats.mtime === "number" && Number.isFinite(remoteStats.mtime)
          ? Math.max(0, Math.trunc(remoteStats.mtime * 1000))
          : null;
      return {
        exists: true,
        size,
        modifiedTimeMs
      };
    } catch (error) {
      if (isSftpNotFoundError(error)) {
        return {
          exists: false,
          size: null,
          modifiedTimeMs: null
        };
      }
      throw error;
    }
  }

  async getRemotePathWriteAccess(tabId: string, remotePath: string): Promise<RemotePathWriteAccess> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const sftp = await this.ensureSftp(connection);
    const normalizedRemotePath = normalizeRemotePath(remotePath);
    const identity = await this.getRemoteIdentity(connection);
    const privileged = isPrivilegedSystemRemotePath(normalizedRemotePath);

    let exists = false;
    let isDirectory = false;
    let pathWritable: boolean | null = null;
    let modeOctal: string | null = null;
    let uid: number | null = null;
    let gid: number | null = null;
    let parentPath: string | null = dirnamePosix(normalizedRemotePath);

    try {
      const stats = await this.statRemote(sftp, normalizedRemotePath);
      exists = true;
      isDirectory = isDirectoryMode(stats.mode ?? 0);
      modeOctal = formatModeOctal(stats.mode);
      uid = typeof stats.uid === "number" ? stats.uid : null;
      gid = typeof stats.gid === "number" ? stats.gid : null;
      pathWritable =
        typeof stats.uid === "number" && typeof stats.gid === "number" && typeof stats.mode === "number"
          ? canWriteWithIdentity(
              { mode: stats.mode, uid: stats.uid, gid: stats.gid },
              identity
            )
          : null;
      if (!isDirectory) {
        parentPath = dirnamePosix(normalizedRemotePath);
      }
    } catch (error) {
      if (!isSftpNotFoundError(error)) {
        throw error;
      }
      parentPath = dirnamePosix(normalizedRemotePath);
    }

    let parentWritable: boolean | null = null;
    if (!isDirectory || !exists) {
      try {
        const parentStats = await this.statRemote(sftp, parentPath || ".");
        parentWritable =
          typeof parentStats.uid === "number" &&
          typeof parentStats.gid === "number" &&
          typeof parentStats.mode === "number"
            ? canWriteWithIdentity(
                { mode: parentStats.mode, uid: parentStats.uid, gid: parentStats.gid },
                identity
              ) && (parentStats.mode & 0o100) !== 0
            : null;
      } catch {
        parentWritable = null;
      }
    } else if (isDirectory && exists) {
      // Directory upload target: execute bit also required to create entries.
      parentWritable = null;
      if (pathWritable === true && typeof modeOctal === "string") {
        const modeValue = Number.parseInt(modeOctal, 8);
        if (Number.isFinite(modeValue) && (modeValue & 0o100) === 0) {
          pathWritable = false;
        }
      }
    }

    const effectiveWritable = computeEffectiveWritable({
      exists,
      isDirectory: exists ? isDirectory : false,
      pathWritable,
      parentWritable
    });

    return {
      path: normalizedRemotePath,
      exists,
      isDirectory: exists ? isDirectory : false,
      isPrivilegedSystemPath: privileged,
      fileWritable: pathWritable,
      parentWritable,
      effectiveWritable,
      modeOctal,
      uid,
      gid
    };
  }

  async stagePrivilegedUpload(
    tabId: string,
    localPath: string,
    intendedRemotePath: string,
    relativeStagingPath?: string
  ): Promise<StagePrivilegedUploadResult> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const normalizedLocalPath = normalizeLocalPath(localPath, "Local upload file path");
    const normalizedIntendedPath = normalizeRemotePath(intendedRemotePath);
    assertPathIsNotRoot(normalizedIntendedPath);

    const home = await this.getRemoteHomeDirectory(connection);
    const relativePath = buildPrivilegedStagingRelativePath(
      normalizedIntendedPath,
      relativeStagingPath
    );
    const stagedRemotePath = posixPath.join(home, REMOTE_PRIVILEGED_STAGING_DIRECTORY, relativePath);
    const stagedParent = posixPath.dirname(stagedRemotePath);
    await this.ensureRemoteDirectoryTree(connection, stagedParent);

    let modeOctal = "644";
    try {
      const access = await this.getRemotePathWriteAccess(tabId, normalizedIntendedPath);
      if (access.modeOctal && access.exists && !access.isDirectory) {
        modeOctal = access.modeOctal.slice(-3);
      }
    } catch {
      // Keep default mode when intended path cannot be probed.
    }

    const transferId = `stage-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    await this.uploadFileToPath(tabId, transferId, normalizedLocalPath, stagedRemotePath);

    return {
      stagedRemotePath,
      intendedRemotePath: normalizedIntendedPath,
      suggestedTerminalCommand: buildPrivilegedInstallCommand(
        stagedRemotePath,
        normalizedIntendedPath,
        modeOctal
      ),
      modeOctal
    };
  }

  async tryPrivilegedUploadSave(
    tabId: string,
    localPath: string,
    intendedRemotePath: string,
    relativeStagingPath?: string
  ): Promise<PrivilegedUploadSaveResult> {
    const staged = await this.stagePrivilegedUpload(
      tabId,
      localPath,
      intendedRemotePath,
      relativeStagingPath
    );
    const connection = this.getConnectedSsh2Connection(tabId);
    const command = `sudo -n install -m ${staged.modeOctal} ${shellSingleQuote(staged.stagedRemotePath)} ${shellSingleQuote(staged.intendedRemotePath)}`;
    try {
      await this.executeRemoteCommand(connection.client, command, 15_000);
      await this.cleanupPrivilegedStagingFile(tabId, staged.stagedRemotePath);
      return {
        success: true,
        stagedRemotePath: staged.stagedRemotePath,
        intendedRemotePath: staged.intendedRemotePath,
        suggestedTerminalCommand: staged.suggestedTerminalCommand
      };
    } catch (error) {
      return {
        success: false,
        stagedRemotePath: staged.stagedRemotePath,
        intendedRemotePath: staged.intendedRemotePath,
        suggestedTerminalCommand: staged.suggestedTerminalCommand,
        message:
          (error as Error).message?.trim() ||
          "Passwordless sudo is unavailable. Run the suggested install command in the terminal."
      };
    }
  }

  async cleanupPrivilegedStagingFile(tabId: string, stagedRemotePath: string): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const normalized = normalizeRemotePath(stagedRemotePath);
    if (!normalized || normalized === "/" || normalized === ".") {
      return;
    }
    const home = await this.getRemoteHomeDirectory(connection);
    const stagingRoot = posixPath.join(home, REMOTE_PRIVILEGED_STAGING_DIRECTORY);
    const isUnderStaging =
      normalized === stagingRoot ||
      normalized.startsWith(`${stagingRoot}/`) ||
      normalized.includes(`/${REMOTE_PRIVILEGED_STAGING_DIRECTORY}/`);
    if (!isUnderStaging) {
      throw new Error("Refusing to delete a path outside the TermDock staging directory.");
    }
    const sftp = await this.ensureSftp(connection);
    await this.unlinkIgnoreMissing(sftp, normalized);
    // Best-effort: remove empty parent directories under staging (never remove staging root).
    let parent = posixPath.dirname(normalized);
    while (parent.startsWith(`${stagingRoot}/`) && parent !== stagingRoot) {
      try {
        const rows = await this.readDirectory(sftp, parent);
        const remaining = rows.filter((row) => row.filename !== "." && row.filename !== "..");
        if (remaining.length > 0) {
          break;
        }
        await new Promise<void>((resolve, reject) => {
          sftp.rmdir(parent, (error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      } catch {
        break;
      }
      parent = posixPath.dirname(parent);
    }
  }

  async resolveRemoteStagingRoot(tabId: string): Promise<string> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const home = await this.getRemoteHomeDirectory(connection);
    return posixPath.join(home, REMOTE_PRIVILEGED_STAGING_DIRECTORY);
  }

  private async resolveRemoteLookupPath(
    connection: Ssh2TerminalConnection,
    targetPath?: string
  ): Promise<string> {
    const normalized = normalizeRemotePath(targetPath);
    if (normalized === "~") {
      return this.getRemoteHomeDirectory(connection);
    }
    if (normalized.startsWith("~/")) {
      const home = await this.getRemoteHomeDirectory(connection);
      const suffix = normalized.slice(2).replace(/^\/+/, "");
      return suffix ? posixPath.join(home, suffix) : home;
    }
    return normalized;
  }

  private async getRemoteIdentity(connection: Ssh2TerminalConnection): Promise<RemoteIdentity> {
    const cached = this.remoteIdentityByTab.get(connection.tabId);
    if (cached) {
      return cached;
    }
    const raw = await this.executeRemoteCommand(connection.client, "id -u; id -G", 8_000);
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const uid = Number.parseInt(lines[0] ?? "", 10);
    const gids = (lines[1] ?? "")
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));
    if (!Number.isFinite(uid)) {
      throw new Error("Unable to resolve remote user identity for write-access checks.");
    }
    const identity: RemoteIdentity = {
      uid,
      gids: gids.length > 0 ? gids : [uid]
    };
    this.remoteIdentityByTab.set(connection.tabId, identity);
    return identity;
  }

  private async getRemoteHomeDirectory(connection: Ssh2TerminalConnection): Promise<string> {
    const cached = this.remoteHomeByTab.get(connection.tabId);
    if (cached) {
      return cached;
    }
    const sftp = await this.ensureSftp(connection);
    let home = "";
    try {
      const printed = (
        await this.executeRemoteCommand(connection.client, 'printf %s "$HOME"', 8_000)
      ).trim();
      if (printed.startsWith("/")) {
        home = printed;
      }
    } catch {
      // Fall through.
    }
    if (!home) {
      try {
        home = await this.realPath(sftp, ".");
      } catch {
        home = "";
      }
    }
    if (!home || home === "/") {
      try {
        const whoami = (await this.executeRemoteCommand(connection.client, "whoami", 5_000)).trim();
        if (whoami) {
          home = `/home/${whoami}`;
        }
      } catch {
        home = "";
      }
    }
    if (!home) {
      throw new Error("Unable to resolve remote home directory.");
    }
    this.remoteHomeByTab.set(connection.tabId, home);
    return home;
  }

  private async ensureRemoteDirectoryTree(
    connection: Ssh2TerminalConnection,
    remoteDirectory: string
  ): Promise<void> {
    const normalized = normalizeRemotePath(remoteDirectory);
    if (!normalized || normalized === "." || normalized === "/") {
      return;
    }
    const sftp = await this.ensureSftp(connection);
    const isAbsolute = normalized.startsWith("/");
    const segments = normalized.split("/").filter(Boolean);
    let currentPath = isAbsolute ? "/" : ".";
    for (const segment of segments) {
      currentPath = posixPath.join(currentPath, segment);
      await this.mkdir(sftp, currentPath);
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
    message: string,
    context?: {
      connectionId?: string;
      sourceEndpoint?: string;
      targetEndpoint?: string;
      errorCode?: string;
    }
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
      createdAt: new Date().toISOString(),
      correlationKey: createPortForwardCorrelationKey(
        forward.type,
        forward.bindHost,
        forward.bindPort
      ),
      connectionId: context?.connectionId,
      sourceEndpoint: context?.sourceEndpoint,
      targetEndpoint: context?.targetEndpoint,
      errorCode: context?.errorCode
    };
    const existing = this.portForwardEventsByTab.get(forward.tabId) ?? [];
    existing.unshift(entry);
    if (existing.length > 200) {
      existing.length = 200;
    }
    this.portForwardEventsByTab.set(forward.tabId, existing);
  }

  private markPortForwardConnectionSuccess(
    tabId: string,
    forwardId: string,
    context?: {
      connectionId?: string;
      sourceEndpoint?: string;
      targetEndpoint?: string;
    }
  ): void {
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
        "Port forward recovered and is accepting connections.",
        context
      );
    }
  }

  private markPortForwardConnectionFailure(
    tabId: string,
    forwardId: string,
    error?: unknown,
    context?: {
      connectionId?: string;
      sourceEndpoint?: string;
      targetEndpoint?: string;
    }
  ): void {
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
        message || "Port forward failed to proxy a connection.",
        {
          ...context,
          errorCode: toPortForwardErrorCode(error)
        }
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

  private nextPortForwardConnectionId(forwardId: string): string {
    const next = (this.portForwardConnectionCounters.get(forwardId) ?? 0) + 1;
    this.portForwardConnectionCounters.set(forwardId, next);
    return `${forwardId}#${next}`;
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
      const connectionId = this.nextPortForwardConnectionId(forwardId);
      const sourceHost = localSocket.remoteAddress ?? input.bindHost;
      const sourcePort = localSocket.remotePort ?? 0;
      const sourceEndpoint = toEndpointLabel(sourceHost, sourcePort);
      const targetEndpoint = toEndpointLabel(input.targetHost, input.targetPort);
      connection.client.forwardOut(
        sourceHost,
        sourcePort,
        input.targetHost,
        input.targetPort,
        (error, sshStream) => {
          if (error || !sshStream) {
            this.markPortForwardConnectionFailure(tabId, forwardId, error, {
              connectionId,
              sourceEndpoint,
              targetEndpoint
            });
            localSocket.destroy(error ?? new Error("Port forward channel rejected."));
            return;
          }
          this.markPortForwardConnectionSuccess(tabId, forwardId, {
            connectionId,
            sourceEndpoint,
            targetEndpoint
          });
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
      const connectionId = this.nextPortForwardConnectionId(forwardId);
      const sourceEndpoint = toEndpointLabel(details.srcIP, details.srcPort);
      const targetEndpoint = toEndpointLabel(input.targetHost, input.targetPort);
      let sshStream: ClientChannel;
      try {
        sshStream = accept();
      } catch {
        this.markPortForwardConnectionFailure(
          tabId,
          forwardId,
          new Error("Remote forward channel rejected."),
          {
            connectionId,
            sourceEndpoint,
            targetEndpoint
          }
        );
        reject();
        return;
      }
      const localSocket = createConnection({
        host: input.targetHost,
        port: input.targetPort
      });
      localSocket.once("connect", () => {
        this.markPortForwardConnectionSuccess(tabId, forwardId, {
          connectionId,
          sourceEndpoint,
          targetEndpoint
        });
        bridgeDuplexStreams(localSocket, sshStream);
      });
      localSocket.once("error", (error) => {
        this.markPortForwardConnectionFailure(tabId, forwardId, error, {
          connectionId,
          sourceEndpoint,
          targetEndpoint
        });
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
        "Port forward stopped because terminal tab disconnected or closed.",
        {
          targetEndpoint: toPortForwardTargetEndpoint(forward)
        }
      );
      this.portForwardConnectionCounters.delete(forward.id);
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

        const connectionId = this.nextPortForwardConnectionId(forwardId);
        const sourceEndpoint = toEndpointLabel(
          socket.remoteAddress ?? socket.localAddress ?? "127.0.0.1",
          socket.remotePort ?? socket.localPort ?? 0
        );
        const targetEndpoint = toEndpointLabel(destinationHost, destinationPort);
        const sourceHost = socket.localAddress ?? "127.0.0.1";
        const sourcePort = socket.localPort ?? 0;
        connection.client.forwardOut(
          sourceHost,
          sourcePort,
          destinationHost,
          destinationPort,
          (error, stream) => {
            if (error || !stream) {
              this.markPortForwardConnectionFailure(tabId, forwardId, error, {
                connectionId,
                sourceEndpoint,
                targetEndpoint
              });
              socket.write(buildSocksReply(0x05));
              destroySocket();
              return;
            }
            this.markPortForwardConnectionSuccess(tabId, forwardId, {
              connectionId,
              sourceEndpoint,
              targetEndpoint
            });
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
    remotePath: string,
    options?: SftpTransferRunOptions
  ): Promise<void> {
    const connection = this.getConnectedSsh2Connection(tabId);
    const safeTransferId = normalizeTransferId(transferId);
    const rateLimitBytesPerSecond = normalizeSftpTransferRateLimitBytesPerSecond(
      options?.rateLimitBytesPerSecond
    );
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
    let uploadSftp: SFTPWrapper | undefined;
    let reusableUploadSftp = false;

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

      let lastReportedBytes = -1;
      let lastReportedAt = 0;
      const reportProgress = (force = false) => {
        const now = Date.now();
        const bytesDelta = transferredBytes - lastReportedBytes;
        const timeDelta = now - lastReportedAt;
        if (
          !force &&
          lastReportedBytes >= 0 &&
          transferredBytes < totalBytes &&
          bytesDelta < TRANSFER_PROGRESS_REPORT_BYTES &&
          timeDelta < TRANSFER_PROGRESS_REPORT_INTERVAL_MS
        ) {
          return;
        }
        lastReportedBytes = transferredBytes;
        lastReportedAt = now;
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

      reportProgress(true);
      const releaseUploadSlot = await this.reserveUploadSftpSlot(tabId, () => activeTransfer.canceled);
      try {
        if (activeTransfer.canceled) {
          throw new TransferCanceledError();
        }
        uploadSftp = this.acquireReusableUploadSftp(connection);
        reusableUploadSftp = Boolean(uploadSftp);
        if (!uploadSftp) {
          uploadSftp = await this.openSftpChannel(connection);
        }
        activeTransfer.sftp = uploadSftp;
      } finally {
        releaseUploadSlot();
      }
      const activeSftp = uploadSftp;
      if (activeTransfer.canceled) {
        throw new TransferCanceledError();
      }

      if (rateLimitBytesPerSecond) {
        const readStream = createReadStream(normalizedLocalPath, { highWaterMark: 64 * 1024 });
        const writeStream = activeSftp.createWriteStream(remotePath, { highWaterMark: 64 * 1024 });
        activeTransfer.readStream = readStream;
        activeTransfer.writeStream = writeStream;
        await this.pipeWithProgress({
          readStream,
          writeStream,
          isCanceled: () => activeTransfer.canceled,
          onChunk: (chunkSize) => {
            transferredBytes += chunkSize;
            reportProgress();
          },
          rateLimitBytesPerSecond
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          let cancelRequested = false;
          const requestCancel = () => {
            if (cancelRequested) {
              return;
            }
            cancelRequested = true;
            safeEndSftp(activeSftp);
          };
          const finalize = (error?: Error) => {
            if (settled) {
              return;
            }
            settled = true;
            clearInterval(cancelPollTimer);
            if (error) {
              reject(error);
              return;
            }
            resolve();
          };
          const cancelPollTimer = setInterval(() => {
            if (!activeTransfer.canceled) {
              return;
            }
            requestCancel();
          }, 80);
          activeSftp.fastPut(
            normalizedLocalPath,
            remotePath,
            {
              fileSize: totalBytes,
              step: (totalTransferred) => {
                transferredBytes = Math.max(transferredBytes, totalTransferred);
                reportProgress();
                if (activeTransfer.canceled) {
                  requestCancel();
                }
              }
            },
            (error) => {
              if (activeTransfer.canceled) {
                finalize(new TransferCanceledError());
                return;
              }
              if (error) {
                finalize(error);
                return;
              }
              finalize();
            }
          );
        });
      }
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
      if (rateLimitBytesPerSecond === undefined) {
        this.releaseReusableUploadSftp(connection, uploadSftp);
        reusableUploadSftp = false;
        uploadSftp = undefined;
      }
    } catch (error) {
      if (activeTransfer.canceled || error instanceof TransferCanceledError) {
        const cleanupSftp =
          connection.sftp ??
          (connection.closed
            ? undefined
            : await this.ensureSftp(connection).catch(() => undefined));
        if (cleanupSftp) {
          await this.unlinkIgnoreMissing(cleanupSftp, remotePath);
        }
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
      if (shouldResetCachedSftp(error)) {
        this.resetCachedSftp(connection);
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
      activeTransfer.readStream = undefined;
      activeTransfer.writeStream = undefined;
      activeTransfer.sftp = undefined;
      if (!reusableUploadSftp) {
        safeEndSftp(uploadSftp);
      }
      this.activeUploadTransfers.delete(transferKey);
      this.notifySftpSlotWaiters(this.uploadSftpSlotWaitersByTab, tabId);
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

    const sftp = await this.openSftpChannel(connection);
    connection.sftp = sftp;
    const clearCachedSftp = () => {
      if (connection.sftp === sftp) {
        connection.sftp = undefined;
      }
    };
    sftp.once("close", clearCachedSftp);
    sftp.once("end", clearCachedSftp);
    sftp.once("error", clearCachedSftp);
    return sftp;
  }

  private async openSftpChannel(connection: Ssh2TerminalConnection): Promise<SFTPWrapper> {
    return new Promise<SFTPWrapper>((resolve, reject) => {
      connection.client.sftp((error, nextSftp) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(nextSftp);
      });
    });
  }

  private resetCachedSftp(connection: Ssh2TerminalConnection): void {
    const cachedSftp = connection.sftp;
    connection.sftp = undefined;
    safeEndSftp(cachedSftp);
  }

  private countInFlightUploadSftp(tabId: string): number {
    let count = 0;
    for (const transfer of this.activeUploadTransfers.values()) {
      if (transfer.tabId === tabId && transfer.sftp) {
        count += 1;
      }
    }
    return count + (this.reservedUploadSftpSlotsByTab.get(tabId) ?? 0);
  }

  private async reserveUploadSftpSlot(
    tabId: string,
    isCanceled: () => boolean
  ): Promise<() => void> {
    while (this.countInFlightUploadSftp(tabId) >= MAX_IN_FLIGHT_UPLOAD_SFTP_PER_TAB) {
      if (isCanceled()) {
        throw new TransferCanceledError();
      }
      await this.waitForSftpSlot(this.uploadSftpSlotWaitersByTab, tabId);
    }
    if (isCanceled()) {
      throw new TransferCanceledError();
    }
    this.reservedUploadSftpSlotsByTab.set(
      tabId,
      (this.reservedUploadSftpSlotsByTab.get(tabId) ?? 0) + 1
    );
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const next = (this.reservedUploadSftpSlotsByTab.get(tabId) ?? 1) - 1;
      if (next <= 0) {
        this.reservedUploadSftpSlotsByTab.delete(tabId);
      } else {
        this.reservedUploadSftpSlotsByTab.set(tabId, next);
      }
      this.notifySftpSlotWaiters(this.uploadSftpSlotWaitersByTab, tabId);
    };
  }

  private acquireReusableUploadSftp(connection: Ssh2TerminalConnection): SFTPWrapper | undefined {
    return this.acquireReusableSftp(
      connection,
      this.reusableUploadSftpByTab,
      this.reusableUploadSftpExpiryTimersByTab
    );
  }

  private releaseReusableUploadSftp(
    connection: Ssh2TerminalConnection,
    sftp: SFTPWrapper | undefined
  ): void {
    if (!sftp) {
      return;
    }
    if (connection.closed || this.connections.get(connection.tabId) !== connection) {
      safeEndSftp(sftp);
      return;
    }
    this.releaseReusableSftp(
      connection,
      sftp,
      this.reusableUploadSftpByTab,
      this.reusableUploadSftpExpiryTimersByTab,
      MAX_IDLE_REUSABLE_UPLOAD_SFTP_PER_TAB
    );
  }

  private clearReusableUploadSftp(tabId: string): void {
    this.clearReusableSftp(
      tabId,
      this.reusableUploadSftpByTab,
      this.reusableUploadSftpExpiryTimersByTab
    );
  }

  private countInFlightDownloadSftp(tabId: string): number {
    let count = 0;
    for (const transfer of this.activeDownloadTransfers.values()) {
      if (transfer.tabId === tabId && transfer.sftp) {
        count += 1;
      }
    }
    return count + (this.reservedDownloadSftpSlotsByTab.get(tabId) ?? 0);
  }

  private async reserveDownloadSftpSlot(
    tabId: string,
    isCanceled: () => boolean
  ): Promise<() => void> {
    while (this.countInFlightDownloadSftp(tabId) >= MAX_IN_FLIGHT_DOWNLOAD_SFTP_PER_TAB) {
      if (isCanceled()) {
        throw new TransferCanceledError();
      }
      await this.waitForSftpSlot(this.downloadSftpSlotWaitersByTab, tabId);
    }
    if (isCanceled()) {
      throw new TransferCanceledError();
    }
    this.reservedDownloadSftpSlotsByTab.set(
      tabId,
      (this.reservedDownloadSftpSlotsByTab.get(tabId) ?? 0) + 1
    );
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const next = (this.reservedDownloadSftpSlotsByTab.get(tabId) ?? 1) - 1;
      if (next <= 0) {
        this.reservedDownloadSftpSlotsByTab.delete(tabId);
      } else {
        this.reservedDownloadSftpSlotsByTab.set(tabId, next);
      }
      this.notifySftpSlotWaiters(this.downloadSftpSlotWaitersByTab, tabId);
    };
  }

  private waitForSftpSlot(waitersByTab: Map<string, Set<() => void>>, tabId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const waiters = waitersByTab.get(tabId) ?? new Set<() => void>();
      waiters.add(resolve);
      waitersByTab.set(tabId, waiters);
    });
  }

  private notifySftpSlotWaiters(waitersByTab: Map<string, Set<() => void>>, tabId: string): void {
    const waiters = waitersByTab.get(tabId);
    if (!waiters || waiters.size === 0) {
      return;
    }
    waitersByTab.delete(tabId);
    for (const resolve of waiters) {
      resolve();
    }
  }

  private clearSftpSlotState(tabId: string): void {
    this.reservedUploadSftpSlotsByTab.delete(tabId);
    this.reservedDownloadSftpSlotsByTab.delete(tabId);
    this.notifySftpSlotWaiters(this.uploadSftpSlotWaitersByTab, tabId);
    this.notifySftpSlotWaiters(this.downloadSftpSlotWaitersByTab, tabId);
  }

  private acquireReusableDownloadSftp(connection: Ssh2TerminalConnection): SFTPWrapper | undefined {
    return this.acquireReusableSftp(
      connection,
      this.reusableDownloadSftpByTab,
      this.reusableDownloadSftpExpiryTimersByTab
    );
  }

  private releaseReusableDownloadSftp(
    connection: Ssh2TerminalConnection,
    sftp: SFTPWrapper | undefined
  ): void {
    if (!sftp) {
      return;
    }
    if (connection.closed || this.connections.get(connection.tabId) !== connection) {
      safeEndSftp(sftp);
      return;
    }
    this.releaseReusableSftp(
      connection,
      sftp,
      this.reusableDownloadSftpByTab,
      this.reusableDownloadSftpExpiryTimersByTab,
      MAX_IDLE_REUSABLE_DOWNLOAD_SFTP_PER_TAB
    );
  }

  private clearReusableDownloadSftp(tabId: string): void {
    this.clearReusableSftp(
      tabId,
      this.reusableDownloadSftpByTab,
      this.reusableDownloadSftpExpiryTimersByTab
    );
  }

  private acquireReusableSftp(
    connection: Ssh2TerminalConnection,
    poolByTab: Map<string, ReusableUploadSftpEntry[]>,
    expiryTimersByTab: Map<string, ReturnType<typeof setTimeout>>
  ): SFTPWrapper | undefined {
    const pool = poolByTab.get(connection.tabId);
    if (!pool || pool.length === 0) {
      return undefined;
    }
    const now = Date.now();
    while (pool.length > 0) {
      const next = pool.pop();
      if (!next) {
        break;
      }
      if (connection.closed || now - next.releasedAt >= REUSABLE_SFTP_IDLE_TTL_MS) {
        safeEndSftp(next.sftp);
        continue;
      }
      if (pool.length === 0) {
        poolByTab.delete(connection.tabId);
        this.clearReusableSftpExpiryTimer(connection.tabId, expiryTimersByTab);
      }
      return next.sftp;
    }
    poolByTab.delete(connection.tabId);
    this.clearReusableSftpExpiryTimer(connection.tabId, expiryTimersByTab);
    return undefined;
  }

  private releaseReusableSftp(
    connection: Ssh2TerminalConnection,
    sftp: SFTPWrapper,
    poolByTab: Map<string, ReusableUploadSftpEntry[]>,
    expiryTimersByTab: Map<string, ReturnType<typeof setTimeout>>,
    maxIdleEntries: number
  ): void {
    const pool = poolByTab.get(connection.tabId) ?? [];
    if (!poolByTab.has(connection.tabId)) {
      poolByTab.set(connection.tabId, pool);
    }
    pool.push({
      tabId: connection.tabId,
      sftp,
      releasedAt: Date.now()
    });
    while (pool.length > maxIdleEntries) {
      const staleEntry = pool.shift();
      safeEndSftp(staleEntry?.sftp);
    }
    this.scheduleReusableSftpExpiry(connection.tabId, poolByTab, expiryTimersByTab);
  }

  private clearReusableSftp(
    tabId: string,
    poolByTab: Map<string, ReusableUploadSftpEntry[]>,
    expiryTimersByTab: Map<string, ReturnType<typeof setTimeout>>
  ): void {
    this.clearReusableSftpExpiryTimer(tabId, expiryTimersByTab);
    const pool = poolByTab.get(tabId);
    if (!pool) {
      return;
    }
    poolByTab.delete(tabId);
    for (const entry of pool) {
      safeEndSftp(entry.sftp);
    }
  }

  private scheduleReusableSftpExpiry(
    tabId: string,
    poolByTab: Map<string, ReusableUploadSftpEntry[]>,
    expiryTimersByTab: Map<string, ReturnType<typeof setTimeout>>
  ): void {
    this.clearReusableSftpExpiryTimer(tabId, expiryTimersByTab);
    const pool = poolByTab.get(tabId);
    if (!pool || pool.length === 0) {
      return;
    }
    const nextExpiryAt = Math.min(...pool.map((entry) => entry.releasedAt + REUSABLE_SFTP_IDLE_TTL_MS));
    const timer = setTimeout(() => {
      expiryTimersByTab.delete(tabId);
      const activePool = poolByTab.get(tabId);
      if (!activePool) {
        return;
      }
      const now = Date.now();
      const freshEntries = activePool.filter((entry) => {
        const isFresh = now - entry.releasedAt < REUSABLE_SFTP_IDLE_TTL_MS;
        if (!isFresh) {
          safeEndSftp(entry.sftp);
        }
        return isFresh;
      });
      if (freshEntries.length === 0) {
        poolByTab.delete(tabId);
        return;
      }
      poolByTab.set(tabId, freshEntries);
      this.scheduleReusableSftpExpiry(tabId, poolByTab, expiryTimersByTab);
    }, Math.max(1, nextExpiryAt - Date.now()));
    expiryTimersByTab.set(tabId, timer);
  }

  private clearReusableSftpExpiryTimer(
    tabId: string,
    expiryTimersByTab: Map<string, ReturnType<typeof setTimeout>>
  ): void {
    const timer = expiryTimersByTab.get(tabId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    expiryTimersByTab.delete(tabId);
  }

  private async executeRemoteCommand(
    client: Client,
    command: string,
    timeoutMs: number,
    options?: {
      isCanceled?: () => boolean;
      onChannel?: (channel: ClientChannel) => void;
    }
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
        if (cancelPollTimer) {
          clearInterval(cancelPollTimer);
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

      const cancelPollTimer = options?.isCanceled
        ? setInterval(() => {
            if (!options.isCanceled?.()) {
              return;
            }
            channelRef?.close();
            finalize(new DeleteCanceledError());
          }, 80)
        : null;

      client.exec(command, (error, channel) => {
        if (error) {
          finalize(error);
          return;
        }
        channelRef = channel;
        options?.onChannel?.(channel);

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
          if (options?.isCanceled?.()) {
            finalize(new DeleteCanceledError());
            return;
          }
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
    if (await this.pathExistsAsDirectory(sftp, targetPath)) {
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir(targetPath, (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    } catch (error) {
      const code = (error as { code?: number | string }).code;
      const exists = await this.pathExistsAsDirectory(sftp, targetPath);
      if (exists) {
        return;
      }
      const errorMessage =
        typeof (error as Error)?.message === "string" ? (error as Error).message : String(error);
      if (code === 4 || code === "4" || /failure/i.test(errorMessage)) {
        throw new Error(
          `Failed to create directory "${targetPath}". Check permissions, parent path, or existing file conflicts.`
        );
      }
      throw error;
    }
  }

  private async pathExistsAsDirectory(sftp: SFTPWrapper, targetPath: string): Promise<boolean> {
    try {
      const stats = await new Promise<Attributes>((resolve, reject) => {
        sftp.stat(targetPath, (error, nextStats) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(nextStats);
        });
      });
      return (stats.mode & 0o040000) === 0o040000;
    } catch {
      return false;
    }
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
    directoryPath: string,
    isCanceled?: () => boolean
  ): Promise<void> {
    if (isCanceled?.()) {
      throw new DeleteCanceledError();
    }
    const rows = await this.readDirectory(sftp, directoryPath);
    for (const row of rows) {
      if (isCanceled?.()) {
        throw new DeleteCanceledError();
      }
      const name = typeof row.filename === "string" ? row.filename.trim() : "";
      if (!name || name === "." || name === "..") {
        continue;
      }
      const childPath = posixPath.join(directoryPath, name);
      const kind = detectSftpEntryKind(row.attrs);
      if (kind === "directory") {
        await this.deleteDirectoryRecursively(sftp, childPath, isCanceled);
        continue;
      }
      await this.unlink(sftp, childPath);
    }
    if (isCanceled?.()) {
      throw new DeleteCanceledError();
    }
    await this.rmdir(sftp, directoryPath);
  }

  private async deleteDirectoryViaRemoteCommand(
    connection: Ssh2TerminalConnection,
    directoryPath: string,
    activeDelete?: ActiveDeleteOperation,
    isCanceled?: () => boolean
  ): Promise<void> {
    const command = buildDeleteDirectoryCommand(directoryPath);
    try {
      await this.executeRemoteCommand(
        connection.client,
        command,
        REMOTE_DELETE_DIRECTORY_TIMEOUT_MS,
        {
          isCanceled,
          onChannel: (channel) => {
            if (activeDelete) {
              activeDelete.channelRef = channel;
            }
          }
        }
      );
      return;
    } catch (error) {
      if (error instanceof DeleteCanceledError || isCanceled?.()) {
        throw new DeleteCanceledError();
      }
      if (!shouldFallbackToSftpDirectoryDelete(error)) {
        throw error;
      }
    }
    const sftp = await this.ensureSftp(connection);
    await this.deleteDirectoryRecursively(sftp, directoryPath, isCanceled);
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
    rateLimitBytesPerSecond?: number;
  }): Promise<void> {
    const { readStream, writeStream, isCanceled, onChunk, rateLimitBytesPerSecond } = options;
    const writable = writeStream as NodeJS.WritableStream & {
      write: (chunk: Buffer | string) => boolean;
      end: () => void;
    };
    const rateLimiter = createTransferRateLimiter(rateLimitBytesPerSecond);
    const cancelPollTimer = setInterval(() => {
      if (!isCanceled?.()) {
        return;
      }
      this.cancelStreamPair(readStream, writeStream);
    }, 80);

    try {
      for await (const chunk of readStream as AsyncIterable<Buffer | string>) {
        if (isCanceled?.()) {
          throw new TransferCanceledError();
        }
        const chunkSize = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
        if (!writable.write(chunk)) {
          await once(writeStream as NodeJS.WritableStream, "drain");
        }
        onChunk(chunkSize);
        await rateLimiter(chunkSize);
      }
      if (isCanceled?.()) {
        throw new TransferCanceledError();
      }
      writable.end();
      await finished(writeStream as NodeJS.WritableStream);
    } catch (error) {
      this.cancelStreamPair(readStream, writeStream);
      throw error;
    } finally {
      clearInterval(cancelPollTimer);
    }
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

function toEndpointLabel(host: string, port: number): string {
  const safeHost = host.trim() || "-";
  const safePort =
    Number.isFinite(port) && port > 0 ? Math.max(1, Math.trunc(port)).toString() : "-";
  return `${safeHost}:${safePort}`;
}

function toPortForwardTargetEndpoint(forward: ActivePortForward): string | undefined {
  if (forward.type === "dynamic") {
    return undefined;
  }
  return toEndpointLabel(forward.targetHost, forward.targetPort);
}

function createPortForwardCorrelationKey(
  forwardType: PortForwardType,
  bindHost: string,
  bindPort: number
): string {
  const typeCode = forwardType === "local" ? "L" : forwardType === "remote" ? "R" : "D";
  return `${typeCode}|${bindHost.trim()}:${Math.max(1, Math.trunc(bindPort))}`;
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

function safeEndSftp(sftp?: SFTPWrapper): void {
  if (!sftp) {
    return;
  }
  try {
    sftp.end();
  } catch {
    // Best effort.
  }
}

function normalizeSftpTransferRateLimitBytesPerSecond(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  if (normalized <= 0) {
    return undefined;
  }
  return Math.max(1024, normalized);
}

function createTransferRateLimiter(
  rateLimitBytesPerSecond?: number
): (chunkSize: number) => Promise<void> {
  const normalizedRate = normalizeSftpTransferRateLimitBytesPerSecond(rateLimitBytesPerSecond);
  if (!normalizedRate) {
    return async () => undefined;
  }
  const startedAt = Date.now();
  let transferredBytes = 0;
  return async (chunkSize: number) => {
    if (chunkSize <= 0) {
      return;
    }
    transferredBytes += chunkSize;
    const expectedElapsedMs = (transferredBytes / normalizedRate) * 1000;
    const actualElapsedMs = Date.now() - startedAt;
    const delayMs = Math.floor(expectedElapsedMs - actualElapsedMs);
    if (delayMs <= 4) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  };
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
  "echo '__TD_OS__'",
  "(test -r /etc/os-release && . /etc/os-release && printf '%s\\n' \"${PRETTY_NAME:-${NAME:-unknown}}\") || uname -s 2>/dev/null || echo unknown",
  "uname -s 2>/dev/null || echo unknown",
  "uname -r 2>/dev/null || echo unknown",
  "uname -m 2>/dev/null || echo unknown",
  "echo '__TD_UPTIME__'",
  "cat /proc/uptime 2>/dev/null || echo '0 0'",
  "echo '__TD_LOAD__'",
  "cat /proc/loadavg 2>/dev/null || echo '0 0 0'",
  "echo '__TD_MEM__'",
  "cat /proc/meminfo 2>/dev/null || echo ''",
  "echo '__TD_CPUINFO__'",
  "(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo 2>/dev/null || echo 0)",
  "echo '__TD_DISK__'",
  "df -B1 -PT 2>/dev/null || df -B1 -P 2>/dev/null || echo ''",
  "echo '__TD_INODE__'",
  "df -Pi 2>/dev/null || echo ''",
  "echo '__TD_CPU__'",
  "cat /proc/stat 2>/dev/null || echo ''",
  "echo '__TD_NET__'",
  "cat /proc/net/dev 2>/dev/null || echo ''",
  "echo '__TD_END__'"
].join("; ");

const SERVER_PROCESS_COMMAND = [
  "echo '__TD_PROC__'",
  "ps -eo pid,user,pcpu,pmem,args --sort=-pcpu 2>/dev/null | sed -n '2,11p'",
  "echo '__TD_MEMPROC__'",
  "ps -eo pid,user,pcpu,pmem,args --sort=-pmem 2>/dev/null | sed -n '2,11p'",
  "echo '__TD_FAILED__'",
  "(command -v systemctl >/dev/null 2>&1 && systemctl --failed --no-legend --no-pager --plain 2>/dev/null | head -n 8) || true",
  "echo '__TD_END__'"
].join("; ");

const REMOTE_DELETE_DIRECTORY_TIMEOUT_MS = 30 * 60_000;

type ServerHealthSectionName =
  | "__TD_HOST__"
  | "__TD_OS__"
  | "__TD_UPTIME__"
  | "__TD_LOAD__"
  | "__TD_MEM__"
  | "__TD_CPUINFO__"
  | "__TD_DISK__"
  | "__TD_INODE__"
  | "__TD_CPU__"
  | "__TD_NET__";

const SERVER_HEALTH_SECTION_NAMES: ServerHealthSectionName[] = [
  "__TD_HOST__",
  "__TD_OS__",
  "__TD_UPTIME__",
  "__TD_LOAD__",
  "__TD_MEM__",
  "__TD_CPUINFO__",
  "__TD_DISK__",
  "__TD_INODE__",
  "__TD_CPU__",
  "__TD_NET__"
];
const SERVER_HEALTH_SECTION_SET = new Set<string>(SERVER_HEALTH_SECTION_NAMES);

type ServerProcessSectionName = "__TD_PROC__" | "__TD_MEMPROC__" | "__TD_FAILED__";
const SERVER_PROCESS_SECTION_NAMES: ServerProcessSectionName[] = [
  "__TD_PROC__",
  "__TD_MEMPROC__",
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
  const osLines = getNonEmptyLines(sectionLines.get("__TD_OS__"));
  const osName = osLines[0] ?? "unknown";
  const kernelName = osLines[1] ?? "";
  const kernelRelease = osLines[2] ?? "";
  const architecture = osLines[3] ?? "";
  const uptimeParts = (getFirstNonEmptyLine(sectionLines.get("__TD_UPTIME__")) ?? "0").split(/\s+/);
  const uptimeSeconds = toSafeInteger(Number.parseFloat(uptimeParts[0] ?? "0"));

  const loadParts = (getFirstNonEmptyLine(sectionLines.get("__TD_LOAD__")) ?? "0 0 0")
    .trim()
    .split(/\s+/);
  const load1 = toSafeNumber(Number.parseFloat(loadParts[0] ?? "0"));
  const load5 = toSafeNumber(Number.parseFloat(loadParts[1] ?? "0"));
  const load15 = toSafeNumber(Number.parseFloat(loadParts[2] ?? "0"));

  const memory = parseMemInfoSection(sectionLines.get("__TD_MEM__") ?? []);
  const filesystems = parseDiskSections(
    sectionLines.get("__TD_DISK__") ?? [],
    sectionLines.get("__TD_INODE__") ?? []
  );
  const disk = filesystems.find((entry) => entry.path === "/") ?? filesystems[0] ?? createEmptyFilesystemUsage();
  const cpu = parseCpuSection(sectionLines.get("__TD_CPU__") ?? []);
  const cpuInfoCoreCount = toSafeInteger(
    Number.parseInt(getFirstNonEmptyLine(sectionLines.get("__TD_CPUINFO__")) ?? "0", 10)
  );
  const network = parseNetworkSection(sectionLines.get("__TD_NET__") ?? []);

  return {
    hostname: host,
    osName,
    kernelName,
    kernelRelease,
    architecture,
    cpuCoreCount: cpuInfoCoreCount || cpu.coreCount,
    uptimeSeconds,
    load1,
    load5,
    load15,
    memoryTotalBytes: memory.totalBytes,
    memoryUsedBytes: memory.usedBytes,
    memoryAvailableBytes: memory.availableBytes,
    memoryFreeBytes: memory.freeBytes,
    memoryBufferBytes: memory.bufferBytes,
    memoryCachedBytes: memory.cachedBytes,
    swapTotalBytes: memory.swapTotalBytes,
    swapUsedBytes: memory.swapUsedBytes,
    swapFreeBytes: memory.swapFreeBytes,
    diskPath: disk.path,
    diskTotalBytes: disk.totalBytes,
    diskUsedBytes: disk.usedBytes,
    diskAvailableBytes: disk.availableBytes,
    filesystems,
    cpuTotalTicks: cpu.totalTicks,
    cpuIdleTicks: cpu.idleTicks,
    networkRxBytes: network.rxBytes,
    networkTxBytes: network.txBytes,
    networkInterfaces: network.interfaces
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
    memoryProcesses: parseProcessRows(sectionLines.get("__TD_MEMPROC__") ?? []),
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

function parseFailedServiceRows(lines: string[]): ServerFailedServiceEntry[] {
  const result: ServerFailedServiceEntry[] = [];
  const seen = new Set<string>();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const fields = line.split(/\s+/);
    const name = fields[0] ?? "";
    if (!name || !name.includes(".") || seen.has(name)) {
      continue;
    }
    seen.add(name);
    result.push({
      name,
      loadState: fields[1],
      activeState: fields[2],
      subState: fields[3],
      description: fields.slice(4).join(" ") || undefined
    });
  }
  return result.slice(0, 8);
}

function parseMemInfoSection(lines: string[]): {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  freeBytes: number;
  bufferBytes: number;
  cachedBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  swapFreeBytes: number;
} {
  let totalKb = 0;
  let availableKb = 0;
  let freeKb = 0;
  let bufferKb = 0;
  let cachedKb = 0;
  let swapTotalKb = 0;
  let swapFreeKb = 0;
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
      case "SwapTotal":
        swapTotalKb = value;
        break;
      case "SwapFree":
        swapFreeKb = value;
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
  const swapTotalBytes = toSafeInteger(swapTotalKb * 1024);
  const swapFreeBytes = toSafeInteger(swapFreeKb * 1024);
  return {
    totalBytes,
    usedBytes,
    availableBytes,
    freeBytes: toSafeInteger(freeKb * 1024),
    bufferBytes: toSafeInteger(bufferKb * 1024),
    cachedBytes: toSafeInteger(cachedKb * 1024),
    swapTotalBytes,
    swapUsedBytes: Math.max(0, swapTotalBytes - swapFreeBytes),
    swapFreeBytes
  };
}

function parseDiskSections(diskLines: string[], inodeLines: string[]): ServerFilesystemUsage[] {
  const inodePercentByPath = new Map<string, number>();
  for (const rawLine of inodeLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("Filesystem")) {
      continue;
    }
    const tokens = line.split(/\s+/);
    if (tokens.length < 6) {
      continue;
    }
    const path = tokens[tokens.length - 1] || "/";
    inodePercentByPath.set(path, parsePercentToken(tokens[tokens.length - 2]));
  }

  const result: ServerFilesystemUsage[] = [];
  for (const rawLine of diskLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("Filesystem")) {
      continue;
    }
    const tokens = line.split(/\s+/);
    if (tokens.length < 6) {
      continue;
    }
    const hasTypeColumn = tokens.length >= 7 && !/^\d+$/.test(tokens[1] ?? "");
    const filesystem = tokens[0] ?? "";
    const type = hasTypeColumn ? tokens[1] : undefined;
    const totalIndex = hasTypeColumn ? 2 : 1;
    const path = tokens[tokens.length - 1] || "/";
    const totalBytes = toSafeInteger(Number.parseInt(tokens[totalIndex] ?? "0", 10));
    const usedBytes = toSafeInteger(Number.parseInt(tokens[totalIndex + 1] ?? "0", 10));
    const availableBytes = toSafeInteger(Number.parseInt(tokens[totalIndex + 2] ?? "0", 10));
    if (!filesystem || totalBytes <= 0) {
      continue;
    }
    result.push({
      filesystem,
      path,
      type,
      totalBytes,
      usedBytes,
      availableBytes,
      usePercent: parsePercentToken(tokens[totalIndex + 3]),
      inodeUsedPercent: inodePercentByPath.get(path)
    });
  }
  return result.length > 0 ? result.slice(0, 12) : [createEmptyFilesystemUsage()];
}

function createEmptyFilesystemUsage(): ServerFilesystemUsage {
  return {
    filesystem: "",
    path: "/",
    totalBytes: 0,
    usedBytes: 0,
    availableBytes: 0,
    usePercent: 0
  };
}

function parsePercentToken(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  return Math.max(0, Math.min(100, toSafeNumber(Number.parseFloat(value.replace("%", "")))));
}

function parseCpuSection(lines: string[]): {
  totalTicks: number;
  idleTicks: number;
  coreCount: number;
} {
  const coreCount = lines.filter((line) => /^cpu\d+\s/.test(line.trim())).length;
  const cpuLine = lines.find((line) => line.trimStart().startsWith("cpu "));
  if (!cpuLine) {
    return {
      totalTicks: 0,
      idleTicks: 0,
      coreCount
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
    idleTicks: toSafeInteger(idleTicks),
    coreCount
  };
}

function parseNetworkSection(lines: string[]): {
  rxBytes: number;
  txBytes: number;
  interfaces: ServerNetworkInterfaceUsage[];
} {
  let rxBytes = 0;
  let txBytes = 0;
  let loopbackRxBytes = 0;
  let loopbackTxBytes = 0;
  let nonLoopbackCount = 0;
  const interfaces: ServerNetworkInterfaceUsage[] = [];

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
    const usage: ServerNetworkInterfaceUsage = {
      name: interfaceName,
      rxBytes: lineRxBytes,
      txBytes: lineTxBytes,
      rxErrors: toSafeInteger(Number.parseInt(values[2] ?? "0", 10)),
      rxDropped: toSafeInteger(Number.parseInt(values[3] ?? "0", 10)),
      txErrors: toSafeInteger(Number.parseInt(values[10] ?? "0", 10)),
      txDropped: toSafeInteger(Number.parseInt(values[11] ?? "0", 10))
    };
    if (interfaceName === "lo") {
      loopbackRxBytes += lineRxBytes;
      loopbackTxBytes += lineTxBytes;
      interfaces.push(usage);
      continue;
    }
    nonLoopbackCount += 1;
    rxBytes += lineRxBytes;
    txBytes += lineTxBytes;
    interfaces.push(usage);
  }

  if (nonLoopbackCount === 0) {
    rxBytes = loopbackRxBytes;
    txBytes = loopbackTxBytes;
  }
  return {
    rxBytes: toSafeInteger(rxBytes),
    txBytes: toSafeInteger(txBytes),
    interfaces: interfaces
      .sort((left, right) => right.rxBytes + right.txBytes - (left.rxBytes + left.txBytes))
      .slice(0, 12)
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

function getNonEmptyLines(lines: string[] | undefined): string[] {
  if (!lines || lines.length === 0) {
    return [];
  }
  return lines.map((line) => line.trim()).filter((line) => line.length > 0);
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

function toPortForwardErrorCode(error: unknown): string | undefined {
  const nodeError = error as { code?: unknown };
  if (typeof nodeError?.code === "string" && nodeError.code.trim()) {
    return nodeError.code.trim().slice(0, 40);
  }
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error ?? "");
  const match = rawMessage.match(/\b(E[A-Z0-9_]{2,})\b/);
  if (match && match[1]) {
    return match[1].slice(0, 40);
  }
  return undefined;
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

function isSftpNotFoundError(error: unknown): boolean {
  const codeValue = (error as { code?: unknown })?.code;
  if (typeof codeValue === "number" && codeValue === 2) {
    return true;
  }
  if (typeof codeValue === "string" && /ENOENT|NO_SUCH_FILE/i.test(codeValue)) {
    return true;
  }
  const message = (error as Error)?.message?.toLowerCase?.() ?? String(error ?? "").toLowerCase();
  return (
    message.includes("no such file") ||
    message.includes("not found") ||
    message.includes("enoent")
  );
}

function shouldResetCachedSftp(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error ?? "");
  if (!message) {
    return false;
  }
  return /no response from server|channel (?:is )?closed|unexpected eof|socket.*closed|not connected|connection.*(?:closed|lost|reset)/i.test(
    message
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

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
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
