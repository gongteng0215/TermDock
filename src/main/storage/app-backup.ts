import type {
  AppBackupExportInput,
  AppBackupExportResult,
  AppBackupImportInput,
  AppBackupImportResult,
  AppBackupPreviewInput,
  AppBackupPreviewResult,
  AppBackupSessionDuplicateStrategy,
  TermDockAppBackupFile,
  TermDockAppBackupState
} from "../../shared/app-backup.js";
import {
  APP_BACKUP_FORMAT,
  APP_BACKUP_VERSION,
  buildAppBackupPreview
} from "../../shared/app-backup.js";
import type { SessionCreateInput, SessionRecord } from "../../shared/session.js";
import { SQLITE_SCHEMA_VERSION } from "./sqlite/schema.js";
import type { SqliteDisconnectReportStore } from "./sqlite/sqlite-disconnect-report-store.js";
import type { SqlitePortForwardEventStore } from "./sqlite/sqlite-port-forward-event-store.js";
import type { SqlitePreferenceStore } from "./sqlite/sqlite-preference-store.js";
import type { SqliteTransferStore } from "./sqlite/sqlite-transfer-store.js";
import type { SqliteWorkbenchStore } from "./sqlite/sqlite-workbench-store.js";
import type { DualWriteSessionStore } from "./dual-write-session-store.js";
import type { SessionStore } from "./session-store.js";
import type { CredentialStore } from "../security/credential-store.js";
import {
  exportEncryptedSessionMigration,
  importEncryptedSessionMigration
} from "../session/session-migration.js";

export interface AppBackupStores {
  sessionStore: SessionStore | DualWriteSessionStore;
  credentialStore: CredentialStore;
  transferStore: SqliteTransferStore | null;
  disconnectReportStore: SqliteDisconnectReportStore | null;
  portForwardEventStore: SqlitePortForwardEventStore | null;
  workbenchStore: SqliteWorkbenchStore | null;
  preferenceStore: SqlitePreferenceStore | null;
}

function sessionConnectionKey(session: {
  host: string;
  port: number;
  username: string;
}): string {
  return `${session.host.trim().toLowerCase()}:${session.port}:${session.username.trim().toLowerCase()}`;
}

function allocateImportName(desiredName: string, usedNames: Set<string>): string {
  const base = desiredName.trim() || "Session";
  if (!usedNames.has(base.toLowerCase())) {
    return base;
  }
  let index = 2;
  while (usedNames.has(`${base} (${index})`.toLowerCase())) {
    index += 1;
  }
  return `${base} (${index})`;
}

function emptyBackupState(): TermDockAppBackupState {
  return {
    sessions: [],
    transferHistory: [],
    transferPendingRestore: [],
    disconnectReports: [],
    portForwardEvents: [],
    quickProfiles: [],
    sessionTemplates: [],
    commandSnippetGroups: [],
    commandSnippetScopedValues: {},
    appPreferences: {}
  };
}

