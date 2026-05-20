import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type {
  CommandSnippetGroup,
  CommandSnippetItem,
  CommandSnippetParameter,
  CommandSnippetPromptSet,
  CommandSnippetScopedValueRecord,
  CommandSnippetVariableScopeId
} from "./command-snippets";
import type { TerminalCommandHistorySource } from "./components/terminal-workspace";

interface TerminalTabLike {
  id: string;
  title?: string;
  sessionId: string;
}

interface SessionLike {
  id: string;
  host: string;
  name: string;
  username: string;
}

interface BuildScopedValueCacheKeyInput {
  scope: CommandSnippetVariableScopeId;
  key: string;
  snippetId: string;
  groupId: string;
  sessionId: string;
}

interface GuardedTerminalWriteOptions {
  source: "snippet";
  commandText?: string;
}

interface UseCommandSnippetRuntimeArgs {
  activeTabIdRef: MutableRefObject<string | null>;
  buildCommandSnippetScopedValueCacheKey: (
    input: BuildScopedValueCacheKeyInput
  ) => string | null;
  commandSnippetGroups: CommandSnippetGroup[];
  commandSnippetScopedValues: Record<string, CommandSnippetScopedValueRecord>;
  formatCommandSnippetVariableScopeLabel: (scope: CommandSnippetVariableScopeId) => string;
  getCommandSnippetParameterPatternError: (pattern: string) => string | null;
  guardedTerminalWrite: (
    tabId: string,
    text: string,
    options: GuardedTerminalWriteOptions
  ) => Promise<boolean>;
  mergeCommandSnippetParameters: (
    snippet: CommandSnippetItem | null,
    promptSet: CommandSnippetPromptSet | null
  ) => CommandSnippetParameter[];
  normalizeCommandSnippetScopedValues: (
    payload: Record<string, CommandSnippetScopedValueRecord>
  ) => Record<string, CommandSnippetScopedValueRecord>;
  parameterTokenPattern: RegExp;
  sessionsRef: MutableRefObject<SessionLike[]>;
  setCommandSnippetScopedValues: Dispatch<
    SetStateAction<Record<string, CommandSnippetScopedValueRecord>>
  >;
  setError: Dispatch<SetStateAction<string | null>>;
  showAppAlert: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      detailText?: string;
      translateDetailText?: boolean;
    }
  ) => Promise<void>;
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
  showAppPrompt: (
    message: string,
    defaultValue?: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      multiline?: boolean;
      detailText?: string;
    }
  ) => Promise<string | null>;
  systemApi: Window["termdock"]["system"] | null;
  terminalApi: Window["termdock"]["terminal"] | null;
  terminalTabsRef: MutableRefObject<TerminalTabLike[]>;
  upsertTerminalCommandHistoryCommand: (
    command: string,
    options?: {
      replaceEntryId?: string;
      preferredTabId?: string;
      source?: TerminalCommandHistorySource;
    }
  ) => boolean;
}

