import type { CommandSnippetManagerModalProps } from "./components/command-snippet-manager-modal";

interface BuildCommandSnippetManagerModalPropsArgs
  extends Omit<
    CommandSnippetManagerModalProps,
    | "onClearAll"
    | "onClearScopedValues"
    | "onDeleteGroup"
    | "onDeleteSelectedPromptSet"
    | "onDeleteSnippet"
    | "onExportJson"
    | "onRunSelectedSnippet"
  > {
  clearAllCommandSnippetGroups: () => Promise<void>;
  clearCommandSnippetScopedValues: () => Promise<void>;
  deleteCommandSnippetManagerGroup: () => Promise<void>;
  deleteCommandSnippetManagerSnippet: () => Promise<void>;
  deleteSelectedCommandSnippetManagerPromptSet: () => Promise<void>;
  exportCommandSnippetGroups: () => Promise<void>;
  runSelectedCommandSnippetManagerSnippet: () => Promise<void>;
}

export function buildCommandSnippetManagerModalProps({
  clearAllCommandSnippetGroups,
  clearCommandSnippetScopedValues,
  deleteCommandSnippetManagerGroup,
  deleteCommandSnippetManagerSnippet,
  deleteSelectedCommandSnippetManagerPromptSet,
  exportCommandSnippetGroups,
  runSelectedCommandSnippetManagerSnippet,
  ...modalProps
}: BuildCommandSnippetManagerModalPropsArgs): CommandSnippetManagerModalProps {
  return {
    ...modalProps,
    onClearAll: () => {
      void clearAllCommandSnippetGroups();
    },
    onClearScopedValues: () => {
      void clearCommandSnippetScopedValues();
    },
    onDeleteGroup: () => {
      void deleteCommandSnippetManagerGroup();
    },
    onDeleteSelectedPromptSet: () => {
      void deleteSelectedCommandSnippetManagerPromptSet();
    },
    onDeleteSnippet: () => {
      void deleteCommandSnippetManagerSnippet();
    },
    onExportJson: () => {
      void exportCommandSnippetGroups();
    },
    onRunSelectedSnippet: () => {
      void runSelectedCommandSnippetManagerSnippet();
    }
  };
}