function sanitizeSessionForBackup(session: SessionRecord): SessionRecord {
  const next: SessionRecord = {
    id: session.id,
    name: session.name,
    host: session.host,
    port: session.port,
    username: session.username,
    authType: session.authType,
    favorite: session.favorite === true,
    hasSecret: session.hasSecret === true,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
  if (session.privateKeyPath) {
    next.privateKeyPath = session.privateKeyPath;
  }
  if (session.groupId) {
    next.groupId = session.groupId;
  }
  if (session.remark) {
    next.remark = session.remark;
  }
  if (session.lastConnectedAt) {
    next.lastConnectedAt = session.lastConnectedAt;
  }
  return next;
}

function assertNoPlainSecretsInState(state: TermDockAppBackupState): void {
  const serialized = JSON.stringify(state);
  if (/"secret"\s*:/.test(serialized)) {
    throw new Error("Refusing to export app backup: plain secret fields detected in dump.");
  }
}

function normalizeBackupState(raw: unknown): TermDockAppBackupState {
  const candidate =
    raw && typeof raw === "object" ? (raw as Partial<TermDockAppBackupState>) : {};
  return {
    sessions: Array.isArray(candidate.sessions)
      ? candidate.sessions.map((session) => sanitizeSessionForBackup(session as SessionRecord))
      : [],
    transferHistory: Array.isArray(candidate.transferHistory) ? candidate.transferHistory : [],
    transferPendingRestore: Array.isArray(candidate.transferPendingRestore)
      ? candidate.transferPendingRestore
      : [],
    disconnectReports: Array.isArray(candidate.disconnectReports)
      ? candidate.disconnectReports
      : [],
    portForwardEvents: Array.isArray(candidate.portForwardEvents)
      ? candidate.portForwardEvents
      : [],
    quickProfiles: Array.isArray(candidate.quickProfiles) ? candidate.quickProfiles : [],
    sessionTemplates: Array.isArray(candidate.sessionTemplates)
      ? candidate.sessionTemplates.map((template) => {
          const row = { ...(template as unknown as Record<string, unknown>) };
          delete row.secret;
          return row as unknown as TermDockAppBackupState["sessionTemplates"][number];
        })
      : [],
    commandSnippetGroups: Array.isArray(candidate.commandSnippetGroups)
      ? candidate.commandSnippetGroups
      : [],
    commandSnippetScopedValues:
      candidate.commandSnippetScopedValues &&
      typeof candidate.commandSnippetScopedValues === "object"
        ? candidate.commandSnippetScopedValues
        : {},
    appPreferences:
      candidate.appPreferences && typeof candidate.appPreferences === "object"
        ? candidate.appPreferences
        : {}
  };
}

export function parseAppBackupFile(fileText: string): TermDockAppBackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("App backup file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("App backup file is not an object.");
  }
  const candidate = parsed as Partial<TermDockAppBackupFile>;
  if (candidate.format !== APP_BACKUP_FORMAT || candidate.version !== APP_BACKUP_VERSION) {
    throw new Error("App backup file format is not supported.");
  }
  if (typeof candidate.exportedAtIso !== "string" || typeof candidate.appVersion !== "string") {
    throw new Error("App backup file is missing required metadata.");
  }
  if (typeof candidate.schemaVersion !== "number" || !Number.isFinite(candidate.schemaVersion)) {
    throw new Error("App backup file is missing schemaVersion.");
  }
  return {
    format: APP_BACKUP_FORMAT,
    version: APP_BACKUP_VERSION,
    exportedAtIso: candidate.exportedAtIso,
    appVersion: candidate.appVersion,
    schemaVersion: candidate.schemaVersion,
    state: normalizeBackupState(candidate.state),
    credentialsAttachment: candidate.credentialsAttachment
  };
}

export async function collectAppBackupState(
  stores: AppBackupStores
): Promise<TermDockAppBackupState> {
  const sessions = (await stores.sessionStore.list()).map(sanitizeSessionForBackup);
  const state: TermDockAppBackupState = {
    ...emptyBackupState(),
    sessions
  };
  if (stores.transferStore) {
    state.transferHistory = stores.transferStore.listHistory();
    state.transferPendingRestore = stores.transferStore.listPendingRestore();
  }
  if (stores.disconnectReportStore) {
    state.disconnectReports = stores.disconnectReportStore.list();
  }
  if (stores.portForwardEventStore) {
    state.portForwardEvents = stores.portForwardEventStore.list();
  }
  if (stores.workbenchStore) {
    state.quickProfiles = stores.workbenchStore.listQuickProfiles();
    state.sessionTemplates = stores.workbenchStore.listSessionTemplates();
    state.commandSnippetGroups = stores.workbenchStore.listSnippetGroups();
    state.commandSnippetScopedValues = stores.workbenchStore.listSnippetScopedValues();
  }
  if (stores.preferenceStore) {
    state.appPreferences = stores.preferenceStore.listAll();
  }
  assertNoPlainSecretsInState(state);
  return state;
}

