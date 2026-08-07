import type { FormEvent } from "react";
import type { SessionAuthType } from "../../shared/session";

interface SessionTemplateEnvVarView {
  id: string;
  key: string;
  value: string;
}

interface SessionTemplateDraftView {
  templateName: string;
  sessionName: string;
  host: string;
  port: string;
  username: string;
  authType: SessionAuthType;
  privateKeyPath: string;
  groupId: string;
  remark: string;
  favorite: boolean;
  secret: string;
  envVars: SessionTemplateEnvVarView[];
}

interface SessionTemplateRecordView extends SessionTemplateDraftView {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionTemplateManagerModalProps {
  open: boolean;
  draft: SessionTemplateDraftView;
  editingTemplate: SessionTemplateRecordView | null;
  editingTemplateId: string | null;
  error: string | null;
  maxEnvVarCount: number;
  maxTemplateCount: number;
  onAddEnvVar: () => void;
  onClose: () => void;
  onDeleteEditingTemplate: () => void;
  onDraftFieldChange: (patch: Partial<SessionTemplateDraftView>) => void;
  onRemoveEnvVar: (envVarId: string) => void;
  onResetDraft: () => void;
  onSelectTemplate: (template: SessionTemplateRecordView) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateEnvVar: (
    envVarId: string,
    patch: Partial<Pick<SessionTemplateEnvVarView, "key" | "value">>
  ) => void;
  onUseCurrentForm: () => void;
  onUseEditingTemplate: () => void;
  templates: SessionTemplateRecordView[];
}

export function SessionTemplateManagerModal({
  open,
  draft,
  editingTemplate,
  editingTemplateId,
  error,
  maxEnvVarCount,
  maxTemplateCount,
  onAddEnvVar,
  onClose,
  onDeleteEditingTemplate,
  onDraftFieldChange,
  onRemoveEnvVar,
  onResetDraft,
  onSelectTemplate,
  onSubmit,
  onUpdateEnvVar,
  onUseCurrentForm,
  onUseEditingTemplate,
  templates
}: SessionTemplateManagerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal modal--wide"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Session Templates"
      >
        <div className="modal__header">
          <h3>Session Templates</h3>
          <button className="icon-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="session-template-manager">
          <aside className="session-template-manager__sidebar">
            <div className="session-template-manager__sidebar-actions">
              <button className="field-row__action" onClick={onResetDraft} type="button">
                New Blank
              </button>
              <button className="field-row__action" onClick={onUseCurrentForm} type="button">
                Use Current Form
              </button>
            </div>
            <p className="hint">
              Use {"${ENV_NAME}"} placeholders in host, name, user, group, remark, secret, and key
              path fields.
            </p>
            {templates.length === 0 ? (
              <p className="hint">No saved templates yet.</p>
            ) : (
              <ul className="session-template-list">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      className={
                        editingTemplateId === template.id
                          ? "session-template-list__item is-selected"
                          : "session-template-list__item"
                      }
                      onClick={() => onSelectTemplate(template)}
                      type="button"
                    >
                      <span className="session-template-list__name">{template.templateName}</span>
                      <span className="session-template-list__meta">
                        {(template.host || "host pending") +
                          (template.username ? ` · ${template.username}` : "")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="hint">
              Saved templates {templates.length}/{maxTemplateCount}
            </p>
          </aside>
          <form className="session-form session-template-manager__editor" onSubmit={onSubmit}>
            <label>
              Template Name
              <input
                onChange={(event) => onDraftFieldChange({ templateName: event.target.value })}
                placeholder="Prod Web Template"
                value={draft.templateName}
              />
            </label>
            <div className="field-grid">
              <label>
                Session Name
                <input
                  onChange={(event) => onDraftFieldChange({ sessionName: event.target.value })}
                  placeholder="web-${ENV}-${INDEX}"
                  value={draft.sessionName}
                />
              </label>
              <label>
                Port
                <input
                  onChange={(event) => onDraftFieldChange({ port: event.target.value })}
                  placeholder="22"
                  value={draft.port}
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                Host
                <input
                  onChange={(event) => onDraftFieldChange({ host: event.target.value })}
                  placeholder="${HOST}"
                  value={draft.host}
                />
              </label>
              <label>
                Username
                <input
                  onChange={(event) => onDraftFieldChange({ username: event.target.value })}
                  placeholder="deploy"
                  value={draft.username}
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                Group
                <input
                  onChange={(event) => onDraftFieldChange({ groupId: event.target.value })}
                  placeholder="${ENV}"
                  value={draft.groupId}
                />
              </label>
              <label>
                Auth Type
                <select
                  onChange={(event) =>
                    onDraftFieldChange({ authType: event.target.value as SessionAuthType })
                  }
                  value={draft.authType}
                >
              <option value="password">Password</option>
              <option value="privateKey">Private Key</option>
              <option value="agent">SSH Agent</option>
              <option value="keyboardInteractive">Keyboard Interactive / MFA</option>
                </select>
              </label>
            </div>
            {draft.authType === "privateKey" ? (
              <label>
                Private Key Path
                <input
                  onChange={(event) => onDraftFieldChange({ privateKeyPath: event.target.value })}
                  placeholder="~/.ssh/${KEY_NAME}"
                  value={draft.privateKeyPath}
                />
              </label>
            ) : null}
            <label>
              {draft.authType === "password" ? "Password / Secret" : "Key Passphrase"}
              <input
                onChange={(event) => onDraftFieldChange({ secret: event.target.value })}
                placeholder={
                  draft.authType === "password" ? "${SSH_PASSWORD}" : "${KEY_PASSPHRASE}"
                }
                type="password"
                value={draft.secret}
              />
            </label>
            <label className="settings-checkbox">
              <input
                checked={draft.favorite}
                onChange={(event) => onDraftFieldChange({ favorite: event.target.checked })}
                type="checkbox"
              />
              Mark created sessions as favorite
            </label>
            <label>
              Remark
              <input
                onChange={(event) => onDraftFieldChange({ remark: event.target.value })}
                placeholder="Managed by ${OWNER}"
                value={draft.remark}
              />
            </label>
            <section className="session-template-env-vars">
              <div className="session-template-env-vars__header">
                <div>
                  <h4>Template Env Vars</h4>
                  <p className="hint">
                    {draft.envVars.length}/{maxEnvVarCount} saved values
                  </p>
                </div>
                <button
                  className="field-row__action"
                  disabled={draft.envVars.length >= maxEnvVarCount}
                  onClick={onAddEnvVar}
                  type="button"
                >
                  Add Variable
                </button>
              </div>
              {draft.envVars.length === 0 ? (
                <p className="hint">No template env vars yet.</p>
              ) : (
                <div className="session-template-env-vars__list">
                  {draft.envVars.map((envVar) => (
                    <div className="session-template-env-vars__row" key={envVar.id}>
                      <input
                        onChange={(event) =>
                          onUpdateEnvVar(envVar.id, {
                            key: event.target.value
                          })
                        }
                        placeholder="ENV_NAME"
                        value={envVar.key}
                      />
                      <input
                        onChange={(event) =>
                          onUpdateEnvVar(envVar.id, {
                            value: event.target.value
                          })
                        }
                        placeholder="value"
                        value={envVar.value}
                      />
                      <button
                        className="icon-button"
                        onClick={() => onRemoveEnvVar(envVar.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {error ? <p className="hint test-result test-result--error">{error}</p> : null}
            <div className="modal__actions">
              <button className="icon-button" onClick={onClose} type="button">
                Close
              </button>
              <button
                className="field-row__action"
                disabled={!editingTemplate}
                onClick={onUseEditingTemplate}
                type="button"
              >
                Use Template
              </button>
              <button
                className="field-row__action"
                disabled={!editingTemplate}
                onClick={onDeleteEditingTemplate}
                type="button"
              >
                Delete Template
              </button>
              <button className="primary-button" type="submit">
                {editingTemplate ? "Save Changes" : "Save Template"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
