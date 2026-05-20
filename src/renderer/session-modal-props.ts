import type { FormEvent } from "react";

import type { SessionCreateInput } from "../shared/session";
import type { SessionCreateModalProps } from "./components/session-create-modal";
import type { SessionTemplateManagerModalProps } from "./components/session-template-manager-modal";

interface BuildSessionCreateModalPropsArgs
  extends Omit<
    SessionCreateModalProps,
    "onApplyTemplate" | "onManageTemplates" | "onPickPrivateKeyFile" | "onSaveAsTemplate" | "onTestConnection"
  > {
  chooseSessionTemplateAndApply: () => Promise<void>;
  handleTestConnection: () => Promise<void>;
  openSessionTemplateManager: (options?: { sourceForm?: SessionCreateInput }) => void;
  pickPrivateKeyFile: () => Promise<void>;
}

export function buildSessionCreateModalProps({
  chooseSessionTemplateAndApply,
  form,
  handleTestConnection,
  openSessionTemplateManager,
  pickPrivateKeyFile,
  ...modalProps
}: BuildSessionCreateModalPropsArgs): SessionCreateModalProps {
  return {
    ...modalProps,
    form,
    onApplyTemplate: () => {
      void chooseSessionTemplateAndApply();
    },
    onManageTemplates: () => openSessionTemplateManager(),
    onPickPrivateKeyFile: () => {
      void pickPrivateKeyFile();
    },
    onSaveAsTemplate: () =>
      openSessionTemplateManager({
        sourceForm: form
      }),
    onTestConnection: () => {
      void handleTestConnection();
    }
  };
}

interface BuildSessionTemplateManagerModalPropsArgs
  extends Omit<
    SessionTemplateManagerModalProps,
    "onDeleteEditingTemplate" | "onSubmit" | "onUseCurrentForm" | "onUseEditingTemplate"
  > {
  applySessionTemplateToForm: (
    template: NonNullable<SessionTemplateManagerModalProps["editingTemplate"]>,
    options?: { openCreateModal?: boolean; forceNewSession?: boolean }
  ) => Promise<void>;
  deleteEditingSessionTemplate: () => Promise<void>;
  form: SessionCreateInput;
  isCreateModalOpen: boolean;
  saveSessionTemplateDraft: (
    draft: SessionTemplateManagerModalProps["draft"],
    event: FormEvent<HTMLFormElement>
  ) => void;
  startSessionTemplateDraftFromForm: (form: SessionCreateInput) => void;
}

export function buildSessionTemplateManagerModalProps({
  applySessionTemplateToForm,
  deleteEditingSessionTemplate,
  editingTemplate,
  form,
  isCreateModalOpen,
  saveSessionTemplateDraft,
  startSessionTemplateDraftFromForm,
  draft,
  ...modalProps
}: BuildSessionTemplateManagerModalPropsArgs): SessionTemplateManagerModalProps {
  return {
    ...modalProps,
    draft,
    editingTemplate,
    onDeleteEditingTemplate: () => {
      void deleteEditingSessionTemplate();
    },
    onSubmit: (event) => saveSessionTemplateDraft(draft, event),
    onUseCurrentForm: () => startSessionTemplateDraftFromForm(form),
    onUseEditingTemplate: () => {
      if (!editingTemplate) {
        return;
      }
      void applySessionTemplateToForm(editingTemplate, {
        openCreateModal: true,
        forceNewSession: !isCreateModalOpen
      });
    }
  };
}
