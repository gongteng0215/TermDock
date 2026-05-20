import type {
  SettingsModalContentProps,
  SettingsSectionId
} from "./components/settings-modal-content";
import type {
  BuildSettingsModalShellPropsArgs,
  SettingsModalShellFrameProps
} from "./settings-modal-props";
import {
  buildConnectionSettingsSectionProps,
  buildDiagnosticsSettingsSectionProps,
  buildFileOpeningSettingsSectionProps,
  buildHotkeySettingsSectionProps,
  buildPortForwardingSettingsSectionProps,
  buildSafetySettingsSectionProps,
  buildServerHealthSettingsSectionProps,
  buildSftpSettingsSectionProps,
  buildWorkspaceSettingsSectionProps
} from "./settings-section-props";
import {
  buildSettingsModalContentProps,
  buildSettingsModalShellProps
} from "./settings-modal-props";

type ConnectionSettingsSectionArgs =
  Parameters<typeof buildConnectionSettingsSectionProps>[0];
type WorkspaceSettingsSectionArgs =
  Parameters<typeof buildWorkspaceSettingsSectionProps>[0];
type SafetySettingsSectionArgs = Parameters<typeof buildSafetySettingsSectionProps>[0];
type HotkeySettingsSectionArgs = Parameters<typeof buildHotkeySettingsSectionProps>[0];
type ServerHealthSettingsSectionArgs =
  Parameters<typeof buildServerHealthSettingsSectionProps>[0];
type FileOpeningSettingsSectionArgs =
  Parameters<typeof buildFileOpeningSettingsSectionProps>[0];
type SftpSettingsSectionArgs = Parameters<typeof buildSftpSettingsSectionProps>[0];
type PortForwardingSettingsSectionArgs =
  Parameters<typeof buildPortForwardingSettingsSectionProps>[0];
type DiagnosticsSettingsSectionArgs =
  Parameters<typeof buildDiagnosticsSettingsSectionProps>[0];

export interface BuildSettingsCompositePropsArgs {
  connection: ConnectionSettingsSectionArgs;
  diagnostics: DiagnosticsSettingsSectionArgs;
  fileOpening: FileOpeningSettingsSectionArgs;
  hotkeys: HotkeySettingsSectionArgs;
  portForwarding: PortForwardingSettingsSectionArgs;
  safety: SafetySettingsSectionArgs;
  serverHealth: ServerHealthSettingsSectionArgs;
  sftp: SftpSettingsSectionArgs;
  shell: BuildSettingsModalShellPropsArgs<SettingsSectionId>;
  workspace: WorkspaceSettingsSectionArgs;
}

export interface SettingsCompositeProps {
  settingsModalContentProps: SettingsModalContentProps;
  settingsModalShellProps: SettingsModalShellFrameProps;
}

export function buildSettingsCompositeProps({
  connection,
  diagnostics,
  fileOpening,
  hotkeys,
  portForwarding,
  safety,
  serverHealth,
  sftp,
  shell,
  workspace
}: BuildSettingsCompositePropsArgs): SettingsCompositeProps {
  const connectionSectionProps = buildConnectionSettingsSectionProps(connection);
  const workspaceSectionProps = buildWorkspaceSettingsSectionProps(workspace);
  const safetySectionProps = buildSafetySettingsSectionProps(safety);
  const hotkeySectionProps = buildHotkeySettingsSectionProps(hotkeys);
  const serverHealthSectionProps =
    buildServerHealthSettingsSectionProps(serverHealth);
  const fileOpeningSectionProps = buildFileOpeningSettingsSectionProps(fileOpening);
  const sftpSectionProps = buildSftpSettingsSectionProps(sftp);
  const portForwardingSectionProps =
    buildPortForwardingSettingsSectionProps(portForwarding);
  const diagnosticsSectionProps =
    buildDiagnosticsSettingsSectionProps(diagnostics);

  return {
    settingsModalContentProps: buildSettingsModalContentProps({
      activeSectionId: shell.activeSectionId,
      connectionSectionProps,
      diagnosticsSectionProps,
      fileOpeningSectionProps,
      hotkeySectionProps,
      portForwardingSectionProps,
      safetySectionProps,
      serverHealthSectionProps,
      sftpSectionProps,
      workspaceSectionProps
    }),
    settingsModalShellProps: buildSettingsModalShellProps(shell)
  };
}
