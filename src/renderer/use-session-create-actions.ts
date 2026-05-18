import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from "react";

import type {
  SessionCreateInput,
  SessionRecord,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../shared/session";

interface SessionGroupsStateLike {
  groups: string[];
}

interface SessionsApiLike {
  create: (input: SessionCreateInput) => Promise<SessionRecord>;
  testConnection: (input: SessionCreateInput) => Promise<SessionTestConnectionResult>;
  update: (sessionId: string, patch: SessionUpdateInput) => Promise<SessionRecord>;
}

interface UseSessionCreateActionsArgs {
  editingSession: SessionRecord | null;
  editingSessionId: string | null;
  emptyForm: SessionCreateInput;
  form: SessionCreateInput;
  formatSshConnectionError: (error: unknown) => string;
  normalizeSessionGroups: (groups: string[]) => string[];
  saving: boolean;
  sessions: SessionRecord[];
  sessionsApi: SessionsApiLike | null;
  setEditingSessionId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setForm: Dispatch<SetStateAction<SessionCreateInput>>;
  setIsCreateModalOpen: Dispatch<SetStateAction<boolean>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setSelectedSessionId: Dispatch<SetStateAction<string | null>>;
  setSessionGroupsState: Dispatch<SetStateAction<SessionGroupsStateLike>>;
  setSessions: Dispatch<SetStateAction<SessionRecord[]>>;
  setTestConnectionResult: Dispatch<SetStateAction<SessionTestConnectionResult | null>>;
  setTestingConnection: Dispatch<SetStateAction<boolean>>;
  showAppAlert: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      detailText?: string;
      translateDetailText?: boolean;
    }
  ) => Promise<void>;
  testingConnection: boolean;
  toFormFromSession: (session: SessionRecord) => SessionCreateInput;
}

