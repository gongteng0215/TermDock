import type { ServerHealthSnapshot } from "../../shared/terminal";
import type { ServerHealthDerivedMetrics } from "../use-server-health-monitor";

export interface ServerHealthInspectorAlertStatus {
  hasAny: boolean;
  cpuHigh: boolean;
  memoryHigh: boolean;
  diskHigh: boolean;
}

interface ServerHealthInspectorContentProps {
  alertStatus: ServerHealthInspectorAlertStatus;
  formatPercent: (value: number) => string;
  formatTransferBytes: (bytes: number) => string;
  isConnected: boolean;
  loading: boolean;
  metrics: ServerHealthDerivedMetrics | null;
  serverHealth: ServerHealthSnapshot | null;
  serverHealthError: string | null;
  updatedLabel: string;
}

export function ServerHealthInspectorContent({
  alertStatus,
  formatPercent,
  formatTransferBytes,
  isConnected,
  loading,
  metrics,
  serverHealth,
  serverHealthError,
  updatedLabel
}: ServerHealthInspectorContentProps) {
  return (
    <>
      {!isConnected ? (
        <p className="hint">Connect the active terminal tab to collect metrics.</p>
      ) : null}
      {serverHealthError ? <p className="hint sftp-error">{serverHealthError}</p> : null}
      {alertStatus.hasAny ? (
        <p className="hint server-health__alert-text">
          Threshold reached:
          {alertStatus.cpuHigh ? " CPU" : ""}
          {alertStatus.memoryHigh ? " Memory" : ""}
          {alertStatus.diskHigh ? " Disk" : ""}
        </p>
      ) : null}
      {loading ? (
        <p className="hint" role="status" aria-live="polite">
          Collecting server metrics...
        </p>
      ) : null}
      {serverHealth ? (
        <>
          <div className="server-health-grid">
            <div
              className={
                alertStatus.cpuHigh
                  ? "server-health-card server-health-card--cpu is-alert"
                  : "server-health-card server-health-card--cpu"
              }
            >
              <span className="server-health-card__label">CPU</span>
              <strong className="server-health-card__value">
                {formatPercent(metrics?.cpuUsagePercent ?? 0)}
              </strong>
            </div>
            <div
              className={
                alertStatus.memoryHigh
                  ? "server-health-card server-health-card--memory is-alert"
                  : "server-health-card server-health-card--memory"
              }
            >
              <span className="server-health-card__label">Memory</span>
              <strong className="server-health-card__value">
                {formatPercent(metrics?.memoryUsagePercent ?? 0)}
              </strong>
              <span className="server-health-card__meta">
                {formatTransferBytes(serverHealth.memoryUsedBytes)}/
                {formatTransferBytes(serverHealth.memoryTotalBytes)}
              </span>
            </div>
            <div
              className={
                alertStatus.diskHigh
                  ? "server-health-card server-health-card--disk is-alert"
                  : "server-health-card server-health-card--disk"
              }
            >
              <span className="server-health-card__label">Disk</span>
              <strong className="server-health-card__value">
                {formatPercent(metrics?.diskUsagePercent ?? 0)}
              </strong>
            </div>
          </div>
          <p className="hint server-health__footnote">Updated: {updatedLabel}</p>
        </>
      ) : null}
    </>
  );
}
