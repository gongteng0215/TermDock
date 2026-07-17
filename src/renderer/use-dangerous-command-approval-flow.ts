import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";

import type { SessionRecord } from "../shared/session";
import type { TerminalTab } from "./terminal-workspace-types";
import {
  formatDangerousCommandSourceLabel,
  inspectDangerousCommandText,
  shouldInspectDangerousCommandWrite,
  type DangerousCommandApprovalRequest,
  type DangerousCommandExecutionSource,
  type DangerousCommandGuardPreferences,
  type DangerousCommandInspectionResult
} from "./dangerous-command-guard";

export interface DangerousCommandApprovalState {
  id: string;
  request: DangerousCommandApprovalRequest;
  sourceLabel: string;
  contextSummary: string;
  ruleSummary: string;
}

export type DangerousCommandApprovalScopeId = "tab" | "sessionGroup";

export interface DangerousCommandTemporaryApproval {
  id: string;
  scope: DangerousCommandApprovalScopeId;
  tabId: string | null;
  tabTitle: string;
  sessionGroupName: string | null;
  source: DangerousCommandExecutionSource;
  sourceLabel: string;
  commandText: string;
  preview: string;
  severity: DangerousCommandInspectionResult["severity"];
  appliedPolicyPackId: DangerousCommandInspectionResult["appliedPolicyPackId"];
  appliedEnvironmentTemplateId: DangerousCommandInspectionResult["appliedEnvironmentTemplateId"];
  createdAt: number;
}

interface GuardedTerminalWriteOptions {
  source: DangerousCommandExecutionSource;
  commandText?: string;
  skipDangerousCommandCheck?: boolean;
}

interface UseDangerousCommandApprovalFlowArgs {
  buildApprovalContext: (
    request: DangerousCommandApprovalRequest
  ) => { contextSummary: string; ruleSummary: string };
  dangerousCommandGuardPreferences: DangerousCommandGuardPreferences;
  findMatchingPersistentApproval: (request: DangerousCommandApprovalRequest) => boolean;
  maxTemporaryApprovals: number;
  pushAppHintMessage: (
    message: string,
    options?: { level?: "info" | "warn"; durationMs?: number }
  ) => void;
  sessionsRef: MutableRefObject<SessionRecord[]>;
  setError: Dispatch<SetStateAction<string | null>>;
  systemApi: Window["termdock"]["system"] | null;
  terminalApi: Window["termdock"]["terminal"] | null;
  terminalTabsRef: MutableRefObject<TerminalTab[]>;
}

