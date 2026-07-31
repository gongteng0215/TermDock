import type { ComponentProps, CSSProperties, ReactNode } from "react";
import {
  Activity,
  ArrowUpDown,
  Check,
  CloudUpload,
  FolderOpen,
  History,
  Play,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare
} from "lucide-react";

import {
  CommandHistoryInspectorSection,
  SessionsInspectorSection,
  SftpExplorerSection,
  ServerHealthInspectorSection
} from "./workbench-panels";
import { ServerHealthInspectorContent } from "./server-health-inspector-content";
import {
  TerminalWorkspaceHost,
  type TerminalWorkspaceHostProps
} from "./terminal-workspace-host";
import { AppInlineHintPanel, TransferDock, type TransferDockProps } from "./workbench-shell";

export type CockpitDockId =
  | "terminal"
  | "files"
  | "monitor"
  | "history"
  | "transfers"
  | "retry"
  | "operations"
  | "settings";

export interface CockpitChromeProps {
  activeDock: CockpitDockId;
  onDockSelect: (id: CockpitDockId) => void;
  autoReconnectEnabled: boolean;
  reconnectDelaySeconds: number;
  reconnectBusy: boolean;
  onReconnect: () => void;
  safetyEnabled: boolean;
  onOpenSafety: () => void;
}

export interface CockpitWorkbenchShellProps {
  chrome: CockpitChromeProps;
  appInlineHintPanelProps: ComponentProps<typeof AppInlineHintPanel>;
  commandHistoryInspectorSectionProps: ComponentProps<typeof CommandHistoryInspectorSection>;
  serverHealthInspectorContentProps: ComponentProps<typeof ServerHealthInspectorContent>;
  serverHealthInspectorSectionProps: Omit<
    ComponentProps<typeof ServerHealthInspectorSection>,
    "children"
  >;
  sessionsInspectorSectionProps: ComponentProps<typeof SessionsInspectorSection>;
  sftpExplorerSectionProps: ComponentProps<typeof SftpExplorerSection>;
  terminalWorkspaceProps: TerminalWorkspaceHostProps;
  transferDockProps: ComponentProps<typeof TransferDock>;
}

const DOCK_ITEMS: Array<{
  id: CockpitDockId;
  label: string;
  Icon: typeof TerminalSquare;
}> = [
  { id: "terminal", label: "TERMINAL", Icon: TerminalSquare },
  { id: "files", label: "FILES", Icon: FolderOpen },
  { id: "monitor", label: "MONITOR", Icon: Activity },
  { id: "history", label: "HISTORY", Icon: History },
  { id: "transfers", label: "TRANSFERS", Icon: ArrowUpDown },
  { id: "retry", label: "RETRY", Icon: RefreshCw },
  { id: "operations", label: "OPERATIONS", Icon: Play },
  { id: "settings", label: "SETTINGS", Icon: Settings }
];

function countTransfers(
  transfers: TransferDockProps["uploadPanel"]["transfers"],
  status: string
): number {
  return transfers.filter((transfer) => transfer.status === status).length;
}

function parseProgressPercent(label: string): number | null {
  const match = label.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) {
    return null;
  }
  return Math.max(0, Math.min(100, Number(match[1])));
}

