/** Shared shapes for Phase 4 disconnect-report persistence. */

export type PersistedDisconnectReportTrigger = "status" | "error";

export type PersistedDisconnectReportStatus = "connected" | "connecting" | "closed";

export interface PersistedDisconnectReportFailureSample {
  direction: "upload" | "download";
  name: string;
  message: string;
  updatedAt: number;
}

export interface PersistedDisconnectReportItem {
  id: string;
  createdAt: string;
  tabId: string;
  tabTitle: string;
  sessionId: string;
  sessionName: string;
  target: string;
  trigger: PersistedDisconnectReportTrigger;
  status?: PersistedDisconnectReportStatus;
  message: string;
  activeTabId: string | null;
  wasActiveTab: boolean;
  openTabCount: number;
  connectedTabCount: number;
  autoReconnect: boolean;
  reconnectDelaySeconds: number;
  uploadRunning: number;
  uploadQueued: number;
  downloadRunning: number;
  downloadQueued: number;
  pausedUpload: boolean;
  pausedDownload: boolean;
  portForwardTotal: number;
  portForwardDegraded: number;
  portForwardBusy: boolean;
  serverHealthLoading: boolean;
  serverProcessLoading: boolean;
  serverHealthError?: string;
  serverProcessError?: string;
  recentFailures: PersistedDisconnectReportFailureSample[];
}
