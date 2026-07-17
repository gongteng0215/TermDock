import type { SessionRecord } from "../shared/session";
import type { TerminalTab } from "./terminal-workspace-types";
import type { BuildSessionsInspectorSectionPropsArgs } from "./workbench-panel-props";

type SessionsInspectorActionArgs = Pick<
  BuildSessionsInspectorSectionPropsArgs,
  | "dismissFirstRunOnboarding"
  | "importSessionsFromSshConfig"
  | "openCreateModal"
  | "openFirstRunSecurityNotes"
  | "openSessionBlankContextMenu"
  | "openSessionContextMenu"
  | "openSettingsPanelConnection"
  | "openTerminalTab"
  | "setActiveSessionGroupKey"
  | "setSelectedGroupKeys"
  | "setSelectedSessionId"
  | "setSelectedSessionIds"
  | "setSessionFavoritesOnly"
  | "setSessionFilterQuery"
>;

interface SessionGroupLike {
  key: string;
  label: string;
  groupName: string;
  sessions: SessionRecord[];
}

interface ActiveSessionGroupLike {
  key: string;
  label: string;
  groupName: string;
}

type SessionsInspectorValueArgs = {
  activeGroupSessions: BuildSessionsInspectorSectionPropsArgs["activeGroupSessions"];
  activeSessionGroup: ActiveSessionGroupLike | null;
  activeSessionId: string | null;
  activeTerminalTab: TerminalTab | null;
  filteredSessionCount: number;
  groupedSessions: SessionGroupLike[];
  isActiveTabConnected: boolean;
  isFirstRunOnboardingDismissed: boolean;
  loading: boolean;
  selectedGroupKeySet: Set<string>;
  selectedSession: SessionRecord | null;
  selectedSessionIdSet: Set<string>;
  sessionBadgeText: string;
  sessionFavoritesOnly: boolean;
  sessionFilterQuery: string;
  sessions: SessionRecord[];
  totalSessionCount: number;
  workspaceProfile:
    | {
        id: string;
        shortLabel: string;
      }
    | null;
};

interface BuildSessionsInspectorCompositeArgsInput {
  actions: SessionsInspectorActionArgs;
  values: SessionsInspectorValueArgs;
}

export function buildSessionsInspectorCompositeArgs({
  actions,
  values
}: BuildSessionsInspectorCompositeArgsInput): BuildSessionsInspectorSectionPropsArgs {
  return {
    ...values,
    ...actions
  };
}
