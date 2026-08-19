import { useCallback, useEffect, useRef, useState } from "react";

import type { MouseEvent as ReactMouseEvent } from "react";

import type { SftpEntry } from "../shared/sftp";
import { useDismissableLayer } from "./use-dismissable-layer";

export interface SftpContextMenuState {
  x: number;
  y: number;
  entryPath: string | null;
}

export interface SftpToolbarMenuState {
  x: number;
  y: number;
}

interface UseSftpContextMenusArgs {
  hasActiveTerminalTab: boolean;
  selectOnlySftpPath: (path: string | null) => void;
  selectedSftpPaths: string[];
  sftpEntryPaths: string[];
}

export function useSftpContextMenus({
  hasActiveTerminalTab,
  selectOnlySftpPath,
  selectedSftpPaths,
  sftpEntryPaths
}: UseSftpContextMenusArgs) {
  const [sftpContextMenu, setSftpContextMenu] = useState<SftpContextMenuState | null>(null);
  const [sftpToolbarMenu, setSftpToolbarMenu] = useState<SftpToolbarMenuState | null>(null);
  const sftpContextMenuRef = useRef<HTMLDivElement | null>(null);
  const sftpToolbarMenuRef = useRef<HTMLDivElement | null>(null);

  const closeSftpContextMenu = useCallback(() => {
    setSftpContextMenu(null);
  }, []);

  const closeSftpToolbarMenu = useCallback(() => {
    setSftpToolbarMenu(null);
  }, []);

  const openSftpContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, entry?: SftpEntry) => {
      event.preventDefault();
      event.stopPropagation();
      closeSftpToolbarMenu();
      if (entry && !selectedSftpPaths.includes(entry.path)) {
        selectOnlySftpPath(entry.path);
      }
      setSftpContextMenu({
        x: event.clientX,
        y: event.clientY,
        entryPath: entry?.path ?? null
      });
    },
    [closeSftpToolbarMenu, selectOnlySftpPath, selectedSftpPaths]
  );

  const toggleSftpToolbarMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const triggerRect = event.currentTarget.getBoundingClientRect();
      closeSftpContextMenu();
      setSftpToolbarMenu((prev) => {
        if (prev) {
          return null;
        }
        return {
          x: Math.round(triggerRect.left),
          y: Math.round(triggerRect.bottom + 4)
        };
      });
    },
    [closeSftpContextMenu]
  );

  useDismissableLayer({
    open: Boolean(sftpContextMenu),
    onDismiss: closeSftpContextMenu,
    rootRef: sftpContextMenuRef,
    closeOnOutsidePointer: true,
    closeOnEscape: true,
    closeOnWindowLayoutChange: true
  });

  useDismissableLayer({
    open: Boolean(sftpToolbarMenu),
    onDismiss: closeSftpToolbarMenu,
    rootRef: sftpToolbarMenuRef,
    closeOnOutsidePointer: true,
    closeOnEscape: true,
    closeOnWindowLayoutChange: true
  });

  useEffect(() => {
    if (!sftpContextMenu) {
      return;
    }
    if (!hasActiveTerminalTab) {
      closeSftpContextMenu();
      return;
    }
    if (!sftpContextMenu.entryPath) {
      return;
    }
    if (!sftpEntryPaths.includes(sftpContextMenu.entryPath)) {
      closeSftpContextMenu();
    }
  }, [
    closeSftpContextMenu,
    hasActiveTerminalTab,
    sftpContextMenu,
    sftpEntryPaths
  ]);

  return {
    closeSftpContextMenu,
    closeSftpToolbarMenu,
    openSftpContextMenu,
    sftpContextMenu,
    sftpContextMenuRef,
    sftpToolbarMenu,
    sftpToolbarMenuRef,
    toggleSftpToolbarMenu
  };
}
