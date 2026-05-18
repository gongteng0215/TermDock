import type { SessionCreateInput, SessionRecord, SessionUpdateInput } from "../shared/session";

type SessionSortMode = "default" | "nameAsc" | "nameDesc" | "recent";

export interface SessionContextAction {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  run: () => void;
}

export type SessionContextMenuTarget =
  | {
      type: "session";
      sessionId: string;
    }
  | {
      type: "group";
      groupKey: string;
      groupName: string;
      label: string;
    }
  | {
      type: "group-root";
    }
  | {
      type: "group-view";
      groupKey: string;
      groupName: string;
      label: string;
    };

interface SessionGroupLike {
  key: string;
  groupName: string;
}

interface BuildSessionContextActionsArgs {
  activeGroupSessions: SessionRecord[];
  assignSessionsToGroup: (sessionIds: string[], groupName: string) => Promise<void>;
  chooseSessionTemplateAndApply: (options?: {
    openCreateModal?: boolean;
    groupId?: string;
    forceNewSession?: boolean;
  }) => Promise<void>;
  contextTarget: SessionContextMenuTarget | null;
  copyClashDirectRules: (session: SessionRecord) => Promise<void>;
  copySessionConnectionCommand: (session: SessionRecord) => Promise<void>;
  createSessionQuickProfileForSession: (session: SessionRecord) => Promise<void>;
  deleteSessionGroup: (groupName: string) => Promise<void>;
  deleteSessionGroupsBatch: (groupNames: string[]) => Promise<void>;
  exportAllSessionGroups: () => Promise<void>;
  exportAllSessionsWithGroups: () => Promise<void>;
  exportEncryptedSessionMigration: () => Promise<void>;
  groupedSessions: SessionGroupLike[];
  importEncryptedSessionMigration: () => Promise<void>;
  importSessionsFromJson: () => Promise<void>;
  importSessionsFromSshConfig: () => Promise<void>;
  manageSessionQuickProfilesForSession: (session: SessionRecord) => Promise<void>;
  openCreateModal: (groupId?: string) => void;
  openDuplicateSessionModal: (session: SessionRecord) => void;
  openEditModal: (session: SessionRecord) => void;
  openMoveSessionsToGroupDialog: (sessionIds: string[]) => void;
  openSessionTemplateManager: (options?: { templateId?: string | null; sourceForm?: SessionCreateInput }) => void;
  openTerminalTab: (session: SessionRecord) => void;
  patchSession: (sessionId: string, patch: SessionUpdateInput) => Promise<void>;
  promptCreateSessionGroup: () => Promise<void>;
  removeSessionsByIds: (sessionIds: string[]) => Promise<void>;
  renameSessionGroup: (groupName: string) => Promise<void>;
  runSessionQuickProfileChooser: (session: SessionRecord) => Promise<void>;
  selectedGroupKeySet: Set<string>;
  selectedGroupKeys: string[];
  selectedGroupNames: string[];
  selectedGroups: SessionGroupLike[];
  selectedSession: SessionRecord | null;
  selectedSessionIds: string[];
  selectedSessionsInActiveGroup: SessionRecord[];
  sessionContextTarget: SessionRecord | null;
  sessionQuickProfilesCount: number;
  sessionSortMode: SessionSortMode;
  sessionTemplatesCount: number;
  setActiveSessionGroupKey: (value: string | null) => void;
  setSelectedGroupKeys: (value: string[]) => void;
  setSelectedSessionId: (value: string | null) => void;
  setSelectedSessionIds: (value: string[]) => void;
  setSessionSortMode: (value: SessionSortMode) => void;
  toFormFromSession: (session: SessionRecord) => SessionCreateInput;
  tr: (value: string) => string;
  viewSessionDetails: (session: SessionRecord) => Promise<void>;
}

function appendSessionSortActions(
  actions: SessionContextAction[],
  tr: (value: string) => string,
  sessionSortMode: SessionSortMode,
  setSessionSortMode: (value: SessionSortMode) => void
) {
  actions.push({
    id: "sort-default",
    label: tr(sessionSortMode === "default" ? "Sort: Default (Current)" : "Sort: Default"),
    run: () => {
      setSessionSortMode("default");
    }
  });
  actions.push({
    id: "sort-recent",
    label: tr(sessionSortMode === "recent" ? "Sort: Recent (Current)" : "Sort: Recent"),
    run: () => {
      setSessionSortMode("recent");
    }
  });
  actions.push({
    id: "sort-name-asc",
    label: tr(sessionSortMode === "nameAsc" ? "Sort: Name A-Z (Current)" : "Sort: Name A-Z"),
    run: () => {
      setSessionSortMode("nameAsc");
    }
  });
  actions.push({
    id: "sort-name-desc",
    label: tr(sessionSortMode === "nameDesc" ? "Sort: Name Z-A (Current)" : "Sort: Name Z-A"),
    run: () => {
      setSessionSortMode("nameDesc");
    }
  });
}

