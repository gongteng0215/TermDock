import { useCallback } from "react";

import type { DragEvent } from "react";

import type { SftpContextAction } from "./sftp-context-actions";

interface ShowAppAlertOptions {
  title?: string;
  confirmLabel?: string;
  detailText?: string;
}

interface SystemApiLike {
  getPathForDroppedFile?: (file: File) => Promise<string | null>;
}

interface UseSftpExplorerActionsArgs {
  closeSftpContextMenu: () => void;
  closeSftpToolbarMenu: () => void;
  copyTextToClipboard: (text: string) => Promise<boolean>;
  setSftpDropActive: (value: boolean) => void;
  setSftpError: (message: string | null) => void;
  sftpDropActive: boolean;
  showAppAlert: (message: string, options?: ShowAppAlertOptions) => Promise<void>;
  systemApi: SystemApiLike | null;
  uploadLocalPathsToSftp: (paths: string[]) => Promise<void>;
}

async function getLocalPathsFromDroppedFiles(
  files: FileList,
  resolvePath?: (file: File) => Promise<string | null>
): Promise<string[]> {
  const paths = await Promise.all(
    Array.from(files).map(async (file) => {
      const maybePath = (file as File & { path?: string }).path;
      if (maybePath && typeof maybePath === "string") {
        return maybePath;
      }
      if (!resolvePath) {
        return null;
      }
      try {
        return await resolvePath(file);
      } catch {
        return null;
      }
    })
  );
  return paths.filter((pathValue): pathValue is string => typeof pathValue === "string" && pathValue.length > 0);
}

export function useSftpExplorerActions({
  closeSftpContextMenu,
  closeSftpToolbarMenu,
  copyTextToClipboard,
  setSftpDropActive,
  setSftpError,
  sftpDropActive,
  showAppAlert,
  systemApi,
  uploadLocalPathsToSftp
}: UseSftpExplorerActionsArgs) {
  const onSftpDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!sftpDropActive) {
        setSftpDropActive(true);
      }
    },
    [setSftpDropActive, sftpDropActive]
  );

  const onSftpDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (
        event.currentTarget instanceof HTMLElement &&
        event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget)
      ) {
        return;
      }
      setSftpDropActive(false);
    },
    [setSftpDropActive]
  );

  const onSftpDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setSftpDropActive(false);
      const droppedFiles = event.dataTransfer.files;
      void (async () => {
        const localPaths = await getLocalPathsFromDroppedFiles(
          droppedFiles,
          systemApi?.getPathForDroppedFile
        );
        if (localPaths.length === 0) {
          setSftpError("Cannot resolve local paths from dropped files. Try the Upload button.");
          return;
        }
        await uploadLocalPathsToSftp(localPaths);
      })();
    },
    [setSftpDropActive, setSftpError, systemApi, uploadLocalPathsToSftp]
  );

  const runSftpContextAction = useCallback(
    (action: SftpContextAction) => {
      if (action.disabled) {
        return;
      }
      closeSftpContextMenu();
      action.run();
    },
    [closeSftpContextMenu]
  );

  const runSftpToolbarAction = useCallback(
    (action: SftpContextAction) => {
      if (action.disabled) {
        return;
      }
      closeSftpToolbarMenu();
      action.run();
    },
    [closeSftpToolbarMenu]
  );

  const copySftpPathWithFallback = useCallback(
    (path: string) => {
      void (async () => {
        try {
          const copied = await copyTextToClipboard(path);
          if (copied) {
            return;
          }
        } catch {
          // Fallback to dialog for manual copy.
        }
        await showAppAlert("Clipboard unavailable. Copy the path below manually.", {
          title: "Manual Copy",
          confirmLabel: "Close",
          detailText: path
        });
      })();
    },
    [copyTextToClipboard, showAppAlert]
  );

  return {
    copySftpPathWithFallback,
    onSftpDragLeave,
    onSftpDragOver,
    onSftpDrop,
    runSftpContextAction,
    runSftpToolbarAction
  };
}
