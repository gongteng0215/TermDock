import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";

import type {
  CommandSnippetGroup,
  CommandSnippetItem,
  CommandSnippetParameter,
  CommandSnippetPromptSet,
  CommandSnippetScopedValueRecord,
  CommandSnippetVariableScopeId
} from "./command-snippets";

interface UseCommandSnippetManagerArgs {
  buildCommandSnippetParameterToken: (key: string) => string;
  commandSnippetGroups: CommandSnippetGroup[];
  commandSnippetManagerGroupId: string;
  commandSnippetManagerSnippetId: string;
  commandSnippetScopedValues: Record<string, CommandSnippetScopedValueRecord>;
  createCommandSnippetParameter: (
    ordinal: number,
    existingKeys: ReadonlySet<string>,
    scope: "snippet" | "group"
  ) => CommandSnippetParameter;
  getCommandSnippetParameterPatternError: (pattern: string) => string | null;
  isCommandSnippetManagerOpen: boolean;
  listCommandSnippetTemplateParameterKeys: (template: string) => string[];
  maxGroups: number;
  maxParameters: number;
  maxPromptSets: number;
  maxPromptSetNameLength: number;
  maxSnippetsPerGroup: number;
  maxParameterDefaultLength: number;
  maxParameterLabelLength: number;
  maxParameterPatternLength: number;
  mergeCommandSnippetParameters: (
    snippet: CommandSnippetItem | null,
    promptSet: CommandSnippetPromptSet | null
  ) => CommandSnippetParameter[];
  normalizeCommandSnippetParameterKey: (input: string) => string;
  runCommandSnippet: (snippet: CommandSnippetItem, groupId?: string) => Promise<void>;
  setCommandSnippetGroups: Dispatch<SetStateAction<CommandSnippetGroup[]>>;
  setCommandSnippetManagerGroupId: Dispatch<SetStateAction<string>>;
  setCommandSnippetManagerSnippetId: Dispatch<SetStateAction<string>>;
  setCommandSnippetScopedValues: Dispatch<
    SetStateAction<Record<string, CommandSnippetScopedValueRecord>>
  >;
  setError: Dispatch<SetStateAction<string | null>>;
  showAppConfirm: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
      detailText?: string;
    }
  ) => Promise<boolean>;
  totalCommandSnippetCount: number;
}

