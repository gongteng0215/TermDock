import type { ComponentProps } from "react";

import {
  ConnectionSettingsSection,
  DiagnosticsSettingsSection,
  FileOpeningSettingsSection,
  HotkeySettingsSection,
  PortForwardingSettingsSection,
  SafetySettingsSection,
  ServerHealthSettingsSection,
  SftpSettingsSection,
  WorkspaceSettingsSection
} from "./settings-sections";

type SettingsSectionId =
  | "connection"
  | "workspace"
  | "safety"
  | "hotkeys"
  | "serverHealth"
  | "fileOpening"
  | "sftp"
  | "portForwarding"
  | "diagnostics";

interface SettingsModalContentProps {
  activeSectionId: SettingsSectionId;
  connectionSectionProps: ComponentProps<typeof ConnectionSettingsSection>;
  workspaceSectionProps: ComponentProps<typeof WorkspaceSettingsSection>;
  safetySectionProps: ComponentProps<typeof SafetySettingsSection>;
  hotkeySectionProps: ComponentProps<typeof HotkeySettingsSection>;
  serverHealthSectionProps: ComponentProps<typeof ServerHealthSettingsSection>;
  fileOpeningSectionProps: ComponentProps<typeof FileOpeningSettingsSection>;
  sftpSectionProps: ComponentProps<typeof SftpSettingsSection>;
  portForwardingSectionProps: ComponentProps<typeof PortForwardingSettingsSection>;
  diagnosticsSectionProps: ComponentProps<typeof DiagnosticsSettingsSection>;
}

export function SettingsModalContent({
  activeSectionId,
  connectionSectionProps,
  workspaceSectionProps,
  safetySectionProps,
  hotkeySectionProps,
  serverHealthSectionProps,
  fileOpeningSectionProps,
  sftpSectionProps,
  portForwardingSectionProps,
  diagnosticsSectionProps
}: SettingsModalContentProps) {
  switch (activeSectionId) {
    case "connection":
      return <ConnectionSettingsSection {...connectionSectionProps} />;
    case "workspace":
      return <WorkspaceSettingsSection {...workspaceSectionProps} />;
    case "safety":
      return <SafetySettingsSection {...safetySectionProps} />;
    case "hotkeys":
      return <HotkeySettingsSection {...hotkeySectionProps} />;
    case "serverHealth":
      return <ServerHealthSettingsSection {...serverHealthSectionProps} />;
    case "fileOpening":
      return <FileOpeningSettingsSection {...fileOpeningSectionProps} />;
    case "sftp":
      return <SftpSettingsSection {...sftpSectionProps} />;
    case "portForwarding":
      return <PortForwardingSettingsSection {...portForwardingSectionProps} />;
    case "diagnostics":
      return <DiagnosticsSettingsSection {...diagnosticsSectionProps} />;
    default:
      return null;
  }
}
