import type {
  PortForwardEventLevel,
  PortForwardEventType,
  PortForwardType
} from "./terminal.js";

/** Shared shapes for Phase 4 port-forward event history persistence. */

export interface PersistedPortForwardEventHistoryItem {
  key: string;
  sessionId: string;
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
