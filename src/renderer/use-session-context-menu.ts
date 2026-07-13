import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";

import type { MouseEvent as ReactMouseEvent } from "react";

import type { SessionRecord } from "../shared/session";
import type { SessionContextMenuTarget } from "./session-context-actions";
import { useDismissableLayer } from "./use-dismissable-layer";

export interface SessionContextMenuState {
  x: number;
  y: number;
  target: SessionContextMenuTarget;
}

function normalizeSessionGroupName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSessionGroups(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const rawValue of values) {
    const normalized = normalizeSessionGroupName(rawValue);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    groups.push(normalized);
  }
  groups.sort((left, right) => left.localeCompare(right));
  return groups;
}

interface UseSessionContextMenuArgs {
  activeSessionGroupKey: string | null;
  persistedGroupNames: string[];
  sessions: SessionRecord[];
  setSelectedGroupKeys: Dispatch<SetStateAction<string[]>>;
  setSelectedSessionId: Dispatch<SetStateAction<string | null>>;
  setSelectedSessionIds: Dispatch<SetStateAction<string[]>>;
}

export function useSessionContextMenu({
  activeSessionGroupKey,
  persistedGroupNames,
  sessions,
  setSelectedGroupKeys,
  setSelectedSessionId,
  setSelectedSessionIds
}: UseSessionContextMenuArgs) {
  const [sessionContextMenu, setSessionContextMenu] =
    useState<SessionContextMenuState | null>(null);
  const sessionContextMenuRef = useRef<HTMLDivElement | null>(null);

  const closeSessionContextMenu = useCallback(() => {
    setSessionContextMenu(null);
  }, []);

  const openSessionContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, target: SessionContextMenuTarget) => {
      event.preventDefault();
      event.stopPropagation();
      if (target.type === "session") {
        setSelectedSessionId(target.sessionId);
        setSelectedSessionIds((prev) =>
          prev.includes(target.sessionId) ? prev : [target.sessionId]
        );
      }
      if (target.type === "group") {
        setSelectedGroupKeys((prev) =>
          prev.includes(target.groupKey) ? prev : [target.groupKey]
        );
      }
      setSessionContextMenu({
        x: event.clientX,
        y: event.clientY,
        target
      });
    },
    [setSelectedGroupKeys, setSelectedSessionId, setSelectedSessionIds]
  );

  const openSessionBlankContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, input, textarea, select, a, label, .session-list__item, .session-folder-list__item"
        )
      ) {
        return;
      }
      if (activeSessionGroupKey) {
        const groupName =
          activeSessionGroupKey === "__ungrouped__" ? "" : activeSessionGroupKey;
        openSessionContextMenu(event, {
          type: "group-view",
          groupKey: activeSessionGroupKey,
          groupName,
          label: groupName || "Ungrouped"
        });
        return;
      }
      openSessionContextMenu(event, { type: "group-root" });
    },
    [activeSessionGroupKey, openSessionContextMenu]
  );

  const sessionGroupOptions = useMemo(
    () =>
      normalizeSessionGroups([
        ...persistedGroupNames,
        ...sessions.map((session) => session.groupId ?? "")
      ]),
    [persistedGroupNames, sessions]
  );

  useDismissableLayer({
    open: Boolean(sessionContextMenu),
    onDismiss: closeSessionContextMenu,
    rootRef: sessionContextMenuRef,
    closeOnOutsidePointer: true,
    closeOnEscape: true,
    closeOnWindowLayoutChange: true
  });

  useEffect(() => {
    if (!sessionContextMenu) {
      return;
    }
    const contextTarget = sessionContextMenu.target;
    if (contextTarget.type === "session") {
      const exists = sessions.some((session) => session.id === contextTarget.sessionId);
      if (!exists) {
        closeSessionContextMenu();
      }
      return;
    }
    if (contextTarget.type === "group" || contextTarget.type === "group-view") {
      if (contextTarget.groupKey === "__ungrouped__") {
        return;
      }
      const exists =
        sessionGroupOptions.some(
          (groupName) => groupName.toLowerCase() === contextTarget.groupName.toLowerCase()
        ) ||
        sessions.some(
          (session) =>
            (session.groupId?.trim() ?? "").toLowerCase() === contextTarget.groupName.toLowerCase()
        );
      if (!exists) {
        closeSessionContextMenu();
      }
    }
  }, [closeSessionContextMenu, sessionContextMenu, sessionGroupOptions, sessions]);

  return {
    closeSessionContextMenu,
    openSessionBlankContextMenu,
    openSessionContextMenu,
    sessionContextMenu,
    sessionContextMenuRef
  };
}
