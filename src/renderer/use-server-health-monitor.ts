import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import type { ServerHealthSnapshot, ServerProcessSnapshot } from "../shared/terminal";

const SERVER_HEALTH_POLL_INTERVAL_MS = 5000;
const SERVER_PROCESS_POLL_INTERVAL_MS = 10000;

type TerminalBridge = Window["termdock"]["terminal"];

export interface ServerHealthDerivedMetrics {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

interface ServerHealthTabState {
  snapshot: ServerHealthSnapshot | null;
  metrics: ServerHealthDerivedMetrics | null;
  loading: boolean;
  error: string | null;
}

interface ServerProcessTabState {
  snapshot: ServerProcessSnapshot | null;
  loading: boolean;
  error: string | null;
}

interface UseServerHealthMonitorArgs {
  activeTabId: string | null;
  activeTabIdRef: MutableRefObject<string | null>;
  connectedTabIdsRef: MutableRefObject<Set<string>>;
  disconnectReportFingerprintByTabRef: MutableRefObject<
    Map<string, { fingerprint: string; capturedAt: number }>
  >;
  isServerHealthDetailOpen: boolean;
  runningDownloadIdsRef: MutableRefObject<Map<string, string>>;
  runningUploadIdsRef: MutableRefObject<Map<string, string>>;
  terminalApi: TerminalBridge | null;
}

function deriveServerHealthMetrics(
  current: ServerHealthSnapshot,
  previous: ServerHealthSnapshot | null
): ServerHealthDerivedMetrics {
  const memoryUsagePercent =
    current.memoryTotalBytes > 0
      ? (current.memoryUsedBytes / current.memoryTotalBytes) * 100
      : 0;
  const diskUsagePercent =
    current.diskTotalBytes > 0 ? (current.diskUsedBytes / current.diskTotalBytes) * 100 : 0;

  let cpuUsagePercent = 0;
  let rxBytesPerSecond = 0;
  let txBytesPerSecond = 0;
  if (previous && previous.tabId === current.tabId) {
    const totalTicksDelta = current.cpuTotalTicks - previous.cpuTotalTicks;
    const idleTicksDelta = current.cpuIdleTicks - previous.cpuIdleTicks;
    if (totalTicksDelta > 0) {
      cpuUsagePercent = ((totalTicksDelta - idleTicksDelta) / totalTicksDelta) * 100;
    }

    const currentMillis = new Date(current.collectedAt).getTime();
    const previousMillis = new Date(previous.collectedAt).getTime();
    const elapsedSeconds = (currentMillis - previousMillis) / 1000;
    if (elapsedSeconds > 0) {
      const rxDelta = current.networkRxBytes - previous.networkRxBytes;
      const txDelta = current.networkTxBytes - previous.networkTxBytes;
      rxBytesPerSecond = rxDelta > 0 ? rxDelta / elapsedSeconds : 0;
      txBytesPerSecond = txDelta > 0 ? txDelta / elapsedSeconds : 0;
    }
  }

  return {
    cpuUsagePercent: Number.isFinite(cpuUsagePercent)
      ? Math.max(0, Math.min(100, cpuUsagePercent))
      : 0,
    memoryUsagePercent: Number.isFinite(memoryUsagePercent)
      ? Math.max(0, Math.min(100, memoryUsagePercent))
      : 0,
    diskUsagePercent: Number.isFinite(diskUsagePercent)
      ? Math.max(0, Math.min(100, diskUsagePercent))
      : 0,
    rxBytesPerSecond: Number.isFinite(rxBytesPerSecond) ? Math.max(0, rxBytesPerSecond) : 0,
    txBytesPerSecond: Number.isFinite(txBytesPerSecond) ? Math.max(0, txBytesPerSecond) : 0
  };
}

export function useServerHealthMonitor({
  activeTabId,
  activeTabIdRef,
  connectedTabIdsRef,
  disconnectReportFingerprintByTabRef,
  isServerHealthDetailOpen,
  runningDownloadIdsRef,
  runningUploadIdsRef,
  terminalApi
}: UseServerHealthMonitorArgs) {
  const [serverHealthByTab, setServerHealthByTab] = useState<Record<string, ServerHealthTabState>>(
    {}
  );
  const [serverProcessByTab, setServerProcessByTab] = useState<Record<string, ServerProcessTabState>>(
    {}
  );
  const serverHealthByTabRef = useRef<Record<string, ServerHealthTabState>>(serverHealthByTab);
  const serverProcessByTabRef = useRef<Record<string, ServerProcessTabState>>(serverProcessByTab);
  const serverHealthRequestInFlightTabsRef = useRef<Set<string>>(new Set());
  const serverProcessRequestInFlightTabsRef = useRef<Set<string>>(new Set());
  const serverHealthRequestIdsRef = useRef<Map<string, number>>(new Map());
  const serverProcessRequestIdsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    serverHealthByTabRef.current = serverHealthByTab;
  }, [serverHealthByTab]);

  useEffect(() => {
    serverProcessByTabRef.current = serverProcessByTab;
  }, [serverProcessByTab]);

  const invalidateServerHealthRequest = useCallback((tabId: string) => {
    const nextRequestId = (serverHealthRequestIdsRef.current.get(tabId) ?? 0) + 1;
    serverHealthRequestIdsRef.current.set(tabId, nextRequestId);
    serverHealthRequestInFlightTabsRef.current.delete(tabId);
  }, []);

  const invalidateServerProcessRequest = useCallback((tabId: string) => {
    const nextRequestId = (serverProcessRequestIdsRef.current.get(tabId) ?? 0) + 1;
    serverProcessRequestIdsRef.current.set(tabId, nextRequestId);
    serverProcessRequestInFlightTabsRef.current.delete(tabId);
  }, []);

  const resetServerHealth = useCallback(
    (options?: { tabId?: string | null; message?: string | null }) => {
      const targetTabId = (options?.tabId ?? activeTabIdRef.current ?? "").trim();
      if (!targetTabId) {
        return;
      }
      invalidateServerHealthRequest(targetTabId);
      const nextState: ServerHealthTabState = {
        snapshot: null,
        metrics: null,
        loading: false,
        error: options?.message ?? null
      };
      setServerHealthByTab((prev) => {
        const previous = prev[targetTabId];
        if (
          previous &&
          previous.snapshot === null &&
          previous.metrics === null &&
          previous.loading === false &&
          previous.error === nextState.error
        ) {
          return prev;
        }
        return {
          ...prev,
          [targetTabId]: nextState
        };
      });
    },
    [activeTabIdRef, invalidateServerHealthRequest]
  );

  const resetServerProcesses = useCallback(
    (options?: { tabId?: string | null; message?: string | null }) => {
      const targetTabId = (options?.tabId ?? activeTabIdRef.current ?? "").trim();
      if (!targetTabId) {
        return;
      }
      invalidateServerProcessRequest(targetTabId);
      const nextState: ServerProcessTabState = {
        snapshot: null,
        loading: false,
        error: options?.message ?? null
      };
      setServerProcessByTab((prev) => {
        const previous = prev[targetTabId];
        if (
          previous &&
          previous.snapshot === null &&
          previous.loading === false &&
          previous.error === nextState.error
        ) {
          return prev;
        }
        return {
          ...prev,
          [targetTabId]: nextState
        };
      });
    },
    [activeTabIdRef, invalidateServerProcessRequest]
  );

  const removeServerMonitorTabState = useCallback(
    (tabId: string) => {
      const targetTabId = tabId.trim();
      if (!targetTabId) {
        return;
      }
      invalidateServerHealthRequest(targetTabId);
      invalidateServerProcessRequest(targetTabId);
      setServerHealthByTab((prev) => {
        if (!(targetTabId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[targetTabId];
        return next;
      });
      setServerProcessByTab((prev) => {
        if (!(targetTabId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[targetTabId];
        return next;
      });
      disconnectReportFingerprintByTabRef.current.delete(targetTabId);
    },
    [
      disconnectReportFingerprintByTabRef,
      invalidateServerHealthRequest,
      invalidateServerProcessRequest
    ]
  );

  const refreshServerHealth = useCallback(
    async (options?: { tabId?: string; silent?: boolean }) => {
      const targetTabId = (options?.tabId ?? activeTabIdRef.current ?? "").trim();
      if (!targetTabId) {
        return;
      }
      if (!terminalApi) {
        resetServerHealth({
          tabId: targetTabId,
          message: "Terminal bridge unavailable. Restart `pnpm dev`."
        });
        return;
      }
      if (!connectedTabIdsRef.current.has(targetTabId)) {
        resetServerHealth({
          tabId: targetTabId,
          message: "Terminal tab is not connected."
        });
        return;
      }
      const isSilent = options?.silent === true;
      if (serverHealthRequestInFlightTabsRef.current.has(targetTabId)) {
        return;
      }
      if (isSilent) {
        const hasActiveUpload = Array.from(runningUploadIdsRef.current.values()).some(
          (tabId) => tabId === targetTabId
        );
        const hasActiveDownload = Array.from(runningDownloadIdsRef.current.values()).some(
          (tabId) => tabId === targetTabId
        );
        if (hasActiveUpload || hasActiveDownload) {
          return;
        }
      }

      const previousSnapshot = serverHealthByTabRef.current[targetTabId]?.snapshot ?? null;
      const requestId = (serverHealthRequestIdsRef.current.get(targetTabId) ?? 0) + 1;
      serverHealthRequestIdsRef.current.set(targetTabId, requestId);
      serverHealthRequestInFlightTabsRef.current.add(targetTabId);
      setServerHealthByTab((prev) => {
        const previous = prev[targetTabId];
        return {
          ...prev,
          [targetTabId]: {
            snapshot: previous?.snapshot ?? null,
            metrics: previous?.metrics ?? null,
            loading: true,
            error: isSilent ? previous?.error ?? null : null
          }
        };
      });
      try {
        const snapshot = await terminalApi.getServerHealth(targetTabId);
        if (
          serverHealthRequestIdsRef.current.get(targetTabId) !== requestId ||
          !connectedTabIdsRef.current.has(targetTabId)
        ) {
          return;
        }
        const nextMetrics = deriveServerHealthMetrics(snapshot, previousSnapshot);
        setServerHealthByTab((prev) => ({
          ...prev,
          [targetTabId]: {
            snapshot,
            metrics: nextMetrics,
            loading: false,
            error: null
          }
        }));
      } catch (caughtError) {
        if (serverHealthRequestIdsRef.current.get(targetTabId) !== requestId) {
          return;
        }
        const message = (caughtError as Error).message;
        setServerHealthByTab((prev) => {
          const previous = prev[targetTabId];
          return {
            ...prev,
            [targetTabId]: {
              snapshot: previous?.snapshot ?? null,
              metrics: previous?.metrics ?? null,
              loading: false,
              error: message
            }
          };
        });
      } finally {
        serverHealthRequestInFlightTabsRef.current.delete(targetTabId);
      }
    },
    [
      activeTabIdRef,
      connectedTabIdsRef,
      resetServerHealth,
      runningDownloadIdsRef,
      runningUploadIdsRef,
      terminalApi
    ]
  );

  const refreshServerProcesses = useCallback(
    async (options?: { tabId?: string; silent?: boolean }) => {
      const targetTabId = (options?.tabId ?? activeTabIdRef.current ?? "").trim();
      if (!targetTabId) {
        return;
      }
      if (!terminalApi) {
        resetServerProcesses({
          tabId: targetTabId,
          message: "Terminal bridge unavailable. Restart `pnpm dev`."
        });
        return;
      }
      if (!connectedTabIdsRef.current.has(targetTabId)) {
        resetServerProcesses({
          tabId: targetTabId,
          message: "Terminal tab is not connected."
        });
        return;
      }
      const isSilent = options?.silent === true;
      if (serverProcessRequestInFlightTabsRef.current.has(targetTabId)) {
        return;
      }
      if (isSilent) {
        const hasActiveUpload = Array.from(runningUploadIdsRef.current.values()).some(
          (tabId) => tabId === targetTabId
        );
        const hasActiveDownload = Array.from(runningDownloadIdsRef.current.values()).some(
          (tabId) => tabId === targetTabId
        );
        if (hasActiveUpload || hasActiveDownload) {
          return;
        }
      }

      const requestId = (serverProcessRequestIdsRef.current.get(targetTabId) ?? 0) + 1;
      serverProcessRequestIdsRef.current.set(targetTabId, requestId);
      serverProcessRequestInFlightTabsRef.current.add(targetTabId);
      setServerProcessByTab((prev) => {
        const previous = prev[targetTabId];
        return {
          ...prev,
          [targetTabId]: {
            snapshot: previous?.snapshot ?? null,
            loading: true,
            error: isSilent ? previous?.error ?? null : null
          }
        };
      });
      try {
        const snapshot = await terminalApi.getServerProcesses(targetTabId);
        if (
          serverProcessRequestIdsRef.current.get(targetTabId) !== requestId ||
          !connectedTabIdsRef.current.has(targetTabId)
        ) {
          return;
        }
        setServerProcessByTab((prev) => ({
          ...prev,
          [targetTabId]: {
            snapshot,
            loading: false,
            error: null
          }
        }));
      } catch (caughtError) {
        if (serverProcessRequestIdsRef.current.get(targetTabId) !== requestId) {
          return;
        }
        const message = (caughtError as Error).message;
        setServerProcessByTab((prev) => {
          const previous = prev[targetTabId];
          return {
            ...prev,
            [targetTabId]: {
              snapshot: previous?.snapshot ?? null,
              loading: false,
              error: message
            }
          };
        });
      } finally {
        serverProcessRequestInFlightTabsRef.current.delete(targetTabId);
      }
    },
    [
      activeTabIdRef,
      connectedTabIdsRef,
      resetServerProcesses,
      runningDownloadIdsRef,
      runningUploadIdsRef,
      terminalApi
    ]
  );

  useEffect(() => {
    if (!activeTabId) {
      return;
    }
    if (!connectedTabIdsRef.current.has(activeTabId)) {
      return;
    }
    void refreshServerHealth({
      tabId: activeTabId
    });
  }, [activeTabId, connectedTabIdsRef, refreshServerHealth]);

  useEffect(() => {
    if (!isServerHealthDetailOpen) {
      return;
    }
    if (!activeTabId) {
      return;
    }
    if (!connectedTabIdsRef.current.has(activeTabId)) {
      return;
    }
    void refreshServerProcesses({
      tabId: activeTabId
    });
  }, [activeTabId, connectedTabIdsRef, isServerHealthDetailOpen, refreshServerProcesses]);

  useEffect(() => {
    if (!activeTabId || !terminalApi) {
      return;
    }
    const timer = window.setInterval(() => {
      if (!connectedTabIdsRef.current.has(activeTabId)) {
        return;
      }
      void refreshServerHealth({
        tabId: activeTabId,
        silent: true
      });
    }, SERVER_HEALTH_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeTabId, connectedTabIdsRef, refreshServerHealth, terminalApi]);

  useEffect(() => {
    if (!isServerHealthDetailOpen || !activeTabId || !terminalApi) {
      return;
    }
    const timer = window.setInterval(() => {
      if (!connectedTabIdsRef.current.has(activeTabId)) {
        return;
      }
      void refreshServerProcesses({
        tabId: activeTabId,
        silent: true
      });
    }, SERVER_PROCESS_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [
    activeTabId,
    connectedTabIdsRef,
    isServerHealthDetailOpen,
    refreshServerProcesses,
    terminalApi
  ]);

  useEffect(() => {
    serverHealthRequestInFlightTabsRef.current.clear();
    serverProcessRequestInFlightTabsRef.current.clear();
    serverHealthRequestIdsRef.current.clear();
    serverProcessRequestIdsRef.current.clear();
    setServerHealthByTab({});
    setServerProcessByTab({});
  }, [terminalApi]);

  const activeServerHealthState = activeTabId ? serverHealthByTab[activeTabId] ?? null : null;
  const activeServerProcessState = activeTabId ? serverProcessByTab[activeTabId] ?? null : null;

  return {
    activeServerHealthState,
    activeServerProcessState,
    refreshServerHealth,
    refreshServerProcesses,
    removeServerMonitorTabState,
    resetServerHealth,
    resetServerProcesses,
    serverHealth: activeServerHealthState?.snapshot ?? null,
    serverHealthByTabRef,
    serverHealthError: activeServerHealthState?.error ?? null,
    serverHealthLoading: activeServerHealthState?.loading ?? false,
    serverHealthMetrics: activeServerHealthState?.metrics ?? null,
    serverProcessByTabRef,
    serverProcessError: activeServerProcessState?.error ?? null,
    serverProcessLoading: activeServerProcessState?.loading ?? false,
    serverProcessSnapshot: activeServerProcessState?.snapshot ?? null
  };
}