function createDangerousCommandTemporaryApprovalFromRequest(
  request: DangerousCommandApprovalRequest,
  sourceLabel: string,
  tabTitle: string,
  scope: DangerousCommandApprovalScopeId
): DangerousCommandTemporaryApproval | null {
  if (scope === "sessionGroup" && !request.result.sessionGroupName) {
    return null;
  }
  return {
    id: `danger-approval-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    scope,
    tabId: scope === "tab" ? request.tabId : null,
    tabTitle: tabTitle.trim() || `Tab ${request.tabId}`,
    sessionGroupName: scope === "sessionGroup" ? request.result.sessionGroupName : null,
    source: request.source,
    sourceLabel,
    commandText: request.result.commandText,
    preview: request.result.preview,
    severity: request.result.severity,
    appliedPolicyPackId: request.result.appliedPolicyPackId,
    appliedEnvironmentTemplateId: request.result.appliedEnvironmentTemplateId,
    createdAt: Date.now()
  };
}

function matchesDangerousCommandTemporaryApproval(
  approval: DangerousCommandTemporaryApproval,
  request: DangerousCommandApprovalRequest
): boolean {
  if (approval.source !== request.source) {
    return false;
  }
  if (approval.commandText !== request.result.commandText) {
    return false;
  }
  if (approval.appliedPolicyPackId !== request.result.appliedPolicyPackId) {
    return false;
  }
  if (approval.appliedEnvironmentTemplateId !== request.result.appliedEnvironmentTemplateId) {
    return false;
  }
  if (approval.scope === "tab") {
    return approval.tabId === request.tabId;
  }
  return (
    approval.scope === "sessionGroup" &&
    approval.sessionGroupName !== null &&
    approval.sessionGroupName === request.result.sessionGroupName
  );
}

export function formatDangerousCommandTemporaryApprovalScopeLabel(
  approval: DangerousCommandTemporaryApproval
): string {
  if (approval.scope === "sessionGroup") {
    return approval.sessionGroupName ? `Group ${approval.sessionGroupName}` : "Group";
  }
  return approval.tabTitle.trim() ? `Tab ${approval.tabTitle.trim()}` : "This Tab";
}

function getSessionGroupNameForTab(
  tabId: string,
  terminalTabs: TerminalTab[],
  sessions: SessionRecord[]
): string | null {
  const normalizedTabId = tabId.trim();
  if (!normalizedTabId) {
    return null;
  }
  const tab = terminalTabs.find((item) => item.id === normalizedTabId) ?? null;
  if (!tab) {
    return null;
  }
  const session = sessions.find((item) => item.id === tab.sessionId) ?? null;
  const groupName = session?.groupId?.trim() ?? "";
  return groupName || null;
}

export function useDangerousCommandApprovalFlow({
  buildApprovalContext,
  dangerousCommandGuardPreferences,
  findMatchingPersistentApproval,
  maxTemporaryApprovals,
  pushAppHintMessage,
  sessionsRef,
  setError,
  systemApi,
  terminalApi,
  terminalTabsRef
}: UseDangerousCommandApprovalFlowArgs) {
  const [dangerousCommandApproval, setDangerousCommandApproval] =
    useState<DangerousCommandApprovalState | null>(null);
  const [dangerousCommandTemporaryApprovals, setDangerousCommandTemporaryApprovals] = useState<
    DangerousCommandTemporaryApproval[]
  >([]);
  const dangerousCommandApprovalRef = useRef<DangerousCommandApprovalState | null>(
    dangerousCommandApproval
  );
  const dangerousCommandApprovalResolverRef = useRef<((value: boolean) => void) | null>(null);
  const dangerousCommandTemporaryApprovalsRef = useRef<DangerousCommandTemporaryApproval[]>(
    dangerousCommandTemporaryApprovals
  );
  const dangerousCommandPreferencesSignatureRef = useRef(
    JSON.stringify(dangerousCommandGuardPreferences)
  );

  useEffect(() => {
    dangerousCommandApprovalRef.current = dangerousCommandApproval;
  }, [dangerousCommandApproval]);

  useEffect(() => {
    dangerousCommandTemporaryApprovalsRef.current = dangerousCommandTemporaryApprovals;
  }, [dangerousCommandTemporaryApprovals]);

  const resolveDangerousCommandApproval = useCallback((approved: boolean) => {
    const resolver = dangerousCommandApprovalResolverRef.current;
    dangerousCommandApprovalResolverRef.current = null;
    setDangerousCommandApproval(null);
    if (resolver) {
      resolver(approved);
    }
  }, []);

  const removeDangerousCommandTemporaryApproval = useCallback((approvalId: string) => {
    setDangerousCommandTemporaryApprovals((prev) =>
      prev.filter((approval) => approval.id !== approvalId)
    );
  }, []);

  const clearDangerousCommandTemporaryApprovals = useCallback(
    (reason?: "settings-changed" | "manual") => {
      const hadApprovals = dangerousCommandTemporaryApprovalsRef.current.length > 0;
      if (!hadApprovals) {
        return;
      }
      setDangerousCommandTemporaryApprovals([]);
      if (reason === "settings-changed") {
        pushAppHintMessage(
          "Cleared temporary dangerous-command approvals after Safety settings changed.",
          {
            level: "info",
            durationMs: 4200
          }
        );
      }
    },
    [pushAppHintMessage]
  );

  const approveDangerousCommandWithScope = useCallback(
    (scope: DangerousCommandApprovalScopeId) => {
      const currentApproval = dangerousCommandApprovalRef.current;
      if (!currentApproval) {
        resolveDangerousCommandApproval(true);
        return;
      }
      const tabTitle =
        terminalTabsRef.current.find((tab) => tab.id === currentApproval.request.tabId)?.title ?? "";
      const nextApproval = createDangerousCommandTemporaryApprovalFromRequest(
        currentApproval.request,
        currentApproval.sourceLabel,
        tabTitle,
        scope
      );
      if (!nextApproval) {
        resolveDangerousCommandApproval(true);
        return;
      }
      setDangerousCommandTemporaryApprovals((prev) => {
        const filtered = prev.filter(
          (approval) => !matchesDangerousCommandTemporaryApproval(approval, currentApproval.request)
        );
        const next = [nextApproval, ...filtered];
        return next.slice(0, maxTemporaryApprovals);
      });
      pushAppHintMessage(
        `Approved exact command for ${formatDangerousCommandTemporaryApprovalScopeLabel(nextApproval)}.`,
        {
          level: currentApproval.request.result.severity === "critical" ? "warn" : "info",
          durationMs: 4600
        }
      );
      resolveDangerousCommandApproval(true);
    },
    [maxTemporaryApprovals, pushAppHintMessage, resolveDangerousCommandApproval, terminalTabsRef]
  );

  const requestDangerousCommandApproval = useCallback(
    async (request: DangerousCommandApprovalRequest): Promise<boolean> => {
      if (dangerousCommandApprovalResolverRef.current) {
        dangerousCommandApprovalResolverRef.current(false);
      }
      if (findMatchingPersistentApproval(request)) {
        return true;
      }
      const matchingTemporaryApproval = dangerousCommandTemporaryApprovalsRef.current.find((approval) =>
        matchesDangerousCommandTemporaryApproval(approval, request)
      );
      if (matchingTemporaryApproval) {
        return true;
      }
      const { contextSummary, ruleSummary } = buildApprovalContext(request);
      setDangerousCommandApproval({
        id: `danger-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        request,
        sourceLabel: formatDangerousCommandSourceLabel(request.source),
        contextSummary,
        ruleSummary
      });
      return new Promise((resolve) => {
        dangerousCommandApprovalResolverRef.current = resolve;
      });
    },
    [buildApprovalContext, findMatchingPersistentApproval]
  );

  const dismissDangerousCommandApprovalsForClosedTabs = useCallback(
    (tabIds: string[]) => {
      const tabIdSet = new Set(tabIds.filter(Boolean));
      if (tabIdSet.size === 0) {
        return;
      }
      setDangerousCommandTemporaryApprovals((prev) =>
        prev.filter(
          (approval) => approval.scope !== "tab" || !approval.tabId || !tabIdSet.has(approval.tabId)
        )
      );
      const currentApproval = dangerousCommandApprovalRef.current;
      if (currentApproval && tabIdSet.has(currentApproval.request.tabId)) {
        resolveDangerousCommandApproval(false);
      }
    },
    [resolveDangerousCommandApproval]
  );

  const guardedTerminalWrite = useCallback(
    async (
      tabId: string,
      data: string,
      options: GuardedTerminalWriteOptions
    ): Promise<boolean> => {
      if (!terminalApi) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return false;
      }
      const normalizedCommandText =
        typeof options.commandText === "string" && options.commandText.trim()
          ? options.commandText.trim()
          : data.replace(/[\r\n]+$/g, "").trim();
      if (
        !options.skipDangerousCommandCheck &&
        shouldInspectDangerousCommandWrite(options.source, data, dangerousCommandGuardPreferences) &&
        normalizedCommandText
      ) {
        const inspection = inspectDangerousCommandText(
          normalizedCommandText,
          dangerousCommandGuardPreferences,
          {
            sessionGroupName: getSessionGroupNameForTab(
              tabId,
              terminalTabsRef.current,
              sessionsRef.current
            )
          }
        );
        if (inspection) {
          const approved = await requestDangerousCommandApproval({
            tabId,
            source: options.source,
            result: inspection
          });
          if (!approved) {
            pushAppHintMessage(
              `Blocked ${formatDangerousCommandSourceLabel(options.source)} command: ${inspection.preview}`,
              {
                level: inspection.severity === "critical" ? "warn" : "info",
                durationMs: 5200
              }
            );
            void systemApi?.writeLog(
              "warn",
              "renderer:dangerous-command",
              "Dangerous command blocked.",
              {
                tabId,
                source: options.source,
                command: inspection.commandText,
                matches: inspection.matches,
                sessionGroupName: inspection.sessionGroupName,
                appliedPolicyPackId: inspection.appliedPolicyPackId,
                appliedEnvironmentTemplateId: inspection.appliedEnvironmentTemplateId
              }
            );
            return false;
          }
          void systemApi?.writeLog(
            "warn",
            "renderer:dangerous-command",
            "Dangerous command approved for one-time execution.",
            {
              tabId,
              source: options.source,
              command: inspection.commandText,
              matches: inspection.matches,
              sessionGroupName: inspection.sessionGroupName,
              appliedPolicyPackId: inspection.appliedPolicyPackId,
              appliedEnvironmentTemplateId: inspection.appliedEnvironmentTemplateId
            }
          );
        }
      }
      await terminalApi.write(tabId, data);
      return true;
    },
    [
      dangerousCommandGuardPreferences,
      pushAppHintMessage,
      requestDangerousCommandApproval,
      sessionsRef,
      setError,
      systemApi,
      terminalApi,
      terminalTabsRef
    ]
  );

  useEffect(() => {
    const nextSignature = JSON.stringify(dangerousCommandGuardPreferences);
    if (dangerousCommandPreferencesSignatureRef.current !== nextSignature) {
      dangerousCommandPreferencesSignatureRef.current = nextSignature;
      clearDangerousCommandTemporaryApprovals("settings-changed");
    }
  }, [clearDangerousCommandTemporaryApprovals, dangerousCommandGuardPreferences]);

  useEffect(() => {
    return () => {
      if (dangerousCommandApprovalResolverRef.current) {
        dangerousCommandApprovalResolverRef.current(false);
        dangerousCommandApprovalResolverRef.current = null;
      }
    };
  }, []);

  return {
    approveDangerousCommandWithScope,
    clearDangerousCommandTemporaryApprovals,
    dangerousCommandApproval,
    dangerousCommandTemporaryApprovals,
    dismissDangerousCommandApprovalsForClosedTabs,
    guardedTerminalWrite,
    removeDangerousCommandTemporaryApproval,
    requestDangerousCommandApproval,
    resolveDangerousCommandApproval
  };
}
