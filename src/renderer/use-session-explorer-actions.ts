import { useCallback } from "react";

import { type SessionContextAction } from "./session-context-actions";

interface ShowAppPromptOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  inputType?: "text" | "password";
  detailText?: string;
}

interface UseSessionExplorerActionsArgs {
  addSessionGroup: (rawName: string) => void;
  closeSessionContextMenu: () => void;
  showAppPrompt: (
    message: string,
    defaultValue?: string,
    options?: ShowAppPromptOptions
  ) => Promise<string | null>;
}

export function useSessionExplorerActions({
  addSessionGroup,
  closeSessionContextMenu,
  showAppPrompt
}: UseSessionExplorerActionsArgs) {
  const runSessionContextAction = useCallback(
    (action: SessionContextAction) => {
      if (action.disabled) {
        return;
      }
      closeSessionContextMenu();
      action.run();
    },
    [closeSessionContextMenu]
  );

  const promptCreateSessionGroup = useCallback(async () => {
    const groupNameInput = await showAppPrompt("Enter a name for the new group.", "", {
      title: "New Group",
      confirmLabel: "Create"
    });
    if (groupNameInput === null) {
      return;
    }
    addSessionGroup(groupNameInput);
  }, [addSessionGroup, showAppPrompt]);

  return {
    promptCreateSessionGroup,
    runSessionContextAction
  };
}
