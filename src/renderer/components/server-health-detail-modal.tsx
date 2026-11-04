import type {
  ServerFilesystemUsage,
  ServerHealthSnapshot,
  ServerNetworkInterfaceUsage,
  ServerProcessEntry,
  ServerProcessSnapshot
} from "../../shared/terminal";
import type { ServerHealthDerivedMetrics } from "../use-server-health-monitor";

import { UiIcon } from "./ui-icon";
import { HealthUsageMeter, ServerGpuDetails } from "./server-gpu-details";
import "../styles/server-health-details.css";

export type ServerHealthDetailTab =
  | "overview"
  | "gpu"
  | "disk"
  | "network"
  | "processes"
  | "services";

export interface ServerHealthDetailAlertStatus {
  cpuHigh: boolean;
  diskHigh: boolean;
  hasAny: boolean;
  memoryHigh: boolean;
}

export interface ServerHealthDetailModalProps {
  alertStatus: ServerHealthDetailAlertStatus;
  canRefresh: boolean;
  collectedAtLabel: string;
  cpuCoreLabel: string;
  detailTab: ServerHealthDetailTab;
  filesystems: ServerFilesystemUsage[];
  formatOptionalPercent: (value?: number) => string;
  formatPercent: (value: number) => string;
  formatProcessPercent: (value: number) => string;
  formatTransferBytes: (bytes: number) => string;
  formatUptime: (seconds: number) => string;
  isConnected: boolean;
  kernelLabel: string;
  loadPerCore: number | null;
  memoryAvailableBytes: number;
  memoryProcesses: ServerProcessEntry[];
  metrics: ServerHealthDerivedMetrics | null;
  networkInterfaces: ServerNetworkInterfaceUsage[];
  onClose: () => void;
  onRefresh: () => void;
  onSelectTab: (tab: ServerHealthDetailTab) => void;
  open: boolean;
  processError: string | null;
  processLoading: boolean;
  processSnapshot: ServerProcessSnapshot | null;
  serverHealth: ServerHealthSnapshot | null;
  serverHealthError: string | null;
  subtitle: string;
  swapUsagePercent: number;
}

const SERVER_HEALTH_DETAIL_TABS: Array<{
  id: ServerHealthDetailTab;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "gpu", label: "GPU" },
  { id: "disk", label: "Disk" },
  { id: "network", label: "Network" },
  { id: "processes", label: "Processes" },
  { id: "services", label: "Services" }
];

