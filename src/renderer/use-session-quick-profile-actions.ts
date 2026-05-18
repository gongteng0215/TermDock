import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { SessionRecord } from "../shared/session";

interface SessionQuickProfileLike {
  id: string;
  name: string;
  startupCommand: string;
  confirmBeforeRun: boolean;
}

interface SessionTerminalOpenOptions {
  startupCommands?: string[];
}

interface ChoiceOption {
  value: string;
  label: string;
  danger?: boolean;
}

interface UseSessionQuickProfileActionsArgs {
  maxQuickProfiles: number;
  openTerminalTab: (
    session: SessionRecord,
    options?: SessionTerminalOpenOptions
  ) => string | null;
  sessionQuickProfiles: SessionQuickProfileLike[];
  setError: Dispatch<SetStateAction<string | null>>;
  setSessionQuickProfiles: Dispatch<SetStateAction<SessionQuickProfileLike[]>>;
  showAppAlert: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      detailText?: string;
      translateDetailText?: boolean;
    }
  ) => Promise<void>;
  showAppChoice: (
    message: string,
    choices: ChoiceOption[],
    options?: {
      title?: string;
      cancelLabel?: string;
      detailText?: string;
    }
  ) => Promise<string | null>;
  showAppConfirm: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
      detailText?: string;
    }
  ) => Promise<boolean>;
  showAppPrompt: (
    message: string,
    defaultValue?: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      multiline?: boolean;
      detailText?: string;
    }
  ) => Promise<string | null>;
}

