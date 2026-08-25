import { useEffect, useRef, useState, type CSSProperties } from "react";

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
  failedServices: number | null;
  formatUptime: (seconds: number) => string;
  serverHealth: ServerHealthSnapshot | null;
  serverHealthError: string | null;
  thresholds: {
    cpuWarnPercent: number;
    memoryWarnPercent: number;
    diskWarnPercent: number;
  };
  updatedLabel: string;
}

type ResourceMetricKey = "cpuUsagePercent" | "memoryUsagePercent" | "diskUsagePercent";

interface ResourceMeterProps {
  alert: boolean;
  delta: number;
  label: string;
  percent: number;
  threshold: number;
}

function ResourceMeter({ alert, delta, label, percent, threshold }: ResourceMeterProps) {
  const safePercent = Math.max(0, Math.min(100, percent));
  const trend = Math.abs(delta) < 0.5 ? "steady" : delta > 0 ? "up" : "down";
  return (
    <div className={`server-health-meter${alert ? " is-alert" : ""}`}>
      <div className="server-health-meter__heading">
        <span>{label}</span>
        <strong>{safePercent.toFixed(0)}%</strong>
        <em className={`server-health-meter__trend is-${trend}`} title={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)} percentage points since the previous sample`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
        </em>
      </div>
      <div
        className="server-health-meter__track"
        style={{
          "--health-meter-pct": `${safePercent}%`,
          "--health-threshold-pct": `${Math.max(0, Math.min(100, threshold))}%`
        } as CSSProperties}
      >
        <span className="server-health-meter__fill" />
        <i className="server-health-meter__threshold" title={`Warning threshold ${threshold}%`} />
      </div>
    </div>
  );
}

export function ServerHealthInspectorContent({
  alertStatus,
  formatPercent,
  formatTransferBytes,
  isConnected,
  loading,
  metrics,
  failedServices,
  formatUptime,
  serverHealth,
  serverHealthError,
  thresholds,
  updatedLabel
}: ServerHealthInspectorContentProps) {
  const previousMetricsRef = useRef<ServerHealthDerivedMetrics | null>(null);
  const previousTabIdRef = useRef<string | null>(null);
  const [resourceDeltas, setResourceDeltas] = useState<Record<ResourceMetricKey, number>>({
    cpuUsagePercent: 0,
    memoryUsagePercent: 0,
    diskUsagePercent: 0
  });

  useEffect(() => {
    if (!metrics || !serverHealth) {
      previousMetricsRef.current = null;
      previousTabIdRef.current = null;
      setResourceDeltas({ cpuUsagePercent: 0, memoryUsagePercent: 0, diskUsagePercent: 0 });
      return;
    }
    const previous =
      previousTabIdRef.current === serverHealth.tabId ? previousMetricsRef.current : null;
    setResourceDeltas({
      cpuUsagePercent: previous ? metrics.cpuUsagePercent - previous.cpuUsagePercent : 0,
      memoryUsagePercent: previous ? metrics.memoryUsagePercent - previous.memoryUsagePercent : 0,
      diskUsagePercent: previous ? metrics.diskUsagePercent - previous.diskUsagePercent : 0
    });
    previousMetricsRef.current = metrics;
    previousTabIdRef.current = serverHealth.tabId;
  }, [metrics, serverHealth]);

  const swapUsagePercent =
    serverHealth?.swapTotalBytes && serverHealth.swapTotalBytes > 0
      ? ((serverHealth.swapUsedBytes ?? 0) / serverHealth.swapTotalBytes) * 100
      : 0;

  return (
    <>
      {!isConnected ? (
        <p className="hint">Monitoring is paused until the active terminal tab connects.</p>
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
      {loading && !serverHealth ? (
        <p className="hint" role="status" aria-live="polite">
          Collecting server metrics...
        </p>
      ) : null}
      {serverHealth && isConnected ? (
        <>
          <div className="server-health-dashboard">
            <div className="server-health-dashboard__resources">
              <ResourceMeter alert={alertStatus.cpuHigh} delta={resourceDeltas.cpuUsagePercent} label="CPU" percent={metrics?.cpuUsagePercent ?? 0} threshold={thresholds.cpuWarnPercent} />
              <ResourceMeter alert={alertStatus.memoryHigh} delta={resourceDeltas.memoryUsagePercent} label="Memory" percent={metrics?.memoryUsagePercent ?? 0} threshold={thresholds.memoryWarnPercent} />
              <ResourceMeter alert={alertStatus.diskHigh} delta={resourceDeltas.diskUsagePercent} label={`Disk ${serverHealth.diskPath || "/"}`} percent={metrics?.diskUsagePercent ?? 0} threshold={thresholds.diskWarnPercent} />
            </div>
            <div className="server-health-dashboard__facts">
              <div><span>Load 1/5/15</span><strong>{serverHealth.load1.toFixed(2)} / {serverHealth.load5.toFixed(2)} / {serverHealth.load15.toFixed(2)}</strong></div>
              <div><span>Network</span><strong>↓ {formatTransferBytes(metrics?.rxBytesPerSecond ?? 0)}/s · ↑ {formatTransferBytes(metrics?.txBytesPerSecond ?? 0)}/s</strong></div>
              <div><span>Swap</span><strong>{serverHealth.swapTotalBytes ? formatPercent(swapUsagePercent) : "Not configured"}</strong></div>
              <div><span>Uptime</span><strong>{formatUptime(serverHealth.uptimeSeconds)}</strong></div>
              <div className={failedServices && failedServices > 0 ? "is-alert" : ""}><span>Failed services</span><strong>{failedServices ?? "—"}</strong></div>
            </div>
          </div>
          <p className="hint server-health__footnote">
            Updated: {updatedLabel}
            {loading ? <span className="server-health__refreshing"> · refreshing...</span> : null}
          </p>
        </>
      ) : null}
    </>
  );
}