export function useCommandSnippetRuntime({
  activeTabIdRef,
  buildCommandSnippetScopedValueCacheKey,
  commandSnippetGroups,
  commandSnippetScopedValues,
  formatCommandSnippetVariableScopeLabel,
  getCommandSnippetParameterPatternError,
  guardedTerminalWrite,
  mergeCommandSnippetParameters,
  normalizeCommandSnippetScopedValues,
  parameterTokenPattern,
  sessionsRef,
  setCommandSnippetScopedValues,
  setError,
  showAppAlert,
  showAppConfirm,
  showAppPrompt,
  systemApi,
  terminalApi,
  terminalTabsRef,
  upsertTerminalCommandHistoryCommand
}: UseCommandSnippetRuntimeArgs) {
  const renderCommandSnippetTemplate = useCallback(
    async (
      template: string,
      parameterValues?: Record<string, string>
    ): Promise<{
      rendered: string;
      unresolvedParameterKeys: string[];
    }> => {
      const tabId = activeTabIdRef.current;
      const tab = tabId ? terminalTabsRef.current.find((entry) => entry.id === tabId) ?? null : null;
      const session = tab
        ? sessionsRef.current.find((entry) => entry.id === tab.sessionId) ?? null
        : null;
      const now = new Date();
      const replacements: Record<string, string> = {
        "${date}": now.toLocaleDateString(),
        "${time}": now.toLocaleTimeString(),
        "${datetime}": now.toLocaleString(),
        "${tabTitle}": tab?.title ?? "",
        "${sessionName}": session?.name ?? "",
        "${host}": session?.host ?? "",
        "${username}": session?.username ?? ""
      };
      let rendered = template;
      if (rendered.includes("${clipboard}") && systemApi?.readClipboardText) {
        try {
          replacements["${clipboard}"] = await systemApi.readClipboardText();
        } catch {
          replacements["${clipboard}"] = "";
        }
      } else {
        replacements["${clipboard}"] = "";
      }
      for (const [token, value] of Object.entries(replacements)) {
        rendered = rendered.replaceAll(token, value);
      }
      const unresolvedParameterKeys = new Set<string>();
      rendered = rendered.replaceAll(parameterTokenPattern, (_match, key) => {
        const parameterKey = typeof key === "string" ? key.trim() : "";
        if (
          parameterValues &&
          parameterKey &&
          Object.prototype.hasOwnProperty.call(parameterValues, parameterKey)
        ) {
          return parameterValues[parameterKey] ?? "";
        }
        if (parameterKey) {
          unresolvedParameterKeys.add(parameterKey);
        }
        return _match;
      });
      return {
        rendered: rendered.trim(),
        unresolvedParameterKeys: Array.from(unresolvedParameterKeys)
      };
    },
    [activeTabIdRef, parameterTokenPattern, sessionsRef, systemApi, terminalTabsRef]
  );

  const applyCommandSnippetScopedValueUpdates = useCallback(
    (updates: Array<{ cacheKey: string; value: string }>) => {
      if (updates.length === 0) {
        return;
      }
      setCommandSnippetScopedValues((prev) => {
        const next: Record<string, CommandSnippetScopedValueRecord> = { ...prev };
        let offset = 0;
        for (const update of updates) {
          if (!update.cacheKey) {
            continue;
          }
          next[update.cacheKey] = {
            value: update.value,
            updatedAt: Date.now() + offset
          };
          offset += 1;
        }
        return normalizeCommandSnippetScopedValues(next);
      });
    },
    [normalizeCommandSnippetScopedValues, setCommandSnippetScopedValues]
  );

  const collectCommandSnippetParameterValues = useCallback(
    async (
      snippet: CommandSnippetItem,
      parameters: CommandSnippetParameter[],
      groupId: string
    ): Promise<
      | {
          values: Record<string, string>;
          scopedValueUpdates: Array<{ cacheKey: string; value: string }>;
        }
      | null
    > => {
      if (parameters.length === 0) {
        return {
          values: {},
          scopedValueUpdates: []
        };
      }
      const activeTabId = activeTabIdRef.current;
      const activeTab = activeTabId
        ? terminalTabsRef.current.find((entry) => entry.id === activeTabId) ?? null
        : null;
      const sessionId = activeTab?.sessionId ?? "";
      const values: Record<string, string> = {};
      const scopedValueUpdates: Array<{ cacheKey: string; value: string }> = [];
      for (let index = 0; index < parameters.length; index += 1) {
        const parameter = parameters[index];
        const patternError = getCommandSnippetParameterPatternError(parameter.pattern);
        if (patternError) {
          await showAppAlert(
            `Snippet parameter "${parameter.label || parameter.key}" has an invalid regex pattern.\n${patternError}`,
            {
              title: "Run Snippet"
            }
          );
          return null;
        }
        const compiledPattern = parameter.pattern.trim() ? new RegExp(parameter.pattern.trim()) : null;
        const scopedValueCacheKey = buildCommandSnippetScopedValueCacheKey({
          scope: parameter.scope,
          key: parameter.key,
          snippetId: snippet.id,
          groupId,
          sessionId
        });
        const cachedValue = scopedValueCacheKey
          ? commandSnippetScopedValues[scopedValueCacheKey]?.value ?? null
          : null;
        while (true) {
          const input = await showAppPrompt(
            [
              `Provide a value for "${parameter.label || parameter.key}".`,
              parameter.required ? "This parameter is required." : "Leave blank to skip this parameter.",
              `Scope: ${formatCommandSnippetVariableScopeLabel(parameter.scope)}`,
              compiledPattern ? `Pattern: ${parameter.pattern.trim()}` : null
            ]
              .filter(Boolean)
              .join("\n"),
            cachedValue ?? parameter.defaultValue,
            {
              title: `Run Snippet: ${snippet.name}`,
              confirmLabel: index === parameters.length - 1 ? "Preview" : "Next"
            }
          );
          if (input === null) {
            return null;
          }
          if (parameter.required && !input.trim()) {
            await showAppAlert(`"${parameter.label || parameter.key}" cannot be empty.`, {
              title: "Run Snippet"
            });
            continue;
          }
          if (compiledPattern && input.trim() && !compiledPattern.test(input)) {
            await showAppAlert(
              `Value for "${parameter.label || parameter.key}" does not match:\n${parameter.pattern.trim()}`,
              {
                title: "Run Snippet"
              }
            );
            continue;
          }
          values[parameter.key] = input;
          if (scopedValueCacheKey) {
            scopedValueUpdates.push({
              cacheKey: scopedValueCacheKey,
              value: input
            });
          }
          break;
        }
      }
      return {
        values,
        scopedValueUpdates
      };
    },
    [
      activeTabIdRef,
      buildCommandSnippetScopedValueCacheKey,
      commandSnippetScopedValues,
      formatCommandSnippetVariableScopeLabel,
      getCommandSnippetParameterPatternError,
      showAppAlert,
      showAppPrompt,
      terminalTabsRef
    ]
  );

  const runCommandSnippet = useCallback(
    async (snippet: CommandSnippetItem, groupId = ""): Promise<void> => {
      if (!terminalApi) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const tabId = activeTabIdRef.current;
      if (!tabId) {
        setError("Open and focus a terminal tab before running snippets.");
        return;
      }
      const promptSet =
        commandSnippetGroups.find((group) => group.id === groupId)?.promptSets.find(
          (entry) => entry.id === snippet.promptSetId
        ) ?? null;
      const effectiveParameters = mergeCommandSnippetParameters(snippet, promptSet);
      const parameterResult = await collectCommandSnippetParameterValues(
        snippet,
        effectiveParameters,
        groupId
      );
      if (parameterResult === null) {
        return;
      }
      const { rendered, unresolvedParameterKeys } = await renderCommandSnippetTemplate(
        snippet.template,
        parameterResult.values
      );
      if (unresolvedParameterKeys.length > 0) {
        await showAppAlert(
          `Snippet template references undefined parameter token(s): ${unresolvedParameterKeys.join(", ")}`,
          {
            title: "Run Snippet"
          }
        );
        return;
      }
      if (!rendered) {
        await showAppAlert("Snippet resolved to an empty command.", {
          title: "Run Snippet"
        });
        return;
      }
      if (snippet.confirmBeforeRun || snippet.previewBeforeRun || effectiveParameters.length > 0) {
        const confirmed = await showAppConfirm(
          snippet.confirmBeforeRun
            ? `Run snippet "${snippet.name}" on current tab?`
            : `Preview generated command for snippet "${snippet.name}".`,
          {
            title: snippet.confirmBeforeRun ? "Run Snippet" : "Snippet Preview",
            confirmLabel: "Run",
            cancelLabel: "Cancel",
            detailText: rendered
          }
        );
        if (!confirmed) {
          return;
        }
      }
      const wrote = await guardedTerminalWrite(tabId, `${rendered}\n`, {
        source: "snippet",
        commandText: rendered
      });
      if (!wrote) {
        return;
      }
      applyCommandSnippetScopedValueUpdates(parameterResult.scopedValueUpdates);
      upsertTerminalCommandHistoryCommand(rendered, {
        preferredTabId: tabId,
        source: "manual"
      });
    },
    [
      activeTabIdRef,
      applyCommandSnippetScopedValueUpdates,
      collectCommandSnippetParameterValues,
      commandSnippetGroups,
      guardedTerminalWrite,
      mergeCommandSnippetParameters,
      renderCommandSnippetTemplate,
      setError,
      showAppAlert,
      showAppConfirm,
      terminalApi,
      upsertTerminalCommandHistoryCommand
    ]
  );

  return {
    runCommandSnippet
  };
}
