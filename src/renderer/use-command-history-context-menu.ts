import { useCallback, useEffect, useRef, useState } from "react";

import type { MouseEvent as ReactMouseEvent } from "react";

export interface CommandHistoryContextMenuState {
  x: number;
  y: number;
  entryId: string | null;
}

interface UseCommandHistoryContextMenuArgs {
  entryIds: string[];
}

export function useCommandHistoryContextMenu({
  entryIds
}: UseCommandHistoryContextMenuArgs) {
  const [commandHistoryContextMenu, setCommandHistoryContextMenu] =
    useState<CommandHistoryContextMenuState | null>(null);
  const commandHistoryContextMenuRef = useRef<HTMLDivElement | null>(null);

  const closeCommandHistoryContextMenu = useCallback(() => {
    setCommandHistoryContextMenu(null);
  }, []);

  const openCommandHistoryContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, entryId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setCommandHistoryContextMenu({
        x: event.clientX,
        y: event.clientY,
        entryId
      });
    },
    []
  );

  const openCommandHistoryPanelContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".command-history-panel__item")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setCommandHistoryContextMenu({
        x: event.clientX,
        y: event.clientY,
        entryId: null
      });
    },
    []
  );

  useEffect(() => {
    if (!commandHistoryContextMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (commandHistoryContextMenuRef.current?.contains(target)) {
        return;
      }
      closeCommandHistoryContextMenu();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCommandHistoryContextMenu();
      }
    };

    const onWindowLayoutChange = () => {
      closeCommandHistoryContextMenu();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onWindowLayoutChange);
    window.addEventListener("scroll", onWindowLayoutChange, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onWindowLayoutChange);
      window.removeEventListener("scroll", onWindowLayoutChange, true);
    };
  }, [closeCommandHistoryContextMenu, commandHistoryContextMenu]);

  useEffect(() => {
    if (!commandHistoryContextMenu?.entryId) {
      return;
    }
    if (!entryIds.includes(commandHistoryContextMenu.entryId)) {
      closeCommandHistoryContextMenu();
    }
  }, [closeCommandHistoryContextMenu, commandHistoryContextMenu, entryIds]);

  return {
    closeCommandHistoryContextMenu,
    commandHistoryContextEntryId: commandHistoryContextMenu?.entryId ?? null,
    commandHistoryContextMenu,
    commandHistoryContextMenuRef,
    openCommandHistoryContextMenu,
    openCommandHistoryPanelContextMenu
  };
}
