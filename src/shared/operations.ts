import type { SessionRecord } from "./session.js";

export interface TrustedHostKey {
  endpoint: string;
  host: string;
  port: number;
  fingerprint: string;
  publicKeyBase64: string;
  firstTrustedAt: string;
  lastTrustedAt: string;
}

export interface RunbookVariable {
  name: string;
  label: string;
  required: boolean;
  defaultValue?: string;
}

export interface Runbook {
  id: string;
  name: string;
  description: string;
  command: string;
  variables: RunbookVariable[];
  /** Defaults to 6; bounded to 16 to protect SSH channel pressure. */
  concurrency?: number;
  timeoutSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export type RunbookTargetStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface RunbookTargetResult {
  sessionId: string;
  sessionName: string;
  status: RunbookTargetStatus;
  exitCode?: number | null;
  startedAt?: string;
  finishedAt?: string;
  outputTail: string;
  error?: string;
}

export type RunbookRunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface RunbookRun {
  id: string;
  runbookId: string;
  runbookName: string;
  command: string;
  /** Present when a runbook was manually launched from a Fleet Health incident. */
  incidentId?: string;
  status: RunbookRunStatus;
  startedAt: string;
  finishedAt?: string;
  targetResults: RunbookTargetResult[];
}

export interface RunbookStartInput {
  runbookId: string;
  sessionIds: string[];
  variables: Record<string, string>;
  approvedDangerousCommand?: boolean;
  /** Incidents only recommend actions; this reference never enables auto-remediation. */
  incidentId?: string;
}

export interface SyncProfile {
  id: string;
  name: string;
  sessionId: string;
  direction: "upload" | "download";
  localRoot: string;
  remoteRoot: string;
  excludePatterns: string[];
  createdAt: string;
  updatedAt: string;
}

export type SyncPlanAction = "create" | "update" | "skip" | "conflict" | "preserve" | "error";

export interface SyncPlanItem {
  relativePath: string;
  action: SyncPlanAction;
  reason: string;
  localPath: string;
  remotePath: string;
  size: number;
}

export interface SyncPlan {
  id: string;
  profileId: string;
  createdAt: string;
  items: SyncPlanItem[];
}

export type SyncRunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface SyncRun {
  id: string;
  profileId: string;
  profileName: string;
  direction: SyncProfile["direction"];
  status: SyncRunStatus;
  startedAt: string;
  finishedAt?: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  canceledFiles: number;
  errors: Array<{ relativePath: string; message: string }>;
}

export interface PinnedMonitor {
  sessionId: string;
  enabled: boolean;
  intervalSeconds: number;
  cpuWarnPercent?: number;
  memoryWarnPercent?: number;
  diskWarnPercent?: number;
  cpuCriticalPercent?: number;
  memoryCriticalPercent?: number;
  diskCriticalPercent?: number;
  alertOnFailedServices?: boolean;
  failedServiceWarnCount?: number;
  failedServiceCriticalCount?: number;
  cooldownSeconds?: number;
  /** Saved recommendations only; an operator must still preview and confirm each run. */
  recommendedRunbookIds?: string[];
  updatedAt: string;
}

export interface HealthObservation {
  sessionId: string;
  collectedAt: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  load1: number;
  failedServices: number;
  connectionState: "healthy" | "unreachable" | "needsAttention";
}

export type HealthSeverity = "healthy" | "warning" | "critical" | "needsAttention" | "unmonitored";

export type HealthIncidentStatus = "open" | "acknowledged" | "resolved";

export type HealthIncidentEventType =
  | "created"
  | "conditionsChanged"
  | "escalated"
  | "acknowledged"
  | "runbookStarted"
  | "runbookFinished"
  | "healthySample"
  | "resolved";

export interface HealthIncidentEvent {
  id: string;
  incidentId: string;
  type: HealthIncidentEventType;
  createdAt: string;
  detail: string;
  severity?: Exclude<HealthSeverity, "healthy" | "needsAttention" | "unmonitored">;
  runbookRunId?: string;
}

export interface HealthIncident {
  id: string;
  sessionId: string;
  status: HealthIncidentStatus;
  severity: Exclude<HealthSeverity, "healthy" | "needsAttention" | "unmonitored">;
  conditionKeys: string[];
  firstDetectedAt: string;
  lastDetectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  healthyStreak: number;
  lastNotifiedAt?: string;
  notifiedSeverity?: Exclude<HealthSeverity, "healthy" | "needsAttention" | "unmonitored">;
  latestObservation: HealthObservation;
}

export interface FleetHealthOverviewItem {
  sessionId: string;
  severity: HealthSeverity;
  monitored: boolean;
  lastObservation?: HealthObservation;
  activeIncident?: HealthIncident;
}

export type HealthTrendRange = "24h" | "7d" | "30d";

export interface HealthTrendPoint {
  collectedAt: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  load1: number;
  failedServices: number;
  unhealthySamples: number;
}

export interface HealthIncidentEvidence {
  exportedAt: string;
  session?: Pick<SessionRecord, "id" | "name" | "host" | "port" | "username" | "groupId" | "environment" | "tags" | "owner">;
  incident: Omit<HealthIncident, "lastNotifiedAt" | "notifiedSeverity">;
  events: HealthIncidentEvent[];
  trends: Record<HealthTrendRange, HealthTrendPoint[]>;
  runbooks: Array<Pick<RunbookRun, "id" | "runbookId" | "runbookName" | "incidentId" | "status" | "startedAt" | "finishedAt">>;
}

export const WORKSPACE_PACKAGE_FORMAT = "termdock-workspace" as const;
export const WORKSPACE_PACKAGE_VERSION = 1 as const;

export type WorkspaceImportStrategy = "skip" | "overwrite" | "rename";

export interface WorkspacePackageState {
  sessions: SessionRecord[];
  runbooks: Runbook[];
  syncProfiles: SyncProfile[];
  pinnedMonitors: PinnedMonitor[];
  /** Health rules and policy preferences stay local by default unless explicitly selected. */
  healthRules: Record<string, unknown>;
  policyBundle: Record<string, unknown>;
}

export interface WorkspacePackageFile {
  format: typeof WORKSPACE_PACKAGE_FORMAT;
  version: typeof WORKSPACE_PACKAGE_VERSION;
  exportedAt: string;
  saltBase64: string;
  ivBase64: string;
  authTagBase64: string;
  ciphertextBase64: string;
}

export interface WorkspacePackagePreview {
  exportedAt: string;
  sessionCount: number;
  runbookCount: number;
  syncProfileCount: number;
  pinnedMonitorCount: number;
  includesCredentials: boolean;
}

export interface WorkspacePackageExportInput {
  appVersion: string;
  passphrase: string;
  includeCredentials?: boolean;
  includePrivateKeyFiles?: boolean;
}

export interface WorkspacePackageExportResult {
  file: WorkspacePackageFile;
  warnings: string[];
}

export interface WorkspacePackagePreviewInput {
  fileText: string;
  passphrase: string;
}

export interface WorkspacePackagePreviewResult {
  preview: WorkspacePackagePreview;
}

export interface WorkspacePackageImportInput extends WorkspacePackagePreviewInput {
  sessionStrategy: WorkspaceImportStrategy;
  restoreCredentials?: boolean;
  includePrivateKeyFiles?: boolean;
}

export interface WorkspacePackageImportResult {
  preview: WorkspacePackagePreview;
  sessionsCreated: number;
  sessionsUpdated: number;
  sessionsSkipped: number;
  warnings: string[];
}

export type OperationsEvent =
  | { type: "runbookRun"; run: RunbookRun }
  | { type: "syncRun"; run: SyncRun }
  | { type: "healthObservation"; observation: HealthObservation }
  | { type: "healthIncident"; incident: HealthIncident }
  | { type: "focusHealthIncident"; incidentId: string };
