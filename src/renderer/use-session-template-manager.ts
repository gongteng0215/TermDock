import { useCallback, useMemo, type Dispatch, type FormEvent, type SetStateAction } from "react";

import type { SessionCreateInput } from "../shared/session";

interface SessionTemplateEnvVar {
  id: string;
  key: string;
  value: string;
}

interface SessionTemplateDraft {
  templateName: string;
  sessionName: string;
  host: string;
  port: string;
  username: string;
  authType: SessionCreateInput["authType"];
  privateKeyPath: string;
  groupId: string;
  remark: string;
  favorite: boolean;
  secret: string;
  envVars: SessionTemplateEnvVar[];
}

interface SessionTemplateRecord extends SessionTemplateDraft {
  id: string;
  createdAt: number;
  updatedAt: number;
}

interface AppChoiceOption {
  value: string;
  label: string;
  danger?: boolean;
}

interface UseSessionTemplateManagerArgs {
  createClientSideId: (prefix: string) => string;
  createEmptySessionTemplateDraft: () => SessionTemplateDraft;
  createSessionTemplateDraftFromForm: (form: SessionCreateInput) => SessionTemplateDraft;
  editingSessionTemplateId: string | null;
  form: SessionCreateInput;
  maxEnvVarCount: number;
  normalizeSessionTemplateDraft: (payload: unknown) => SessionTemplateDraft;
  normalizeSessionTemplates: (payload: unknown) => SessionTemplateRecord[];
  resolveSessionTemplateToForm: (
    template: SessionTemplateDraft | SessionTemplateRecord
  ) => SessionCreateInput;
  sessionTemplates: SessionTemplateRecord[];
  setEditingSessionId: Dispatch<SetStateAction<string | null>>;
  setEditingSessionTemplateId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setForm: Dispatch<SetStateAction<SessionCreateInput>>;
  setIsCreateModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsSessionTemplateManagerOpen: Dispatch<SetStateAction<boolean>>;
  setSessionTemplateDraft: Dispatch<SetStateAction<SessionTemplateDraft>>;
  setSessionTemplateError: Dispatch<SetStateAction<string | null>>;
  setSessionTemplates: Dispatch<SetStateAction<SessionTemplateRecord[]>>;
  setTestConnectionResult: Dispatch<SetStateAction<{ ok: boolean; message: string } | null>>;
  showAppAlert: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      detailText?: string;
      translateDetailText?: boolean;
    }
  ) => Promise<void>;
  showAppChoice: (
    message: string,
    choices: AppChoiceOption[],
    options?: {
      title?: string;
      cancelLabel?: string;
      detailText?: string;
    }
  ) => Promise<string | null>;
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
  toSessionTemplateDraftFromRecord: (template: SessionTemplateRecord) => SessionTemplateDraft;
}