export function useSessionQuickProfileActions({
  maxQuickProfiles,
  openTerminalTab,
  sessionQuickProfiles,
  setError,
  setSessionQuickProfiles,
  showAppAlert,
  showAppChoice,
  showAppConfirm,
  showAppPrompt
}: UseSessionQuickProfileActionsArgs) {
  const runSessionQuickProfile = useCallback(
    async (session: SessionRecord, profile: SessionQuickProfileLike): Promise<void> => {
      const normalizedCommand = profile.startupCommand.trim();
      if (!normalizedCommand) {
        await showAppAlert("Quick profile command is empty.", {
          title: "Quick Profile"
        });
        return;
      }
      if (profile.confirmBeforeRun) {
        const confirmed = await showAppConfirm(
          `Run quick profile "${profile.name}" on "${session.name}"?\n\nCommand:\n${normalizedCommand}`,
          {
            title: "Quick Profile",
            confirmLabel: "Run",
            cancelLabel: "Cancel"
          }
        );
        if (!confirmed) {
          return;
        }
      }
      const tabId = openTerminalTab(session, {
        startupCommands: [normalizedCommand]
      });
      if (!tabId) {
        return;
      }
      setError(null);
    },
    [openTerminalTab, setError, showAppAlert, showAppConfirm]
  );

  const createSessionQuickProfileForSession = useCallback(
    async (session: SessionRecord): Promise<void> => {
      const profileNameInput = await showAppPrompt(
        "Enter quick profile name.",
        `${session.name} quick`,
        {
          title: "New Quick Profile",
          confirmLabel: "Continue"
        }
      );
      if (profileNameInput === null) {
        return;
      }
      const profileName = profileNameInput.trim().slice(0, 80);
      if (!profileName) {
        await showAppAlert("Profile name cannot be empty.", {
          title: "New Quick Profile"
        });
        return;
      }
      const commandInput = await showAppPrompt(
        "Enter startup command (supports multiline).",
        "",
        {
          title: "Quick Profile Command",
          confirmLabel: "Save",
          multiline: true
        }
      );
      if (commandInput === null) {
        return;
      }
      const startupCommand = commandInput.trim().slice(0, 4000);
      if (!startupCommand) {
        await showAppAlert("Startup command cannot be empty.", {
          title: "Quick Profile Command"
        });
        return;
      }
      const confirmChoice = await showAppChoice(
        "Require confirmation before running this profile?",
        [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" }
        ],
        {
          title: "Quick Profile"
        }
      );
      if (!confirmChoice) {
        return;
      }
      const profile: SessionQuickProfileLike = {
        id: `qp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name: profileName,
        startupCommand,
        confirmBeforeRun: confirmChoice === "yes"
      };
      setSessionQuickProfiles((prev) => [profile, ...prev].slice(0, maxQuickProfiles));
      await showAppAlert(
        `Quick profile "${profile.name}" saved. Use "Run Quick Profile..." to execute on a session.`,
        {
          title: "Quick Profile"
        }
      );
    },
    [maxQuickProfiles, setSessionQuickProfiles, showAppAlert, showAppChoice, showAppPrompt]
  );

  const runSessionQuickProfileChooser = useCallback(
    async (session: SessionRecord): Promise<void> => {
      if (sessionQuickProfiles.length === 0) {
        await showAppAlert("No quick profiles available. Create one first.", {
          title: "Quick Profile"
        });
        return;
      }
      const profileChoice = await showAppChoice(
        `Choose quick profile for "${session.name}".`,
        sessionQuickProfiles.map((profile) => ({
          value: profile.id,
          label: profile.name
        })),
        {
          title: "Run Quick Profile"
        }
      );
      if (!profileChoice) {
        return;
      }
      const profile = sessionQuickProfiles.find((entry) => entry.id === profileChoice);
      if (!profile) {
        return;
      }
      await runSessionQuickProfile(session, profile);
    },
    [runSessionQuickProfile, sessionQuickProfiles, showAppAlert, showAppChoice]
  );

  const manageSessionQuickProfilesForSession = useCallback(
    async (session: SessionRecord): Promise<void> => {
      if (sessionQuickProfiles.length === 0) {
        await createSessionQuickProfileForSession(session);
        return;
      }
      const profileChoice = await showAppChoice(
        "Select quick profile to manage.",
        sessionQuickProfiles.map((profile) => ({
          value: profile.id,
          label: profile.name
        })),
        {
          title: "Manage Quick Profiles"
        }
      );
      if (!profileChoice) {
        return;
      }
      const profile = sessionQuickProfiles.find((entry) => entry.id === profileChoice);
      if (!profile) {
        return;
      }
      const action = await showAppChoice(
        `Profile "${profile.name}"`,
        [
          { value: "run", label: "Run" },
          { value: "edit", label: "Edit" },
          { value: "delete", label: "Delete", danger: true }
        ],
        {
          title: "Manage Quick Profile"
        }
      );
      if (!action) {
        return;
      }
      if (action === "run") {
        await runSessionQuickProfile(session, profile);
        return;
      }
      if (action === "edit") {
        const nextNameInput = await showAppPrompt("Edit profile name.", profile.name, {
          title: "Edit Quick Profile",
          confirmLabel: "Continue"
        });
        if (nextNameInput === null) {
          return;
        }
        const nextName = nextNameInput.trim().slice(0, 80);
        if (!nextName) {
          await showAppAlert("Profile name cannot be empty.", {
            title: "Edit Quick Profile"
          });
          return;
        }
        const nextCommandInput = await showAppPrompt(
          "Edit startup command (supports multiline).",
          profile.startupCommand,
          {
            title: "Edit Quick Profile",
            confirmLabel: "Save",
            multiline: true
          }
        );
        if (nextCommandInput === null) {
          return;
        }
        const nextCommand = nextCommandInput.trim().slice(0, 4000);
        if (!nextCommand) {
          await showAppAlert("Startup command cannot be empty.", {
            title: "Edit Quick Profile"
          });
          return;
        }
        const confirmChoice = await showAppChoice(
          "Require confirmation before running this profile?",
          [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" }
          ],
          {
            title: "Edit Quick Profile"
          }
        );
        if (!confirmChoice) {
          return;
        }
        setSessionQuickProfiles((prev) =>
          prev.map((entry) =>
            entry.id === profile.id
              ? {
                  ...entry,
                  name: nextName,
                  startupCommand: nextCommand,
                  confirmBeforeRun: confirmChoice === "yes"
                }
              : entry
          )
        );
        return;
      }
      const confirmed = await showAppConfirm(`Delete quick profile "${profile.name}"?`, {
        title: "Delete Quick Profile",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      });
      if (!confirmed) {
        return;
      }
      setSessionQuickProfiles((prev) => prev.filter((entry) => entry.id !== profile.id));
    },
    [
      createSessionQuickProfileForSession,
      runSessionQuickProfile,
      sessionQuickProfiles,
      setSessionQuickProfiles,
      showAppAlert,
      showAppChoice,
      showAppConfirm,
      showAppPrompt
    ]
  );

  return {
    createSessionQuickProfileForSession,
    manageSessionQuickProfilesForSession,
    runSessionQuickProfile,
    runSessionQuickProfileChooser
  };
}