export async function exportAppBackup(
  stores: AppBackupStores,
  input: AppBackupExportInput
): Promise<AppBackupExportResult> {
  const warnings: string[] = [];
  const exportedAtIso = new Date().toISOString();
  const state = await collectAppBackupState(stores);
  const file: TermDockAppBackupFile = {
    format: APP_BACKUP_FORMAT,
    version: APP_BACKUP_VERSION,
    exportedAtIso,
    appVersion: input.appVersion,
    schemaVersion: SQLITE_SCHEMA_VERSION,
    state
  };

  if (input.includeCredentials) {
    const passphrase = typeof input.passphrase === "string" ? input.passphrase : "";
    if (passphrase.length < 8) {
      throw new Error("Backup passphrase must be at least 8 characters when including credentials.");
    }
    const credentialExport = await exportEncryptedSessionMigration(stores.credentialStore, {
      passphrase,
      appVersion: input.appVersion,
      sessions: await stores.sessionStore.list(),
      includePrivateKeyFiles: input.includePrivateKeyFiles === true
    });
    file.credentialsAttachment = credentialExport.file;
    warnings.push(...credentialExport.warnings);
  }

  assertNoPlainSecretsInState(file.state);
  return { file, warnings };
}

export function previewAppBackup(input: AppBackupPreviewInput): AppBackupPreviewResult {
  const file = parseAppBackupFile(input.fileText);
  return {
    preview: buildAppBackupPreview(file),
    warnings: []
  };
}

function sessionToCreateInput(
  session: SessionRecord,
  nameOverride?: string
): SessionCreateInput {
  return {
    name: nameOverride ?? session.name,
    host: session.host,
    port: session.port,
    username: session.username,
    authType: session.authType,
    privateKeyPath: session.privateKeyPath,
    groupId: session.groupId,
    remark: session.remark,
    favorite: session.favorite
  };
}

function replaceDurableState(stores: AppBackupStores, state: TermDockAppBackupState): string[] {
  const replaced: string[] = [];
  if (stores.transferStore) {
    stores.transferStore.replaceHistory(state.transferHistory);
    stores.transferStore.replacePendingRestore(state.transferPendingRestore);
    replaced.push("transfer_history", "transfer_pending_restore");
  }
  if (stores.disconnectReportStore) {
    stores.disconnectReportStore.replaceAll(state.disconnectReports);
    replaced.push("disconnect_reports");
  }
  if (stores.portForwardEventStore) {
    stores.portForwardEventStore.replaceAll(state.portForwardEvents);
    replaced.push("port_forward_events");
  }
  if (stores.workbenchStore) {
    stores.workbenchStore.replaceQuickProfiles(state.quickProfiles);
    stores.workbenchStore.replaceSessionTemplates(state.sessionTemplates);
    stores.workbenchStore.replaceSnippetGroups(state.commandSnippetGroups);
    stores.workbenchStore.replaceSnippetScopedValues(state.commandSnippetScopedValues);
    replaced.push(
      "session_quick_profiles",
      "session_templates",
      "command_snippet_groups",
      "command_snippet_scoped_values"
    );
  }
  if (stores.preferenceStore) {
    stores.preferenceStore.replaceAll(state.appPreferences);
    replaced.push("app_preferences");
  }
  return replaced;
}