export function useSessionTemplateManager({
  createClientSideId,
  createEmptySessionTemplateDraft,
  createSessionTemplateDraftFromForm,
  editingSessionTemplateId,
  form,
  maxEnvVarCount,
  normalizeSessionTemplateDraft,
  normalizeSessionTemplates,
  resolveSessionTemplateToForm,
  sessionTemplates,
  setEditingSessionId,
  setEditingSessionTemplateId,
  setError,
  setForm,
  setIsCreateModalOpen,
  setIsSessionTemplateManagerOpen,
  setSessionTemplateDraft,
  setSessionTemplateError,
  setSessionTemplates,
  setTestConnectionResult,
  showAppAlert,
  showAppChoice,
  showAppConfirm,
  toSessionTemplateDraftFromRecord
}: UseSessionTemplateManagerArgs) {
  const editingSessionTemplate = useMemo(
    () => sessionTemplates.find((template) => template.id === editingSessionTemplateId) ?? null,
    [editingSessionTemplateId, sessionTemplates]
  );

  const resetSessionTemplateDraft = useCallback(() => {
    setEditingSessionTemplateId(null);
    setSessionTemplateDraft(createEmptySessionTemplateDraft());
    setSessionTemplateError(null);
  }, [createEmptySessionTemplateDraft, setEditingSessionTemplateId, setSessionTemplateDraft, setSessionTemplateError]);

  const startSessionTemplateDraftFromForm = useCallback(
    (sourceForm: SessionCreateInput) => {
      setEditingSessionTemplateId(null);
      setSessionTemplateDraft(createSessionTemplateDraftFromForm(sourceForm));
      setSessionTemplateError(null);
    },
    [
      createSessionTemplateDraftFromForm,
      setEditingSessionTemplateId,
      setSessionTemplateDraft,
      setSessionTemplateError
    ]
  );

  const loadSessionTemplateForEditing = useCallback(
    (template: SessionTemplateRecord) => {
      setEditingSessionTemplateId(template.id);
      setSessionTemplateDraft(toSessionTemplateDraftFromRecord(template));
      setSessionTemplateError(null);
    },
    [setEditingSessionTemplateId, setSessionTemplateDraft, setSessionTemplateError, toSessionTemplateDraftFromRecord]
  );

  const openSessionTemplateManager = useCallback(
    (options?: { templateId?: string | null; sourceForm?: SessionCreateInput }) => {
      const nextTemplateId = options?.templateId?.trim() || null;
      if (nextTemplateId) {
        const existing = sessionTemplates.find((template) => template.id === nextTemplateId);
        if (existing) {
          loadSessionTemplateForEditing(existing);
        } else if (options?.sourceForm) {
          startSessionTemplateDraftFromForm(options.sourceForm);
        } else {
          resetSessionTemplateDraft();
        }
      } else if (options?.sourceForm) {
        startSessionTemplateDraftFromForm(options.sourceForm);
      } else if (sessionTemplates.length > 0) {
        loadSessionTemplateForEditing(sessionTemplates[0]);
      } else {
        resetSessionTemplateDraft();
      }
      setIsSessionTemplateManagerOpen(true);
    },
    [
      loadSessionTemplateForEditing,
      resetSessionTemplateDraft,
      sessionTemplates,
      setIsSessionTemplateManagerOpen,
      startSessionTemplateDraftFromForm
    ]
  );

  const closeSessionTemplateManager = useCallback(() => {
    setIsSessionTemplateManagerOpen(false);
    setSessionTemplateError(null);
  }, [setIsSessionTemplateManagerOpen, setSessionTemplateError]);

  const updateSessionTemplateDraftFields = useCallback(
    (patch: Partial<SessionTemplateDraft>) => {
      setSessionTemplateDraft((prev) => ({
        ...prev,
        ...patch
      }));
      setSessionTemplateError(null);
    },
    [setSessionTemplateDraft, setSessionTemplateError]
  );

  const addSessionTemplateEnvVar = useCallback(() => {
    setSessionTemplateDraft((prev) => {
      if (prev.envVars.length >= maxEnvVarCount) {
        return prev;
      }
      return {
        ...prev,
        envVars: [
          ...prev.envVars,
          {
            id: createClientSideId("stv"),
            key: "",
            value: ""
          }
        ]
      };
    });
    setSessionTemplateError(null);
  }, [createClientSideId, maxEnvVarCount, setSessionTemplateDraft, setSessionTemplateError]);

  const updateSessionTemplateEnvVar = useCallback(
    (envVarId: string, patch: Partial<Pick<SessionTemplateEnvVar, "key" | "value">>) => {
      setSessionTemplateDraft((prev) => ({
        ...prev,
        envVars: prev.envVars.map((envVar) =>
          envVar.id === envVarId
            ? {
                ...envVar,
                key: patch.key ?? envVar.key,
                value: patch.value ?? envVar.value
              }
            : envVar
        )
      }));
      setSessionTemplateError(null);
    },
    [setSessionTemplateDraft, setSessionTemplateError]
  );

  const removeSessionTemplateEnvVar = useCallback(
    (envVarId: string) => {
      setSessionTemplateDraft((prev) => ({
        ...prev,
        envVars: prev.envVars.filter((envVar) => envVar.id !== envVarId)
      }));
      setSessionTemplateError(null);
    },
    [setSessionTemplateDraft, setSessionTemplateError]
  );

  const validateSessionTemplateDraft = useCallback(
    (draft: SessionTemplateDraft): SessionTemplateDraft => {
      const normalized = normalizeSessionTemplateDraft(draft);
      if (!normalized.templateName) {
        throw new Error("Template name is required.");
      }
      const envKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
      const seenKeys = new Set<string>();
      for (const envVar of normalized.envVars) {
        if (!envVar.key) {
          throw new Error("Template env var name is required.");
        }
        if (!envKeyPattern.test(envVar.key)) {
          throw new Error(
            `Invalid env var "${envVar.key}". Use letters, numbers, and underscores, and do not start with a number.`
          );
        }
        const normalizedKey = envVar.key.toLowerCase();
        if (seenKeys.has(normalizedKey)) {
          throw new Error(`Duplicate env var "${envVar.key}" in this template.`);
        }
        seenKeys.add(normalizedKey);
      }
      const conflictingTemplate = sessionTemplates.find(
        (template) =>
          template.id !== editingSessionTemplateId &&
          template.templateName.trim().toLowerCase() === normalized.templateName.toLowerCase()
      );
      if (conflictingTemplate) {
        throw new Error(`Template "${normalized.templateName}" already exists.`);
      }
      return normalized;
    },
    [editingSessionTemplateId, normalizeSessionTemplateDraft, sessionTemplates]
  );

  const saveSessionTemplateDraft = useCallback(
    (draft: SessionTemplateDraft, event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      try {
        const normalizedDraft = validateSessionTemplateDraft(draft);
        const now = Date.now();
        const nextRecord: SessionTemplateRecord = {
          id: editingSessionTemplateId ?? createClientSideId("st"),
          createdAt: editingSessionTemplate?.createdAt ?? now,
          updatedAt: now,
          ...normalizedDraft
        };
        setSessionTemplates((prev) => {
          const next =
            editingSessionTemplateId === null
              ? [nextRecord, ...prev]
              : prev.map((template) => (template.id === editingSessionTemplateId ? nextRecord : template));
          return normalizeSessionTemplates(next);
        });
        setEditingSessionTemplateId(nextRecord.id);
        setSessionTemplateDraft(toSessionTemplateDraftFromRecord(nextRecord));
        setSessionTemplateError(null);
      } catch (caughtError) {
        const message = (caughtError as Error).message;
        setSessionTemplateError(message);
        setError(message);
      }
    },
    [
      createClientSideId,
      editingSessionTemplate,
      editingSessionTemplateId,
      normalizeSessionTemplates,
      setEditingSessionTemplateId,
      setSessionTemplateDraft,
      setSessionTemplateError,
      setSessionTemplates,
      toSessionTemplateDraftFromRecord,
      validateSessionTemplateDraft
    ]
  );

  const deleteEditingSessionTemplate = useCallback(async () => {
    if (!editingSessionTemplate) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete session template "${editingSessionTemplate.templateName}"?`,
      {
        title: "Delete Session Template",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setSessionTemplates((prev) => prev.filter((template) => template.id !== editingSessionTemplate.id));
    const remaining = sessionTemplates.filter((template) => template.id !== editingSessionTemplate.id);
    if (remaining.length > 0) {
      loadSessionTemplateForEditing(remaining[0]);
    } else {
      resetSessionTemplateDraft();
    }
  }, [
    editingSessionTemplate,
    loadSessionTemplateForEditing,
    resetSessionTemplateDraft,
    sessionTemplates,
    setSessionTemplates,
    showAppConfirm
  ]);

  const applySessionTemplateToForm = useCallback(
    async (
      template: SessionTemplateRecord,
      options?: {
        openCreateModal?: boolean;
        groupId?: string;
        forceNewSession?: boolean;
      }
    ) => {
      try {
        const resolved = resolveSessionTemplateToForm(template);
        const nextGroupId = options?.groupId?.trim();
        setForm({
          ...resolved,
          groupId: nextGroupId && nextGroupId.length > 0 ? nextGroupId : resolved.groupId ?? ""
        });
        if (options?.forceNewSession) {
          setEditingSessionId(null);
        }
        setTestConnectionResult(null);
        setError(null);
        if (options?.openCreateModal) {
          setIsCreateModalOpen(true);
        }
        setIsSessionTemplateManagerOpen(false);
      } catch (caughtError) {
        await showAppAlert((caughtError as Error).message, {
          title: "Session Template"
        });
      }
    },
    [
      resolveSessionTemplateToForm,
      setEditingSessionId,
      setError,
      setForm,
      setIsCreateModalOpen,
      setIsSessionTemplateManagerOpen,
      setTestConnectionResult,
      showAppAlert
    ]
  );

  const chooseSessionTemplateAndApply = useCallback(
    async (options?: { openCreateModal?: boolean; groupId?: string; forceNewSession?: boolean }) => {
      if (sessionTemplates.length === 0) {
        await showAppAlert("No session templates available. Create one first.", {
          title: "Session Templates"
        });
        return;
      }
      const selectedTemplateId = await showAppChoice(
        "Choose session template.",
        sessionTemplates.map((template) => ({
          value: template.id,
          label: `${template.templateName}  (${template.host || "host pending"})`
        })),
        {
          title: "Session Templates",
          cancelLabel: "Cancel"
        }
      );
      if (!selectedTemplateId) {
        return;
      }
      const selectedTemplate = sessionTemplates.find((template) => template.id === selectedTemplateId) ?? null;
      if (!selectedTemplate) {
        return;
      }
      await applySessionTemplateToForm(selectedTemplate, options);
    },
    [applySessionTemplateToForm, sessionTemplates, showAppAlert, showAppChoice]
  );

  return {
    addSessionTemplateEnvVar,
    applySessionTemplateToForm,
    chooseSessionTemplateAndApply,
    closeSessionTemplateManager,
    deleteEditingSessionTemplate,
    editingSessionTemplate,
    loadSessionTemplateForEditing,
    openSessionTemplateManager,
    removeSessionTemplateEnvVar,
    resetSessionTemplateDraft,
    saveSessionTemplateDraft,
    startSessionTemplateDraftFromForm,
    updateSessionTemplateDraftFields,
    updateSessionTemplateEnvVar
  };
}
