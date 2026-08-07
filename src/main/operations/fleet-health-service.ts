import { BrowserWindow, Notification } from "electron";

import type { SqliteOperationsStore } from "../storage/sqlite/sqlite-operations-store.js";
import type { TerminalService } from "../terminal/terminal-service.js";

const TICK_INTERVAL_MS = 10_000;
const MAX_PARALLEL_MONITORS = 8;

/**
 * Runs pinned health checks independently from terminal tabs. It deliberately
 * uses the renderer's WebContents only as an event destination: TerminalService
 * performs non-interactive trust checks, so a background poll never opens an
 * authentication or host-key prompt.
 */
export class FleetHealthService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly lastCollectedAt = new Map<string, number>();

  constructor(
    private readonly store: SqliteOperationsStore | null,
    private readonly terminalService: TerminalService
  ) {}

  start(): void {
    if (!this.store || this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_INTERVAL_MS);
    void this.tick();
  }

  dispose(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (!this.store || this.running) return;
    const targetWindow = BrowserWindow.getAllWindows().find((windowRef) => !windowRef.isDestroyed());
    if (!targetWindow) return;
    this.running = true;
    try {
      const now = Date.now();
      const throttleMultiplier = this.terminalService.hasActiveTransfers() ? 2 : 1;
      const due = this.store
        .listPinnedMonitors()
        .filter((monitor) => monitor.enabled)
        .filter((monitor) => {
          const previous = this.lastCollectedAt.get(monitor.sessionId) ?? 0;
          return now - previous >= monitor.intervalSeconds * 1_000 * throttleMultiplier;
        })
        .slice(0, MAX_PARALLEL_MONITORS);
      let nextIndex = 0;
      const workerCount = Math.min(MAX_PARALLEL_MONITORS, due.length);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (nextIndex < due.length) {
            const index = nextIndex;
            nextIndex += 1;
            const monitor = due[index];
            if (!monitor) return;
            this.lastCollectedAt.set(monitor.sessionId, Date.now());
            await this.terminalService.collectPinnedHealth(monitor.sessionId, targetWindow.webContents);
            this.notifyIfNeeded(monitor.sessionId, monitor.cooldownSeconds ?? 300, targetWindow);
          }
        })
      );
    } finally {
      this.running = false;
    }
  }

  private notifyIfNeeded(sessionId: string, cooldownSeconds: number, targetWindow: BrowserWindow): void {
    if (!this.store || !Notification.isSupported()) return;
    const candidate = this.store.listHealthIncidents(undefined, 200).find(
      (incident) => incident.sessionId === sessionId && incident.status !== "resolved"
    );
    if (!candidate) return;
    const incident = this.store.claimHealthIncidentNotification(candidate.id, cooldownSeconds);
    if (!incident) return;
    const notification = new Notification({
      title: `TermDock Fleet: ${incident.severity === "critical" ? "Critical" : "Warning"}`,
      body: `${sessionId} · ${incident.conditionKeys.join(", ") || "health threshold"}`,
      urgency: incident.severity === "critical" ? "critical" : "normal"
    });
    notification.on("click", () => {
      if (targetWindow.isDestroyed()) return;
      if (targetWindow.isMinimized()) targetWindow.restore();
      targetWindow.show();
      targetWindow.focus();
      targetWindow.webContents.send("operations:event", { type: "focusHealthIncident", incidentId: incident.id });
    });
    notification.show();
  }
}
