import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FleetHealthOverviewItem, HealthIncident, HealthIncidentEvent, HealthObservation, HealthTrendPoint, HealthTrendRange, PinnedMonitor, Runbook, RunbookRun, SyncPlan, SyncProfile, SyncRun, TrustedHostKey, WorkspaceImportStrategy } from "../../shared/operations";
import type { SessionEnvironment, SessionRecord, SessionUpdateInput } from "../../shared/session";
import { AppDialogModal, type AppDialogOptionView, type AppDialogView } from "./app-dialogs";
import { ModalShell } from "./modal-shell";

type OperationsHubSection = "palette" | "runbooks" | "assets" | "trust" | "sync" | "fleet" | "workspace";
type FleetFilter = "all" | "critical" | "warning" | "healthy" | "needsAttention" | "unmonitored";

type HubPromptOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: "text" | "password";
};

type HubConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  detailText?: string;
};

type HubChoiceOptions = {
  title?: string;
  cancelLabel?: string;
  detailText?: string;
};

interface OperationsHubProps {
  open: boolean;
  sessions: SessionRecord[];
  selectedSessionIds: string[];
  onClose: () => void;
  onRequestOpen: () => void;
  onOpenSession: (session: SessionRecord) => void;
  onOpenSettings: () => void;
  onSaveSession: (sessionId: string, patch: SessionUpdateInput) => Promise<void>;
  onReloadSessions: () => Promise<void>;
  onPinnedMonitorChange: (monitor: PinnedMonitor) => void;
  onError: (message: string) => void;
}

const SECTION_LABELS: Array<{ id: OperationsHubSection; label: string }> = [
  { id: "palette", label: "Quick switcher" },
  { id: "runbooks", label: "Runbooks" },
  { id: "assets", label: "Assets" },
  { id: "trust", label: "Trust Center" },
  { id: "sync", label: "Sync" },
  { id: "fleet", label: "Fleet Health" },
  { id: "workspace", label: "Workspace package" }
];

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function variablesFromCommand(command: string): Runbook["variables"] {
  const seen = new Set<string>();
  const variables: Runbook["variables"] = [];
  for (const match of command.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
    const name = match[1];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    variables.push({ name, label: name, required: true });
  }
  return variables;
}

function formatRunStatus(run: RunbookRun): string {
  const succeeded = run.targetResults.filter((result) => result.status === "succeeded").length;
  const failed = run.targetResults.filter((result) => result.status === "failed").length;
  return `${run.status} · ${succeeded} succeeded${failed ? ` · ${failed} failed` : ""}`;
}

function splitTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).slice(0, 32);
}

function fleetRank(status: FleetFilter): number {
  return status === "critical" ? 0 : status === "warning" ? 1 : status === "needsAttention" ? 2 : status === "healthy" ? 3 : 4;
}

function fleetLabel(status: FleetFilter): string {
  return status === "needsAttention" ? "Needs manual connection" : status === "unmonitored" ? "Not monitored" : status[0].toUpperCase() + status.slice(1);
}

const TREND_CHART_WIDTH = 640;
const TREND_CHART_HEIGHT = 142;
const TREND_PLOT_LEFT = 38;
const TREND_PLOT_RIGHT = 630;
const TREND_PLOT_TOP = 10;
const TREND_PLOT_BOTTOM = 116;

function finiteTrendValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatTrendRate(bytesPerSecond: number): string {
  const value = finiteTrendValue(bytesPerSecond);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB/s`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB/s`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB/s`;
  return `${value.toFixed(0)} B/s`;
}

function formatTrendTime(value: string, range: HealthTrendRange): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return range === "24h"
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function trendPointX(index: number, count: number): number {
  return count <= 1
    ? TREND_PLOT_LEFT
    : TREND_PLOT_LEFT + (index / (count - 1)) * (TREND_PLOT_RIGHT - TREND_PLOT_LEFT);
}

function trendPointY(value: number, maximum: number): number {
  const bounded = Math.max(0, Math.min(maximum, finiteTrendValue(value)));
  return TREND_PLOT_BOTTOM - (bounded / Math.max(1, maximum)) * (TREND_PLOT_BOTTOM - TREND_PLOT_TOP);
}

function trendSegments(
  points: HealthTrendPoint[],
  read: (point: HealthTrendPoint) => number,
  maximum: number,
  omitDegraded = false
): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (omitDegraded && point.unhealthySamples > 0) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${trendPointX(index, points.length)},${trendPointY(read(point), maximum)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));
  return segments;
}

function trendStats(points: HealthTrendPoint[], read: (point: HealthTrendPoint) => number) {
  const values = points.map(read).map(finiteTrendValue);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    latest: values.at(-1) ?? 0,
    average: values.length ? total / values.length : 0,
    maximum: values.length ? Math.max(...values) : 0
  };
}

interface TrendMiniCardProps {
  className: string;
  label: string;
  maximum: number;
  points: HealthTrendPoint[];
  series: Array<{ className: string; read: (point: HealthTrendPoint) => number }>;
  value: string;
}

function TrendMiniCard({ className, label, maximum, points, series, value }: TrendMiniCardProps) {
  return (
    <div className={`fleet-trend-mini ${className}`}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <svg aria-hidden="true" preserveAspectRatio="none" viewBox={`0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}`}>
        {series.flatMap((entry) =>
          trendSegments(points, entry.read, maximum, true).map((coordinates, index) => (
            <polyline className={entry.className} key={`${entry.className}-${index}`} points={coordinates} />
          ))
        )}
      </svg>
    </div>
  );
}

function HealthTrendDashboard({
  cpuCoreCount,
  monitor,
  points,
  range
}: {
  cpuCoreCount?: number;
  monitor?: PinnedMonitor;
  points: HealthTrendPoint[];
  range: HealthTrendRange;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  if (points.length < 2) return <p className="hint">Waiting for enough health samples to draw a trend.</p>;

  const hovered = hoverIndex === null ? null : points[hoverIndex];
  const cpuStats = trendStats(points, (point) => point.cpuUsagePercent);
  const memoryStats = trendStats(points, (point) => point.memoryUsagePercent);
  const diskStats = trendStats(points, (point) => point.diskUsagePercent);
  const loadMaximum = Math.max(
    1,
    cpuCoreCount ?? 1,
    ...points.flatMap((point) => [point.load1, point.load5 ?? 0, point.load15 ?? 0])
  );
  const networkMaximum = Math.max(
    1,
    ...points.flatMap((point) => [point.networkRxBytesPerSecond ?? 0, point.networkTxBytesPerSecond ?? 0])
  );
  const serviceMaximum = Math.max(1, ...points.map((point) => point.failedServices));
  const degradedSamples = points.reduce((count, point) => count + point.unhealthySamples, 0);
  const warningThreshold = Math.min(
    monitor?.cpuWarnPercent ?? 85,
    monitor?.memoryWarnPercent ?? 85,
    monitor?.diskWarnPercent ?? 85
  );
  const criticalThreshold = Math.min(
    monitor?.cpuCriticalPercent ?? 95,
    monitor?.memoryCriticalPercent ?? 95,
    monitor?.diskCriticalPercent ?? 95
  );
  const latest = points.at(-1)!;

  return (
    <div className="fleet-trend-dashboard" aria-label={`Health trend with ${points.length} samples`}>
      <div className="fleet-trend-resource">
        <div className="fleet-trend-resource__heading">
          <div><strong>Resource utilization</strong><span>Fixed 0–100% scale · gaps indicate unavailable samples</span></div>
          <div className="fleet-trend-resource__legend"><span className="is-cpu">CPU</span><span className="is-memory">Memory</span><span className="is-disk">Disk</span></div>
        </div>
        <div className="fleet-trend-resource__plot">
          <svg
            aria-hidden="true"
            onPointerLeave={() => setHoverIndex(null)}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const plotStart = (TREND_PLOT_LEFT / TREND_CHART_WIDTH) * bounds.width;
              const plotWidth = ((TREND_PLOT_RIGHT - TREND_PLOT_LEFT) / TREND_CHART_WIDTH) * bounds.width;
              const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left - plotStart) / Math.max(1, plotWidth)));
              setHoverIndex(Math.round(ratio * (points.length - 1)));
            }}
            preserveAspectRatio="none"
            viewBox={`0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}`}
          >
            {[0, 25, 50, 75, 100].map((value) => <g key={value}><line className="fleet-trend__grid" x1={TREND_PLOT_LEFT} x2={TREND_PLOT_RIGHT} y1={trendPointY(value, 100)} y2={trendPointY(value, 100)} /><text x="2" y={trendPointY(value, 100) + 3}>{value}%</text></g>)}
            <line className="fleet-trend__threshold fleet-trend__threshold--warning" x1={TREND_PLOT_LEFT} x2={TREND_PLOT_RIGHT} y1={trendPointY(warningThreshold, 100)} y2={trendPointY(warningThreshold, 100)} />
            <line className="fleet-trend__threshold fleet-trend__threshold--critical" x1={TREND_PLOT_LEFT} x2={TREND_PLOT_RIGHT} y1={trendPointY(criticalThreshold, 100)} y2={trendPointY(criticalThreshold, 100)} />
            {trendSegments(points, (point) => point.cpuUsagePercent, 100, true).map((coordinates, index) => <polyline className="fleet-trend__cpu" key={`cpu-${index}`} points={coordinates} />)}
            {trendSegments(points, (point) => point.memoryUsagePercent, 100, true).map((coordinates, index) => <polyline className="fleet-trend__memory" key={`memory-${index}`} points={coordinates} />)}
            {trendSegments(points, (point) => point.diskUsagePercent, 100, true).map((coordinates, index) => <polyline className="fleet-trend__disk" key={`disk-${index}`} points={coordinates} />)}
            {hoverIndex !== null ? <line className="fleet-trend__crosshair" x1={trendPointX(hoverIndex, points.length)} x2={trendPointX(hoverIndex, points.length)} y1={TREND_PLOT_TOP} y2={TREND_PLOT_BOTTOM} /> : null}
          </svg>
          {hovered && hoverIndex !== null ? (
            <div className="fleet-trend-tooltip" style={{ left: `${(trendPointX(hoverIndex, points.length) / TREND_CHART_WIDTH) * 100}%` }}>
              <strong>{new Date(hovered.collectedAt).toLocaleString()}</strong>
              <span>CPU {hovered.cpuUsagePercent.toFixed(1)}% · MEM {hovered.memoryUsagePercent.toFixed(1)}% · DISK {hovered.diskUsagePercent.toFixed(1)}%</span>
              <span>Load {hovered.load1.toFixed(2)} / {(hovered.load5 ?? 0).toFixed(2)} / {(hovered.load15 ?? 0).toFixed(2)}</span>
              <span>RX {formatTrendRate(hovered.networkRxBytesPerSecond ?? 0)} · TX {formatTrendRate(hovered.networkTxBytesPerSecond ?? 0)}</span>
              <span>{hovered.failedServices} failed service(s){hovered.unhealthySamples > 0 ? " · connection degraded" : ""}</span>
            </div>
          ) : null}
        </div>
        <div className="fleet-trend__time-axis"><span>{formatTrendTime(points[0].collectedAt, range)}</span><span>{formatTrendTime(points[Math.floor((points.length - 1) / 2)].collectedAt, range)}</span><span>{formatTrendTime(latest.collectedAt, range)}</span></div>
        <div className="fleet-trend-resource__stats">
          <span><b>CPU</b> avg {cpuStats.average.toFixed(0)}% · max {cpuStats.maximum.toFixed(0)}%</span>
          <span><b>MEM</b> avg {memoryStats.average.toFixed(0)}% · max {memoryStats.maximum.toFixed(0)}%</span>
          <span><b>DISK</b> avg {diskStats.average.toFixed(0)}% · max {diskStats.maximum.toFixed(0)}%</span>
        </div>
      </div>
      <div className="fleet-trend-secondary">
        <TrendMiniCard className="fleet-trend-mini--load" label="Load 1 / 5 / 15" maximum={loadMaximum} points={points} series={[{ className: "fleet-trend__load1", read: (point) => point.load1 }, { className: "fleet-trend__load5", read: (point) => point.load5 ?? 0 }, { className: "fleet-trend__load15", read: (point) => point.load15 ?? 0 }]} value={`${latest.load1.toFixed(2)} / ${(latest.load5 ?? 0).toFixed(2)} / ${(latest.load15 ?? 0).toFixed(2)}`} />
        <TrendMiniCard className="fleet-trend-mini--network" label="Network RX / TX" maximum={networkMaximum} points={points} series={[{ className: "fleet-trend__network-rx", read: (point) => point.networkRxBytesPerSecond ?? 0 }, { className: "fleet-trend__network-tx", read: (point) => point.networkTxBytesPerSecond ?? 0 }]} value={`${formatTrendRate(latest.networkRxBytesPerSecond ?? 0)} / ${formatTrendRate(latest.networkTxBytesPerSecond ?? 0)}`} />
        <TrendMiniCard className="fleet-trend-mini--services" label="Failed services" maximum={serviceMaximum} points={points} series={[{ className: "fleet-trend__services", read: (point) => point.failedServices }]} value={`${latest.failedServices} current · ${serviceMaximum} peak`} />
      </div>
      <div className="fleet-trend-status"><div>{points.map((point, index) => <i className={point.unhealthySamples > 0 ? "is-degraded" : "is-healthy"} key={`${point.collectedAt}-${index}`} title={`${new Date(point.collectedAt).toLocaleString()} · ${point.unhealthySamples > 0 ? "degraded" : "healthy"}`} />)}</div><span>Connection timeline · {degradedSamples} degraded sample(s)</span></div>
    </div>
  );
}

export function OperationsHub({
  open,
  sessions,
  selectedSessionIds,
  onClose,
  onRequestOpen,
  onOpenSession,
  onOpenSettings,
  onSaveSession,
  onReloadSessions,
  onPinnedMonitorChange,
  onError
}: OperationsHubProps) {
  const operations = window.termdock?.operations;
  const [section, setSection] = useState<OperationsHubSection>("palette");
  const [query, setQuery] = useState("");
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [runs, setRuns] = useState<RunbookRun[]>([]);
  const [trustedHosts, setTrustedHosts] = useState<TrustedHostKey[]>([]);
  const [syncProfiles, setSyncProfiles] = useState<SyncProfile[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncPreview, setSyncPreview] = useState<{ profile: SyncProfile; plan: SyncPlan } | null>(null);
  const [pinnedSessionIds, setPinnedSessionIds] = useState<Set<string>>(new Set());
  const [pinnedMonitorsBySession, setPinnedMonitorsBySession] = useState<Record<string, PinnedMonitor | undefined>>({});
  const [healthBySession, setHealthBySession] = useState<Record<string, HealthObservation | undefined>>({});
  const [fleetOverview, setFleetOverview] = useState<FleetHealthOverviewItem[]>([]);
  const [healthIncidents, setHealthIncidents] = useState<HealthIncident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedFleetSessionId, setSelectedFleetSessionId] = useState<string | null>(null);
  const [selectedIncidentEvents, setSelectedIncidentEvents] = useState<HealthIncidentEvent[]>([]);
  const [trendRange, setTrendRange] = useState<HealthTrendRange>("24h");
  const [trendPoints, setTrendPoints] = useState<HealthTrendPoint[]>([]);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>("all");
  const [selectedRunbookId, setSelectedRunbookId] = useState<string | null>(null);
  const [runbookName, setRunbookName] = useState("");
  const [runbookDescription, setRunbookDescription] = useState("");
  const [runbookCommand, setRunbookCommand] = useState("");
  const [runbookConcurrency, setRunbookConcurrency] = useState(6);
  const [runbookTimeoutSeconds, setRunbookTimeoutSeconds] = useState(60);
  const [runbookBusy, setRunbookBusy] = useState(false);
  const [assetSessionId, setAssetSessionId] = useState<string>("");
  const [assetEnvironment, setAssetEnvironment] = useState<SessionEnvironment>("custom");
  const [assetTags, setAssetTags] = useState("");
  const [assetOwner, setAssetOwner] = useState("");
  const [assetJumpSessionId, setAssetJumpSessionId] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);
  const [syncName, setSyncName] = useState("");
  const [syncSessionId, setSyncSessionId] = useState("");
  const [syncDirection, setSyncDirection] = useState<"upload" | "download">("upload");
  const [syncLocalRoot, setSyncLocalRoot] = useState("");
  const [syncRemoteRoot, setSyncRemoteRoot] = useState("/");
  const [syncExcludes, setSyncExcludes] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState("");
  const [hubDialog, setHubDialog] = useState<AppDialogView | null>(null);
  const [hubDialogInput, setHubDialogInput] = useState("");
  const hubDialogInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const hubDialogResolverRef = useRef<((result: unknown) => void) | null>(null);
  const hubDialogCancelValueRef = useRef<unknown>(undefined);

  const resolveHubDialog = useCallback((result: unknown) => {
    const resolver = hubDialogResolverRef.current;
    hubDialogResolverRef.current = null;
    hubDialogCancelValueRef.current = undefined;
    setHubDialog(null);
    setHubDialogInput("");
    resolver?.(result);
  }, []);

  const openHubDialog = useCallback((dialog: AppDialogView, cancelResult: unknown, initialInput = ""): Promise<unknown> => {
    if (hubDialogResolverRef.current) {
      hubDialogResolverRef.current(hubDialogCancelValueRef.current);
    }
    hubDialogCancelValueRef.current = cancelResult;
    setHubDialog(dialog);
    setHubDialogInput(dialog.mode === "prompt" ? initialInput : "");
    return new Promise((resolve) => {
      hubDialogResolverRef.current = resolve;
    });
  }, []);

  const closeHubDialog = useCallback(() => {
    resolveHubDialog(hubDialogCancelValueRef.current);
  }, [resolveHubDialog]);

  const submitHubDialog = useCallback(() => {
    if (!hubDialog || hubDialog.mode === "choice") return;
    if (hubDialog.mode === "confirm") {
      resolveHubDialog(true);
      return;
    }
    if (hubDialog.mode === "prompt") {
      resolveHubDialog(hubDialogInput);
    }
  }, [hubDialog, hubDialogInput, resolveHubDialog]);

  const showHubPrompt = useCallback(
    async (message: string, defaultValue = "", options?: HubPromptOptions): Promise<string | null> => {
      const result = await openHubDialog({
        mode: "prompt",
        title: options?.title ?? "Input Required",
        message,
        confirmLabel: options?.confirmLabel ?? "Continue",
        cancelLabel: options?.cancelLabel ?? "Cancel",
        inputType: options?.inputType
      }, null, defaultValue);
      return typeof result === "string" ? result : null;
    },
    [openHubDialog]
  );

  const showHubConfirm = useCallback(
    async (message: string, options?: HubConfirmOptions): Promise<boolean> => {
      const result = await openHubDialog({
        mode: "confirm",
        title: options?.title ?? "Confirm",
        message,
        confirmLabel: options?.confirmLabel ?? "Confirm",
        cancelLabel: options?.cancelLabel ?? "Cancel",
        danger: options?.danger,
        detailText: options?.detailText
      }, false);
      return result === true;
    },
    [openHubDialog]
  );

  const showHubChoice = useCallback(
    async (message: string, options: AppDialogOptionView[], dialogOptions?: HubChoiceOptions): Promise<string | null> => {
      const result = await openHubDialog({
        mode: "choice",
        title: dialogOptions?.title ?? "Choose Action",
        message,
        confirmLabel: "",
        cancelLabel: dialogOptions?.cancelLabel ?? "Cancel",
        detailText: dialogOptions?.detailText,
        options
      }, null);
      return typeof result === "string" ? result : null;
    },
    [openHubDialog]
  );

  useEffect(() => {
    if (!hubDialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || hubDialog.mode === "choice") return;
      event.preventDefault();
      submitHubDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hubDialog, submitHubDialog]);

  useEffect(() => {
    if (!hubDialog || hubDialog.mode !== "prompt") return;
    const timeoutId = window.setTimeout(() => {
      hubDialogInputRef.current?.focus();
      hubDialogInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [hubDialog]);

  useEffect(() => () => {
    if (hubDialogResolverRef.current) {
      hubDialogResolverRef.current(hubDialogCancelValueRef.current);
      hubDialogResolverRef.current = null;
    }
  }, []);

  const selectedRunbook = useMemo(
    () => runbooks.find((runbook) => runbook.id === selectedRunbookId) ?? null,
    [runbooks, selectedRunbookId]
  );
  const selectedAsset = useMemo(
    () => sessions.find((session) => session.id === assetSessionId) ?? null,
    [assetSessionId, sessions]
  );
  const selectedIds = useMemo(
    () => selectedSessionIds.filter((id) => sessions.some((session) => session.id === id)),
    [selectedSessionIds, sessions]
  );
  const paletteRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = (value: string) => !normalized || value.toLowerCase().includes(normalized);
    return {
      sessions: sessions.filter((session) =>
        matches([session.name, session.host, session.username, ...(session.tags ?? [])].join(" "))
      ),
      runbooks: runbooks.filter((runbook) => matches(`${runbook.name} ${runbook.description} ${runbook.command}`))
    };
  }, [query, runbooks, sessions]);

  const fleetRows = useMemo(() => {
    const bySession = new Map(fleetOverview.map((item) => [item.sessionId, item]));
    return sessions.map((session) => {
      const overview = bySession.get(session.id);
      const severity: FleetFilter = overview?.severity ?? "unmonitored";
      return { session, severity, overview };
    }).filter((item) => fleetFilter === "all" || item.severity === fleetFilter)
      .sort((left, right) => fleetRank(left.severity) - fleetRank(right.severity) || new Date(right.overview?.lastObservation?.collectedAt ?? 0).getTime() - new Date(left.overview?.lastObservation?.collectedAt ?? 0).getTime());
  }, [fleetFilter, fleetOverview, sessions]);
  const fleetSummaryCounts = useMemo(() => {
    const counts: Record<Exclude<FleetFilter, "all">, number> = {
      critical: 0,
      warning: 0,
      healthy: 0,
      needsAttention: 0,
      unmonitored: 0
    };
    const bySession = new Map(fleetOverview.map((item) => [item.sessionId, item.severity]));
    sessions.forEach((session) => {
      const severity = bySession.get(session.id) ?? "unmonitored";
      counts[severity] += 1;
    });
    return counts;
  }, [fleetOverview, sessions]);

  const selectedIncident = useMemo(
    () => healthIncidents.find((incident) => incident.id === selectedIncidentId) ?? null,
    [healthIncidents, selectedIncidentId]
  );
  const selectedFleetSession = useMemo(
    () => sessions.find((session) => session.id === selectedFleetSessionId) ?? null,
    [selectedFleetSessionId, sessions]
  );
  const selectedFleetOverview = useMemo(
    () => fleetOverview.find((item) => item.sessionId === selectedFleetSessionId),
    [fleetOverview, selectedFleetSessionId]
  );
  const selectedFleetObservation = selectedFleetSessionId
    ? selectedFleetOverview?.lastObservation ?? healthBySession[selectedFleetSessionId]
    : undefined;

  useEffect(() => {
    if (selectedIncident) setSelectedFleetSessionId(selectedIncident.sessionId);
  }, [selectedIncident]);

  const refresh = async () => {
    if (!operations) return;
    const [nextRunbooks, nextRuns, nextTrustedHosts, nextSyncProfiles, nextSyncRuns, nextPins, nextFleetOverview, nextHealthIncidents] = await Promise.all([
      operations.listRunbooks(),
      operations.listRunbookRuns(60),
      operations.listTrustedHostKeys(),
      operations.listSyncProfiles(),
      operations.listSyncRuns(60),
      operations.listPinnedMonitors(),
      operations.listFleetHealthOverview(),
      operations.listHealthIncidents(undefined, 160)
    ]);
    setRunbooks(nextRunbooks);
    setRuns(nextRuns);
    setTrustedHosts(nextTrustedHosts);
    setSyncProfiles(nextSyncProfiles);
    setSyncRuns(nextSyncRuns);
    setPinnedSessionIds(new Set(nextPins.filter((pin) => pin.enabled).map((pin) => pin.sessionId)));
    setPinnedMonitorsBySession(Object.fromEntries(nextPins.map((pin) => [pin.sessionId, pin])));
    setFleetOverview(nextFleetOverview);
    setHealthIncidents(nextHealthIncidents);
    setHealthBySession(Object.fromEntries(nextFleetOverview.flatMap((entry) => entry.lastObservation ? [[entry.sessionId, entry.lastObservation]] : [])));
  };

  useEffect(() => {
    if (!open) return;
    void refresh().catch((error) => onError(`Could not load Operations Hub. ${toMessage(error)}`));
  }, [open]); // Intentionally reload only when opening; event subscription keeps live data current.

  useEffect(() => {
    if (!operations) return;
    return operations.onEvent((event) => {
      if (event.type === "runbookRun") {
        setRuns((previous) => [event.run, ...previous.filter((run) => run.id !== event.run.id)].slice(0, 60));
        if (event.run.incidentId && event.run.incidentId === selectedIncidentId) {
          void operations.listHealthIncidentEvents(event.run.incidentId).then(setSelectedIncidentEvents).catch(() => undefined);
        }
      }
      if (event.type === "syncRun") {
        setSyncRuns((previous) => [event.run, ...previous.filter((run) => run.id !== event.run.id)].slice(0, 60));
      }
      if (event.type === "healthObservation") {
        setHealthBySession((previous) => ({ ...previous, [event.observation.sessionId]: event.observation }));
        setFleetOverview((previous) => previous.map((entry) => entry.sessionId === event.observation.sessionId ? { ...entry, lastObservation: event.observation, ...(event.observation.connectionState === "needsAttention" ? { severity: "needsAttention" as const, activeIncident: undefined } : {}) } : entry));
      }
      if (event.type === "healthIncident") {
        setHealthIncidents((previous) => [event.incident, ...previous.filter((incident) => incident.id !== event.incident.id)].slice(0, 160));
        setFleetOverview((previous) => previous.map((entry) => entry.sessionId === event.incident.sessionId ? { ...entry, severity: event.incident.status === "resolved" ? "healthy" : event.incident.severity, activeIncident: event.incident.status === "resolved" ? undefined : event.incident } : entry));
      }
      if (event.type === "focusHealthIncident") {
        onRequestOpen();
        setSection("fleet");
        setSelectedIncidentId(event.incidentId);
      }
    });
  }, [onRequestOpen, operations, selectedIncidentId]);

  useEffect(() => {
    const nextId = selectedIds[0] ?? sessions[0]?.id ?? "";
    setAssetSessionId((previous) => (sessions.some((session) => session.id === previous) ? previous : nextId));
    setSyncSessionId((previous) => (sessions.some((session) => session.id === previous) ? previous : nextId));
  }, [selectedIds, sessions]);

  useEffect(() => {
    if (!selectedAsset) return;
    setAssetEnvironment(selectedAsset.environment ?? "custom");
    setAssetTags((selectedAsset.tags ?? []).join(", "));
    setAssetOwner(selectedAsset.owner ?? "");
    setAssetJumpSessionId(selectedAsset.jumpSessionId ?? "");
  }, [selectedAsset]);

  const selectRunbook = (runbook: Runbook) => {
    setSelectedRunbookId(runbook.id);
    setRunbookName(runbook.name);
    setRunbookDescription(runbook.description);
    setRunbookCommand(runbook.command);
    setRunbookConcurrency(runbook.concurrency ?? 6);
    setRunbookTimeoutSeconds(runbook.timeoutSeconds ?? 60);
  };

  const clearRunbookDraft = () => {
    setSelectedRunbookId(null);
    setRunbookName("");
    setRunbookDescription("");
    setRunbookCommand("");
    setRunbookConcurrency(6);
    setRunbookTimeoutSeconds(60);
  };

  const saveRunbook = async () => {
    if (!operations) return;
    setRunbookBusy(true);
    try {
      const saved = await operations.saveRunbook({
        id: selectedRunbookId ?? undefined,
        name: runbookName,
        description: runbookDescription,
        command: runbookCommand,
        variables: variablesFromCommand(runbookCommand)
        ,concurrency: runbookConcurrency
        ,timeoutSeconds: runbookTimeoutSeconds
      });
      setRunbooks((previous) => [saved, ...previous.filter((runbook) => runbook.id !== saved.id)]);
      selectRunbook(saved);
    } catch (error) {
      onError(`Could not save Runbook. ${toMessage(error)}`);
    } finally {
      setRunbookBusy(false);
    }
  };

  const exportRunbookRuns = async (format: "json" | "csv") => {
    try {
      const text = format === "json"
        ? JSON.stringify(runs, null, 2)
        : [
            "runbook,status,startedAt,finishedAt,session,status,exitCode,error",
            ...runs.flatMap((run) => run.targetResults.map((result) => [
              run.runbookName,
              run.status,
              run.startedAt,
              run.finishedAt ?? "",
              result.sessionName,
              result.status,
              result.exitCode ?? "",
              result.error ?? ""
            ].map((value) => `\"${String(value).replaceAll("\"", "\"\"")}\"`).join(",")))
          ].join("\n");
      await window.termdock.system.saveTextFile({
        title: "Export Runbook history",
        defaultFileName: `termdock-runbooks-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`,
        text,
        filters: [{ name: format === "json" ? "JSON" : "CSV", extensions: [format] }]
      });
    } catch (error) {
      onError(`Could not export Runbook history. ${toMessage(error)}`);
    }
  };

  const runSelectedRunbook = async () => {
    if (!operations || !selectedRunbook) return;
    const sessionIds = selectedIds.length > 0 ? selectedIds : sessions.map((session) => session.id);
    if (sessionIds.length === 0) {
      onError("Create or select at least one session before running a Runbook.");
      return;
    }
    const variables: Record<string, string> = {};
    for (const variable of selectedRunbook.variables) {
      const value = await showHubPrompt(
        variable.required ? "This Runbook variable is required." : "Optional Runbook variable.",
        variable.defaultValue ?? "",
        {
          title: variable.label || variable.name,
          confirmLabel: "Next"
        }
      );
      if (value === null) return;
      variables[variable.name] = value;
    }
    const preview = selectedRunbook.command.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, name: string) => variables[name] ?? "");
    if (!await showHubConfirm(`Run on ${sessionIds.length} selected session(s)?`, {
      title: "Runbook Preview",
      confirmLabel: "Run Now",
      detailText: preview
    })) return;
    setRunbookBusy(true);
    try {
      const run = await operations.startRunbook({
        runbookId: selectedRunbook.id,
        sessionIds,
        variables,
        approvedDangerousCommand: true
      });
      setRuns((previous) => [run, ...previous.filter((item) => item.id !== run.id)].slice(0, 60));
    } catch (error) {
      onError(`Runbook did not start. ${toMessage(error)}`);
    } finally {
      setRunbookBusy(false);
    }
  };

  const saveAsset = async () => {
    if (!selectedAsset) return;
    if (assetJumpSessionId === selectedAsset.id) {
      onError("A session cannot use itself as a jump host.");
      return;
    }
    setAssetBusy(true);
    try {
      await onSaveSession(selectedAsset.id, {
        environment: assetEnvironment,
        tags: splitTags(assetTags),
        owner: assetOwner.trim(),
        jumpSessionId: assetJumpSessionId || ""
      });
    } catch (error) {
      onError(`Could not save asset fields. ${toMessage(error)}`);
    } finally {
      setAssetBusy(false);
    }
  };

  const saveSyncProfile = async () => {
    if (!operations) return;
    setSyncBusy(true);
    try {
      const saved = await operations.saveSyncProfile({
        name: syncName,
        sessionId: syncSessionId,
        direction: syncDirection,
        localRoot: syncLocalRoot,
        remoteRoot: syncRemoteRoot,
        excludePatterns: syncExcludes.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
      });
      setSyncProfiles((previous) => [saved, ...previous.filter((profile) => profile.id !== saved.id)]);
      setSyncName("");
      setSyncLocalRoot("");
      setSyncRemoteRoot("/");
      setSyncExcludes("");
    } catch (error) {
      onError(`Could not save sync profile. ${toMessage(error)}`);
    } finally {
      setSyncBusy(false);
    }
  };

  const previewSync = async (profile: SyncProfile) => {
    if (!operations) return;
    setSyncBusy(true);
    try {
      const plan = await operations.planSync(profile.id);
      setSyncPreview({ profile, plan });
    } catch (error) {
      onError(`Could not create sync preview. ${toMessage(error)}`);
    } finally {
      setSyncBusy(false);
    }
  };

  const startPreviewedSync = async () => {
    if (!operations || !syncPreview) return;
    setSyncBusy(true);
    try {
      const run = await operations.startSync(syncPreview.profile.id, syncPreview.plan.id);
      setSyncRuns((previous) => [run, ...previous.filter((item) => item.id !== run.id)].slice(0, 60));
      setSyncPreview(null);
    } catch (error) {
      onError(`Sync did not start. ${toMessage(error)}`);
    } finally {
      setSyncBusy(false);
    }
  };

  const togglePinnedMonitor = async (sessionId: string) => {
    if (!operations) return;
    const enabled = !pinnedSessionIds.has(sessionId);
    try {
      const saved = await operations.savePinnedMonitor({
        ...pinnedMonitorsBySession[sessionId],
        sessionId,
        enabled,
        intervalSeconds: pinnedMonitorsBySession[sessionId]?.intervalSeconds ?? 60,
        updatedAt: new Date().toISOString()
      });
      setPinnedSessionIds((previous) => {
        const next = new Set(previous);
        if (enabled) next.add(sessionId); else next.delete(sessionId);
        return next;
      });
      setPinnedMonitorsBySession((previous) => ({ ...previous, [sessionId]: saved }));
      onPinnedMonitorChange(saved);
      setFleetOverview((previous) => {
        const current = previous.find((entry) => entry.sessionId === sessionId);
        const next: FleetHealthOverviewItem = { sessionId, monitored: enabled, severity: enabled ? "healthy" : "unmonitored", lastObservation: current?.lastObservation, activeIncident: current?.activeIncident };
        return [next, ...previous.filter((entry) => entry.sessionId !== sessionId)];
      });
    } catch (error) {
      onError(`Could not update Fleet Health. ${toMessage(error)}`);
    }
  };

  const collectPinnedHealth = async (sessionId: string) => {
    if (!operations) return;
    try {
      const observation = await operations.collectPinnedHealth(sessionId);
      setHealthBySession((previous) => ({ ...previous, [sessionId]: observation }));
    } catch (error) {
      onError(`Could not collect Fleet Health. ${toMessage(error)}`);
    }
  };

  const savePinnedMonitorPatch = async (sessionId: string, patch: Partial<PinnedMonitor>) => {
    if (!operations) return;
    const current = pinnedMonitorsBySession[sessionId];
    if (!current) return;
    try {
      const saved = await operations.savePinnedMonitor({ ...current, ...patch, sessionId, updatedAt: new Date().toISOString() });
      setPinnedMonitorsBySession((previous) => ({ ...previous, [sessionId]: saved }));
      onPinnedMonitorChange(saved);
    } catch (error) {
      onError(`Could not update Fleet Health rule. ${toMessage(error)}`);
    }
  };

  useEffect(() => {
    const trendSessionId = selectedFleetSessionId ?? selectedIncident?.sessionId ?? "";
    if (!operations || !trendSessionId) {
      setSelectedIncidentEvents([]);
      setTrendPoints([]);
      return;
    }
    void Promise.all([
      selectedIncidentId ? operations.listHealthIncidentEvents(selectedIncidentId) : Promise.resolve([]),
      operations.listHealthTrend(trendSessionId, trendRange)
    ]).then(([events, points]) => {
      setSelectedIncidentEvents(events);
      setTrendPoints(points);
    }).catch((error) => onError(`Could not load Fleet Health details. ${toMessage(error)}`));
  }, [onError, operations, selectedFleetSessionId, selectedIncident, selectedIncidentId, trendRange]);

  const acknowledgeIncident = async (incidentId: string) => {
    if (!operations) return;
    try {
      const acknowledged = await operations.acknowledgeHealthIncident(incidentId);
      if (acknowledged) {
        setHealthIncidents((previous) => [acknowledged, ...previous.filter((incident) => incident.id !== acknowledged.id)]);
        setFleetOverview((previous) => previous.map((entry) => entry.sessionId === acknowledged.sessionId ? { ...entry, activeIncident: acknowledged } : entry));
      }
    } catch (error) {
      onError(`Could not acknowledge Fleet Health incident. ${toMessage(error)}`);
    }
  };

  const exportIncidentEvidence = async (incidentId: string) => {
    if (!operations) return;
    try {
      const evidence = await operations.exportHealthIncidentEvidence(incidentId);
      await window.termdock.system.saveTextFile({
        title: "Export Fleet Health incident evidence",
        defaultFileName: `termdock-fleet-incident-${incidentId.slice(0, 8)}.json`,
        text: JSON.stringify(evidence, null, 2),
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
    } catch (error) {
      onError(`Could not export Fleet Health evidence. ${toMessage(error)}`);
    }
  };

  const runIncidentRunbook = async (incident: HealthIncident, runbook: Runbook) => {
    if (!operations) return;
    const variables: Record<string, string> = {};
    for (const variable of runbook.variables) {
      const value = await showHubPrompt(variable.required ? "This Runbook variable is required." : "Optional Runbook variable.", variable.defaultValue ?? "", {
        title: variable.label || variable.name,
        confirmLabel: "Next"
      });
      if (value === null) return;
      variables[variable.name] = value;
    }
    const preview = runbook.command.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, name: string) => variables[name] ?? "");
    if (!await showHubConfirm(`Run on the affected session only? This action is never automatic.`, {
      title: `Incident Runbook: ${runbook.name}`,
      confirmLabel: "Previewed — Run Now",
      detailText: preview
    })) return;
    setRunbookBusy(true);
    try {
      const run = await operations.startRunbook({
        runbookId: runbook.id,
        sessionIds: [incident.sessionId],
        variables,
        incidentId: incident.id,
        approvedDangerousCommand: true
      });
      setRuns((previous) => [run, ...previous.filter((item) => item.id !== run.id)].slice(0, 60));
    } catch (error) {
      onError(`Incident Runbook did not start. ${toMessage(error)}`);
    } finally {
      setRunbookBusy(false);
    }
  };

  const exportWorkspace = async () => {
    if (!operations) return;
    const passphrase = await showHubPrompt(
      "Choose a workspace package passphrase (at least 8 characters).",
      "",
      {
        title: "Export Workspace",
        confirmLabel: "Continue",
        inputType: "password"
      }
    );
    if (passphrase === null) return;
    const includeCredentials = await showHubConfirm(
      "Include the existing encrypted credentials attachment? Credentials are excluded by default.",
      {
        title: "Export Workspace",
        confirmLabel: "Include Credentials"
      }
    );
    setWorkspaceBusy(true);
    try {
      const result = await operations.exportWorkspace({
        appVersion: "TermDock",
        passphrase,
        includeCredentials,
        includePrivateKeyFiles: includeCredentials && await showHubConfirm(
          "Also include private key file contents in the encrypted credentials attachment?",
          {
            title: "Include Private Key Files",
            confirmLabel: "Include Private Keys",
            danger: true
          }
        )
      });
      const saved = await window.termdock.system.saveTextFile({
        title: "Export encrypted workspace package",
        defaultFileName: `termdock-workspace-${result.file.exportedAt.replace(/[:.]/g, "-")}.tdworkspace`,
        text: JSON.stringify(result.file, null, 2),
        filters: [{ name: "TermDock workspace", extensions: ["tdworkspace"] }]
      });
      setWorkspaceStatus(saved.canceled ? "Workspace export canceled." : `Workspace exported to ${saved.outputPath ?? "selected file"}.`);
    } catch (error) {
      onError(`Could not export workspace package. ${toMessage(error)}`);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const importWorkspace = async () => {
    if (!operations) return;
    try {
      const selected = await window.termdock.system.pickAndReadTextFile({
        title: "Import encrypted workspace package",
        filters: [{ name: "TermDock workspace", extensions: ["tdworkspace"] }]
      });
      if (selected.canceled) return;
      const passphrase = await showHubPrompt("Enter the workspace package passphrase.", "", {
        title: "Import Workspace",
        confirmLabel: "Unlock",
        inputType: "password"
      });
      if (passphrase === null) return;
      setWorkspaceBusy(true);
      const preview = await operations.previewWorkspace({ fileText: selected.text, passphrase });
      const strategyAnswer = await showHubChoice(
        `Import ${preview.preview.sessionCount} session(s), ${preview.preview.runbookCount} Runbook(s), and ${preview.preview.syncProfileCount} sync profile(s). Choose how matching items should be handled.`,
        [
          { value: "rename", label: "Keep both · Rename imported" },
          { value: "skip", label: "Keep existing · Skip imported" },
          { value: "overwrite", label: "Replace existing", danger: true }
        ],
        {
          title: "Resolve Import Conflicts",
          detailText: "Host trust records are not imported and must be verified on this device."
        }
      );
      if (strategyAnswer === null) return;
      const sessionStrategy = strategyAnswer as WorkspaceImportStrategy;
      const restoreCredentials = preview.preview.includesCredentials && await showHubConfirm(
        "Restore the optional encrypted credentials attachment?",
        {
          title: "Import Credentials",
          confirmLabel: "Restore Credentials"
        }
      );
      const result = await operations.importWorkspace({
        fileText: selected.text,
        passphrase,
        sessionStrategy,
        restoreCredentials,
        includePrivateKeyFiles: restoreCredentials && await showHubConfirm(
          "Restore embedded private key files when included?",
          {
            title: "Import Private Key Files",
            confirmLabel: "Restore Private Keys",
            danger: true
          }
        )
      });
      await onReloadSessions();
      await refresh();
      setWorkspaceStatus(`Imported ${result.sessionsCreated} session(s), updated ${result.sessionsUpdated}, skipped ${result.sessionsSkipped}. ${result.warnings.length ? result.warnings[0] : "Host trust records were intentionally not imported."}`);
    } catch (error) {
      onError(`Could not import workspace package. ${toMessage(error)}`);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Operations Hub"
      modalClassName="modal--operations-hub"
    >
      <div className="operations-hub">
        <nav aria-label="Operations Hub" className="operations-hub__nav">
          {SECTION_LABELS.map((item) => (
            <button
              className={`secondary-button secondary-button--small ${section === item.id ? "is-active" : ""}`}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {section === "palette" ? (
          <section className="operations-hub__section">
            <label className="operations-hub__field">
              Search sessions, tabs, Runbooks and actions
              <input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Type to switch…" value={query} />
            </label>
            <div className="operations-hub__split">
              <div className="operations-hub__list">
                <h4>Sessions</h4>
                {paletteRows.sessions.slice(0, 14).map((session) => (
                  <button className="operations-hub__row" key={session.id} onClick={() => onOpenSession(session)} type="button">
                    <strong>{session.name}</strong><span>{session.username}@{session.host}{session.tags?.length ? ` · ${session.tags.join(", ")}` : ""}</span>
                  </button>
                ))}
              </div>
              <div className="operations-hub__list">
                <h4>Actions</h4>
                <button className="operations-hub__row" onClick={() => setSection("runbooks")} type="button"><strong>Runbooks</strong><span>Run a saved command across selected sessions</span></button>
                <button className="operations-hub__row" onClick={() => setSection("fleet")} type="button"><strong>Fleet Health</strong><span>Pin sessions for controlled checks</span></button>
                <button className="operations-hub__row" onClick={onOpenSettings} type="button"><strong>Settings</strong><span>Connection, SFTP, alerts and workspace settings</span></button>
                {paletteRows.runbooks.slice(0, 5).map((runbook) => (
                  <button className="operations-hub__row" key={runbook.id} onClick={() => { selectRunbook(runbook); setSection("runbooks"); }} type="button"><strong>{runbook.name}</strong><span>{runbook.description || runbook.command}</span></button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {section === "runbooks" ? (
          <section className="operations-hub__section operations-hub__three-column">
            <div className="operations-hub__list">
              <div className="operations-hub__heading"><h4>Saved Runbooks</h4><button className="secondary-button secondary-button--small" onClick={clearRunbookDraft} type="button">New</button></div>
              {runbooks.map((runbook) => <button className={`operations-hub__row ${selectedRunbookId === runbook.id ? "is-selected" : ""}`} key={runbook.id} onClick={() => selectRunbook(runbook)} type="button"><strong>{runbook.name}</strong><span>{runbook.description || runbook.command}</span></button>)}
              {runbooks.length === 0 ? <p className="hint">Save a repeatable command here. Variables use <code>{"{{name}}"}</code>.</p> : null}
            </div>
            <div className="operations-hub__editor">
              <label className="operations-hub__field">Name<input onChange={(event) => setRunbookName(event.target.value)} value={runbookName} /></label>
              <label className="operations-hub__field">Description<input onChange={(event) => setRunbookDescription(event.target.value)} value={runbookDescription} /></label>
              <div className="operations-hub__inline-fields"><label className="operations-hub__field">Concurrency<input max="16" min="1" onChange={(event) => setRunbookConcurrency(Number(event.target.value) || 6)} type="number" value={runbookConcurrency} /></label><label className="operations-hub__field">Timeout (seconds)<input max="3600" min="5" onChange={(event) => setRunbookTimeoutSeconds(Number(event.target.value) || 60)} type="number" value={runbookTimeoutSeconds} /></label></div>
              <label className="operations-hub__field">Command<textarea onChange={(event) => setRunbookCommand(event.target.value)} placeholder="systemctl restart {{service}}" value={runbookCommand} /></label>
              <p className="hint">Targets: {selectedIds.length > 0 ? `${selectedIds.length} selected session(s)` : `all ${sessions.length} sessions`}. Secret, password and OTP values are not stored in Runbooks.</p>
              <div className="operations-hub__actions"><button className="secondary-button" disabled={runbookBusy || !runbookCommand.trim()} onClick={() => void saveRunbook()} type="button">Save</button><button className="primary-button" disabled={runbookBusy || !selectedRunbook} onClick={() => void runSelectedRunbook()} type="button">Preview & Run</button></div>
            </div>
            <div className="operations-hub__list">
              <div className="operations-hub__heading"><h4>Recent runs</h4><div className="operations-hub__actions"><button className="secondary-button secondary-button--small" onClick={() => void exportRunbookRuns("csv")} type="button">Export CSV</button><button className="secondary-button secondary-button--small" onClick={() => void operations?.clearRunbookRuns().then(() => setRuns([]))} type="button">Clear</button></div></div>
              {runs.map((run) => <div className="operations-hub__run" key={run.id}><strong>{run.runbookName}</strong><span>{formatRunStatus(run)}</span><code>{run.command}</code>{run.status === "running" ? <button className="secondary-button secondary-button--small" onClick={() => void operations?.cancelRunbook(run.id)} type="button">Cancel</button> : null}{run.targetResults.filter((result) => result.error).slice(0, 2).map((result) => <small key={result.sessionId}>{result.sessionName}: {result.error}</small>)}</div>)}
            </div>
          </section>
        ) : null}

        {section === "assets" ? (
          <section className="operations-hub__section operations-hub__split">
            <div className="operations-hub__list">
              <h4>Session assets</h4>
              {sessions.map((session) => <button className={`operations-hub__row ${assetSessionId === session.id ? "is-selected" : ""}`} key={session.id} onClick={() => setAssetSessionId(session.id)} type="button"><strong>{session.name}</strong><span>{session.environment ?? "unclassified"}{session.owner ? ` · ${session.owner}` : ""}</span></button>)}
            </div>
            <div className="operations-hub__editor">
              {selectedAsset ? <>
                <h4>{selectedAsset.name}</h4>
                <label className="operations-hub__field">Environment<select onChange={(event) => setAssetEnvironment(event.target.value as SessionEnvironment)} value={assetEnvironment}><option value="dev">Development</option><option value="staging">Staging</option><option value="prod">Production</option><option value="custom">Custom / unclassified</option></select></label>
                <label className="operations-hub__field">Tags<input onChange={(event) => setAssetTags(event.target.value)} placeholder="api, europe, customer-a" value={assetTags} /></label>
                <label className="operations-hub__field">Owner<input onChange={(event) => setAssetOwner(event.target.value)} placeholder="Optional owner" value={assetOwner} /></label>
                <label className="operations-hub__field">One-hop jump session<select onChange={(event) => setAssetJumpSessionId(event.target.value)} value={assetJumpSessionId}><option value="">Direct connection</option>{sessions.filter((session) => session.id !== selectedAsset.id).map((session) => <option key={session.id} value={session.id}>{session.name} · {session.host}</option>)}</select></label>
                <p className="hint">Jump sessions are references to existing sessions. Cycles and deletion of a referenced jump session are blocked.</p>
                <div className="operations-hub__actions"><button className="primary-button" disabled={assetBusy} onClick={() => void saveAsset()} type="button">Save asset fields</button></div>
              </> : <p className="hint">No sessions yet.</p>}
            </div>
          </section>
        ) : null}

        {section === "trust" ? (
          <section className="operations-hub__section operations-hub__list">
            <h4>Trusted server keys</h4>
            <p className="hint">First connections require an explicit SHA-256 fingerprint confirmation. A changed key is blocked until it is reviewed here or confirmed again.</p>
            {trustedHosts.map((host) => <div className="operations-hub__trust" key={host.endpoint}><div><strong>{host.host}:{host.port}</strong><code>{host.fingerprint}</code><span>Last trusted {new Date(host.lastTrustedAt).toLocaleString()}</span></div><button className="secondary-button secondary-button--danger secondary-button--small" onClick={() => void operations?.removeTrustedHostKey(host.endpoint).then(() => setTrustedHosts((previous) => previous.filter((item) => item.endpoint !== host.endpoint)))} type="button">Remove</button></div>)}
            {trustedHosts.length === 0 ? <p className="hint">No server keys have been trusted on this device.</p> : null}
          </section>
        ) : null}

        {section === "sync" ? (
          <section className="operations-hub__section operations-hub__split">
            <div className="operations-hub__editor"><h4>New one-way sync profile</h4><label className="operations-hub__field">Name<input onChange={(event) => setSyncName(event.target.value)} value={syncName} /></label><label className="operations-hub__field">Session<select onChange={(event) => setSyncSessionId(event.target.value)} value={syncSessionId}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label><label className="operations-hub__field">Direction<select onChange={(event) => setSyncDirection(event.target.value as "upload" | "download")} value={syncDirection}><option value="upload">Deploy local → remote</option><option value="download">Pull remote → local</option></select></label><label className="operations-hub__field">Local root<input onChange={(event) => setSyncLocalRoot(event.target.value)} value={syncLocalRoot} /></label><label className="operations-hub__field">Remote root<input onChange={(event) => setSyncRemoteRoot(event.target.value)} value={syncRemoteRoot} /></label><label className="operations-hub__field">Exclude globs<textarea onChange={(event) => setSyncExcludes(event.target.value)} placeholder="node_modules/**\n.git/**" value={syncExcludes} /></label><p className="hint">Plans never delete extra target files. Conflicts stay skipped until you decide.</p><div className="operations-hub__actions"><button className="primary-button" disabled={syncBusy || !syncSessionId || !syncLocalRoot.trim()} onClick={() => void saveSyncProfile()} type="button">Save profile</button></div></div>
            <div className="operations-hub__list"><h4>Saved profiles</h4>{syncProfiles.map((profile) => <div className="operations-hub__run" key={profile.id}><strong>{profile.name}</strong><span>{profile.direction === "upload" ? "Local → remote" : "Remote → local"}</span><code>{profile.localRoot} ↔ {profile.remoteRoot}</code><button className="secondary-button secondary-button--danger secondary-button--small" onClick={() => void operations?.removeSyncProfile(profile.id).then(() => setSyncProfiles((previous) => previous.filter((item) => item.id !== profile.id)))} type="button">Remove</button></div>)}{syncProfiles.length === 0 ? <p className="hint">Save a profile, then create a change preview before it runs.</p> : null}</div>
          </section>
        ) : null}

        {section === "sync" ? (
          <section className="operations-hub__section operations-hub__list">
            <div className="operations-hub__heading">
              <h4>Preview and run</h4>
              <button className="secondary-button secondary-button--small" onClick={() => void operations?.clearSyncRuns().then(() => setSyncRuns([]))} type="button">Clear history</button>
            </div>
            <p className="hint">A preview compares full trees before it transfers. Only new or source-newer files run; conflicts and target-only files stay untouched.</p>
            {syncPreview ? <div className="operations-hub__preview"><strong>Preview: {syncPreview.profile.name}</strong><span>{syncPreview.plan.items.filter((item) => item.action === "create").length} new · {syncPreview.plan.items.filter((item) => item.action === "update").length} updates · {syncPreview.plan.items.filter((item) => item.action === "conflict").length} conflicts · {syncPreview.plan.items.filter((item) => item.action === "preserve").length} preserved</span><code>{syncPreview.plan.items.slice(0, 8).map((item) => `${item.action}: ${item.relativePath}`).join("\n") || "No changed files."}</code><div className="operations-hub__actions"><button className="secondary-button secondary-button--small" onClick={() => setSyncPreview(null)} type="button">Discard</button><button className="primary-button" disabled={syncBusy} onClick={() => void startPreviewedSync()} type="button">Run {syncPreview.plan.items.filter((item) => item.action === "create" || item.action === "update").length} file(s)</button></div></div> : null}
            {syncProfiles.map((profile) => <div className="operations-hub__trust" key={`preview-${profile.id}`}><div><strong>{profile.name}</strong><span>{profile.direction === "upload" ? "Deploy local → remote" : "Pull remote → local"}</span></div><button className="secondary-button secondary-button--small" disabled={syncBusy} onClick={() => void previewSync(profile)} type="button">Preview</button></div>)}
            {syncRuns.slice(0, 6).map((run) => <div className="operations-hub__run" key={run.id}><strong>{run.profileName}</strong><span>{run.status} · {run.completedFiles}/{run.totalFiles} completed{run.failedFiles ? ` · ${run.failedFiles} failed` : ""}</span>{run.status === "running" ? <button className="secondary-button secondary-button--small" onClick={() => void operations?.cancelSync(run.id)} type="button">Cancel</button> : null}{run.errors.slice(0, 1).map((error) => <small key={`${run.id}-${error.relativePath}`}>{error.relativePath || "Connection"}: {error.message}</small>)}</div>)}
          </section>
        ) : null}

        {false && section === "fleet" ? (
          <section className="operations-hub__section operations-hub__list"><h4>Fixed monitoring</h4><p className="hint">Pinned sessions are sampled by controlled short connections. Sessions that still need trust, credentials or interactive MFA are marked as requiring a manual connection instead of repeatedly prompting.</p>{sessions.map((session) => <div className="operations-hub__trust" key={session.id}><div><strong>{session.name}</strong><span>{session.username}@{session.host} · {pinnedSessionIds.has(session.id) ? "Every 60 seconds" : "Not pinned"}</span></div><button className="secondary-button secondary-button--small" onClick={() => void togglePinnedMonitor(session.id)} type="button">{pinnedSessionIds.has(session.id) ? "Unpin" : "Pin monitor"}</button></div>)}</section>
        ) : null}

        {false && section === "fleet" ? (
          <section className="operations-hub__section operations-hub__list">
            <div className="operations-hub__heading"><h4>Latest observations</h4><span className="hint">60s default · max 8 parallel · busy transfers automatically slow polls</span></div>
            {sessions.filter((session) => pinnedSessionIds.has(session.id)).map((session) => {
              const observation = healthBySession[session.id];
              return <div className="operations-hub__trust" key={`health-${session.id}`}><div><strong>{session.name}</strong><span>{observation ? `${observation.connectionState} · CPU ${observation.cpuUsagePercent.toFixed(0)}% · MEM ${observation.memoryUsagePercent.toFixed(0)}% · DISK ${observation.diskUsagePercent.toFixed(0)}% · services ${observation.failedServices}` : "Waiting for first sample"}</span></div><button className="secondary-button secondary-button--small" onClick={() => void collectPinnedHealth(session.id)} type="button">Check now</button></div>;
            })}
          </section>
        ) : null}

        {false && section === "fleet" ? (
          <section className="operations-hub__section operations-hub__list">
            <h4>Alert rules</h4>
            {sessions.filter((session) => pinnedSessionIds.has(session.id)).map((session) => {
              const monitor = pinnedMonitorsBySession[session.id];
              if (!monitor) return null;
              return <div className="operations-hub__rule" key={`rule-${session.id}`}><strong>{session.name}</strong><label>CPU<input min="1" max="100" onChange={(event) => void savePinnedMonitorPatch(session.id, { cpuWarnPercent: Number(event.target.value) })} type="number" value={monitor.cpuWarnPercent ?? 85} />%</label><label>Memory<input min="1" max="100" onChange={(event) => void savePinnedMonitorPatch(session.id, { memoryWarnPercent: Number(event.target.value) })} type="number" value={monitor.memoryWarnPercent ?? 85} />%</label><label>Disk<input min="1" max="100" onChange={(event) => void savePinnedMonitorPatch(session.id, { diskWarnPercent: Number(event.target.value) })} type="number" value={monitor.diskWarnPercent ?? 85} />%</label><label>Cooldown<input min="60" max="3600" onChange={(event) => void savePinnedMonitorPatch(session.id, { cooldownSeconds: Number(event.target.value) })} type="number" value={monitor.cooldownSeconds ?? 300} />s</label><label className="operations-hub__checkbox"><input checked={monitor.alertOnFailedServices !== false} onChange={(event) => void savePinnedMonitorPatch(session.id, { alertOnFailedServices: event.target.checked })} type="checkbox" />Failed services</label></div>;
            })}
          </section>
        ) : null}

        {section === "fleet" ? (
          <section className="operations-hub__section operations-hub__fleet">
            <div className="operations-hub__list">
            <div className="operations-hub__heading">
              <div><h4>Fleet overview</h4><span className="hint">Controlled short connections · max 8 parallel · busy transfers slow polling</span></div>
              <div className="operations-hub__actions fleet-overview__filters">
                {(["all", "critical", "warning", "healthy", "needsAttention", "unmonitored"] as FleetFilter[]).map((item) => (
                  <button className={`secondary-button secondary-button--small ${fleetFilter === item ? "is-active" : ""}`} key={item} onClick={() => setFleetFilter(item)} type="button">{item === "all" ? "All" : fleetLabel(item)}</button>
                ))}
              </div>
            </div>
            <div className="fleet-overview__summary-cards" aria-label="Fleet status summary">
              {(["critical", "warning", "healthy", "needsAttention", "unmonitored"] as const).map((severity) => (
                <button className={`fleet-overview__summary-card fleet-overview__summary-card--${severity} ${fleetFilter === severity ? "is-active" : ""}`} key={severity} onClick={() => setFleetFilter(fleetFilter === severity ? "all" : severity)} type="button">
                  <strong>{fleetSummaryCounts[severity]}</strong><span>{fleetLabel(severity)}</span>
                </button>
              ))}
            </div>
            {pinnedSessionIds.size === 0 ? (
              <div className="fleet-empty-state" role="status">
                <strong>Start Fleet Health from a server you already use.</strong>
                <span>Open a terminal tab and choose <b>Pin monitor</b> in Server Health, or use the Pin action on a session below. Monitoring stays local and runs controlled checks every 60 seconds.</span>
              </div>
            ) : null}
            {fleetRows.map(({ session, severity, overview }) => {
              const observation = overview?.lastObservation ?? healthBySession[session.id];
              return <div className="operations-hub__trust fleet-overview__row" key={session.id}>
                <button className="fleet-overview__summary" onClick={() => { setSelectedFleetSessionId(session.id); setSelectedIncidentId(overview?.activeIncident?.id ?? null); }} type="button">
                  <strong>{session.name}<em className={`fleet-status fleet-status--${severity}`}>{fleetLabel(severity)}</em></strong>
                  {observation ? <>
                    <div className="fleet-overview__resource-bars">
                      {([ ["CPU", observation.cpuUsagePercent], ["MEM", observation.memoryUsagePercent], ["DISK", observation.diskUsagePercent] ] as Array<[string, number]>).map(([label, value]) => <span key={label}><i>{label}</i><b><em style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></b><strong>{value.toFixed(0)}%</strong></span>)}
                    </div>
                    <span>Load {observation.load1.toFixed(2)} / {(observation.load5 ?? 0).toFixed(2)} / {(observation.load15 ?? 0).toFixed(2)} · RX {formatTrendRate(observation.networkRxBytesPerSecond ?? 0)} · TX {formatTrendRate(observation.networkTxBytesPerSecond ?? 0)} · services {observation.failedServices} · {new Date(observation.collectedAt).toLocaleTimeString()}</span>
                  </> : <span>{severity === "unmonitored" ? "Pin this session to begin controlled health checks." : "Waiting for the first sample."}</span>}
                </button>
                <div className="operations-hub__actions"><button className="secondary-button secondary-button--small" onClick={() => onOpenSession(session)} type="button">Open</button><button className="secondary-button secondary-button--small" onClick={() => void togglePinnedMonitor(session.id)} type="button">{pinnedSessionIds.has(session.id) ? "Unpin" : "Pin"}</button>{pinnedSessionIds.has(session.id) ? <button className="secondary-button secondary-button--small" onClick={() => void collectPinnedHealth(session.id)} type="button">Check</button> : null}</div>
              </div>;
            })}
            {fleetRows.length === 0 ? <p className="hint">No sessions match this Fleet Health filter.</p> : null}
            </div>

            <div className="operations-hub__list">
            <h4>Monitor rules and recommended Runbooks</h4>
            <p className="hint">Warning preserves the existing threshold. Critical is a stronger local alert; every recommended Runbook still requires preview and confirmation.</p>
            {sessions.filter((session) => pinnedSessionIds.has(session.id)).map((session) => {
              const monitor = pinnedMonitorsBySession[session.id];
              if (!monitor) return null;
              return <div className="operations-hub__rule fleet-rule" key={`rule-v149-${session.id}`}>
                <strong>{session.name}</strong>
                <div className="fleet-rule__thresholds">
                  <label>CPU W<input min="1" max="99" onChange={(event) => void savePinnedMonitorPatch(session.id, { cpuWarnPercent: Number(event.target.value) })} type="number" value={monitor.cpuWarnPercent ?? 85} />%</label><label>CPU C<input min="2" max="100" onChange={(event) => void savePinnedMonitorPatch(session.id, { cpuCriticalPercent: Number(event.target.value) })} type="number" value={monitor.cpuCriticalPercent ?? 95} />%</label>
                  <label>MEM W<input min="1" max="99" onChange={(event) => void savePinnedMonitorPatch(session.id, { memoryWarnPercent: Number(event.target.value) })} type="number" value={monitor.memoryWarnPercent ?? 85} />%</label><label>MEM C<input min="2" max="100" onChange={(event) => void savePinnedMonitorPatch(session.id, { memoryCriticalPercent: Number(event.target.value) })} type="number" value={monitor.memoryCriticalPercent ?? 95} />%</label>
                  <label>DISK W<input min="1" max="99" onChange={(event) => void savePinnedMonitorPatch(session.id, { diskWarnPercent: Number(event.target.value) })} type="number" value={monitor.diskWarnPercent ?? 85} />%</label><label>DISK C<input min="2" max="100" onChange={(event) => void savePinnedMonitorPatch(session.id, { diskCriticalPercent: Number(event.target.value) })} type="number" value={monitor.diskCriticalPercent ?? 95} />%</label>
                  <label>Service W<input min="1" max="999" onChange={(event) => void savePinnedMonitorPatch(session.id, { failedServiceWarnCount: Number(event.target.value) })} type="number" value={monitor.failedServiceWarnCount ?? 1} /></label><label>Service C<input min="2" max="1000" onChange={(event) => void savePinnedMonitorPatch(session.id, { failedServiceCriticalCount: Number(event.target.value) })} type="number" value={monitor.failedServiceCriticalCount ?? 3} /></label>
                  <label>Cooldown<input min="60" max="3600" onChange={(event) => void savePinnedMonitorPatch(session.id, { cooldownSeconds: Number(event.target.value) })} type="number" value={monitor.cooldownSeconds ?? 300} />s</label>
                </div>
                <label className="operations-hub__field fleet-rule__runbooks">Recommended Runbooks (up to 3)<select multiple onChange={(event) => void savePinnedMonitorPatch(session.id, { recommendedRunbookIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value).slice(0, 3) })} value={monitor.recommendedRunbookIds ?? []}>{runbooks.map((runbook) => <option key={runbook.id} value={runbook.id}>{runbook.name}</option>)}</select></label>
              </div>;
            })}
            {pinnedSessionIds.size === 0 ? <p className="hint">Pin a session above to configure thresholds and recommended response Runbooks.</p> : null}
            </div>

            <div className="operations-hub__split fleet-incidents">
            <div className="operations-hub__list">
              <div className="operations-hub__heading"><h4>Incident queue</h4><span className="hint">Open and acknowledged incidents first</span></div>
              {healthIncidents.filter((incident) => incident.status !== "resolved").map((incident) => <button className={`operations-hub__row ${selectedIncidentId === incident.id ? "is-selected" : ""}`} key={incident.id} onClick={() => { setSelectedIncidentId(incident.id); setSelectedFleetSessionId(incident.sessionId); }} type="button"><strong>{sessions.find((session) => session.id === incident.sessionId)?.name ?? incident.sessionId}<em className={`fleet-status fleet-status--${incident.severity}`}>{incident.severity}</em></strong><span>{incident.conditionKeys.join(", ")} · {incident.status} · {new Date(incident.lastDetectedAt).toLocaleString()}</span></button>)}
              {healthIncidents.every((incident) => incident.status === "resolved") ? <p className="hint">No active incidents. Resolved history remains in the local evidence store.</p> : null}
            </div>
            <div className="operations-hub__editor fleet-incident-detail">
              {selectedFleetSession ? <>
                <div className="operations-hub__heading"><div><h4>{selectedFleetSession.name}</h4><span className="hint">{selectedIncident ? `${selectedIncident.conditionKeys.join(", ")} · since ${new Date(selectedIncident.firstDetectedAt).toLocaleString()}` : selectedFleetObservation ? `Latest check ${new Date(selectedFleetObservation.collectedAt).toLocaleString()}` : "Waiting for the first monitor sample."}</span></div>{selectedIncident ? <div className="operations-hub__actions">{selectedIncident.status === "open" ? <button className="secondary-button secondary-button--small" onClick={() => void acknowledgeIncident(selectedIncident.id)} type="button">Acknowledge</button> : null}<button className="secondary-button secondary-button--small" onClick={() => void exportIncidentEvidence(selectedIncident.id)} type="button">Export evidence</button></div> : null}</div>
                <div className="fleet-incident-detail__range">{(["24h", "7d", "30d"] as HealthTrendRange[]).map((range) => <button className={`secondary-button secondary-button--small ${trendRange === range ? "is-active" : ""}`} key={range} onClick={() => setTrendRange(range)} type="button">{range}</button>)}</div>
                <HealthTrendDashboard cpuCoreCount={selectedFleetObservation?.cpuCoreCount} monitor={pinnedMonitorsBySession[selectedFleetSession.id]} points={trendPoints} range={trendRange} />
                {selectedFleetObservation ? <div className="fleet-incident-detail__metrics"><span>Load {selectedFleetObservation.load1.toFixed(2)} / {(selectedFleetObservation.load5 ?? 0).toFixed(2)} / {(selectedFleetObservation.load15 ?? 0).toFixed(2)}</span><span>Swap {(selectedFleetObservation.swapUsagePercent ?? 0).toFixed(0)}%</span><span>RX {formatTrendRate(selectedFleetObservation.networkRxBytesPerSecond ?? 0)} · TX {formatTrendRate(selectedFleetObservation.networkTxBytesPerSecond ?? 0)}</span><span>Failed services {selectedFleetObservation.failedServices}</span><span>{selectedIncident?.status ?? selectedFleetOverview?.severity ?? "healthy"}</span></div> : null}
                {selectedIncident ? <>
                  <h4>Recommended response</h4>
                  <div className="operations-hub__actions">{(pinnedMonitorsBySession[selectedIncident.sessionId]?.recommendedRunbookIds ?? []).map((runbookId) => runbooks.find((runbook) => runbook.id === runbookId)).filter((runbook): runbook is Runbook => Boolean(runbook)).map((runbook) => <button className="primary-button" disabled={runbookBusy} key={runbook.id} onClick={() => void runIncidentRunbook(selectedIncident, runbook)} type="button">Preview {runbook.name}</button>)}{(pinnedMonitorsBySession[selectedIncident.sessionId]?.recommendedRunbookIds ?? []).length === 0 ? <p className="hint">No response Runbook is linked to this monitor.</p> : null}</div>
                  <h4>Timeline</h4>
                  <div className="fleet-incident-detail__timeline">{selectedIncidentEvents.map((event) => <div key={event.id}><strong>{event.type}</strong><span>{event.detail}</span><small>{new Date(event.createdAt).toLocaleString()}</small></div>)}</div>
                </> : <p className="hint">No open incident for this server. The charts remain available for routine inspection.</p>}
              </> : <p className="hint">Select any monitored server above, or choose an active incident, to inspect its trends.</p>}
            </div>
            </div>
          </section>
        ) : null}

        {section === "workspace" ? (
          <section className="operations-hub__section operations-hub__split">
            <div className="operations-hub__editor">
              <h4>Encrypted local workspace</h4>
              <p className="hint">A <code>.tdworkspace</code> package encrypts sessions, groups, asset fields, Runbooks, sync profiles and fixed monitor settings with your passphrase. It is local-only: no cloud account or shared live workspace is created.</p>
              <p className="hint">Server trust fingerprints are intentionally excluded. Each device must verify server identity again.</p>
              <button className="primary-button" disabled={workspaceBusy} onClick={() => void exportWorkspace()} type="button">Export .tdworkspace</button>
            </div>
            <div className="operations-hub__editor">
              <h4>Import with preview</h4>
              <p className="hint">Choose skip, overwrite or rename for session conflicts. Credentials remain excluded unless the package explicitly contains the optional encrypted attachment and you choose to restore it.</p>
              <button className="secondary-button" disabled={workspaceBusy} onClick={() => void importWorkspace()} type="button">Import .tdworkspace</button>
              {workspaceStatus ? <p className="hint">{workspaceStatus}</p> : null}
            </div>
          </section>
        ) : null}
      </div>
      <AppDialogModal
        dialog={hubDialog}
        inputElementRef={hubDialogInputRef}
        inputValue={hubDialogInput}
        onClose={closeHubDialog}
        onInputChange={setHubDialogInput}
        onResolveOption={(value) => resolveHubDialog(value)}
        onSubmit={submitHubDialog}
      />
    </ModalShell>
  );
}
