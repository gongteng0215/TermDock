import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  SessionCreateInput,
  SessionRecord,
  SessionUpdateInput
} from "../shared/session";
import { TerminalWorkspace } from "./components/terminal-workspace";
import type { TerminalTab } from "./components/terminal-workspace";

const EMPTY_FORM: SessionCreateInput = {
  name: "",
  host: "",
  port: 22,
  username: "",
  authType: "password",
  privateKeyPath: "",
  remark: "",
  favorite: false,
  secret: ""
};

function getSafeTabInstance(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function formatTabTitle(sessionName: string, instance: number): string {
  return instance <= 1 ? sessionName : `${sessionName} (${instance})`;
}

export function App() {
  const [bridge, setBridge] = useState<Window["termdock"] | null>(
    () => window.termdock ?? null
  );
  const sessionsApi = bridge?.sessions ?? null;
  const systemApi = bridge?.system ?? null;
  const terminalApi = bridge?.terminal ?? null;

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [form, setForm] = useState<SessionCreateInput>(EMPTY_FORM);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  useEffect(() => {
    if (bridge) {
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      if (window.termdock) {
        setBridge(window.termdock);
        setError(null);
        clearInterval(interval);
        return;
      }

      attempts += 1;
      if (attempts === 30) {
        setError("Desktop bridge is not ready. Please restart `pnpm dev`.");
        setLoading(false);
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [bridge]);

  useEffect(() => {
    if (!sessionsApi) {
      return;
    }

    const load = async () => {
      try {
        const nextSessions = await sessionsApi.list();
        setSessions(nextSessions);
        if (nextSessions.length > 0) {
          setSelectedSessionId(nextSessions[0].id);
        }
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [sessionsApi]);

  useEffect(() => {
    if (terminalTabs.length === 0) {
      return;
    }

    setTerminalTabs((prev) => {
      let changed = false;
      const maxInstanceBySession = new Map<string, number>();
      const next = prev.map((tab) => {
        const rawInstance = getSafeTabInstance(tab.instance);
        const fallbackInstance = (maxInstanceBySession.get(tab.sessionId) ?? 0) + 1;
        const safeInstance = rawInstance > 0 ? rawInstance : fallbackInstance;
        maxInstanceBySession.set(
          tab.sessionId,
          Math.max(maxInstanceBySession.get(tab.sessionId) ?? 0, safeInstance)
        );

        const sessionName =
          sessions.find((session) => session.id === tab.sessionId)?.name ??
          tab.title.replace(/\s*\(NaN\)\s*$/i, "");
        const safeTitle = formatTabTitle(sessionName, safeInstance);

        if (tab.instance !== safeInstance || tab.title !== safeTitle) {
          changed = true;
          return {
            ...tab,
            instance: safeInstance,
            title: safeTitle
          };
        }
        return tab;
      });
      return changed ? next : prev;
    });
  }, [sessions, terminalTabs.length]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setTestConnectionResult(null);
    setIsCreateModalOpen(true);
    setError(null);
  };

  const closeCreateModal = () => {
    if (saving || testingConnection) {
      return;
    }
    setIsCreateModalOpen(false);
  };

  const normalizeFormForSubmit = (): SessionCreateInput => ({
    ...form,
    secret: form.secret?.trim(),
    privateKeyPath:
      form.authType === "privateKey" ? form.privateKeyPath?.trim() : undefined
  });

  const handleCreateSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      setError("Name, host and username are required.");
      return;
    }
    if (form.authType === "password" && !form.secret?.trim()) {
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

      const created = await sessionsApi.create(normalizeFormForSubmit());
      const nextSessions = [created, ...sessions];
      setSessions(nextSessions);
      setSelectedSessionId(created.id);
      setForm(EMPTY_FORM);
      setIsCreateModalOpen(false);
      setTestConnectionResult(null);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
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
        message: (caughtError as Error).message
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const openTerminalTab = (session: SessionRecord) => {
    if (!terminalApi) {
      setError("Terminal bridge unavailable. Restart `pnpm dev`.");
      return;
    }

    const id = `${session.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const existingTabs = terminalTabs.filter(
      (tab) => tab.sessionId === session.id
    );
    const nextInstance = existingTabs.reduce((max, tab) => {
      return Math.max(max, getSafeTabInstance(tab.instance));
    }, 0) + 1;
    const title = formatTabTitle(session.name, nextInstance);
    const nextTab: TerminalTab = {
      id,
      sessionId: session.id,
      title,
      instance: nextInstance
    };
    const nextTabs = [...terminalTabs, nextTab];
    setTerminalTabs(nextTabs);
    setActiveTabId(id);
  };

  const closeTerminalTab = (tabId: string) => {
    if (terminalApi) {
      void terminalApi.close(tabId);
    }

    const nextTabs = terminalTabs.filter((tab) => tab.id !== tabId);
    setTerminalTabs(nextTabs);

    if (activeTabId !== tabId) {
      return;
    }
    setActiveTabId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null);
  };

  const removeSession = async (sessionId: string) => {
    const hit = sessions.find((session) => session.id === sessionId);
    if (!hit) {
      return;
    }
    const accepted = window.confirm(`Delete session "${hit.name}"?`);
    if (!accepted) {
      return;
    }

    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }

      await sessionsApi.remove(sessionId);
      const nextSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(nextSessions);
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(nextSessions[0]?.id ?? null);
      }
      const removedTabs = terminalTabs.filter((tab) => tab.sessionId === sessionId);
      for (const tab of removedTabs) {
        if (terminalApi) {
          void terminalApi.close(tab.id);
        }
      }
      const nextTabs = terminalTabs.filter((tab) => tab.sessionId !== sessionId);
      setTerminalTabs(nextTabs);
      if (nextTabs.every((tab) => tab.id !== activeTabId)) {
        setActiveTabId(nextTabs[0]?.id ?? null);
      }
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const patchSession = async (sessionId: string, patch: SessionUpdateInput) => {
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }

      const updated = await sessionsApi.update(sessionId, patch);
      setSessions((prev) =>
        prev.map((session) => (session.id === updated.id ? updated : session))
      );
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const pickPrivateKeyFile = async () => {
    try {
      if (!systemApi) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }

      const filePath = await systemApi.pickPrivateKey();
      if (!filePath) {
        return;
      }

      setForm((prev) => ({
        ...prev,
        privateKeyPath: filePath
      }));
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <strong>TermDock</strong>
          <span>SSH + SFTP Workbench</span>
        </div>
        <div className="topbar__meta">MVP Bootstrap</div>
      </header>

      <main className="layout">
        <aside className="panel panel--left">
          <section className="panel__section">
            <div className="panel__heading">
              <h2>Sessions</h2>
              <button
                className="primary-button primary-button--small"
                onClick={openCreateModal}
                type="button"
              >
                + New
              </button>
            </div>
            {loading ? <p className="hint">Loading sessions...</p> : null}
            <ul className="session-list">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className={
                    selectedSessionId === session.id
                      ? "session-list__item is-selected"
                      : "session-list__item"
                  }
                >
                  <button
                    className="session-list__main"
                    onClick={() => setSelectedSessionId(session.id)}
                    type="button"
                  >
                    <span className="session-list__name">{session.name}</span>
                    <span className="session-list__host">
                      {session.username}@{session.host}:{session.port}
                    </span>
                  </button>
                  <div className="session-list__actions">
                    <button
                      className="icon-button"
                      onClick={() =>
                        void patchSession(session.id, { favorite: !session.favorite })
                      }
                      title={session.favorite ? "Unfavorite" : "Favorite"}
                      type="button"
                    >
                      {session.favorite ? "★" : "☆"}
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => openTerminalTab(session)}
                      title="Open terminal tab"
                      type="button"
                    >
                      Open
                    </button>
                    <button
                      className="icon-button icon-button--danger"
                      onClick={() => void removeSession(session.id)}
                      title="Delete session"
                      type="button"
                    >
                      Del
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="panel panel--center">
          <TerminalWorkspace
            activeTabId={activeTabId}
            onCloseTab={closeTerminalTab}
            onError={setError}
            onSelectTab={setActiveTabId}
            terminalApi={terminalApi}
            tabs={terminalTabs}
          />
        </section>

        <aside className="panel panel--right">
          <section className="panel__section">
            <h2>SFTP</h2>
            <p className="hint">
              Placeholder panel for remote files, transfer queue and task progress.
            </p>
          </section>

          <section className="panel__section">
            <h2>Selected Session</h2>
            {selectedSession ? (
              <dl className="session-meta">
                <div>
                  <dt>Name</dt>
                  <dd>{selectedSession.name}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>
                    {selectedSession.username}@{selectedSession.host}:
                    {selectedSession.port}
                  </dd>
                </div>
                <div>
                  <dt>Auth</dt>
                  <dd>{selectedSession.authType}</dd>
                </div>
                <div>
                  <dt>Secret</dt>
                  <dd>{selectedSession.hasSecret ? "Stored in secure vault" : "-"}</dd>
                </div>
                <div>
                  <dt>Remark</dt>
                  <dd>{selectedSession.remark || "-"}</dd>
                </div>
              </dl>
            ) : (
              <p className="hint">Pick a session from the left panel.</p>
            )}
          </section>
        </aside>
      </main>

      {isCreateModalOpen ? (
        <div
          className="modal-backdrop"
          onClick={closeCreateModal}
          role="presentation"
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create Session"
          >
            <div className="modal__header">
              <h3>Create Session</h3>
              <button className="icon-button" onClick={closeCreateModal} type="button">
                Close
              </button>
            </div>
            <form className="session-form" onSubmit={handleCreateSession}>
              <label>
                Name
                <input
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="prod-web-01"
                  value={form.name}
                />
              </label>
              <label>
                Host
                <input
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, host: event.target.value }))
                  }
                  placeholder="10.0.10.31"
                  value={form.host}
                />
              </label>
              <div className="field-grid">
                <label>
                  Port
                  <input
                    max={65535}
                    min={1}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        port: Number(event.target.value) || 22
                      }))
                    }
                    type="number"
                    value={form.port ?? 22}
                  />
                </label>
                <label>
                  Username
                  <input
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, username: event.target.value }))
                    }
                    placeholder="ec2-user"
                    value={form.username}
                  />
                </label>
              </div>
              <label>
                Auth Type
                <select
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      authType: event.target.value as SessionCreateInput["authType"]
                    }))
                  }
                  value={form.authType}
                >
                  <option value="password">Password</option>
                  <option value="privateKey">Private Key</option>
                </select>
              </label>
              {form.authType === "privateKey" ? (
                <label>
                  Private Key Path
                  <div className="field-row">
                    <input
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          privateKeyPath: event.target.value
                        }))
                      }
                      placeholder="~/.ssh/id_ed25519"
                      value={form.privateKeyPath ?? ""}
                    />
                    <button
                      className="field-row__action"
                      onClick={() => void pickPrivateKeyFile()}
                      type="button"
                    >
                      Choose File
                    </button>
                  </div>
                </label>
              ) : null}
              <label>
                {form.authType === "password" ? "Password" : "Key Passphrase (Optional)"}
                <input
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, secret: event.target.value }))
                  }
                  placeholder={
                    form.authType === "password"
                      ? "Password stored in OS secure vault"
                      : "Optional passphrase"
                  }
                  type="password"
                  value={form.secret ?? ""}
                />
              </label>
              <label>
                Remark
                <input
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, remark: event.target.value }))
                  }
                  placeholder="web production host"
                  value={form.remark ?? ""}
                />
              </label>

              {testConnectionResult ? (
                <p
                  className={
                    testConnectionResult.ok
                      ? "hint test-result test-result--ok"
                      : "hint test-result test-result--error"
                  }
                >
                  {testConnectionResult.message}
                </p>
              ) : null}

              <div className="modal__actions">
                <button
                  className="icon-button"
                  disabled={saving || testingConnection}
                  onClick={closeCreateModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="field-row__action"
                  disabled={saving || testingConnection}
                  onClick={() => void handleTestConnection()}
                  type="button"
                >
                  {testingConnection ? "Testing..." : "Test Connection"}
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? "Saving..." : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {error ? <div className="error-bar">{error}</div> : null}
    </div>
  );
}
