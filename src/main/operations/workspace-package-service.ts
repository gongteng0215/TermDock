import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scryptSync
} from "node:crypto";

import type { SessionMigrationEncryptedFile } from "../../shared/session-migration.js";
import type {
  WorkspaceImportStrategy,
  WorkspacePackageExportInput,
  WorkspacePackageExportResult,
  WorkspacePackageFile,
  WorkspacePackageImportInput,
  WorkspacePackageImportResult,
  WorkspacePackagePreview,
  WorkspacePackagePreviewInput,
  WorkspacePackagePreviewResult,
  WorkspacePackageState
} from "../../shared/operations.js";
import {
  WORKSPACE_PACKAGE_FORMAT,
  WORKSPACE_PACKAGE_VERSION
} from "../../shared/operations.js";
import type { SessionCreateInput, SessionRecord, SessionUpdateInput } from "../../shared/session.js";
import type { CredentialStore } from "../security/credential-store.js";
import {
  exportEncryptedSessionMigration,
  importEncryptedSessionMigration
} from "../session/session-migration.js";
import type { DualWriteSessionStore } from "../storage/dual-write-session-store.js";
import type { SessionStore } from "../storage/session-store.js";
import type { SqliteOperationsStore } from "../storage/sqlite/sqlite-operations-store.js";

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

interface WorkspacePayload {
  state: WorkspacePackageState;
  credentialsAttachment?: SessionMigrationEncryptedFile;
}

function connectionKey(session: Pick<SessionRecord, "host" | "port" | "username">): string {
  return `${session.host.trim().toLowerCase()}:${session.port}:${session.username.trim().toLowerCase()}`;
}

function sanitizeSession(session: SessionRecord): SessionRecord {
  return {
    id: session.id,
    name: session.name,
    host: session.host,
    port: session.port,
    username: session.username,
    authType: session.authType,
    privateKeyPath: session.privateKeyPath,
    jumpSessionId: session.jumpSessionId,
    groupId: session.groupId,
    remark: session.remark,
    environment: session.environment,
    tags: session.tags,
    owner: session.owner,
    customFields: session.customFields,
    favorite: session.favorite,
    // This is a display-only hint; no secret material leaves keytar.
    hasSecret: session.hasSecret,
    lastConnectedAt: session.lastConnectedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function toSessionCreateInput(session: SessionRecord, name?: string): SessionCreateInput {
  return {
    name: name ?? session.name,
    host: session.host,
    port: session.port,
    username: session.username,
    authType: session.authType,
    privateKeyPath: session.privateKeyPath,
    groupId: session.groupId,
    remark: session.remark,
    environment: session.environment,
    tags: session.tags,
    owner: session.owner,
    customFields: session.customFields,
    favorite: session.favorite
  };
}

function toSessionUpdateInput(session: SessionRecord): SessionUpdateInput {
  return {
    name: session.name,
    host: session.host,
    port: session.port,
    username: session.username,
    authType: session.authType,
    privateKeyPath: session.privateKeyPath ?? "",
    groupId: session.groupId ?? "",
    remark: session.remark ?? "",
    environment: session.environment,
    tags: session.tags ?? [],
    owner: session.owner ?? "",
    customFields: session.customFields ?? [],
    favorite: session.favorite
  };
}

function allocateName(name: string, used: Set<string>): string {
  const base = name.trim() || "Imported session";
  if (!used.has(base.toLowerCase())) return base;
  let index = 2;
  while (used.has(`${base} (${index})`.toLowerCase())) index += 1;
  return `${base} (${index})`;
}

function makePreview(payload: WorkspacePayload, file: WorkspacePackageFile): WorkspacePackagePreview {
  return {
    exportedAt: file.exportedAt,
    sessionCount: payload.state.sessions.length,
    runbookCount: payload.state.runbooks.length,
    syncProfileCount: payload.state.syncProfiles.length,
    pinnedMonitorCount: payload.state.pinnedMonitors.length,
    includesCredentials: Boolean(payload.credentialsAttachment)
  };
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  if (passphrase.length < 8) {
    throw new Error("Workspace package passphrase must be at least 8 characters.");
  }
  return scryptSync(passphrase, salt, KEY_LENGTH);
}

function encryptPayload(payload: WorkspacePayload, passphrase: string): WorkspacePackageFile {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    format: WORKSPACE_PACKAGE_FORMAT,
    version: WORKSPACE_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    saltBase64: salt.toString("base64"),
    ivBase64: iv.toString("base64"),
    authTagBase64: cipher.getAuthTag().toString("base64"),
    ciphertextBase64: encrypted.toString("base64")
  };
}

function parseWorkspaceFile(fileText: string): WorkspacePackageFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("Workspace package is not valid JSON.");
  }
  const candidate = parsed as Partial<WorkspacePackageFile>;
  if (!candidate || candidate.format !== WORKSPACE_PACKAGE_FORMAT || candidate.version !== WORKSPACE_PACKAGE_VERSION) {
    throw new Error("Workspace package format is not supported.");
  }
  for (const key of ["exportedAt", "saltBase64", "ivBase64", "authTagBase64", "ciphertextBase64"] as const) {
    if (typeof candidate[key] !== "string" || !candidate[key]) throw new Error(`Workspace package is missing ${key}.`);
  }
  return candidate as WorkspacePackageFile;
}