export function ServerHealthDetailModal({
  alertStatus,
  canRefresh,
  collectedAtLabel,
  cpuCoreLabel,
  detailTab,
  filesystems,
  formatOptionalPercent,
  formatPercent,
  formatProcessPercent,
  formatTransferBytes,
  formatUptime,
  isConnected,
  kernelLabel,
  loadPerCore,
  memoryAvailableBytes,
  memoryProcesses,
  metrics,
  networkInterfaces,
  onClose,
  onRefresh,
  onSelectTab,
  open,
  processError,
  processLoading,
  processSnapshot,
  serverHealth,
  serverHealthError,
  subtitle,
  swapUsagePercent
}: ServerHealthDetailModalProps) {
  if (!open) {
    return null;
  }
  const gpus = serverHealth?.gpus ?? [];
  const gpuUtilizations = gpus.flatMap((gpu) => gpu.utilizationPercent === undefined ? [] : [gpu.utilizationPercent]);
  const peakGpuUsage = gpuUtilizations.length ? Math.max(...gpuUtilizations) : undefined;
  const failedServices = processSnapshot?.failedServices.length ?? 0;
  const needsAttention = alertStatus.hasAny || failedServices > 0;
  const serviceAssessment = processError ? "Service status unavailable."
    : !processSnapshot ? "Service status has not been collected."
    : failedServices > 0 ? `${failedServices} failed service(s) detected.` : "No failed services detected.";

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label="Server Health Details"
        aria-modal="true"
        className="modal modal--server-health-details"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <div>
            <h3>Server Health Details</h3>
            <p className="hint server-health-modal__subtitle">{subtitle}</p>
          </div>
          <button
            aria-label="Close server health details"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <UiIcon name="close" />
          </button>
        </div>
        <div className="server-health-modal__body">
        {!isConnected ? (
          <p className="hint">Connect the active terminal tab to collect metrics.</p>
        ) : null}
        {serverHealthError ? <p className="hint sftp-error">{serverHealthError}</p> : null}
        {serverHealth ? (
          <div className="server-health-details">
            <div className={`server-health-diagnosis${needsAttention ? " is-alert" : ""}`}>
              <div>
                <span>Current assessment</span>
                <strong>{needsAttention ? "Attention required" : "No active threshold breach"}</strong>
              </div>
              <p>{alertStatus.hasAny ? `High ${[alertStatus.cpuHigh ? "CPU" : "", alertStatus.memoryHigh ? "memory" : "", alertStatus.diskHigh ? "disk" : ""].filter(Boolean).join(", ")}.` : "CPU, memory and disk remain below their configured warning levels."} {serviceAssessment}</p>
              <div className="server-health-diagnosis__meta"><span>{isConnected ? "Connected" : "Disconnected"}</span><span>Collected {collectedAtLabel}</span></div>
            </div>
            <div className="server-health-grid server-health-grid--details">
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
                <span className="server-health-card__meta">
                  <span>Cores</span> {cpuCoreLabel}
                </span>
                <HealthUsageMeter value={metrics?.cpuUsagePercent} label="CPU usage" />
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
                  <span>Used</span> {formatTransferBytes(serverHealth.memoryUsedBytes)} ·{" "}
                  <span>Available</span> {formatTransferBytes(memoryAvailableBytes)}
                </span>
                <HealthUsageMeter value={metrics?.memoryUsagePercent} label="Memory usage" />
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
                <span className="server-health-card__meta">
                  {serverHealth.diskPath} · <span>Free</span>{" "}
                  {formatTransferBytes(serverHealth.diskAvailableBytes)} · <span>Total</span>{" "}
                  {formatTransferBytes(serverHealth.diskTotalBytes)}
                </span>
                <HealthUsageMeter value={metrics?.diskUsagePercent} label="Disk usage" />
              </div>
              <button className="server-health-card server-health-card--gpu" type="button" onClick={() => onSelectTab("gpu")}>
                <span className="server-health-card__label">GPU</span>
                <strong className="server-health-card__value">{peakGpuUsage === undefined ? "—" : formatPercent(peakGpuUsage)}</strong>
                <span className="server-health-card__meta">{gpus.length === 1 ? gpus[0].name : gpus.length ? <>{gpus.length} <span>GPUs</span> · <span>Peak utilization</span></> : "GPU metrics unavailable"}</span>
                <HealthUsageMeter value={peakGpuUsage} label="Peak GPU utilization" />
              </button>
              <div className="server-health-card server-health-card--network">
                <span className="server-health-card__label">Network</span>
                <strong className="server-health-card__value">
                  RX {formatTransferBytes(metrics?.rxBytesPerSecond ?? 0)}/s
                </strong>
                <span className="server-health-card__meta">
                  TX {formatTransferBytes(metrics?.txBytesPerSecond ?? 0)}/s · <span>Total</span> RX{" "}
                  {formatTransferBytes(serverHealth.networkRxBytes)} / TX{" "}
                  {formatTransferBytes(serverHealth.networkTxBytes)}
                </span>
              </div>
              <div className="server-health-card server-health-card--load">
                <span className="server-health-card__label">Load</span>
                <strong className="server-health-card__value">
                  {serverHealth.load1.toFixed(2)} / {serverHealth.load5.toFixed(2)} /{" "}
                  {serverHealth.load15.toFixed(2)}
                </strong>
                <span className="server-health-card__meta">1m / 5m / 15m</span>
              </div>
              <div className="server-health-card server-health-card--uptime">
                <span className="server-health-card__label">Uptime</span>
                <strong className="server-health-card__value">
                  {formatUptime(serverHealth.uptimeSeconds)}
                </strong>
                <span className="server-health-card__meta">{serverHealth.hostname}</span>
              </div>
              <div className="server-health-card server-health-card--swap">
                <span className="server-health-card__label">Swap</span>
                <strong className="server-health-card__value">{formatPercent(swapUsagePercent)}</strong>
                <span className="server-health-card__meta">{formatTransferBytes(serverHealth.swapUsedBytes ?? 0)} / {formatTransferBytes(serverHealth.swapTotalBytes ?? 0)}</span>
                <HealthUsageMeter value={swapUsagePercent} label="Swap usage" />
              </div>
            </div>
            <div className="server-health-detail-tabs" role="tablist" aria-label="Server health sections">
              {SERVER_HEALTH_DETAIL_TABS.map((tab) => (
                <button
                  aria-selected={detailTab === tab.id}
                  aria-controls={`server-health-panel-${tab.id}`}
                  id={`server-health-tab-${tab.id}`}
                  className={
                    detailTab === tab.id
                      ? "server-health-detail-tab is-active"
                      : "server-health-detail-tab"
                  }
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}{tab.id === "gpu" && gpus.length > 0 ? ` (${gpus.length})` : ""}
                </button>
              ))}
            </div>
            <div className="server-health-detail-panel" role="tabpanel" id={`server-health-panel-${detailTab}`} aria-labelledby={`server-health-tab-${detailTab}`}>
              {detailTab === "gpu" ? <ServerGpuDetails snapshot={serverHealth} formatBytes={formatTransferBytes} formatPercent={formatPercent} /> : null}
              {detailTab === "overview" ? (
                <div className="server-health-info-grid" aria-label="System information">
                  <div className="server-health-info-item">
                    <span className="server-health-info-item__label">Hostname</span>
                    <strong className="server-health-info-item__value">{serverHealth.hostname}</strong>
                  </div>
                  <div className="server-health-info-item">
                    <span className="server-health-info-item__label">OS</span>
                    <strong className="server-health-info-item__value">{serverHealth.osName || "-"}</strong>
                  </div>
                  <div className="server-health-info-item">
                    <span className="server-health-info-item__label">Kernel</span>
                    <strong className="server-health-info-item__value">{kernelLabel}</strong>
                  </div>
                  <div className="server-health-info-item">
                    <span className="server-health-info-item__label">Architecture</span>
                    <strong className="server-health-info-item__value">
                      {serverHealth.architecture || "-"}
                    </strong>
                  </div>
                  <div className="server-health-info-item">
                    <span className="server-health-info-item__label">Total memory</span>
                    <strong className="server-health-info-item__value">{formatTransferBytes(serverHealth.memoryTotalBytes)}</strong>
                  </div>
                  <div className="server-health-info-item">
                    <span className="server-health-info-item__label">Load / core</span>
                    <strong className="server-health-info-item__value">
                      {loadPerCore === null ? "-" : loadPerCore.toFixed(2)}
                    </strong>
                  </div>
                  <div className="server-health-info-item">
                    <span className="server-health-info-item__label">Free memory</span>
                    <strong className="server-health-info-item__value">
                      {formatTransferBytes(serverHealth.memoryFreeBytes ?? 0)}
                    </strong>
                  </div>
                  <div className="server-health-info-item">
                    <span className="server-health-info-item__label">Cache / buffers</span>
                    <strong className="server-health-info-item__value">
                      {formatTransferBytes(serverHealth.memoryCachedBytes ?? 0)} /{" "}
                      {formatTransferBytes(serverHealth.memoryBufferBytes ?? 0)}
                    </strong>
                  </div>
                </div>
              ) : null}
              {detailTab === "disk" ? (
                <div className="server-health-table server-health-table--disk">
                  <div className="server-health-table__row server-health-table__row--header">
                    <span>Mount</span>
                    <span>Type</span>
                    <span>Used</span>
                    <span>Free</span>
                    <span>Use</span>
                    <span>Inodes</span>
                  </div>
                  {filesystems.map((entry) => (
                    <div className="server-health-table__row" key={`${entry.filesystem}-${entry.path}`}>
                      <span className="server-health-table__main" title={`${entry.filesystem} ${entry.path}`}>
                        {entry.path}
                      </span>
                      <span>{entry.type || "-"}</span>
                      <span>
                        {formatTransferBytes(entry.usedBytes)}/{formatTransferBytes(entry.totalBytes)}
                      </span>
                      <span>{formatTransferBytes(entry.availableBytes)}</span>
                      <span>{formatOptionalPercent(entry.usePercent)}</span>
                      <span>{formatOptionalPercent(entry.inodeUsedPercent)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {detailTab === "network" ? (
                <div className="server-health-table server-health-table--network">
                  <div className="server-health-table__row server-health-table__row--header">
                    <span>Interface</span>
                    <span>RX</span>
                    <span>TX</span>
                    <span>RX errors</span>
                    <span>TX errors</span>
                    <span>Dropped</span>
                  </div>
                  {networkInterfaces.length ? (
                    networkInterfaces.map((entry) => (
                      <div className="server-health-table__row" key={entry.name}>
                        <span className="server-health-table__main">{entry.name}</span>
                        <span>{formatTransferBytes(entry.rxBytes)}</span>
                        <span>{formatTransferBytes(entry.txBytes)}</span>
                        <span>{entry.rxErrors ?? 0}</span>
                        <span>{entry.txErrors ?? 0}</span>
                        <span>
                          {(entry.rxDropped ?? 0).toLocaleString()}/{(entry.txDropped ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="hint">No network interface data yet.</p>
                  )}
                </div>
              ) : null}
              {detailTab === "processes" ? (
                <>
                  {processError ? <p className="hint sftp-error">{processError}</p> : null}
                  {processLoading && !processSnapshot ? (
                    <p className="hint" role="status" aria-live="polite">
                      Collecting process details...
                    </p>
                  ) : null}
                  <div className="server-health-details__columns">
                    <div className="server-health-processes">
                      <p className="hint server-health-processes__title">Top processes (CPU)</p>
                      {processSnapshot?.processes?.length ? (
                        <ul className="server-health-processes__list">
                          <li className="server-health-processes__item server-health-processes__item--header">
                            <span className="server-health-processes__pid">PID</span>
                            <span className="server-health-processes__user">User</span>
                            <span className="server-health-processes__command">Command</span>
                            <span className="server-health-processes__cpu">CPU</span>
                            <span className="server-health-processes__mem">MEM</span>
                          </li>
                          {processSnapshot.processes.map((entry) => (
                            <li className="server-health-processes__item" key={`cpu-${entry.pid}-${entry.command}`}>
                              <span className="server-health-processes__pid">{entry.pid}</span>
                              <span className="server-health-processes__user" title={entry.user}>
                                {entry.user}
                              </span>
                              <span className="server-health-processes__command" title={entry.command}>
                                {entry.command}
                              </span>
                              <span className="server-health-processes__cpu">
                                {formatProcessPercent(entry.cpuPercent)}
                              </span>
                              <span className="server-health-processes__mem">
                                {formatProcessPercent(entry.memoryPercent)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="hint">No process data yet.</p>
                      )}
                    </div>
                    <div className="server-health-processes">
                      <p className="hint server-health-processes__title">Top processes (Memory)</p>
                      {memoryProcesses.length ? (
                        <ul className="server-health-processes__list">
                          <li className="server-health-processes__item server-health-processes__item--header">
                            <span className="server-health-processes__pid">PID</span>
                            <span className="server-health-processes__user">User</span>
                            <span className="server-health-processes__command">Command</span>
                            <span className="server-health-processes__cpu">CPU</span>
                            <span className="server-health-processes__mem">MEM</span>
                          </li>
                          {memoryProcesses.map((entry) => (
                            <li className="server-health-processes__item" key={`mem-${entry.pid}-${entry.command}`}>
                              <span className="server-health-processes__pid">{entry.pid}</span>
                              <span className="server-health-processes__user" title={entry.user}>
                                {entry.user}
                              </span>
                              <span className="server-health-processes__command" title={entry.command}>
                                {entry.command}
                              </span>
                              <span className="server-health-processes__cpu">
                                {formatProcessPercent(entry.cpuPercent)}
                              </span>
                              <span className="server-health-processes__mem">
                                {formatProcessPercent(entry.memoryPercent)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="hint">No process data yet.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
              {detailTab === "services" ? (
                <div className="server-health-services server-health-services--details">
                  <p className="hint server-health-processes__title">Failed services</p>
                  {processError ? <p className="hint sftp-error">{processError}</p> : null}
                  {processSnapshot?.failedServices?.length ? (
                    <ul className="server-health-services__list server-health-services__list--details">
                      {processSnapshot.failedServices.map((entry) => (
                        <li
                          className="server-health-services__item server-health-services__item--details"
                          key={entry.name}
                        >
                          <strong>{entry.name}</strong>
                          <span>
                            {[entry.loadState, entry.activeState, entry.subState].filter(Boolean).join(" / ") ||
                              "-"}
                          </span>
                          {entry.description ? <small>{entry.description}</small> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">{processError ? "Service status unavailable." : !processSnapshot ? "Service status has not been collected." : "No failed services detected."}</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="hint">No server metrics collected yet.</p>
        )}
        </div>
        <div className="modal__actions">
          <button className="secondary-button" disabled={!canRefresh} onClick={onRefresh} type="button">
            Refresh
          </button>
          <button className="primary-button" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
