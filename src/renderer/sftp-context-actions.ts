import type { SftpEntry } from "../shared/sftp";

export interface SftpContextAction {
  id: string;
  label: string;
  disabled?: boolean;
  run: () => void;
}

interface BuildSftpToolbarActionsArgs {
  canDownloadSelectedEntry: boolean;
  currentDirectoryCwd: string | null;
  currentDirectoryParent: string | null;
  hasSelectedEntry: boolean;
  inputPath: string;
  isActionDisabled: boolean;
  onCreateDirectory: () => void;
  onDeleteSelected: () => void;
  onDownloadSelected: () => void;
  onLoadDirectory: (path: string) => void;
  onRenameSelected: () => void;
  onUploadFile: () => void;
  tr: (value: string) => string;
}

interface BuildSftpContextActionsArgs {
  contextEntry: SftpEntry | null;
  currentDirectoryCwd: string | null;
  currentPathInput: string;
  isActionDisabled: boolean;
  onCopyPath: (path: string) => void;
  onCreateDirectory: () => void;
  onDeleteEntry: (entry?: SftpEntry | null) => void;
  onDownloadDirectory: (entry: SftpEntry) => void;
  onDownloadFile: (entry: SftpEntry) => void;
  onLoadDirectory: (path: string) => void;
  onOpenFile: (entry: SftpEntry) => void;
  onRefreshDirectory: (path: string) => void;
  onRenameEntry: (entry?: SftpEntry | null) => void;
  onUploadFile: () => void;
  tr: (value: string) => string;
}

export function buildSftpToolbarActions({
  canDownloadSelectedEntry,
  currentDirectoryCwd,
  currentDirectoryParent,
  hasSelectedEntry,
  inputPath,
  isActionDisabled,
  onCreateDirectory,
  onDeleteSelected,
  onDownloadSelected,
  onLoadDirectory,
  onRenameSelected,
  onUploadFile,
  tr
}: BuildSftpToolbarActionsArgs): SftpContextAction[] {
  return [
    {
      id: "go-to-path",
      label: tr("Go to Path"),
      disabled: isActionDisabled,
      run: () => {
        onLoadDirectory(inputPath);
      }
    },
    {
      id: "go-parent",
      label: tr("Go Up"),
      disabled: isActionDisabled || !currentDirectoryParent,
      run: () => {
        if (!currentDirectoryParent) {
          return;
        }
        onLoadDirectory(currentDirectoryParent);
      }
    },
    {
      id: "refresh-directory",
      label: tr("Refresh"),
      disabled: isActionDisabled,
      run: () => {
        onLoadDirectory(currentDirectoryCwd ?? inputPath);
      }
    },
    {
      id: "new-folder",
      label: tr("New Folder"),
      disabled: isActionDisabled,
      run: onCreateDirectory
    },
    {
      id: "upload-file",
      label: tr("Upload File"),
      disabled: isActionDisabled,
      run: onUploadFile
    },
    {
      id: "download-selected",
      label: tr("Download Selected"),
      disabled: isActionDisabled || !canDownloadSelectedEntry,
      run: onDownloadSelected
    },
    {
      id: "rename-selected",
      label: tr("Rename Selected"),
      disabled: isActionDisabled || !hasSelectedEntry,
      run: onRenameSelected
    },
    {
      id: "delete-selected",
      label: tr("Delete Selected"),
      disabled: isActionDisabled || !hasSelectedEntry,
      run: onDeleteSelected
    }
  ];
}

export function buildSftpContextActions({
  contextEntry,
  currentDirectoryCwd,
  currentPathInput,
  isActionDisabled,
  onCopyPath,
  onCreateDirectory,
  onDeleteEntry,
  onDownloadDirectory,
  onDownloadFile,
  onLoadDirectory,
  onOpenFile,
  onRefreshDirectory,
  onRenameEntry,
  onUploadFile,
  tr
}: BuildSftpContextActionsArgs): SftpContextAction[] {
  const actions: SftpContextAction[] = [];

  if (contextEntry?.kind === "directory") {
    actions.push({
      id: "open-directory",
      label: tr("Open Directory"),
      run: () => {
        onLoadDirectory(contextEntry.path);
      }
    });
    actions.push({
      id: "download-directory",
      label: tr("Download Folder"),
      disabled: isActionDisabled,
      run: () => {
        onDownloadDirectory(contextEntry);
      }
    });
  }

  if (contextEntry && contextEntry.kind !== "directory") {
    actions.push({
      id: "open-file",
      label: tr("Open File"),
      disabled: isActionDisabled,
      run: () => {
        onOpenFile(contextEntry);
      }
    });
    actions.push({
      id: "download-file",
      label: tr("Download File"),
      disabled: isActionDisabled,
      run: () => {
        onDownloadFile(contextEntry);
      }
    });
  }

  actions.push({
    id: "upload-file",
    label: tr("Upload File"),
    disabled: isActionDisabled,
    run: onUploadFile
  });
  actions.push({
    id: "create-directory",
    label: tr("New Folder"),
    disabled: isActionDisabled,
    run: onCreateDirectory
  });
  actions.push({
    id: "refresh-directory",
    label: tr("Refresh"),
    disabled: isActionDisabled,
    run: () => {
      onRefreshDirectory(currentDirectoryCwd ?? currentPathInput);
    }
  });

  if (contextEntry) {
    actions.push({
      id: "rename-entry",
      label: tr("Rename"),
      disabled: isActionDisabled,
      run: () => {
        onRenameEntry(contextEntry);
      }
    });
    actions.push({
      id: "delete-entry",
      label: tr("Delete"),
      disabled: isActionDisabled,
      run: () => {
        onDeleteEntry(contextEntry);
      }
    });
    actions.push({
      id: "copy-entry-path",
      label: tr("Copy Path"),
      run: () => {
        onCopyPath(contextEntry.path);
      }
    });
  } else if (currentDirectoryCwd) {
    actions.push({
      id: "copy-current-path",
      label: tr("Copy Current Path"),
      run: () => {
        onCopyPath(currentDirectoryCwd);
      }
    });
  }

  return actions;
}
