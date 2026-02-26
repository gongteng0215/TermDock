export type TerminalConnectionStatus = "connecting" | "connected" | "closed";

export interface ServerHealthSnapshot {
  tabId: string;
  collectedAt: string;
  hostname: string;
  uptimeSeconds: number;
  load1: number;
  load5: number;
  load15: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  diskPath: string;
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskAvailableBytes: number;
  cpuTotalTicks: number;
  cpuIdleTicks: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

export interface ServerProcessEntry {
  pid: number;
  user: string;
  cpuPercent: number;
  memoryPercent: number;
  command: string;
}

export interface ServerProcessSnapshot {
  tabId: string;
  collectedAt: string;
  processes: ServerProcessEntry[];
  failedServices: string[];
}

export type TerminalEvent =
  | {
      tabId: string;
      type: "output";
      data: string;
    }
  | {
      tabId: string;
      type: "status";
      status: TerminalConnectionStatus;
    }
  | {
      tabId: string;
      type: "error";
      message: string;
    };