function appendImportExportActions(
  actions: SessionContextAction[],
  args: Pick<
    BuildSessionContextActionsArgs,
    | "tr"
    | "importSessionsFromSshConfig"
    | "importSessionsFromJson"
    | "importEncryptedSessionMigration"
    | "exportAllSessionsWithGroups"
    | "exportEncryptedSessionMigration"
    | "exportAllSessionGroups"
  >
) {
  actions.push({
    id: "import-ssh-config",
    label: args.tr("Import SSH Config..."),
    run: () => {
      void args.importSessionsFromSshConfig();
    }
  });
  actions.push({
    id: "import-sessions-json",
    label: args.tr("Import Sessions JSON..."),
    run: () => {
      void args.importSessionsFromJson();
    }
  });
  actions.push({
    id: "import-encrypted-migration",
    label: args.tr("Import Encrypted Migration..."),
    run: () => {
      void args.importEncryptedSessionMigration();
    }
  });
  actions.push({
    id: "export-all-sessions",
    label: args.tr("Export All Sessions..."),
    run: () => {
      void args.exportAllSessionsWithGroups();
    }
  });
  actions.push({
    id: "export-encrypted-migration",
    label: args.tr("Export Encrypted Migration..."),
    run: () => {
      void args.exportEncryptedSessionMigration();
    }
  });
  actions.push({
    id: "export-all-groups",
    label: args.tr("Export All Groups..."),
    run: () => {
      void args.exportAllSessionGroups();
    }
  });
}

function appendTemplateActions(
  actions: SessionContextAction[],
  args: Pick<
    BuildSessionContextActionsArgs,
    | "tr"
    | "sessionTemplatesCount"
    | "chooseSessionTemplateAndApply"
    | "openSessionTemplateManager"
  >,
  options?: { groupId?: string; forceNewSession?: boolean }
) {
  actions.push({
    id: "new-session-from-template",
    label:
      args.sessionTemplatesCount > 0
        ? args.tr(`New Session From Template... (${args.sessionTemplatesCount})`)
        : args.tr("New Session From Template..."),
    disabled: args.sessionTemplatesCount === 0,
    run: () => {
      void args.chooseSessionTemplateAndApply({
        openCreateModal: true,
        groupId: options?.groupId,
        forceNewSession: options?.forceNewSession
      });
    }
  });
  actions.push({
    id: "manage-session-templates",
    label: args.tr("Manage Session Templates..."),
    run: () => {
      args.openSessionTemplateManager();
    }
  });
}

