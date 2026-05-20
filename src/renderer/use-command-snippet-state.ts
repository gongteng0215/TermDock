import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { CommandSnippetGroup, CommandSnippetScopedValueRecord } from "./command-snippets";

interface UseCommandSnippetStateArgs {
  groupsStorageKey: string;
  maxGroups: number;
  normalizeScopedValues: (
    value: Record<string, CommandSnippetScopedValueRecord>
  ) => Record<string, CommandSnippetScopedValueRecord>;
  readGroups: () => CommandSnippetGroup[];
  readScopedValues: () => Record<string, CommandSnippetScopedValueRecord>;
  scopedValuesStorageKey: string;
}

interface UseCommandSnippetStateResult {
  commandSnippetGroups: CommandSnippetGroup[];
  commandSnippetManagerGroupId: string;
  commandSnippetManagerSnippetId: string;
  commandSnippetScopedValueCount: number;
  commandSnippetScopedValues: Record<string, CommandSnippetScopedValueRecord>;
  isCommandSnippetManagerOpen: boolean;
  setCommandSnippetGroups: Dispatch<SetStateAction<CommandSnippetGroup[]>>;
  setCommandSnippetManagerGroupId: Dispatch<SetStateAction<string>>;
  setCommandSnippetManagerSnippetId: Dispatch<SetStateAction<string>>;
  setCommandSnippetScopedValues: Dispatch<
    SetStateAction<Record<string, CommandSnippetScopedValueRecord>>
  >;
  setIsCommandSnippetManagerOpen: Dispatch<SetStateAction<boolean>>;
  totalCommandSnippetCount: number;
  totalCommandSnippetPromptSetCount: number;
}

export function useCommandSnippetState({
  groupsStorageKey,
  maxGroups,
  normalizeScopedValues,
  readGroups,
  readScopedValues,
  scopedValuesStorageKey
}: UseCommandSnippetStateArgs): UseCommandSnippetStateResult {
  const [commandSnippetGroups, setCommandSnippetGroups] = useState<CommandSnippetGroup[]>(() =>
    readGroups()
  );
  const [commandSnippetScopedValues, setCommandSnippetScopedValues] = useState<
    Record<string, CommandSnippetScopedValueRecord>
  >(() => readScopedValues());
  const [isCommandSnippetManagerOpen, setIsCommandSnippetManagerOpen] = useState(false);
  const [commandSnippetManagerGroupId, setCommandSnippetManagerGroupId] = useState("");
  const [commandSnippetManagerSnippetId, setCommandSnippetManagerSnippetId] = useState("");

  const totalCommandSnippetCount = useMemo(
    () => commandSnippetGroups.reduce((total, group) => total + group.snippets.length, 0),
    [commandSnippetGroups]
  );
  const totalCommandSnippetPromptSetCount = useMemo(
    () => commandSnippetGroups.reduce((total, group) => total + group.promptSets.length, 0),
    [commandSnippetGroups]
  );
  const commandSnippetScopedValueCount = useMemo(
    () => Object.keys(commandSnippetScopedValues).length,
    [commandSnippetScopedValues]
  );

  useEffect(() => {
    try {
      if (commandSnippetGroups.length === 0) {
        window.localStorage.removeItem(groupsStorageKey);
      } else {
        window.localStorage.setItem(
          groupsStorageKey,
          JSON.stringify(commandSnippetGroups.slice(0, maxGroups))
        );
      }
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [commandSnippetGroups, groupsStorageKey, maxGroups]);

  useEffect(() => {
    try {
      const normalizedScopedValues = normalizeScopedValues(commandSnippetScopedValues);
      if (Object.keys(normalizedScopedValues).length === 0) {
        window.localStorage.removeItem(scopedValuesStorageKey);
      } else {
        window.localStorage.setItem(
          scopedValuesStorageKey,
          JSON.stringify(normalizedScopedValues)
        );
      }
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [commandSnippetScopedValues, normalizeScopedValues, scopedValuesStorageKey]);

  return {
    commandSnippetGroups,
    commandSnippetManagerGroupId,
    commandSnippetManagerSnippetId,
    commandSnippetScopedValueCount,
    commandSnippetScopedValues,
    isCommandSnippetManagerOpen,
    setCommandSnippetGroups,
    setCommandSnippetManagerGroupId,
    setCommandSnippetManagerSnippetId,
    setCommandSnippetScopedValues,
    setIsCommandSnippetManagerOpen,
    totalCommandSnippetCount,
    totalCommandSnippetPromptSetCount
  };
}
