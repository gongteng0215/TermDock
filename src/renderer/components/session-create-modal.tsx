import type { FormEvent } from "react";

import type { SessionCreateInput } from "../../shared/session";

interface SessionCreateModalProps {
  open: boolean;
  editingSessionId: string | null;
  form: SessionCreateInput;
  groupOptions: string[];
  maxTemplateCount: number;
  sessionTemplateCount: number;
  saving: boolean;
  testConnectionResult: {
    ok: boolean;
    message: string;
  } | null;
  testingConnection: boolean;
  onApplyTemplate: () => void;
  onClose: () => void;
  onFormChange: (patch: Partial<SessionCreateInput>) => void;
  onManageTemplates: () => void;
  onPickPrivateKeyFile: () => void;
  onSaveAsTemplate: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTestConnection: () => void;
}

export function SessionCreateModal({
  open,
  editingSessionId,
  form,
  groupOptions,
  maxTemplateCount,
  sessionTemplateCount,
  saving,
  testConnectionResult,
  testingConnection,
  onApplyTemplate,
  onClose,
  onFormChange,
  onManageTemplates,
  onPickPrivateKeyFile,
  onSaveAsTemplate,
  onSubmit,
  onTestConnection
}: SessionCreateModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editingSessionId ? "Edit Session" : "Create Session"}
      >
        <div className="modal__header">
          <h3>{editingSessionId ? "Edit Session" : "Create Session"}</h3>
          <button className="icon-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <form className="session-form" onSubmit={onSubmit}>
          <div className="session-template-tools">
            <div className="session-template-tools__summary">
              <strong>Template Tools</strong>
              <span className="hint">
                Saved templates {sessionTemplateCount}/{maxTemplateCount}
              </span>
            </div>
            <div className="session-template-tools__actions">
              <button
                className="field-row__action"
                disabled={sessionTemplateCount === 0}
                onClick={onApplyTemplate}
                type="button"
              >
                Apply Template...
              </button>
              <button className="field-row__action" onClick={onSaveAsTemplate} type="button">
                Save as Template...
              </button>
              <button className="field-row__action" onClick={onManageTemplates} type="button">
                Manage Templates...
              </button>
            </div>
          </div>
          <label>
            Name
            <input
              onChange={(event) => onFormChange({ name: event.target.value })}
              placeholder="prod-web-01"
              value={form.name}
            />
          </label>
          <label>
            Host
            <input
              onChange={(event) => onFormChange({ host: event.target.value })}
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
                  onFormChange({
                    port: Number(event.target.value) || 22
                  })
                }
                type="number"
                value={form.port ?? 22}
              />
            </label>
            <label>
              Username
              <input
                onChange={(event) => onFormChange({ username: event.target.value })}
                placeholder="ec2-user"
                value={form.username}
              />
            </label>
          </div>
          <label>
            Group
            <select
              onChange={(event) => onFormChange({ groupId: event.target.value })}
              value={form.groupId ?? ""}
            >
              <option value="">Ungrouped</option>
              {groupOptions.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Auth Type
            <select
              onChange={(event) =>
                onFormChange({
                  authType: event.target.value as SessionCreateInput["authType"]
                })
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
                  onChange={(event) => onFormChange({ privateKeyPath: event.target.value })}
                  placeholder="~/.ssh/id_ed25519"
                  value={form.privateKeyPath ?? ""}
                />
                <button className="field-row__action" onClick={onPickPrivateKeyFile} type="button">
                  Choose File
                </button>
              </div>
            </label>
          ) : null}
          <label>
            {form.authType === "password" ? "Password" : "Key Passphrase (Optional)"}
            <input
              onChange={(event) => onFormChange({ secret: event.target.value })}
              placeholder={
                form.authType === "password"
                  ? editingSessionId
                    ? "Leave blank to keep current password"
                    : "Password stored in OS secure vault"
                  : "Optional passphrase"
              }
              type="password"
              value={form.secret ?? ""}
            />
          </label>
          <label>
            Remark
            <input
              onChange={(event) => onFormChange({ remark: event.target.value })}
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
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="field-row__action"
              disabled={saving || testingConnection}
              onClick={onTestConnection}
              type="button"
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </button>
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? "Saving..." : editingSessionId ? "Save Changes" : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
