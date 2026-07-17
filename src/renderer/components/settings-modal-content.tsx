import type {
  ConnectionSettingsSectionProps,
  DiagnosticsSettingsSectionProps,
  FileOpeningSettingsSectionProps,
  HotkeySettingsSectionProps,
  PortForwardingSettingsSectionProps,
  SafetySettingsSectionProps,
  ServerHealthSettingsSectionProps,
  SftpSettingsSectionProps,
  WorkspaceSettingsSectionProps
} from "./settings-sections";
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

export type SettingsSectionId =
  | "connection"
  | "workspace"
  | "safety"
  | "hotkeys"
  | "serverHealth"
  | "fileOpening"
  | "sftp"
  | "portForwarding"
  | "diagnostics";

export interface SettingsModalContentProps {
  activeSectionId: SettingsSectionId;
  connectionSectionProps: ConnectionSettingsSectionProps;
  workspaceSectionProps: WorkspaceSettingsSectionProps;
  safetySectionProps: SafetySettingsSectionProps;
  hotkeySectionProps: HotkeySettingsSectionProps;
  serverHealthSectionProps: ServerHealthSettingsSectionProps;
  fileOpeningSectionProps: FileOpeningSettingsSectionProps;
  sftpSectionProps: SftpSettingsSectionProps;
  portForwardingSectionProps: PortForwardingSettingsSectionProps;
  diagnosticsSectionProps: DiagnosticsSettingsSectionProps;
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
