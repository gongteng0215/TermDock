import type { PersistedAppPreferences } from "./app-preference-persistence.js";
import type { PersistedCommandSnippetGroup, PersistedCommandSnippetScopedValueRecord } from "./command-snippet-persistence.js";
import type { PersistedDisconnectReportItem } from "./disconnect-report-persistence.js";
import type { PersistedPortForwardEventHistoryItem } from "./port-forward-event-persistence.js";
import type { SessionRecord } from "./session.js";
import type { SessionMigrationEncryptedFile } from "./session-migration.js";
import type {
  PersistedSessionQuickProfile,
  PersistedSessionTemplateRecord
} from "./session-workbench-persistence.js";
import type {
  PersistedTransferHistoryItem,
  PersistedTransferPendingRestoreItem
} from "./transfer-persistence.js";

export const APP_BACKUP_FORMAT = "termdock-app-backup" as const;
export const APP_BACKUP_VERSION = 1 as const;

export type AppBackupSessionDuplicateStrategy = "skip" | "overwrite" | "rename";

export interface TermDockAppBackupState {
  sessions: SessionRecord[];
  transferHistory: PersistedTransferHistoryItem[];
  transferPendingRestore: PersistedTransferPendingRestoreItem[];
  disconnectReports: PersistedDisconnectReportItem[];
  portForwardEvents: PersistedPortForwardEventHistoryItem[];
  quickProfiles: PersistedSessionQuickProfile[];
  sessionTemplates: PersistedSessionTemplateRecord[];
  commandSnippetGroups: PersistedCommandSnippetGroup[];
  commandSnippetScopedValues: Record<string, PersistedCommandSnippetScopedValueRecord>;
  appPreferences: PersistedAppPreferences;
}

export interface TermDockAppBackupFile {
  format: typeof APP_BACKUP_FORMAT;
  version: typeof APP_BACKUP_VERSION;
  exportedAtIso: string;
  appVersion: string;
  schemaVersion: number;
  state: TermDockAppBackupState;
  /** Optional passphrase-protected `.tdmigration` envelope with session secrets. */
  credentialsAttachment?: SessionMigrationEncryptedFile;
}

export interface AppBackupExportInput {
  appVersion: string;
  includeCredentials: boolean;
  passphrase?: string;
  includePrivateKeyFiles?: boolean;
}

export interface AppBackupExportResult {
  file: TermDockAppBackupFile;
  warnings: string[];
}

export interface AppBackupPreview {
  exportedAtIso: string;
  appVersion: string;
  schemaVersion: number;
  sessionCount: number;
  sessionsWithSecretFlag: number;
  transferHistoryCount: number;
  transferPendingRestoreCount: number;
  disconnectReportCount: number;
  portForwardEventCount: number;
  quickProfileCount: number;
  sessionTemplateCount: number;
  commandSnippetGroupCount: number;
  commandSnippetScopedValueCount: number;
  appPreferenceCount: number;
  hasCredentialsAttachment: boolean;
  credentialSummary?: SessionMigrationEncryptedFile["summary"];
}

export interface AppBackupPreviewInput {
  fileText: string;
}

export interface AppBackupPreviewResult {
  preview: AppBackupPreview;
  warnings: string[];
}

export interface AppBackupImportInput {
  fileText: string;
  sessionDuplicateStrategy: AppBackupSessionDuplicateStrategy;
  restoreCredentials: boolean;
  passphrase?: string;
  includePrivateKeyFiles?: boolean;
}

export interface AppBackupImportAppliedCounts {
  sessionsCreated: number;
  sessionsUpdated: number;
  sessionsSkipped: number;
  secretsRestored: number;
  durableTablesReplaced: string[];
}

export interface AppBackupImportResult {
  preview: AppBackupPreview;
  applied: AppBackupImportAppliedCounts;
  state: TermDockAppBackupState;
  warnings: string[];
}

