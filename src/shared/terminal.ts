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
  osName?: string;
  kernelName?: string;
  kernelRelease?: string;
  architecture?: string;
  cpuCoreCount?: number;
  uptimeSeconds: number;
  load1: number;
  load5: number;
  load15: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryAvailableBytes?: number;
  memoryFreeBytes?: number;
  memoryBufferBytes?: number;
  memoryCachedBytes?: number;
  swapTotalBytes?: number;
  swapUsedBytes?: number;
  swapFreeBytes?: number;
  diskPath: string;
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskAvailableBytes: number;
  filesystems?: ServerFilesystemUsage[];
  cpuTotalTicks: number;
  cpuIdleTicks: number;
  networkRxBytes: number;
  networkTxBytes: number;
  networkInterfaces?: ServerNetworkInterfaceUsage[];
}

export interface ServerProcessEntry {
  pid: number;
  user: string;
  cpuPercent: number;
  memoryPercent: number;
  command: string;
}

export interface ServerFailedServiceEntry {
  name: string;
  loadState?: string;
  activeState?: string;
  subState?: string;
  description?: string;
}

export interface ServerFilesystemUsage {
  filesystem: string;
  path: string;
  type?: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usePercent: number;
  inodeUsedPercent?: number;
}

export interface ServerNetworkInterfaceUsage {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxErrors?: number;
  txErrors?: number;
  rxDropped?: number;
  txDropped?: number;
}

export interface ServerProcessSnapshot {
  tabId: string;
  collectedAt: string;
  processes: ServerProcessEntry[];
  memoryProcesses?: ServerProcessEntry[];
  failedServices: ServerFailedServiceEntry[];
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
    }
  | {
      tabId: string;
      type: "hostKeyPrompt";
      promptId: string;
      host: string;
      port: number;
      fingerprint: string;
      changed: boolean;
      isJumpHost: boolean;
    }
  | {
      tabId: string;
      type: "keyboardInteractivePrompt";
      promptId: string;
      name: string;
      instruction: string;
      prompts: Array<{ prompt: string; echo: boolean }>;
    };
