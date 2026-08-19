import type { SftpDirectoryListResult, SftpEntry } from "../shared/sftp";
import type { TerminalTab } from "./terminal-workspace-types";
import type { BuildSftpExplorerSectionPropsArgs } from "./workbench-panel-props";
import type { SftpExplorerViewMode } from "./workbench-ui-preferences";

type SftpExplorerActionArgs = Pick<
  BuildSftpExplorerSectionPropsArgs,
  | "loadSftpDirectory"
  | "onSftpDragLeave"
  | "onSftpDragOver"
  | "onSftpDrop"
  | "openSftpContextMenu"
  | "openSftpEntryFile"
  | "onClearSftpSelection"
  | "onSelectSftpEntry"
  | "onSelectAllVisibleSftpEntries"
  | "setSftpExplorerViewMode"
  | "setSftpPath"
  | "toggleSftpToolbarMenu"
>;

interface SftpSummaryLike {
  directoryCount: number;
  entryCount: number;
  fileCount: number;
  totalSize: number;
}

type SftpExplorerValueArgs = {
  activeTerminalTab: TerminalTab | null;
  formatExactByteCount: (bytes: number) => string;
  formatSftpLinksForLs: (links: number) => string;
  formatSftpMtimeForLs: (isoString?: string) => string;
  formatSftpSizeForLs: (size: number) => string;
  formatTransferBytes: (bytes: number) => string;
  selectedSftpPaths: string[];
  sftpBrowsePreferences: import("./workbench-ui-preferences").SftpExplorerBrowsePreferences;
  sftpActionLoading: boolean;
  sftpDeleteProgress:
    | {
        kind: SftpEntry["kind"];
        name: string;
      }
    | null;
  sftpDirectory: SftpDirectoryListResult | null;
  sftpDropActive: boolean;
  sftpError: string | null;
  sftpErrorRecovery?: import("react").ReactNode;
  sftpExplorerViewMode: SftpExplorerViewMode;
  sftpLoading: boolean;
  sftpPath: string;
  sftpSummary: SftpSummaryLike;
  updateSftpBrowsePreferences: (
    patch: Partial<import("./workbench-ui-preferences").SftpExplorerBrowsePreferences>
  ) => void;
  visibleSftpEntries: SftpEntry[];
};

interface BuildSftpExplorerCompositeArgsInput {
  actions: SftpExplorerActionArgs;
  values: SftpExplorerValueArgs;
}

export function buildSftpExplorerCompositeArgs({
  actions,
  values
}: BuildSftpExplorerCompositeArgsInput): BuildSftpExplorerSectionPropsArgs {
  return {
    ...values,
    ...actions
  };
}