export function useCommandSnippetManager({
  buildCommandSnippetParameterToken,
  commandSnippetGroups,
  commandSnippetManagerGroupId,
  commandSnippetManagerSnippetId,
  commandSnippetScopedValues,
  createCommandSnippetParameter,
  getCommandSnippetParameterPatternError,
  isCommandSnippetManagerOpen,
  listCommandSnippetTemplateParameterKeys,
  maxGroups,
  maxParameters,
  maxPromptSets,
  maxPromptSetNameLength,
  maxSnippetsPerGroup,
  maxParameterDefaultLength,
  maxParameterLabelLength,
  maxParameterPatternLength,
  mergeCommandSnippetParameters,
  normalizeCommandSnippetParameterKey,
  runCommandSnippet,
  setCommandSnippetGroups,
  setCommandSnippetManagerGroupId,
  setCommandSnippetManagerSnippetId,
  setCommandSnippetScopedValues,
  setError,
  showAppConfirm,
  totalCommandSnippetCount
}: UseCommandSnippetManagerArgs) {
  const selectedCommandSnippetManagerGroup = useMemo(
    () =>
      commandSnippetGroups.find((group) => group.id === commandSnippetManagerGroupId) ??
      commandSnippetGroups[0] ??
      null,
    [commandSnippetGroups, commandSnippetManagerGroupId]
  );

  const selectedCommandSnippetManagerSnippet = useMemo(() => {
    if (!selectedCommandSnippetManagerGroup) {
      return null;
    }
    return (
      selectedCommandSnippetManagerGroup.snippets.find(
        (snippet) => snippet.id === commandSnippetManagerSnippetId
      ) ??
      selectedCommandSnippetManagerGroup.snippets[0] ??
      null
    );
  }, [commandSnippetManagerSnippetId, selectedCommandSnippetManagerGroup]);

  const selectedCommandSnippetManagerPromptSet = useMemo(() => {
    if (!selectedCommandSnippetManagerGroup || !selectedCommandSnippetManagerSnippet?.promptSetId) {
      return null;
    }
    return (
      selectedCommandSnippetManagerGroup.promptSets.find(
        (promptSet) => promptSet.id === selectedCommandSnippetManagerSnippet.promptSetId
      ) ?? null
    );
  }, [selectedCommandSnippetManagerGroup, selectedCommandSnippetManagerSnippet]);

  const selectedCommandSnippetEffectiveParameters = useMemo(
    () =>
      mergeCommandSnippetParameters(
        selectedCommandSnippetManagerSnippet,
        selectedCommandSnippetManagerPromptSet
      ),
    [mergeCommandSnippetParameters, selectedCommandSnippetManagerPromptSet, selectedCommandSnippetManagerSnippet]
  );

  const selectedCommandSnippetTemplateParameterKeys = useMemo(
    () =>
      selectedCommandSnippetManagerSnippet
        ? listCommandSnippetTemplateParameterKeys(selectedCommandSnippetManagerSnippet.template)
        : [],
    [listCommandSnippetTemplateParameterKeys, selectedCommandSnippetManagerSnippet]
  );

  const selectedCommandSnippetMissingParameterKeys = useMemo(() => {
    if (!selectedCommandSnippetManagerSnippet) {
      return [];
    }
    const definedKeys = new Set(
      selectedCommandSnippetEffectiveParameters.map((entry) => entry.key)
    );
    return selectedCommandSnippetTemplateParameterKeys.filter((key) => !definedKeys.has(key));
  }, [
    selectedCommandSnippetEffectiveParameters,
    selectedCommandSnippetManagerSnippet,
    selectedCommandSnippetTemplateParameterKeys
  ]);

  const selectedCommandSnippetUnusedParameterKeys = useMemo(() => {
    if (!selectedCommandSnippetManagerSnippet) {
      return [];
    }
    const usedKeys = new Set(selectedCommandSnippetTemplateParameterKeys);
    return selectedCommandSnippetEffectiveParameters
      .map((entry) => entry.key)
      .filter((key) => !usedKeys.has(key));
  }, [
    selectedCommandSnippetEffectiveParameters,
    selectedCommandSnippetManagerSnippet,
    selectedCommandSnippetTemplateParameterKeys
  ]);

  const selectedCommandSnippetShadowedPromptSetKeys = useMemo(() => {
    if (!selectedCommandSnippetManagerPromptSet || !selectedCommandSnippetManagerSnippet) {
      return [];
    }
    const snippetKeys = new Set(selectedCommandSnippetManagerSnippet.parameters.map((entry) => entry.key));
    return selectedCommandSnippetManagerPromptSet.parameters
      .map((entry) => entry.key)
      .filter((key) => snippetKeys.has(key));
  }, [selectedCommandSnippetManagerPromptSet, selectedCommandSnippetManagerSnippet]);

  const selectedCommandSnippetHasInvalidPattern = useMemo(
    () =>
      selectedCommandSnippetEffectiveParameters.some((parameter) =>
        Boolean(getCommandSnippetParameterPatternError(parameter.pattern))
      ),
    [getCommandSnippetParameterPatternError, selectedCommandSnippetEffectiveParameters]
  );

  useEffect(() => {
    if (!isCommandSnippetManagerOpen) {
      return;
    }
    if (commandSnippetGroups.length === 0) {
      if (commandSnippetManagerGroupId) {
        setCommandSnippetManagerGroupId("");
      }
      if (commandSnippetManagerSnippetId) {
        setCommandSnippetManagerSnippetId("");
      }
      return;
    }
    const nextGroup =
      commandSnippetGroups.find((group) => group.id === commandSnippetManagerGroupId) ??
      commandSnippetGroups[0];
    if (nextGroup.id !== commandSnippetManagerGroupId) {
      setCommandSnippetManagerGroupId(nextGroup.id);
    }
    if (nextGroup.snippets.length === 0) {
      if (commandSnippetManagerSnippetId) {
        setCommandSnippetManagerSnippetId("");
      }
      return;
    }
    const hasSelectedSnippet = nextGroup.snippets.some(
      (snippet) => snippet.id === commandSnippetManagerSnippetId
    );
    if (!hasSelectedSnippet) {
      setCommandSnippetManagerSnippetId(nextGroup.snippets[0].id);
    }
  }, [
    commandSnippetGroups,
    commandSnippetManagerGroupId,
    commandSnippetManagerSnippetId,
    isCommandSnippetManagerOpen,
    setCommandSnippetManagerGroupId,
    setCommandSnippetManagerSnippetId
  ]);

  const updateSelectedCommandSnippet = useCallback(
    (snippetId: string, updater: (snippet: CommandSnippetItem) => CommandSnippetItem) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      setCommandSnippetGroups((prev) =>
        prev.map((group) =>
          group.id === selectedCommandSnippetManagerGroup.id
            ? {
                ...group,
                snippets: group.snippets.map((snippet) =>
                  snippet.id === snippetId ? updater(snippet) : snippet
                )
              }
            : group
        )
      );
    },
    [selectedCommandSnippetManagerGroup, setCommandSnippetGroups]
  );

  const updateSelectedCommandSnippetPromptSet = useCallback(
    (
      promptSetId: string,
      updater: (promptSet: CommandSnippetPromptSet) => CommandSnippetPromptSet
    ) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      setCommandSnippetGroups((prev) =>
        prev.map((group) =>
          group.id === selectedCommandSnippetManagerGroup.id
            ? {
                ...group,
                promptSets: group.promptSets.map((promptSet) =>
                  promptSet.id === promptSetId ? updater(promptSet) : promptSet
                )
              }
            : group
        )
      );
    },
    [selectedCommandSnippetManagerGroup, setCommandSnippetGroups]
  );

  const updateCommandSnippetManagerGroupName = useCallback(
    (groupId: string, nextName: string) => {
      const normalizedName = nextName.slice(0, 80);
      setCommandSnippetGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
                ...group,
                name: normalizedName
              }
            : group
        )
      );
    },
    [setCommandSnippetGroups]
  );

  const addCommandSnippetManagerGroup = useCallback(() => {
    if (commandSnippetGroups.length >= maxGroups) {
      setError(`Snippet groups are limited to ${maxGroups}.`);
      return;
    }
    const nextGroupId = `sg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const nextGroupName = `Group ${commandSnippetGroups.length + 1}`;
    setCommandSnippetGroups((prev) => [
      ...prev,
      {
        id: nextGroupId,
        name: nextGroupName,
        promptSets: [],
        snippets: []
      }
    ]);
    setCommandSnippetManagerGroupId(nextGroupId);
    setCommandSnippetManagerSnippetId("");
  }, [
    commandSnippetGroups.length,
    maxGroups,
    setCommandSnippetGroups,
    setCommandSnippetManagerGroupId,
    setCommandSnippetManagerSnippetId,
    setError
  ]);

  const deleteCommandSnippetManagerGroup = useCallback(async () => {
    if (!selectedCommandSnippetManagerGroup) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete snippet group "${selectedCommandSnippetManagerGroup.name}" and all snippets in it?`,
      {
        title: "Delete Snippet Group",
        confirmLabel: "Delete Group",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetGroups((prev) =>
      prev.filter((group) => group.id !== selectedCommandSnippetManagerGroup.id)
    );
  }, [selectedCommandSnippetManagerGroup, setCommandSnippetGroups, showAppConfirm]);

  const addCommandSnippetManagerSnippet = useCallback(() => {
    if (!selectedCommandSnippetManagerGroup) {
      addCommandSnippetManagerGroup();
      return;
    }
    if (selectedCommandSnippetManagerGroup.snippets.length >= maxSnippetsPerGroup) {
      setError(
        `Snippets per group are limited to ${maxSnippetsPerGroup}. Delete or export existing snippets first.`
      );
      return;
    }
    const nextSnippetId = `sn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const nextSnippet: CommandSnippetItem = {
      id: nextSnippetId,
      name: `Snippet ${selectedCommandSnippetManagerGroup.snippets.length + 1}`,
      template: 'echo "snippet"',
      confirmBeforeRun: false,
      previewBeforeRun: false,
      promptSetId: "",
      parameters: []
    };
    setCommandSnippetGroups((prev) =>
      prev.map((group) =>
        group.id === selectedCommandSnippetManagerGroup.id
          ? {
              ...group,
              snippets: [...group.snippets, nextSnippet]
            }
          : group
      )
    );
    setCommandSnippetManagerSnippetId(nextSnippetId);
  }, [
    addCommandSnippetManagerGroup,
    maxSnippetsPerGroup,
    selectedCommandSnippetManagerGroup,
    setCommandSnippetGroups,
    setCommandSnippetManagerSnippetId,
    setError
  ]);

  const updateCommandSnippetManagerSnippetName = useCallback(
    (snippetId: string, nextName: string) => {
      const normalizedName = nextName.slice(0, 80);
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        name: normalizedName
      }));
    },
    [updateSelectedCommandSnippet]
  );

  const updateCommandSnippetManagerSnippetTemplate = useCallback(
    (snippetId: string, nextTemplate: string) => {
      const normalizedTemplate = nextTemplate.slice(0, 4000);
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        template: normalizedTemplate
      }));
    },
    [updateSelectedCommandSnippet]
  );

  const updateCommandSnippetManagerSnippetConfirm = useCallback(
    (snippetId: string, nextConfirmBeforeRun: boolean) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        confirmBeforeRun: nextConfirmBeforeRun
      }));
    },
    [updateSelectedCommandSnippet]
  );

  const updateCommandSnippetManagerSnippetPreview = useCallback(
    (snippetId: string, nextPreviewBeforeRun: boolean) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        previewBeforeRun: nextPreviewBeforeRun
      }));
    },
    [updateSelectedCommandSnippet]
  );

  const updateCommandSnippetManagerSnippetPromptSet = useCallback(
    (snippetId: string, nextPromptSetId: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        promptSetId: nextPromptSetId
      }));
    },
    [updateSelectedCommandSnippet]
  );

  const addCommandSnippetManagerPromptSet = useCallback(() => {
    if (!selectedCommandSnippetManagerGroup || !selectedCommandSnippetManagerSnippet) {
      return;
    }
    if (selectedCommandSnippetManagerGroup.promptSets.length >= maxPromptSets) {
      setError(`Prompt sets per group are limited to ${maxPromptSets}.`);
      return;
    }
    const nextPromptSetId = `sps-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const nextPromptSet: CommandSnippetPromptSet = {
      id: nextPromptSetId,
      name: `Prompt Set ${selectedCommandSnippetManagerGroup.promptSets.length + 1}`,
      parameters: []
    };
    setCommandSnippetGroups((prev) =>
      prev.map((group) =>
        group.id === selectedCommandSnippetManagerGroup.id
          ? {
              ...group,
              promptSets: [...group.promptSets, nextPromptSet],
              snippets: group.snippets.map((snippet) =>
                snippet.id === selectedCommandSnippetManagerSnippet.id
                  ? {
                      ...snippet,
                      promptSetId: nextPromptSetId
                    }
                  : snippet
              )
            }
          : group
      )
    );
  }, [
    maxPromptSets,
    selectedCommandSnippetManagerGroup,
    selectedCommandSnippetManagerSnippet,
    setCommandSnippetGroups,
    setError
  ]);

  const updateCommandSnippetManagerPromptSetName = useCallback(
    (promptSetId: string, nextName: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        name: nextName.slice(0, maxPromptSetNameLength)
      }));
    },
    [maxPromptSetNameLength, updateSelectedCommandSnippetPromptSet]
  );

  const deleteSelectedCommandSnippetManagerPromptSet = useCallback(async () => {
    if (!selectedCommandSnippetManagerGroup || !selectedCommandSnippetManagerPromptSet) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete prompt set "${selectedCommandSnippetManagerPromptSet.name}" from "${selectedCommandSnippetManagerGroup.name}"? Linked snippets will fall back to snippet-only variables.`,
      {
        title: "Delete Prompt Set",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetGroups((prev) =>
      prev.map((group) =>
        group.id === selectedCommandSnippetManagerGroup.id
          ? {
              ...group,
              promptSets: group.promptSets.filter(
                (promptSet) => promptSet.id !== selectedCommandSnippetManagerPromptSet.id
              ),
              snippets: group.snippets.map((snippet) =>
                snippet.promptSetId === selectedCommandSnippetManagerPromptSet.id
                  ? {
                      ...snippet,
                      promptSetId: ""
                    }
                  : snippet
              )
            }
          : group
      )
    );
  }, [
    selectedCommandSnippetManagerGroup,
    selectedCommandSnippetManagerPromptSet,
    setCommandSnippetGroups,
    showAppConfirm
  ]);

  const addCommandSnippetManagerSnippetParameter = useCallback(() => {
    if (!selectedCommandSnippetManagerSnippet) {
      return;
    }
    if (selectedCommandSnippetManagerSnippet.parameters.length >= maxParameters) {
      setError(`Snippet parameters are limited to ${maxParameters}.`);
      return;
    }
    const existingKeys = new Set(selectedCommandSnippetManagerSnippet.parameters.map((entry) => entry.key));
    const nextParameter = createCommandSnippetParameter(
      selectedCommandSnippetManagerSnippet.parameters.length + 1,
      existingKeys,
      "snippet"
    );
    updateSelectedCommandSnippet(selectedCommandSnippetManagerSnippet.id, (snippet) => ({
      ...snippet,
      parameters: [...snippet.parameters, nextParameter]
    }));
  }, [
    createCommandSnippetParameter,
    maxParameters,
    selectedCommandSnippetManagerSnippet,
    setError,
    updateSelectedCommandSnippet
  ]);

  const updateCommandSnippetManagerSnippetParameterKey = useCallback(
    (snippetId: string, parameterId: string, nextKeyInput: string) => {
      if (!selectedCommandSnippetManagerSnippet) {
        return;
      }
      const normalizedKey = normalizeCommandSnippetParameterKey(nextKeyInput);
      if (!normalizedKey) {
        setError("Snippet parameter keys must contain letters, numbers, '-' or '_'.");
        return;
      }
      if (
        selectedCommandSnippetManagerSnippet.parameters.some(
          (parameter) => parameter.id !== parameterId && parameter.key === normalizedKey
        )
      ) {
        setError(`Snippet parameter key "${normalizedKey}" already exists.`);
        return;
      }
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                key: normalizedKey,
                label: parameter.label || normalizedKey
              }
            : parameter
        )
      }));
    },
    [
      normalizeCommandSnippetParameterKey,
      selectedCommandSnippetManagerSnippet,
      setError,
      updateSelectedCommandSnippet
    ]
  );

  const updateCommandSnippetManagerSnippetParameterLabel = useCallback(
    (snippetId: string, parameterId: string, nextLabel: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                label: nextLabel.slice(0, maxParameterLabelLength)
              }
            : parameter
        )
      }));
    },
    [maxParameterLabelLength, updateSelectedCommandSnippet]
  );

  const updateCommandSnippetManagerSnippetParameterDefault = useCallback(
    (snippetId: string, parameterId: string, nextDefaultValue: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                defaultValue: nextDefaultValue.slice(0, maxParameterDefaultLength)
              }
            : parameter
        )
      }));
    },
    [maxParameterDefaultLength, updateSelectedCommandSnippet]
  );

  const updateCommandSnippetManagerSnippetParameterPattern = useCallback(
    (snippetId: string, parameterId: string, nextPattern: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                pattern: nextPattern.slice(0, maxParameterPatternLength)
              }
            : parameter
        )
      }));
    },
    [maxParameterPatternLength, updateSelectedCommandSnippet]
  );

  const updateCommandSnippetManagerSnippetParameterScope = useCallback(
    (snippetId: string, parameterId: string, nextScope: CommandSnippetVariableScopeId) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                scope: nextScope
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippet]
  );

  const updateCommandSnippetManagerSnippetParameterRequired = useCallback(
    (snippetId: string, parameterId: string, nextRequired: boolean) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                required: nextRequired
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippet]
  );

  const deleteCommandSnippetManagerSnippetParameter = useCallback(
    (snippetId: string, parameterId: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.filter((parameter) => parameter.id !== parameterId)
      }));
    },
    [updateSelectedCommandSnippet]
  );

  const insertCommandSnippetManagerSnippetParameterToken = useCallback(
    (snippetId: string, parameterKey: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => {
        const token = buildCommandSnippetParameterToken(parameterKey);
        const nextTemplate = snippet.template.includes(token)
          ? snippet.template
          : snippet.template.trim()
            ? `${snippet.template}\n${token}`
            : token;
        return {
          ...snippet,
          template: nextTemplate.slice(0, 4000)
        };
      });
    },
    [buildCommandSnippetParameterToken, updateSelectedCommandSnippet]
  );

  const addCommandSnippetManagerPromptSetParameter = useCallback(() => {
    if (!selectedCommandSnippetManagerPromptSet) {
      return;
    }
    if (selectedCommandSnippetManagerPromptSet.parameters.length >= maxParameters) {
      setError(`Prompt-set parameters are limited to ${maxParameters}.`);
      return;
    }
    const existingKeys = new Set(selectedCommandSnippetManagerPromptSet.parameters.map((entry) => entry.key));
    const nextParameter = createCommandSnippetParameter(
      selectedCommandSnippetManagerPromptSet.parameters.length + 1,
      existingKeys,
      "group"
    );
    updateSelectedCommandSnippetPromptSet(selectedCommandSnippetManagerPromptSet.id, (promptSet) => ({
      ...promptSet,
      parameters: [...promptSet.parameters, nextParameter]
    }));
  }, [
    createCommandSnippetParameter,
    maxParameters,
    selectedCommandSnippetManagerPromptSet,
    setError,
    updateSelectedCommandSnippetPromptSet
  ]);

  const updateCommandSnippetManagerPromptSetParameterKey = useCallback(
    (promptSetId: string, parameterId: string, nextKeyInput: string) => {
      if (!selectedCommandSnippetManagerPromptSet) {
        return;
      }
      const normalizedKey = normalizeCommandSnippetParameterKey(nextKeyInput);
      if (!normalizedKey) {
        setError("Prompt-set parameter keys must contain letters, numbers, '-' or '_'.");
        return;
      }
      if (
        selectedCommandSnippetManagerPromptSet.parameters.some(
          (parameter) => parameter.id !== parameterId && parameter.key === normalizedKey
        )
      ) {
        setError(`Prompt-set parameter key "${normalizedKey}" already exists.`);
        return;
      }
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                key: normalizedKey,
                label: parameter.label || normalizedKey
              }
            : parameter
        )
      }));
    },
    [
      normalizeCommandSnippetParameterKey,
      selectedCommandSnippetManagerPromptSet,
      setError,
      updateSelectedCommandSnippetPromptSet
    ]
  );

  const updateCommandSnippetManagerPromptSetParameterLabel = useCallback(
    (promptSetId: string, parameterId: string, nextLabel: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                label: nextLabel.slice(0, maxParameterLabelLength)
              }
            : parameter
        )
      }));
    },
    [maxParameterLabelLength, updateSelectedCommandSnippetPromptSet]
  );

  const updateCommandSnippetManagerPromptSetParameterDefault = useCallback(
    (promptSetId: string, parameterId: string, nextDefaultValue: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                defaultValue: nextDefaultValue.slice(0, maxParameterDefaultLength)
              }
            : parameter
        )
      }));
    },
    [maxParameterDefaultLength, updateSelectedCommandSnippetPromptSet]
  );

  const updateCommandSnippetManagerPromptSetParameterPattern = useCallback(
    (promptSetId: string, parameterId: string, nextPattern: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                pattern: nextPattern.slice(0, maxParameterPatternLength)
              }
            : parameter
        )
      }));
    },
    [maxParameterPatternLength, updateSelectedCommandSnippetPromptSet]
  );

  const updateCommandSnippetManagerPromptSetParameterScope = useCallback(
    (promptSetId: string, parameterId: string, nextScope: CommandSnippetVariableScopeId) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                scope: nextScope
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );

  const updateCommandSnippetManagerPromptSetParameterRequired = useCallback(
    (promptSetId: string, parameterId: string, nextRequired: boolean) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                required: nextRequired
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );

  const deleteCommandSnippetManagerPromptSetParameter = useCallback(
    (promptSetId: string, parameterId: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.filter((parameter) => parameter.id !== parameterId)
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );

  const insertCommandSnippetManagerPromptSetParameterToken = useCallback(
    (snippetId: string, parameterKey: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => {
        const token = buildCommandSnippetParameterToken(parameterKey);
        const nextTemplate = snippet.template.includes(token)
          ? snippet.template
          : snippet.template.trim()
            ? `${snippet.template}\n${token}`
            : token;
        return {
          ...snippet,
          template: nextTemplate.slice(0, 4000)
        };
      });
    },
    [buildCommandSnippetParameterToken, updateSelectedCommandSnippet]
  );

  const runSelectedCommandSnippetManagerSnippet = useCallback(async () => {
    if (!selectedCommandSnippetManagerSnippet) {
      return;
    }
    await runCommandSnippet(
      selectedCommandSnippetManagerSnippet,
      selectedCommandSnippetManagerGroup?.id ?? ""
    );
  }, [runCommandSnippet, selectedCommandSnippetManagerGroup?.id, selectedCommandSnippetManagerSnippet]);

  const deleteCommandSnippetManagerSnippet = useCallback(async () => {
    if (!selectedCommandSnippetManagerGroup || !selectedCommandSnippetManagerSnippet) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete snippet "${selectedCommandSnippetManagerSnippet.name}" from "${selectedCommandSnippetManagerGroup.name}"?`,
      {
        title: "Delete Snippet",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetGroups((prev) =>
      prev.map((group) =>
        group.id === selectedCommandSnippetManagerGroup.id
          ? {
              ...group,
              snippets: group.snippets.filter(
                (snippet) => snippet.id !== selectedCommandSnippetManagerSnippet.id
              )
            }
          : group
      )
    );
  }, [
    selectedCommandSnippetManagerGroup,
    selectedCommandSnippetManagerSnippet,
    setCommandSnippetGroups,
    showAppConfirm
  ]);

  const clearAllCommandSnippetGroups = useCallback(async () => {
    const confirmed = await showAppConfirm(
      `Delete all snippet groups and snippets (${commandSnippetGroups.length} group(s), ${totalCommandSnippetCount} snippet(s))?`,
      {
        title: "Clear Snippet Groups",
        confirmLabel: "Delete All",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetGroups([]);
    setCommandSnippetManagerGroupId("");
    setCommandSnippetManagerSnippetId("");
    setCommandSnippetScopedValues({});
  }, [
    commandSnippetGroups.length,
    setCommandSnippetGroups,
    setCommandSnippetManagerGroupId,
    setCommandSnippetManagerSnippetId,
    setCommandSnippetScopedValues,
    showAppConfirm,
    totalCommandSnippetCount
  ]);

  const clearCommandSnippetScopedValues = useCallback(async () => {
    const scopedValueCount = Object.keys(commandSnippetScopedValues).length;
    if (scopedValueCount === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Clear ${scopedValueCount} remembered scoped snippet value(s)?`,
      {
        title: "Clear Scoped Values",
        confirmLabel: "Clear",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetScopedValues({});
  }, [commandSnippetScopedValues, setCommandSnippetScopedValues, showAppConfirm]);

  const selectCommandSnippetManagerGroup = useCallback(
    (groupId: string) => {
      const nextGroup = commandSnippetGroups.find((group) => group.id === groupId);
      setCommandSnippetManagerGroupId(groupId);
      setCommandSnippetManagerSnippetId(nextGroup?.snippets[0]?.id ?? "");
    },
    [commandSnippetGroups, setCommandSnippetManagerGroupId, setCommandSnippetManagerSnippetId]
  );

  const selectCommandSnippetManagerSnippet = useCallback(
    (snippetId: string) => {
      setCommandSnippetManagerSnippetId(snippetId);
    },
    [setCommandSnippetManagerSnippetId]
  );

  const runCommandSnippetManagerSnippetById = useCallback(
    (snippetId: string) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      const snippet =
        selectedCommandSnippetManagerGroup.snippets.find((entry) => entry.id === snippetId) ?? null;
      if (!snippet) {
        return;
      }
      setCommandSnippetManagerSnippetId(snippetId);
      void runCommandSnippet(snippet, selectedCommandSnippetManagerGroup.id);
    },
    [runCommandSnippet, selectedCommandSnippetManagerGroup, setCommandSnippetManagerSnippetId]
  );

  const normalizeSelectedCommandSnippetManagerGroupName = useCallback(() => {
    if (!selectedCommandSnippetManagerGroup) {
      return;
    }
    if (selectedCommandSnippetManagerGroup.name.trim()) {
      return;
    }
    updateCommandSnippetManagerGroupName(selectedCommandSnippetManagerGroup.id, "Unnamed Group");
  }, [selectedCommandSnippetManagerGroup, updateCommandSnippetManagerGroupName]);

  const normalizeSelectedCommandSnippetManagerSnippetName = useCallback(() => {
    if (!selectedCommandSnippetManagerSnippet) {
      return;
    }
    if (selectedCommandSnippetManagerSnippet.name.trim()) {
      return;
    }
    updateCommandSnippetManagerSnippetName(selectedCommandSnippetManagerSnippet.id, "Unnamed Snippet");
  }, [selectedCommandSnippetManagerSnippet, updateCommandSnippetManagerSnippetName]);

  const normalizeSelectedCommandSnippetManagerPromptSetName = useCallback(() => {
    if (!selectedCommandSnippetManagerPromptSet) {
      return;
    }
    if (selectedCommandSnippetManagerPromptSet.name.trim()) {
      return;
    }
    updateCommandSnippetManagerPromptSetName(
      selectedCommandSnippetManagerPromptSet.id,
      "Unnamed Prompt Set"
    );
  }, [selectedCommandSnippetManagerPromptSet, updateCommandSnippetManagerPromptSetName]);

  return {
    addCommandSnippetManagerGroup,
    addCommandSnippetManagerPromptSet,
    addCommandSnippetManagerPromptSetParameter,
    addCommandSnippetManagerSnippet,
    addCommandSnippetManagerSnippetParameter,
    clearAllCommandSnippetGroups,
    clearCommandSnippetScopedValues,
    deleteCommandSnippetManagerGroup,
    deleteCommandSnippetManagerPromptSetParameter,
    deleteCommandSnippetManagerSnippet,
    deleteCommandSnippetManagerSnippetParameter,
    deleteSelectedCommandSnippetManagerPromptSet,
    insertCommandSnippetManagerPromptSetParameterToken,
    insertCommandSnippetManagerSnippetParameterToken,
    normalizeSelectedCommandSnippetManagerGroupName,
    normalizeSelectedCommandSnippetManagerPromptSetName,
    normalizeSelectedCommandSnippetManagerSnippetName,
    runCommandSnippetManagerSnippetById,
    runSelectedCommandSnippetManagerSnippet,
    selectCommandSnippetManagerGroup,
    selectCommandSnippetManagerSnippet,
    selectedCommandSnippetHasInvalidPattern,
    selectedCommandSnippetManagerGroup,
    selectedCommandSnippetManagerPromptSet,
    selectedCommandSnippetManagerSnippet,
    selectedCommandSnippetMissingParameterKeys,
    selectedCommandSnippetShadowedPromptSetKeys,
    selectedCommandSnippetUnusedParameterKeys,
    updateCommandSnippetManagerGroupName,
    updateCommandSnippetManagerPromptSetName,
    updateCommandSnippetManagerPromptSetParameterDefault,
    updateCommandSnippetManagerPromptSetParameterKey,
    updateCommandSnippetManagerPromptSetParameterLabel,
    updateCommandSnippetManagerPromptSetParameterPattern,
    updateCommandSnippetManagerPromptSetParameterRequired,
    updateCommandSnippetManagerPromptSetParameterScope,
    updateCommandSnippetManagerSnippetConfirm,
    updateCommandSnippetManagerSnippetName,
    updateCommandSnippetManagerSnippetParameterDefault,
    updateCommandSnippetManagerSnippetParameterKey,
    updateCommandSnippetManagerSnippetParameterLabel,
    updateCommandSnippetManagerSnippetParameterPattern,
    updateCommandSnippetManagerSnippetParameterRequired,
    updateCommandSnippetManagerSnippetParameterScope,
    updateCommandSnippetManagerSnippetPreview,
    updateCommandSnippetManagerSnippetPromptSet,
    updateCommandSnippetManagerSnippetTemplate
  };
}
