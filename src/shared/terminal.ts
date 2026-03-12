export type TerminalConnectionStatus = "connecting" | "connected" | "closed";

export type PortForwardType = "local" | "remote" | "dynamic";
export type PortForwardStatus = "active" | "degraded";
export type PortForwardEventLevel = "info" | "error";
export type PortForwardEventType =
  | "created"
  | "removed"
  | "statusRecovered"
  | "statusDegraded";

export interface PortForwardRecord {
  id: string;
  tabId: string;
  type: PortForwardType;
  bindHost: string;
  bindPort: number;
  targetHost?: string;
  targetPort?: number;
  createdAt: string;
  status: PortForwardStatus;
  totalConnections: number;
  failedConnections: number;
  lastActivityAt?: string;
  lastError?: string;
  lastErrorAt?: string;
}

export interface PortForwardEventRecord {
  id: string;
  tabId: string;
  forwardId: string;
  forwardType: PortForwardType;
  bindHost: string;
  bindPort: number;
  level: PortForwardEventLevel;
  type: PortForwardEventType;
  message: string;
  createdAt: string;
  correlationKey?: string;
  connectionId?: string;
  sourceEndpoint?: string;
  targetEndpoint?: string;
  errorCode?: string;
}

export interface CreatePortForwardInput {
  type: PortForwardType;
  bindHost: string;
  bindPort: number;
  targetHost?: string;
  targetPort?: number;
}

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