export function buildSessionContextActions(args: BuildSessionContextActionsArgs): SessionContextAction[] {
  const actions: SessionContextAction[] = [];
  const contextTarget = args.contextTarget;

  if (contextTarget?.type === "session" && args.sessionContextTarget) {
    const selectedSet = new Set(args.selectedSessionsInActiveGroup.map((session) => session.id));
    const sessionsForActions =
      selectedSet.has(args.sessionContextTarget.id) && args.selectedSessionsInActiveGroup.length > 0
        ? args.selectedSessionsInActiveGroup
        : [args.sessionContextTarget];
    const selectedIds = sessionsForActions.map((session) => session.id);
    const selectedCount = sessionsForActions.length;

    actions.push({
      id: "open-session",
      label: args.tr(selectedCount > 1 ? `Open ${selectedCount} Selected Tabs` : "Open Terminal Tab"),
      run: () => {
        for (const session of sessionsForActions) {
          args.openTerminalTab(session);
        }
      }
    });

    if (selectedCount === 1) {
      actions.push({
        id: "view-session",
        label: args.tr("View Details"),
        run: () => {
          void args.viewSessionDetails(args.sessionContextTarget!);
        }
      });
      actions.push({
        id: "toggle-favorite",
        label: args.tr(args.sessionContextTarget.favorite ? "Unfavorite" : "Favorite"),
        run: () => {
          void args.patchSession(args.sessionContextTarget!.id, {
            favorite: !args.sessionContextTarget!.favorite
          });
        }
      });
      actions.push({
        id: "copy-clash-rules",
        label: args.tr("Copy Clash Direct Rules"),
        run: () => {
          void args.copyClashDirectRules(args.sessionContextTarget!);
        }
      });
      actions.push({
        id: "copy-ssh-command",
        label: args.tr("Copy SSH Command"),
        run: () => {
          void args.copySessionConnectionCommand(args.sessionContextTarget!);
        }
      });
      actions.push({
        id: "edit-session",
        label: args.tr("Edit Session"),
        run: () => {
          args.openEditModal(args.sessionContextTarget!);
        }
      });
      actions.push({
        id: "duplicate-session",
        label: args.tr("Duplicate Session"),
        run: () => {
          args.openDuplicateSessionModal(args.sessionContextTarget!);
        }
      });
      actions.push({
        id: "save-session-template",
        label: args.tr("Save as Session Template..."),
        run: () => {
          args.openSessionTemplateManager({
            sourceForm: args.toFormFromSession(args.sessionContextTarget!)
          });
        }
      });
      actions.push({
        id: "run-quick-profile",
        label:
          args.sessionQuickProfilesCount > 0
            ? args.tr(`Run Quick Profile... (${args.sessionQuickProfilesCount})`)
            : args.tr("Run Quick Profile..."),
        disabled: args.sessionQuickProfilesCount === 0,
        run: () => {
          void args.runSessionQuickProfileChooser(args.sessionContextTarget!);
        }
      });
      actions.push({
        id: "create-quick-profile",
        label: args.tr("Save Quick Profile..."),
        run: () => {
          void args.createSessionQuickProfileForSession(args.sessionContextTarget!);
        }
      });
      actions.push({
        id: "manage-quick-profile",
        label: args.tr("Manage Quick Profiles..."),
        run: () => {
          void args.manageSessionQuickProfilesForSession(args.sessionContextTarget!);
        }
      });
    }

    actions.push({
      id: "move-session-group",
      label: args.tr(selectedCount > 1 ? "Move Selected to Group..." : "Move to Group..."),
      run: () => {
        args.openMoveSessionsToGroupDialog(selectedIds);
      }
    });
    actions.push({
      id: "move-session-ungrouped",
      label: args.tr(selectedCount > 1 ? "Move Selected to Ungrouped" : "Move to Ungrouped"),
      run: () => {
        void args.assignSessionsToGroup(selectedIds, "");
      }
    });
    actions.push({
      id: "delete-session",
      label: args.tr(selectedCount > 1 ? `Delete ${selectedCount} Selected` : "Delete Session"),
      danger: true,
      run: () => {
        void args.removeSessionsByIds(selectedIds);
      }
    });
    appendSessionSortActions(actions, args.tr, args.sessionSortMode, args.setSessionSortMode);
    return actions;
  }

  if (contextTarget?.type === "group") {
    const contextGroup = args.groupedSessions.find((group) => group.key === contextTarget.groupKey) ?? null;
    const groupsForActions =
      args.selectedGroupKeySet.has(contextTarget.groupKey) && args.selectedGroups.length > 0
        ? args.selectedGroups
        : contextGroup
          ? [contextGroup]
          : [];
    const groupNamesForActions = groupsForActions
      .filter((group) => group.groupName.trim().length > 0)
      .map((group) => group.groupName);

    actions.push({
      id: "open-group",
      label: args.tr("Open Group"),
      run: () => {
        args.setSelectedGroupKeys([contextTarget.groupKey]);
        args.setActiveSessionGroupKey(contextTarget.groupKey);
      }
    });
    actions.push({
      id: "new-session",
      label: args.tr("New Session"),
      run: () => {
        args.openCreateModal(contextTarget.groupName);
      }
    });
    appendTemplateActions(actions, args, {
      groupId: contextTarget.groupName,
      forceNewSession: true
    });
    appendImportExportActions(actions, args);
    actions.push({
      id: "new-group",
      label: args.tr("New Group"),
      run: () => {
        void args.promptCreateSessionGroup();
      }
    });
    actions.push({
      id: "select-all-groups",
      label: args.tr("Select All Groups"),
      disabled: args.groupedSessions.length === 0,
      run: () => {
        args.setSelectedGroupKeys(args.groupedSessions.map((group) => group.key));
      }
    });
    actions.push({
      id: "clear-group-selection",
      label: args.tr("Clear Group Selection"),
      disabled: args.selectedGroupKeys.length === 0,
      run: () => {
        args.setSelectedGroupKeys([]);
      }
    });
    actions.push({
      id: "rename-group",
      label:
        groupNamesForActions.length > 1
          ? args.tr("Rename Group (Select One)")
          : args.tr("Rename Group"),
      disabled: groupNamesForActions.length !== 1,
      run: () => {
        void args.renameSessionGroup(groupNamesForActions[0]);
      }
    });
    actions.push({
      id: "delete-group",
      label:
        groupNamesForActions.length > 1
          ? args.tr(`Delete ${groupNamesForActions.length} Selected Groups`)
          : args.tr("Delete Group"),
      disabled: groupNamesForActions.length === 0,
      danger: true,
      run: () => {
        void args.deleteSessionGroupsBatch(groupNamesForActions);
      }
    });
    appendSessionSortActions(actions, args.tr, args.sessionSortMode, args.setSessionSortMode);
    return actions;
  }

  if (contextTarget?.type === "group-root") {
    actions.push({
      id: "new-group",
      label: args.tr("New Group"),
      run: () => {
        void args.promptCreateSessionGroup();
      }
    });
    actions.push({
      id: "new-session",
      label: args.tr("New Session"),
      run: () => {
        args.openCreateModal("");
      }
    });
    appendTemplateActions(actions, args, {
      forceNewSession: true
    });
    appendImportExportActions(actions, args);
    actions.push({
      id: "select-all-groups",
      label: args.tr("Select All Groups"),
      disabled: args.groupedSessions.length === 0,
      run: () => {
        args.setSelectedGroupKeys(args.groupedSessions.map((group) => group.key));
      }
    });
    actions.push({
      id: "clear-group-selection",
      label: args.tr("Clear Group Selection"),
      disabled: args.selectedGroupKeys.length === 0,
      run: () => {
        args.setSelectedGroupKeys([]);
      }
    });
    actions.push({
      id: "rename-selected-group",
      label: args.tr("Rename Selected Group"),
      disabled: args.selectedGroupNames.length !== 1,
      run: () => {
        void args.renameSessionGroup(args.selectedGroupNames[0]);
      }
    });
    actions.push({
      id: "delete-selected-groups",
      label:
        args.selectedGroupNames.length > 1
          ? args.tr(`Delete ${args.selectedGroupNames.length} Selected Groups`)
          : args.tr("Delete Selected Group"),
      disabled: args.selectedGroupNames.length === 0,
      danger: true,
      run: () => {
        void args.deleteSessionGroupsBatch(args.selectedGroupNames);
      }
    });
    appendSessionSortActions(actions, args.tr, args.sessionSortMode, args.setSessionSortMode);
    return actions;
  }

  if (contextTarget?.type === "group-view") {
    const selectedCount = args.selectedSessionsInActiveGroup.length;
    const selectedIds = args.selectedSessionsInActiveGroup.map((session) => session.id);

    actions.push({
      id: "back-groups",
      label: args.tr("Back to Groups"),
      run: () => {
        args.setActiveSessionGroupKey(null);
      }
    });
    actions.push({
      id: "new-session",
      label: args.tr("New Session"),
      run: () => {
        args.openCreateModal(contextTarget.groupName);
      }
    });
    appendTemplateActions(actions, args, {
      groupId: contextTarget.groupName,
      forceNewSession: true
    });
    appendImportExportActions(actions, args);
    actions.push({
      id: "new-group",
      label: args.tr("New Group"),
      run: () => {
        void args.promptCreateSessionGroup();
      }
    });
    if (contextTarget.groupName) {
      actions.push({
        id: "rename-group",
        label: args.tr("Rename Group"),
        run: () => {
          void args.renameSessionGroup(contextTarget.groupName);
        }
      });
      actions.push({
        id: "delete-group",
        label: args.tr("Delete Group"),
        danger: true,
        run: () => {
          void args.deleteSessionGroup(contextTarget.groupName);
        }
      });
    }
    actions.push({
      id: "select-all-sessions",
      label: args.tr("Select All Sessions"),
      disabled: args.activeGroupSessions.length === 0,
      run: () => {
        const allIds = args.activeGroupSessions.map((session) => session.id);
        args.setSelectedSessionIds(allIds);
        args.setSelectedSessionId(allIds[0] ?? null);
      }
    });
    actions.push({
      id: "clear-session-selection",
      label: args.tr("Clear Session Selection"),
      disabled: selectedCount === 0,
      run: () => {
        args.setSelectedSessionIds([]);
      }
    });
    actions.push({
      id: "open-selected-sessions",
      label: args.tr(selectedCount > 1 ? `Open ${selectedCount} Selected Tabs` : "Open Selected Session"),
      disabled: selectedCount === 0,
      run: () => {
        for (const session of args.selectedSessionsInActiveGroup) {
          args.openTerminalTab(session);
        }
      }
    });
    actions.push({
      id: "move-selected-sessions",
      label: args.tr("Move Selected to Group..."),
      disabled: selectedCount === 0,
      run: () => {
        args.openMoveSessionsToGroupDialog(selectedIds);
      }
    });
    actions.push({
      id: "move-selected-sessions-ungrouped",
      label: args.tr("Move Selected to Ungrouped"),
      disabled: selectedCount === 0,
      run: () => {
        void args.assignSessionsToGroup(selectedIds, "");
      }
    });
    actions.push({
      id: "delete-selected-sessions",
      label: args.tr(
        selectedCount > 1 ? `Delete ${selectedCount} Selected Sessions` : "Delete Selected Session"
      ),
      disabled: selectedCount === 0,
      danger: true,
      run: () => {
        void args.removeSessionsByIds(selectedIds);
      }
    });
    appendSessionSortActions(actions, args.tr, args.sessionSortMode, args.setSessionSortMode);
  }

  return actions;
}