function CockpitTransferStrip({
  expanded,
  onToggle,
  transferDockProps
}: {
  expanded: boolean;
  onToggle: () => void;
  transferDockProps: TransferDockProps;
}) {
  const {
    uploadPanel,
    downloadPanel,
    canRetryAllFailed,
    failedRetryCandidateTotal,
    onRetryAllFailed,
    labels,
    bindingLabel,
    notice
  } = transferDockProps;

  const uploadRunning = countTransfers(uploadPanel.transfers, "running");
  const uploadQueued = countTransfers(uploadPanel.transfers, "queued");
  const downloadRunning = countTransfers(downloadPanel.transfers, "running");
  const downloadQueued = countTransfers(downloadPanel.transfers, "queued");
  const primary =
    uploadPanel.transfers.find((transfer) => transfer.status === "running") ??
    uploadPanel.transfers.find((transfer) => transfer.status === "queued") ??
    downloadPanel.transfers.find((transfer) => transfer.status === "running") ??
    downloadPanel.transfers.find((transfer) => transfer.status === "queued") ??
    uploadPanel.transfers[0] ??
    downloadPanel.transfers[0] ??
    null;
  const progressPercent = primary ? parseProgressPercent(primary.progressLabel) : null;
  const isComplete = primary?.status === "completed" || progressPercent === 100;
  const directionLabel =
    primary == null
      ? bindingLabel || "No active transfer"
      : primary.direction === "upload"
        ? `Uploading · ${bindingLabel || "active tab"}`
        : `Downloading · ${bindingLabel || "active tab"}`;

  return (
    <section
      className={expanded ? "cockpit-transfer-strip is-expanded" : "cockpit-transfer-strip"}
      data-testid="cockpit-transfer-strip"
    >
      <button
        aria-expanded={expanded}
        aria-label="Toggle transfer details"
        className="cockpit-transfer-strip__main"
        onClick={onToggle}
        type="button"
      >
        <CloudUpload aria-hidden="true" size={22} strokeWidth={1.8} />
        <span className="cockpit-transfer-strip__file">
          <strong>{primary?.name ?? "Transfers idle"}</strong>
          <small>{notice?.message ?? directionLabel}</small>
        </span>
        <span
          className="cockpit-transfer-strip__progress"
          style={
            {
              ["--cockpit-transfer-progress"]: `${progressPercent ?? (primary ? 8 : 0)}%`
            } as CSSProperties
          }
        >
          <i />
          <small>{primary?.progressLabel ?? "0% · waiting"}</small>
        </span>
        {isComplete ? <Check aria-hidden="true" size={18} strokeWidth={2.2} /> : <span />}
      </button>
      <div className="cockpit-transfer-strip__count">
        <small>UPLOADS</small>
        <strong>{uploadPanel.transfers.length}</strong>
        <span>
          Running {uploadRunning}
          <br />
          Queued {uploadQueued}
        </span>
      </div>
      <div className="cockpit-transfer-strip__count">
        <small>DOWNLOADS</small>
        <strong>{downloadPanel.transfers.length}</strong>
        <span>
          Running {downloadRunning}
          <br />
          Queued {downloadQueued}
        </span>
      </div>
      <button
        className="cockpit-transfer-strip__retry"
        disabled={!canRetryAllFailed}
        onClick={onRetryAllFailed}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={13} strokeWidth={1.8} />
        {labels.retryAllFailed} ({failedRetryCandidateTotal})
      </button>
    </section>
  );
}

function CockpitModule({
  title,
  focus,
  testId,
  children,
  trailing
}: {
  title: string;
  focus: boolean;
  testId: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <section
      className={focus ? "cockpit-module is-focus" : "cockpit-module"}
      data-testid={testId}
    >
      <header className="cockpit-module__header">
        <h2 className="cockpit-module__title">{title}</h2>
        {trailing ? <div className="cockpit-module__trailing">{trailing}</div> : null}
      </header>
      <div className="cockpit-module__body">{children}</div>
    </section>
  );
}

function CockpitTopHud({
  autoReconnectEnabled,
  reconnectDelaySeconds,
  reconnectBusy,
  onReconnect,
  safetyEnabled,
  onOpenSafety
}: Pick<
  CockpitChromeProps,
  | "autoReconnectEnabled"
  | "reconnectDelaySeconds"
  | "reconnectBusy"
  | "onReconnect"
  | "safetyEnabled"
  | "onOpenSafety"
>) {
  return (
    <header className="cockpit-top-hud" aria-label="Ops console status">
      <div className="cockpit-top-hud__panel">
        <button
          className="cockpit-top-hud__reconnect"
          disabled={reconnectBusy}
          onClick={onReconnect}
          type="button"
        >
          <ShieldCheck aria-hidden="true" size={18} strokeWidth={1.8} />
          <span className="cockpit-top-hud__copy">
            <strong>{reconnectBusy ? "RECONNECTING" : "RECONNECT"}</strong>
            <small>Auto reconnect: {autoReconnectEnabled ? "ON" : "OFF"}</small>
          </span>
          <i className="cockpit-top-hud__divider" />
          <small className="cockpit-top-hud__delay">Delay: {reconnectDelaySeconds}s</small>
          <RefreshCw
            aria-hidden="true"
            className={
              reconnectBusy ? "cockpit-top-hud__spin is-spinning" : "cockpit-top-hud__spin"
            }
            size={15}
            strokeWidth={1.8}
          />
        </button>
        <button className="cockpit-top-hud__danger" onClick={onOpenSafety} type="button">
          <ShieldAlert aria-hidden="true" size={18} strokeWidth={1.8} />
          <span className="cockpit-top-hud__copy">
            <strong>Dangerous commands</strong>
            <small>Confirm before run: {safetyEnabled ? "ON" : "OFF"}</small>
          </span>
        </button>
      </div>
    </header>
  );
}

