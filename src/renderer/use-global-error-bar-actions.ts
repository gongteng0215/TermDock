import { useCallback } from "react";

import type { SettingsSectionId } from "./components/settings-modal-content";

interface TerminalBridgeLike {
  connect: (tabId: string, sessionId: string) => Promise<unknown>;
}

interface UseGlobalErrorBarActionsArgs {
  activeSessionId: string | null;
  activeTabId: string | null;
  isActiveTabConnected: boolean;
  openOperationCenter: () => void;
  openRetryCenter: () => void;
  openSettingsPanel: (section: SettingsSectionId) => void;
  setError: (message: string | null) => void;
  terminalApi: TerminalBridgeLike | null;
  toLogMessage: (value: unknown) => string;
  writeAppLog: (
    level: "info" | "warn" | "error",
    scope: string,
    message: string,
    details?: unknown
  ) => void;
}

export function useGlobalErrorBarActions({
  activeSessionId,
  activeTabId,
  isActiveTabConnected,
  openOperationCenter,
  openRetryCenter,
  openSettingsPanel,
  setError,
  terminalApi,
  toLogMessage,
  writeAppLog
}: UseGlobalErrorBarActionsArgs) {
  const openConnectionSettingsFromError = useCallback(() => {
    openSettingsPanel("connection");
  }, [openSettingsPanel]);

  const openFileOpeningSettingsFromError = useCallback(() => {
    openSettingsPanel("fileOpening");
  }, [openSettingsPanel]);

  const openHotkeysSettingsFromError = useCallback(() => {
    openSettingsPanel("hotkeys");
  }, [openSettingsPanel]);

  const openSftpSettingsFromError = useCallback(() => {
    openSettingsPanel("sftp");
  }, [openSettingsPanel]);

  const openPortForwardingSettingsFromError = useCallback(() => {
    openSettingsPanel("portForwarding");
  }, [openSettingsPanel]);

  const openSafetySettingsFromError = useCallback(() => {
    openSettingsPanel("safety");
  }, [openSettingsPanel]);

  const openWorkspaceSettingsFromError = useCallback(() => {
    openSettingsPanel("workspace");
  }, [openSettingsPanel]);

  const openServerHealthSettingsFromError = useCallback(() => {
    openSettingsPanel("serverHealth");
  }, [openSettingsPanel]);

  const openDiagnosticsFromError = useCallback(() => {
    openSettingsPanel("diagnostics");
  }, [openSettingsPanel]);

  const reconnectActiveTabFromError = useCallback(async () => {
    try {
      if (!terminalApi) {
        throw new Error("Terminal bridge unavailable. Restart `pnpm dev`.");
      }
      if (!activeTabId || !activeSessionId) {
        throw new Error("Open and select a terminal tab, then retry reconnect.");
      }
      await terminalApi.connect(activeTabId, activeSessionId);
      setError(null);
      writeAppLog(
        "info",
        "renderer:error-bar",
        "Manual reconnect requested from global error bar.",
        {
          tabId: activeTabId,
          sessionId: activeSessionId
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:error-bar",
        "Manual reconnect action failed from global error bar.",
        caughtError
      );
    }
  }, [
    activeSessionId,
    activeTabId,
    setError,
    terminalApi,
    toLogMessage,
    writeAppLog
  ]);

  return {
    openConnectionSettingsFromError,
    openDiagnosticsFromError,
    openFileOpeningSettingsFromError,
    openHotkeysSettingsFromError,
    openOperationCenterFromError: openOperationCenter,
    openPortForwardingSettingsFromError,
    openRetryCenterFromError: openRetryCenter,
    openSafetySettingsFromError,
    openServerHealthSettingsFromError,
    openSftpSettingsFromError,
    openWorkspaceSettingsFromError,
    reconnectActiveTabFromError
  };
}