function decryptPayload(file: WorkspacePackageFile, passphrase: string): WorkspacePayload {
  try {
    const key = deriveKey(passphrase, Buffer.from(file.saltBase64, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(file.ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(file.authTagBase64, "base64"));
    const raw = Buffer.concat([
      decipher.update(Buffer.from(file.ciphertextBase64, "base64")),
      decipher.final()
    ]).toString("utf8");
    const payload = JSON.parse(raw) as WorkspacePayload;
    if (!payload?.state || !Array.isArray(payload.state.sessions)) throw new Error("Workspace package payload is invalid.");
    return {
      state: {
        sessions: payload.state.sessions.map(sanitizeSession),
        runbooks: Array.isArray(payload.state.runbooks) ? payload.state.runbooks : [],
        syncProfiles: Array.isArray(payload.state.syncProfiles) ? payload.state.syncProfiles : [],
        pinnedMonitors: Array.isArray(payload.state.pinnedMonitors) ? payload.state.pinnedMonitors : [],
        healthRules: payload.state.healthRules && typeof payload.state.healthRules === "object" ? payload.state.healthRules : {},
        policyBundle: payload.state.policyBundle && typeof payload.state.policyBundle === "object" ? payload.state.policyBundle : {}
      },
      credentialsAttachment: payload.credentialsAttachment
    };
  } catch (error) {
    throw new Error(`Could not decrypt workspace package. ${error instanceof Error ? error.message : String(error)}`);
  }
}

export class WorkspacePackageService {
  constructor(
    private readonly sessionStore: SessionStore | DualWriteSessionStore,
    private readonly credentialStore: CredentialStore,
    private readonly operationsStore: SqliteOperationsStore | null
  ) {}

  async exportWorkspace(input: WorkspacePackageExportInput): Promise<WorkspacePackageExportResult> {
    if (!this.operationsStore) throw new Error("Workspace package storage is unavailable.");
    const sessions = (await this.sessionStore.list()).map(sanitizeSession);
    const payload: WorkspacePayload = {
      state: {
        sessions,
        runbooks: this.operationsStore.listRunbooks(),
        syncProfiles: this.operationsStore.listSyncProfiles(),
        pinnedMonitors: this.operationsStore.listPinnedMonitors(),
        healthRules: {},
        policyBundle: {}
      }
    };
    const warnings: string[] = [];
    if (input.includeCredentials) {
      const exportResult = await exportEncryptedSessionMigration(this.credentialStore, {
        appVersion: input.appVersion,
        passphrase: input.passphrase,
        sessions,
        includePrivateKeyFiles: input.includePrivateKeyFiles === true
      });
      payload.credentialsAttachment = exportResult.file;
      warnings.push(...exportResult.warnings);
    }
    return { file: encryptPayload(payload, input.passphrase), warnings };
  }

  previewWorkspace(input: WorkspacePackagePreviewInput): WorkspacePackagePreviewResult {
    const file = parseWorkspaceFile(input.fileText);
    const payload = decryptPayload(file, input.passphrase);
    return { preview: makePreview(payload, file) };
  }

  async importWorkspace(input: WorkspacePackageImportInput): Promise<WorkspacePackageImportResult> {
    if (!this.operationsStore) throw new Error("Workspace package storage is unavailable.");
    const file = parseWorkspaceFile(input.fileText);
    const payload = decryptPayload(file, input.passphrase);
    const preview = makePreview(payload, file);
    const existing = await this.sessionStore.list();
    const byConnection = new Map(existing.map((session) => [connectionKey(session), session]));
    const usedNames = new Set(existing.map((session) => session.name.toLowerCase()));
    const idMap = new Map<string, string>();
    const warnings: string[] = [];
    let sessionsCreated = 0;
    let sessionsUpdated = 0;
    let sessionsSkipped = 0;

    for (const imported of payload.state.sessions) {
      const key = connectionKey(imported);
      const matched = byConnection.get(key);
      if (matched && input.sessionStrategy === "skip") {
        sessionsSkipped += 1;
        idMap.set(imported.id, matched.id);
        continue;
      }
      if (matched && input.sessionStrategy === "overwrite") {
        const updated = await this.sessionStore.update(matched.id, toSessionUpdateInput(imported));
        sessionsUpdated += 1;
        idMap.set(imported.id, updated.id);
        byConnection.set(key, updated);
        continue;
      }
      const name = matched ? allocateName(imported.name, usedNames) : allocateName(imported.name, usedNames);
      const created = await this.sessionStore.create(toSessionCreateInput(imported, name));
      sessionsCreated += 1;
      usedNames.add(created.name.toLowerCase());
      idMap.set(imported.id, created.id);
      byConnection.set(connectionKey(created), created);
    }

    // Resolve one-hop jump references only after every imported target has a
    // stable local id. Missing/cyclic references are deliberately dropped.
    for (const imported of payload.state.sessions) {
      const localId = idMap.get(imported.id);
      const jumpId = imported.jumpSessionId ? idMap.get(imported.jumpSessionId) : undefined;
      if (!localId || !jumpId || localId === jumpId) continue;
      try {
        await this.sessionStore.update(localId, { jumpSessionId: jumpId });
      } catch (error) {
        warnings.push(`Could not restore jump host for "${imported.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const existingRunbookIds = new Set(this.operationsStore.listRunbooks().map((item) => item.id));
    const runbookIdMap = new Map<string, string>();
    for (const runbook of payload.state.runbooks) {
      if (existingRunbookIds.has(runbook.id) && input.sessionStrategy === "skip") {
        runbookIdMap.set(runbook.id, runbook.id);
        continue;
      }
      const saved = this.operationsStore.saveRunbook(
        existingRunbookIds.has(runbook.id) && input.sessionStrategy === "rename"
          ? { ...runbook, id: randomUUID(), name: `${runbook.name} (imported)` }
          : runbook
      );
      runbookIdMap.set(runbook.id, saved.id);
    }
    const existingProfileIds = new Set(this.operationsStore.listSyncProfiles().map((item) => item.id));
    for (const profile of payload.state.syncProfiles) {
      const sessionId = idMap.get(profile.sessionId);
      if (!sessionId) continue;
      if (existingProfileIds.has(profile.id) && input.sessionStrategy === "skip") continue;
      this.operationsStore.saveSyncProfile(
        existingProfileIds.has(profile.id) && input.sessionStrategy === "rename"
          ? { ...profile, id: randomUUID(), name: `${profile.name} (imported)`, sessionId }
          : { ...profile, sessionId }
      );
    }
    for (const monitor of payload.state.pinnedMonitors) {
      const sessionId = idMap.get(monitor.sessionId);
      if (sessionId) {
        this.operationsStore.savePinnedMonitor({
          ...monitor,
          sessionId,
          recommendedRunbookIds: (monitor.recommendedRunbookIds ?? [])
            .map((runbookId) => runbookIdMap.get(runbookId) ?? (existingRunbookIds.has(runbookId) ? runbookId : ""))
            .filter(Boolean)
            .slice(0, 3)
        });
      }
    }

    if (input.restoreCredentials && payload.credentialsAttachment) {
      const importedCredentials = await importEncryptedSessionMigration({
        passphrase: input.passphrase,
        fileText: JSON.stringify(payload.credentialsAttachment),
        restorePrivateKeyFiles: input.includePrivateKeyFiles === true
      });
      warnings.push(...importedCredentials.warnings);
      for (const credentialSession of importedCredentials.payload.sessions) {
        const local = byConnection.get(connectionKey(credentialSession));
        if (!local || !credentialSession.secret) continue;
        await this.credentialStore.saveSessionSecret(local.id, credentialSession.secret);
        await this.sessionStore.update(local.id, { secret: credentialSession.secret });
      }
    }

    return { preview, sessionsCreated, sessionsUpdated, sessionsSkipped, warnings };
  }
}