export function buildAppBackupPreview(file: TermDockAppBackupFile): AppBackupPreview {
  const sessions = Array.isArray(file.state?.sessions) ? file.state.sessions : [];
  const scopedValues =
    file.state?.commandSnippetScopedValues &&
    typeof file.state.commandSnippetScopedValues === "object"
      ? file.state.commandSnippetScopedValues
      : {};
  const preferences =
    file.state?.appPreferences && typeof file.state.appPreferences === "object"
      ? file.state.appPreferences
      : {};
  return {
    exportedAtIso: file.exportedAtIso,
    appVersion: file.appVersion,
    schemaVersion: file.schemaVersion,
    sessionCount: sessions.length,
    sessionsWithSecretFlag: sessions.filter((session) => session.hasSecret === true).length,
    transferHistoryCount: Array.isArray(file.state?.transferHistory)
      ? file.state.transferHistory.length
      : 0,
    transferPendingRestoreCount: Array.isArray(file.state?.transferPendingRestore)
      ? file.state.transferPendingRestore.length
      : 0,
    disconnectReportCount: Array.isArray(file.state?.disconnectReports)
      ? file.state.disconnectReports.length
      : 0,
    portForwardEventCount: Array.isArray(file.state?.portForwardEvents)
      ? file.state.portForwardEvents.length
      : 0,
    quickProfileCount: Array.isArray(file.state?.quickProfiles) ? file.state.quickProfiles.length : 0,
    sessionTemplateCount: Array.isArray(file.state?.sessionTemplates)
      ? file.state.sessionTemplates.length
      : 0,
    commandSnippetGroupCount: Array.isArray(file.state?.commandSnippetGroups)
      ? file.state.commandSnippetGroups.length
      : 0,
    commandSnippetScopedValueCount: Object.keys(scopedValues).length,
    appPreferenceCount: Object.keys(preferences).length,
    hasCredentialsAttachment: Boolean(file.credentialsAttachment),
    credentialSummary: file.credentialsAttachment?.summary
  };
}

export function formatAppBackupPreview(
  preview: AppBackupPreview,
  language: "en" | "zh-CN" = "en"
): string {
  const zh = language === "zh-CN";
  const lines = [
    zh ? `导出时间：${preview.exportedAtIso}` : `Exported: ${preview.exportedAtIso}`,
    zh ? `来源应用：${preview.appVersion}` : `Source app: ${preview.appVersion}`,
    zh ? `Schema：v${preview.schemaVersion}` : `Schema: v${preview.schemaVersion}`,
    zh
      ? `会话：${preview.sessionCount}（其中 ${preview.sessionsWithSecretFlag} 个标记 hasSecret）`
      : `Sessions: ${preview.sessionCount} (${preview.sessionsWithSecretFlag} marked hasSecret)`,
    zh
      ? `传输历史：${preview.transferHistoryCount}`
      : `Transfer history: ${preview.transferHistoryCount}`,
    zh
      ? `待恢复传输：${preview.transferPendingRestoreCount}`
      : `Pending restores: ${preview.transferPendingRestoreCount}`,
    zh
      ? `断连报告：${preview.disconnectReportCount}`
      : `Disconnect reports: ${preview.disconnectReportCount}`,
    zh
      ? `端口转发事件：${preview.portForwardEventCount}`
      : `Port-forward events: ${preview.portForwardEventCount}`,
    zh ? `快捷配置：${preview.quickProfileCount}` : `Quick profiles: ${preview.quickProfileCount}`,
    zh ? `会话模板：${preview.sessionTemplateCount}` : `Templates: ${preview.sessionTemplateCount}`,
    zh
      ? `命令片段分组：${preview.commandSnippetGroupCount}`
      : `Snippet groups: ${preview.commandSnippetGroupCount}`,
    zh
      ? `命令片段作用域值：${preview.commandSnippetScopedValueCount}`
      : `Snippet scoped values: ${preview.commandSnippetScopedValueCount}`,
    zh
      ? `应用偏好：${preview.appPreferenceCount}`
      : `App preferences: ${preview.appPreferenceCount}`,
    preview.hasCredentialsAttachment
      ? zh
        ? `凭据附件：有（${preview.credentialSummary?.passwordSecretCount ?? 0} 个密码，${preview.credentialSummary?.privateKeySecretCount ?? 0} 个私钥口令，${preview.credentialSummary?.embeddedPrivateKeyFileCount ?? 0} 个私钥文件）`
        : `Credentials attachment: yes (${preview.credentialSummary?.passwordSecretCount ?? 0} password(s), ${preview.credentialSummary?.privateKeySecretCount ?? 0} passphrase(s), ${preview.credentialSummary?.embeddedPrivateKeyFileCount ?? 0} key file(s))`
      : zh
        ? "凭据附件：无"
        : "Credentials attachment: no"
  ];
  return lines.join("\n");
}