async function applySessionsWithStrategy(
  stores: AppBackupStores,
  sessions: SessionRecord[],
  strategy: AppBackupSessionDuplicateStrategy
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  idByConnectionKey: Map<string, string>;
  warnings: string[];
}> {
  const existing = await stores.sessionStore.list();
  const byConnection = new Map<string, SessionRecord>();
  const usedNames = new Set(existing.map((session) => session.name.trim().toLowerCase()));
  for (const session of existing) {
    byConnection.set(sessionConnectionKey(session), session);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const idByConnectionKey = new Map<string, string>();
  const warnings: string[] = [];

  for (const session of sessions) {
    const key = sessionConnectionKey(session);
    const match = byConnection.get(key);
    try {
      if (match) {
        if (strategy === "skip") {
          skipped += 1;
          idByConnectionKey.set(key, match.id);
          continue;
        }
        if (strategy === "overwrite") {
          const patched = await stores.sessionStore.update(match.id, {
            name: session.name,
            host: session.host,
            port: session.port,
            username: session.username,
            authType: session.authType,
            privateKeyPath: session.privateKeyPath ?? "",
            groupId: session.groupId ?? "",
            remark: session.remark ?? "",
            favorite: session.favorite
          });
          updated += 1;
          idByConnectionKey.set(key, patched.id);
          byConnection.set(key, patched);
          usedNames.add(patched.name.trim().toLowerCase());
          continue;
        }
        const renamed = allocateImportName(session.name, usedNames);
        const createdSession = await stores.sessionStore.create(
          sessionToCreateInput(session, renamed)
        );
        created += 1;
        idByConnectionKey.set(key, createdSession.id);
        usedNames.add(createdSession.name.trim().toLowerCase());
        byConnection.set(sessionConnectionKey(createdSession), createdSession);
        continue;
      }

      const createdSession = await stores.sessionStore.create(sessionToCreateInput(session));
      created += 1;
      idByConnectionKey.set(key, createdSession.id);
      usedNames.add(createdSession.name.trim().toLowerCase());
      byConnection.set(key, createdSession);
    } catch (error) {
      warnings.push(
        `Could not restore session "${session.name}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return { created, updated, skipped, idByConnectionKey, warnings };
}

export async function importAppBackup(
  stores: AppBackupStores,
  input: AppBackupImportInput
): Promise<AppBackupImportResult> {
  const file = parseAppBackupFile(input.fileText);
  const warnings: string[] = [];
  const preview = buildAppBackupPreview(file);
  const state = file.state;

  const sessionApply = await applySessionsWithStrategy(
    stores,
    state.sessions,
    input.sessionDuplicateStrategy
  );
  warnings.push(...sessionApply.warnings);

  let secretsRestored = 0;
  if (input.restoreCredentials) {
    if (!file.credentialsAttachment) {
      throw new Error("This app backup does not include a credentials attachment.");
    }
    const passphrase = typeof input.passphrase === "string" ? input.passphrase : "";
    if (passphrase.length < 8) {
      throw new Error("Backup passphrase must be at least 8 characters to restore credentials.");
    }
    const credentialImport = await importEncryptedSessionMigration({
      passphrase,
      fileText: JSON.stringify(file.credentialsAttachment),
      restorePrivateKeyFiles: input.includePrivateKeyFiles === true
    });
    warnings.push(...credentialImport.warnings);
    for (const migrated of credentialImport.payload.sessions) {
      const key = sessionConnectionKey(migrated);
      const sessionId = sessionApply.idByConnectionKey.get(key);
      if (!sessionId) {
        continue;
      }
      const secret = typeof migrated.secret === "string" ? migrated.secret.trim() : "";
      if (!secret && !migrated.privateKeyPath) {
        continue;
      }
      try {
        if (secret) {
          await stores.credentialStore.saveSessionSecret(sessionId, secret);
          await stores.sessionStore.update(sessionId, { secret });
          secretsRestored += 1;
        }
        if (
          input.includePrivateKeyFiles === true &&
          migrated.authType === "privateKey" &&
          migrated.privateKeyPath
        ) {
          await stores.sessionStore.update(sessionId, {
            privateKeyPath: migrated.privateKeyPath
          });
        }
      } catch (error) {
        warnings.push(
          `Could not restore credentials for "${migrated.name}": ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  const durableTablesReplaced = replaceDurableState(stores, state);

  return {
    preview,
    applied: {
      sessionsCreated: sessionApply.created,
      sessionsUpdated: sessionApply.updated,
      sessionsSkipped: sessionApply.skipped,
      secretsRestored,
      durableTablesReplaced
    },
    state,
    warnings
  };
}
