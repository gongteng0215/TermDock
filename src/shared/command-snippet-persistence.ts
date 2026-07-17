/** Shared shapes for Phase 4 command snippet persistence. */

export type PersistedCommandSnippetVariableScopeId = "snippet" | "group" | "session" | "global";

export interface PersistedCommandSnippetItem {
  id: string;
  name: string;
  template: string;
  confirmBeforeRun: boolean;
  previewBeforeRun: boolean;
  promptSetId: string;
  parameters: PersistedCommandSnippetParameter[];
}

export interface PersistedCommandSnippetParameter {
  id: string;
  key: string;
  label: string;
  defaultValue: string;
  required: boolean;
  pattern: string;
  scope: PersistedCommandSnippetVariableScopeId;
}

export interface PersistedCommandSnippetPromptSet {
  id: string;
  name: string;
  parameters: PersistedCommandSnippetParameter[];
}

export interface PersistedCommandSnippetGroup {
  id: string;
  name: string;
  promptSets: PersistedCommandSnippetPromptSet[];
  snippets: PersistedCommandSnippetItem[];
}

export interface PersistedCommandSnippetScopedValueRecord {
  value: string;
  updatedAt: number;
}

export type PersistedCommandSnippetScopedValues = Record<
  string,
  PersistedCommandSnippetScopedValueRecord
>;
