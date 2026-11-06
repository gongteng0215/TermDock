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
  alert?: boolean;
  delta?: number;
  detail?: string;
  label: string;
  percent?: number;
  threshold?: number;
}

function ResourceMeter({ alert, delta, detail, label, percent, threshold }: ResourceMeterProps) {
  const available = percent !== undefined && Number.isFinite(percent);
  const safePercent = available ? Math.max(0, Math.min(100, percent)) : 0;
  const trend = delta === undefined || Math.abs(delta) < 0.5 ? "steady" : delta > 0 ? "up" : "down";
  return (
    <div className={`server-health-meter${alert ? " is-alert" : ""}${available ? "" : " is-unavailable"}`}>
      <div className="server-health-meter__heading">
        <span>{label}</span>
        <strong>{available ? `${safePercent.toFixed(0)}%` : "—"}</strong>
        {delta !== undefined ? (
          <em className={`server-health-meter__trend is-${trend}`} title={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)} percentage points since the previous sample`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
          </em>
        ) : null}
      </div>
      <div
        className="server-health-meter__track"
        style={{
          "--health-meter-pct": `${safePercent}%`,
          "--health-threshold-pct": threshold === undefined ? undefined : `${Math.max(0, Math.min(100, threshold))}%`
        } as CSSProperties}
      >
        <span className="server-health-meter__fill" />
        {threshold !== undefined ? <i className="server-health-meter__threshold" title={`Warning threshold ${threshold}%`} /> : null}
      </div>
      {detail ? <span className="server-health-meter__detail" title={detail}>{detail}</span> : null}
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
            <div className="server-health-dashboard__gpus">
              {serverHealth.gpus?.length ? serverHealth.gpus.map((gpu) => {
                const memoryPercent = gpu.memoryTotalBytes && gpu.memoryTotalBytes > 0 && gpu.memoryUsedBytes !== undefined
                  ? gpu.memoryUsedBytes / gpu.memoryTotalBytes * 100
                  : undefined;
                const memoryDetail = `${gpu.memoryUsedBytes === undefined ? "—" : formatTransferBytes(gpu.memoryUsedBytes)} / ${gpu.memoryTotalBytes === undefined ? "—" : formatTransferBytes(gpu.memoryTotalBytes)}`;
                return (
                  <section className="server-health-gpu-summary" key={gpu.id} aria-label={gpu.name}>
                    <div className="server-health-gpu-summary__heading">
                      <span>GPU {gpu.index}</span>
                      <strong title={gpu.name}>{gpu.name}</strong>
                    </div>
                    <ResourceMeter label="GPU utilization" percent={gpu.utilizationPercent} />
                    <ResourceMeter label="VRAM" percent={memoryPercent} detail={memoryDetail} />
                  </section>
                );
              }) : (
                <div className="server-health-gpu-summary">
                  <ResourceMeter label="GPU" />
                  <p className="server-health-gpu-summary__status" role="status">
                    {serverHealth.gpuStatus === "error" ? "GPU collection failed" : "GPU metrics unavailable"}
                  </p>
                  <p className="server-health-gpu-summary__status">
                    {serverHealth.gpuStatus === "error"
                      ? "Open Info for GPU collection details."
                      : "Requires NVIDIA and remote nvidia-smi."}
                  </p>
                </div>
              )}
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