function CockpitBottomDock({
  active,
  onSelect
}: {
  active: CockpitDockId;
  onSelect: (id: CockpitDockId) => void;
}) {
  const handleSelect = (id: CockpitDockId) => {
    if (id === "transfers" && active === "transfers") {
      onSelect("terminal");
      return;
    }

    onSelect(id);
  };

  return (
    <nav className="cockpit-bottom-dock" aria-label="Main product navigation">
      <span aria-hidden="true" className="cockpit-bottom-dock__terminal-mask" />
      <div className="cockpit-bottom-dock__hitgrid">
        {DOCK_ITEMS.map(({ id, label, Icon }) => (
          <button
            aria-current={active === id ? "page" : undefined}
            aria-label={
              id === "transfers" && active === "transfers"
                ? "Hide transfer details"
                : `Open ${label.toLowerCase()}`
            }
            className={
              active === id ? "cockpit-bottom-dock__item is-active" : "cockpit-bottom-dock__item"
            }
            data-dock-id={id}
            key={id}
            onClick={() => handleSelect(id)}
            type="button"
          >
            <Icon aria-hidden="true" size={28} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function CockpitWorkbenchShell({
  chrome,
  appInlineHintPanelProps,
  commandHistoryInspectorSectionProps,
  serverHealthInspectorContentProps,
  serverHealthInspectorSectionProps,
  sessionsInspectorSectionProps,
  sftpExplorerSectionProps,
  terminalWorkspaceProps,
  transferDockProps
}: CockpitWorkbenchShellProps) {
  const { activeDock } = chrome;

  return (
    <div className="cockpit-shell" data-active-panel={activeDock}>
      <CockpitTopHud
        autoReconnectEnabled={chrome.autoReconnectEnabled}
        onOpenSafety={chrome.onOpenSafety}
        onReconnect={chrome.onReconnect}
        reconnectBusy={chrome.reconnectBusy}
        reconnectDelaySeconds={chrome.reconnectDelaySeconds}
        safetyEnabled={chrome.safetyEnabled}
      />
      <div className="cockpit-stage">
        <aside className="cockpit-rail cockpit-rail--left">
          <CockpitModule focus={activeDock === "files"} testId="cockpit-files" title="SFTP FILES">
            <SftpExplorerSection {...sftpExplorerSectionProps} />
          </CockpitModule>
        </aside>
        <div className="cockpit-center">
          <section
            className={
              activeDock === "terminal" ? "cockpit-terminal is-focus" : "cockpit-terminal"
            }
            data-testid="cockpit-terminal"
          >
            <TerminalWorkspaceHost {...terminalWorkspaceProps} />
          </section>
          <section
            className={
              activeDock === "transfers" ? "cockpit-transfer is-focus" : "cockpit-transfer"
            }
            data-testid="cockpit-transfers"
          >
            <CockpitTransferStrip
              expanded={activeDock === "transfers"}
              onToggle={() =>
                chrome.onDockSelect(activeDock === "transfers" ? "terminal" : "transfers")
              }
              transferDockProps={transferDockProps}
            />
            {activeDock === "transfers" ? <TransferDock {...transferDockProps} /> : null}
          </section>
          <CockpitBottomDock active={activeDock} onSelect={chrome.onDockSelect} />
        </div>
        <aside className="cockpit-rail cockpit-rail--right">
          <CockpitModule focus={false} testId="cockpit-sessions" title="SESSIONS">
            <SessionsInspectorSection {...sessionsInspectorSectionProps} />
          </CockpitModule>
          <CockpitModule
            focus={activeDock === "monitor"}
            testId="cockpit-health"
            title="SERVER HEALTH"
          >
            <ServerHealthInspectorSection {...serverHealthInspectorSectionProps}>
              <ServerHealthInspectorContent {...serverHealthInspectorContentProps} />
            </ServerHealthInspectorSection>
          </CockpitModule>
          <CockpitModule
            focus={
              activeDock === "history" ||
              activeDock === "operations" ||
              activeDock === "retry"
            }
            testId="cockpit-history"
            title="HISTORY / OPERATIONS"
            trailing={
              activeDock === "operations" ? <span className="cockpit-chip">OPS</span> : null
            }
          >
            <CommandHistoryInspectorSection {...commandHistoryInspectorSectionProps} />
          </CockpitModule>
        </aside>
      </div>
      <AppInlineHintPanel {...appInlineHintPanelProps} hideWhenEmpty />
    </div>
  );
}
