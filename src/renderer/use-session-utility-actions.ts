import { useCallback } from "react";

import type { SessionRecord } from "../shared/session";

interface UseSessionUtilityActionsArgs {
  buildClashDirectRules: (session: SessionRecord) => string;
  buildSshConnectionCommand: (session: SessionRecord) => string;
  copyTextToClipboard: (text: string) => Promise<boolean>;
  formatSessionLastConnected: (isoString?: string) => string;
  showAppAlert: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      detailText?: string;
      translateDetailText?: boolean;
    }
  ) => Promise<void>;
  tr: (value: string) => string;
}

export function useSessionUtilityActions({
  buildClashDirectRules,
  buildSshConnectionCommand,
  copyTextToClipboard,
  formatSessionLastConnected,
  showAppAlert,
  tr
}: UseSessionUtilityActionsArgs) {
  const copyWithManualFallback = useCallback(
    async (
      text: string,
      options: {
        successMessage: string;
        successTitle: string;
        manualTitle?: string;
        manualMessage: string;
      }
    ) => {
      try {
        const copied = await copyTextToClipboard(text);
        if (copied) {
          await showAppAlert(options.successMessage, {
            title: options.successTitle
          });
          return;
        }
      } catch {
        // Fall through to manual copy dialog.
      }
      await showAppAlert(options.manualMessage, {
        title: options.manualTitle ?? "Manual Copy",
        confirmLabel: "Close",
        detailText: text
      });
    },
    [copyTextToClipboard, showAppAlert]
  );

  const copyClashDirectRules = useCallback(
    async (session: SessionRecord) => {
      const text = buildClashDirectRules(session);
      await copyWithManualFallback(text, {
        successMessage: "Clash direct rules copied to clipboard.",
        successTitle: "Clash Rules",
        manualMessage: "Clipboard unavailable. Copy the text below manually."
      });
    },
    [buildClashDirectRules, copyWithManualFallback]
  );

  const copySessionConnectionCommand = useCallback(
    async (session: SessionRecord) => {
      const command = buildSshConnectionCommand(session);
      await copyWithManualFallback(command, {
        successMessage: "SSH command copied to clipboard.",
        successTitle: "Connection Command",
        manualMessage: "Clipboard unavailable. Copy the command below manually."
      });
    },
    [buildSshConnectionCommand, copyWithManualFallback]
  );

  const viewSessionDetails = useCallback(
    async (session: SessionRecord) => {
      const authLabel = session.authType === "privateKey" ? tr("Private Key") : tr("Password");
      const credentialLabel = session.hasSecret ? tr("Stored in secure vault") : "-";
      const lines = [
        `${tr("Name")}: ${session.name}`,
        `${tr("Group")}: ${session.groupId?.trim() || tr("Ungrouped")}`,
        `${tr("Target")}: ${session.username}@${session.host}:${session.port}`,
        `${tr("Auth")}: ${authLabel}`,
        `${tr("Credential")}: ${credentialLabel}`,
        session.authType === "privateKey"
          ? `${tr("Private Key Path")}: ${session.privateKeyPath?.trim() || "-"}`
          : null,
        `${tr("Favorite")}: ${session.favorite ? tr("Yes") : tr("No")}`,
        `${tr("Last Connected")}: ${formatSessionLastConnected(session.lastConnectedAt)}`,
        `${tr("Created At")}: ${formatSessionLastConnected(session.createdAt)}`,
        `${tr("Updated At")}: ${formatSessionLastConnected(session.updatedAt)}`,
        `${tr("Remark")}: ${session.remark || "-"}`
      ].filter((line): line is string => Boolean(line));
      await showAppAlert("Session details", {
        title: "Session Details",
        confirmLabel: "Close",
        detailText: lines.join("\n")
      });
    },
    [formatSessionLastConnected, showAppAlert, tr]
  );

  return {
    copyClashDirectRules,
    copySessionConnectionCommand,
    viewSessionDetails
  };
}