export function useSessionCreateActions({
  editingSession,
  editingSessionId,
  emptyForm,
  form,
  formatSshConnectionError,
  normalizeSessionGroups,
  saving,
  sessions,
  sessionsApi,
  setEditingSessionId,
  setError,
  setForm,
  setIsCreateModalOpen,
  setSaving,
  setSelectedSessionId,
  setSessionGroupsState,
  setSessions,
  setTestConnectionResult,
  setTestingConnection,
  showAppAlert,
  testingConnection,
  toFormFromSession
}: UseSessionCreateActionsArgs) {
  const updateCreateSessionFormFields = useCallback((patch: Partial<SessionCreateInput>) => {
    setForm((prev) => ({
      ...prev,
      ...patch
    }));
  }, [setForm]);

  const openCreateModal = useCallback((groupId = "") => {
    setForm({
      ...emptyForm,
      groupId
    });
    setEditingSessionId(null);
    setTestConnectionResult(null);
    setIsCreateModalOpen(true);
    setError(null);
  }, [emptyForm, setEditingSessionId, setError, setForm, setIsCreateModalOpen, setTestConnectionResult]);

  const openEditModal = useCallback((session: SessionRecord) => {
    setForm(toFormFromSession(session));
    setEditingSessionId(session.id);
    setTestConnectionResult(null);
    setIsCreateModalOpen(true);
    setError(null);
  }, [setEditingSessionId, setError, setForm, setIsCreateModalOpen, setTestConnectionResult, toFormFromSession]);

  const buildDuplicateSessionName = useCallback((sourceName: string): string => {
    const baseName = sourceName.trim() || "Session";
    const candidateBase = `${baseName} copy`;
    const usedNames = new Set(sessions.map((session) => session.name.trim().toLowerCase()));
    if (!usedNames.has(candidateBase.toLowerCase())) {
      return candidateBase;
    }
    let suffix = 2;
    while (usedNames.has(`${candidateBase} ${suffix}`.toLowerCase())) {
      suffix += 1;
    }
    return `${candidateBase} ${suffix}`;
  }, [sessions]);

  const openDuplicateSessionModal = useCallback(
    (session: SessionRecord) => {
      setForm({
        ...toFormFromSession(session),
        name: buildDuplicateSessionName(session.name),
        secret: ""
      });
      setEditingSessionId(null);
      setTestConnectionResult(null);
      setIsCreateModalOpen(true);
      setError(null);
      if (session.authType === "password") {
        void showAppAlert("Duplicated session requires password input before saving.", {
          title: "Duplicate Session"
        });
      }
    },
    [
      buildDuplicateSessionName,
      setEditingSessionId,
      setError,
      setForm,
      setIsCreateModalOpen,
      setTestConnectionResult,
      showAppAlert,
      toFormFromSession
    ]
  );

  const closeCreateModal = useCallback(() => {
    if (saving || testingConnection) {
      return;
    }
    setEditingSessionId(null);
    setIsCreateModalOpen(false);
  }, [saving, setEditingSessionId, setIsCreateModalOpen, testingConnection]);

  const normalizeFormForSubmit = useCallback(
    (): SessionCreateInput => ({
      ...form,
      secret: form.secret?.trim(),
      groupId: form.groupId?.trim(),
      privateKeyPath:
        form.authType === "privateKey" ? form.privateKeyPath?.trim() : undefined
    }),
    [form]
  );

  const handleCreateSession = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const isEditing = Boolean(editingSessionId);
      const editingPasswordExists =
        isEditing && editingSession?.authType === "password" && editingSession.hasSecret;
      const normalizedSecret = form.secret?.trim();
      if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
        setError("Name, host and username are required.");
        return;
      }
      if (form.authType === "password" && !normalizedSecret && !editingPasswordExists) {
        setError("Password is required when auth type is password.");
        return;
      }
      if (form.authType === "privateKey" && !form.privateKeyPath?.trim()) {
        setError("Private key path is required when auth type is private key.");
        return;
      }

      setSaving(true);
      setError(null);
      try {
        if (!sessionsApi) {
          throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
        }

        const normalizedForm = normalizeFormForSubmit();
        if (isEditing && editingSessionId) {
          const patch: SessionUpdateInput = {
            name: normalizedForm.name,
            host: normalizedForm.host,
            port: normalizedForm.port,
            username: normalizedForm.username,
            authType: normalizedForm.authType,
            privateKeyPath:
              normalizedForm.authType === "privateKey"
                ? normalizedForm.privateKeyPath
                : "",
            groupId: normalizedForm.groupId,
            remark: normalizedForm.remark,
            favorite: normalizedForm.favorite
          };
          if (normalizedForm.secret) {
            patch.secret = normalizedForm.secret;
          }
          const updated = await sessionsApi.update(editingSessionId, patch);
          setSessions((prev) =>
            prev.map((session) => (session.id === updated.id ? updated : session))
          );
          if (updated.groupId?.trim()) {
            setSessionGroupsState((prev) => ({
              groups: normalizeSessionGroups([...prev.groups, updated.groupId ?? ""])
            }));
          }
          setSelectedSessionId(updated.id);
        } else {
          const created = await sessionsApi.create(normalizedForm);
          setSessions((prev) => [created, ...prev]);
          if (created.groupId?.trim()) {
            setSessionGroupsState((prev) => ({
              groups: normalizeSessionGroups([...prev.groups, created.groupId ?? ""])
            }));
          }
          setSelectedSessionId(created.id);
        }

        setForm(emptyForm);
        setEditingSessionId(null);
        setIsCreateModalOpen(false);
        setTestConnectionResult(null);
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [
      editingSession,
      editingSessionId,
      emptyForm,
      form,
      normalizeFormForSubmit,
      normalizeSessionGroups,
      sessionsApi,
      setEditingSessionId,
      setError,
      setForm,
      setIsCreateModalOpen,
      setSaving,
      setSelectedSessionId,
      setSessionGroupsState,
      setSessions,
      setTestConnectionResult
    ]
  );

  const handleTestConnection = useCallback(async () => {
    if (!sessionsApi) {
      setError("Session bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!form.host?.trim() || !form.username?.trim()) {
      setError("Host and username are required for connection test.");
      return;
    }
    if (form.authType === "password" && !form.secret?.trim()) {
      setError("Password is required for connection test.");
      return;
    }
    if (form.authType === "privateKey" && !form.privateKeyPath?.trim()) {
      setError("Private key path is required for connection test.");
      return;
    }

    setTestingConnection(true);
    setError(null);
    setTestConnectionResult(null);
    try {
      const result = await sessionsApi.testConnection(normalizeFormForSubmit());
      setTestConnectionResult(result);
    } catch (caughtError) {
      setTestConnectionResult({
        ok: false,
        message: formatSshConnectionError(caughtError)
      });
    } finally {
      setTestingConnection(false);
    }
  }, [
    form,
    formatSshConnectionError,
    normalizeFormForSubmit,
    sessionsApi,
    setError,
    setTestConnectionResult,
    setTestingConnection
  ]);

  return {
    closeCreateModal,
    handleCreateSession,
    handleTestConnection,
    openCreateModal,
    openDuplicateSessionModal,
    openEditModal,
    updateCreateSessionFormFields
  };
}
