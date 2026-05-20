import { UiIcon } from "./ui-icon";

import type {
  CommandSnippetGroup,
  CommandSnippetItem,
  CommandSnippetParameter,
  CommandSnippetPromptSet,
  CommandSnippetVariableScopeId
} from "../command-snippets";

type CommandSnippetParameterView = CommandSnippetParameter;
type CommandSnippetPromptSetView = CommandSnippetPromptSet;
type CommandSnippetItemView = CommandSnippetItem;
type CommandSnippetGroupView = CommandSnippetGroup;

interface CommandSnippetVariableScopeOption {
  id: CommandSnippetVariableScopeId;
  label: string;
}

export interface CommandSnippetManagerModalProps {
  open: boolean;
  onClose: () => void;
  groupCount: number;
  maxGroupCount: number;
  totalSnippetCount: number;
  totalPromptSetCount: number;
  scopedValueCount: number;
  maxSnippetsPerGroup: number;
  maxPromptSets: number;
  maxParameters: number;
  groups: CommandSnippetGroupView[];
  selectedGroup: CommandSnippetGroupView | null;
  selectedSnippet: CommandSnippetItemView | null;
  selectedPromptSet: CommandSnippetPromptSetView | null;
  scopeOptions: CommandSnippetVariableScopeOption[];
  selectedSnippetHasInvalidPattern: boolean;
  missingParameterKeys: string[];
  shadowedPromptSetKeys: string[];
  unusedParameterKeys: string[];
  onAddGroup: () => void;
  onDeleteGroup: () => void;
  onAddSnippet: () => void;
  onRunSelectedSnippet: () => void;
  onDeleteSnippet: () => void;
  onImportJson: () => void;
  onExportJson: () => void;
  onClearScopedValues: () => void;
  onClearAll: () => void;
  onSelectGroup: (groupId: string) => void;
  onGroupNameChange: (groupId: string, nextName: string) => void;
  onSelectedGroupNameBlur: () => void;
  onSelectSnippet: (snippetId: string) => void;
  onRunSnippet: (snippetId: string) => void;
  onSnippetNameChange: (snippetId: string, nextName: string) => void;
  onSelectedSnippetNameBlur: () => void;
  onSnippetTemplateChange: (snippetId: string, nextTemplate: string) => void;
  onSnippetConfirmChange: (snippetId: string, nextConfirmBeforeRun: boolean) => void;
  onSnippetPreviewChange: (snippetId: string, nextPreviewBeforeRun: boolean) => void;
  onSnippetPromptSetChange: (snippetId: string, nextPromptSetId: string) => void;
  onAddPromptSet: () => void;
  onDeleteSelectedPromptSet: () => void;
  onPromptSetNameChange: (promptSetId: string, nextName: string) => void;
  onSelectedPromptSetNameBlur: () => void;
  onAddPromptSetParameter: () => void;
  onPromptSetParameterKeyChange: (
    promptSetId: string,
    parameterId: string,
    nextKey: string
  ) => void;
  onPromptSetParameterLabelChange: (
    promptSetId: string,
    parameterId: string,
    nextLabel: string
  ) => void;
  onPromptSetParameterDefaultChange: (
    promptSetId: string,
    parameterId: string,
    nextDefaultValue: string
  ) => void;
  onPromptSetParameterPatternChange: (
    promptSetId: string,
    parameterId: string,
    nextPattern: string
  ) => void;
  onPromptSetParameterScopeChange: (
    promptSetId: string,
    parameterId: string,
    nextScope: CommandSnippetVariableScopeId
  ) => void;
  onPromptSetParameterRequiredChange: (
    promptSetId: string,
    parameterId: string,
    nextRequired: boolean
  ) => void;
  onDeletePromptSetParameter: (promptSetId: string, parameterId: string) => void;
  onInsertPromptSetParameterToken: (snippetId: string, parameterKey: string) => void;
  onAddSnippetParameter: () => void;
  onSnippetParameterKeyChange: (
    snippetId: string,
    parameterId: string,
    nextKey: string
  ) => void;
  onSnippetParameterLabelChange: (
    snippetId: string,
    parameterId: string,
    nextLabel: string
  ) => void;
  onSnippetParameterDefaultChange: (
    snippetId: string,
    parameterId: string,
    nextDefaultValue: string
  ) => void;
  onSnippetParameterPatternChange: (
    snippetId: string,
    parameterId: string,
    nextPattern: string
  ) => void;
  onSnippetParameterScopeChange: (
    snippetId: string,
    parameterId: string,
    nextScope: CommandSnippetVariableScopeId
  ) => void;
  onSnippetParameterRequiredChange: (
    snippetId: string,
    parameterId: string,
    nextRequired: boolean
  ) => void;
  onDeleteSnippetParameter: (snippetId: string, parameterId: string) => void;
  onInsertSnippetParameterToken: (snippetId: string, parameterKey: string) => void;
  buildParameterToken: (key: string) => string;
  formatScopeLabel: (scope: CommandSnippetVariableScopeId) => string;
  getPatternError: (pattern: string) => string | null;
}

export function CommandSnippetManagerModal({
  open,
  onClose,
  groupCount,
  maxGroupCount,
  totalSnippetCount,
  totalPromptSetCount,
  scopedValueCount,
  maxSnippetsPerGroup,
  maxPromptSets,
  maxParameters,
  groups,
  selectedGroup,
  selectedSnippet,
  selectedPromptSet,
  scopeOptions,
  selectedSnippetHasInvalidPattern,
  missingParameterKeys,
  shadowedPromptSetKeys,
  unusedParameterKeys,
  onAddGroup,
  onDeleteGroup,
  onAddSnippet,
  onRunSelectedSnippet,
  onDeleteSnippet,
  onImportJson,
  onExportJson,
  onClearScopedValues,
  onClearAll,
  onSelectGroup,
  onGroupNameChange,
  onSelectedGroupNameBlur,
  onSelectSnippet,
  onRunSnippet,
  onSnippetNameChange,
  onSelectedSnippetNameBlur,
  onSnippetTemplateChange,
  onSnippetConfirmChange,
  onSnippetPreviewChange,
  onSnippetPromptSetChange,
  onAddPromptSet,
  onDeleteSelectedPromptSet,
  onPromptSetNameChange,
  onSelectedPromptSetNameBlur,
  onAddPromptSetParameter,
  onPromptSetParameterKeyChange,
  onPromptSetParameterLabelChange,
  onPromptSetParameterDefaultChange,
  onPromptSetParameterPatternChange,
  onPromptSetParameterScopeChange,
  onPromptSetParameterRequiredChange,
  onDeletePromptSetParameter,
  onInsertPromptSetParameterToken,
  onAddSnippetParameter,
  onSnippetParameterKeyChange,
  onSnippetParameterLabelChange,
  onSnippetParameterDefaultChange,
  onSnippetParameterPatternChange,
  onSnippetParameterScopeChange,
  onSnippetParameterRequiredChange,
  onDeleteSnippetParameter,
  onInsertSnippetParameterToken,
  buildParameterToken,
  formatScopeLabel,
  getPatternError
}: CommandSnippetManagerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label="Command Snippet Manager"
        aria-modal="true"
        className="modal modal--snippet-manager"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h3>Command Snippet Manager</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="hint snippet-manager__summary">
          Groups {groupCount}/{maxGroupCount} | Snippets {totalSnippetCount} | Prompt Sets{" "}
          {totalPromptSetCount} | Remembered Scoped Values {scopedValueCount}
        </p>
        <div className="snippet-manager__toolbar">
          <button className="secondary-button secondary-button--small" onClick={onAddGroup} type="button">
            New Group
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!selectedGroup}
            onClick={onDeleteGroup}
            type="button"
          >
            Delete Group
          </button>
          <button className="secondary-button secondary-button--small" onClick={onAddSnippet} type="button">
            New Snippet
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!selectedSnippet || selectedSnippetHasInvalidPattern}
            onClick={onRunSelectedSnippet}
            type="button"
          >
            Run Selected
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!selectedSnippet}
            onClick={onDeleteSnippet}
            type="button"
          >
            Delete Snippet
          </button>
          <button className="secondary-button secondary-button--small" onClick={onImportJson} type="button">
            Import JSON
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={groups.length === 0}
            onClick={onExportJson}
            type="button"
          >
            Export JSON
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={scopedValueCount === 0}
            onClick={onClearScopedValues}
            type="button"
          >
            Clear Scoped Values
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={groups.length === 0}
            onClick={onClearAll}
            type="button"
          >
            Clear All
          </button>
        </div>
        <div className="snippet-manager__layout">
          <section className="snippet-manager__column">
            <h4 className="snippet-manager__title">Groups</h4>
            <label className="snippet-manager__field">
              Group Name
              <input
                disabled={!selectedGroup}
                onBlur={onSelectedGroupNameBlur}
                onChange={(event) => {
                  if (!selectedGroup) {
                    return;
                  }
                  onGroupNameChange(selectedGroup.id, event.target.value);
                }}
                type="text"
                value={selectedGroup?.name ?? ""}
              />
            </label>
            <div className="snippet-manager__list-shell">
              {groups.length === 0 ? (
                <p className="hint snippet-manager__empty">No snippet groups.</p>
              ) : (
                <ul className="snippet-manager__list">
                  {groups.map((group) => (
                    <li key={group.id}>
                      <button
                        className={
                          group.id === selectedGroup?.id
                            ? "snippet-manager__list-button is-active"
                            : "snippet-manager__list-button"
                        }
                        onClick={() => onSelectGroup(group.id)}
                        type="button"
                      >
                        <span>{group.name.trim() || "Unnamed Group"}</span>
                        <span className="snippet-manager__count">{group.snippets.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section className="snippet-manager__column">
            <h4 className="snippet-manager__title">
              Snippets ({selectedGroup?.snippets.length ?? 0}/{maxSnippetsPerGroup})
            </h4>
            <p className="hint snippet-manager__meta">Double-click to run snippet directly.</p>
            <div className="snippet-manager__list-shell">
              {!selectedGroup ? (
                <p className="hint snippet-manager__empty">Select a group first.</p>
              ) : selectedGroup.snippets.length === 0 ? (
                <p className="hint snippet-manager__empty">No snippets in selected group.</p>
              ) : (
                <ul className="snippet-manager__list">
                  {selectedGroup.snippets.map((snippet) => (
                    <li key={snippet.id}>
                      <button
                        className={
                          snippet.id === selectedSnippet?.id
                            ? "snippet-manager__list-button is-active"
                            : "snippet-manager__list-button"
                        }
                        onClick={() => onSelectSnippet(snippet.id)}
                        onDoubleClick={() => {
                          onSelectSnippet(snippet.id);
                          onRunSnippet(snippet.id);
                        }}
                        type="button"
                      >
                        <span>{snippet.name.trim() || "Unnamed Snippet"}</span>
                        <span className="snippet-manager__count">
                          {[
                            snippet.parameters.length > 0 ? `V${snippet.parameters.length}` : "",
                            snippet.promptSetId ? "PS" : "",
                            snippet.previewBeforeRun ? "P" : "",
                            snippet.confirmBeforeRun ? "C" : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section className="snippet-manager__editor">
            <h4 className="snippet-manager__title">Editor</h4>
            {selectedSnippet ? (
              <>
                <label className="snippet-manager__field">
                  Snippet Name
                  <input
                    onBlur={onSelectedSnippetNameBlur}
                    onChange={(event) => onSnippetNameChange(selectedSnippet.id, event.target.value)}
                    type="text"
                    value={selectedSnippet.name}
                  />
                </label>
                <label className="snippet-manager__field">
                  Command Template
                  <textarea
                    className="snippet-manager__textarea"
                    onChange={(event) => onSnippetTemplateChange(selectedSnippet.id, event.target.value)}
                    value={selectedSnippet.template}
                  />
                </label>
                <label className="settings-checkbox">
                  <input
                    checked={selectedSnippet.confirmBeforeRun}
                    onChange={(event) =>
                      onSnippetConfirmChange(selectedSnippet.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Require confirmation before run</span>
                </label>
                <label className="settings-checkbox">
                  <input
                    checked={selectedSnippet.previewBeforeRun}
                    onChange={(event) =>
                      onSnippetPreviewChange(selectedSnippet.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Always preview resolved command before run</span>
                </label>
                <div className="snippet-manager__parameter-header">
                  <h5 className="snippet-manager__subtitle">
                    Prompt Set ({selectedGroup?.promptSets.length ?? 0}/{maxPromptSets})
                  </h5>
                  <div className="snippet-manager__parameter-actions">
                    <button
                      className="secondary-button secondary-button--small"
                      disabled={!selectedGroup || selectedGroup.promptSets.length >= maxPromptSets}
                      onClick={onAddPromptSet}
                      type="button"
                    >
                      New Prompt Set
                    </button>
                    <button
                      className="secondary-button secondary-button--small"
                      disabled={!selectedPromptSet}
                      onClick={onDeleteSelectedPromptSet}
                      type="button"
                    >
                      Delete Prompt Set
                    </button>
                  </div>
                </div>
                <label className="snippet-manager__field">
                  Reusable Prompt Set
                  <select
                    onChange={(event) =>
                      onSnippetPromptSetChange(selectedSnippet.id, event.target.value)
                    }
                    value={selectedSnippet.promptSetId}
                  >
                    <option value="">None</option>
                    {(selectedGroup?.promptSets ?? []).map((promptSet) => (
                      <option key={promptSet.id} value={promptSet.id}>
                        {promptSet.name.trim() || "Unnamed Prompt Set"}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="hint snippet-manager__meta">
                  Prompt sets are shared within the selected group. Snippet variables can still
                  override prompt-set keys for one-off cases.
                </p>
                {selectedPromptSet ? (
                  <>
                    <label className="snippet-manager__field">
                      Prompt Set Name
                      <input
                        onBlur={onSelectedPromptSetNameBlur}
                        onChange={(event) =>
                          onPromptSetNameChange(selectedPromptSet.id, event.target.value)
                        }
                        type="text"
                        value={selectedPromptSet.name}
                      />
                    </label>
                    <div className="snippet-manager__parameter-header">
                      <h5 className="snippet-manager__subtitle">
                        Prompt Set Variables ({selectedPromptSet.parameters.length}/{maxParameters})
                      </h5>
                      <button
                        className="secondary-button secondary-button--small"
                        disabled={selectedPromptSet.parameters.length >= maxParameters}
                        onClick={onAddPromptSetParameter}
                        type="button"
                      >
                        Add Variable
                      </button>
                    </div>
                    {selectedPromptSet.parameters.length === 0 ? (
                      <p className="hint snippet-manager__meta">
                        Use prompt sets for values reused by multiple snippets in this group. Group
                        scope is the default, but you can widen it to session/global.
                      </p>
                    ) : (
                      <div className="snippet-manager__parameter-list">
                        {selectedPromptSet.parameters.map((parameter) => (
                          <SnippetParameterCard
                            buildParameterToken={buildParameterToken}
                            deleteButtonLabel="Delete Variable"
                            formatScopeLabel={formatScopeLabel}
                            getPatternError={getPatternError}
                            key={parameter.id}
                            onDefaultChange={(parameterId, nextDefaultValue) =>
                              onPromptSetParameterDefaultChange(
                                selectedPromptSet.id,
                                parameterId,
                                nextDefaultValue
                              )
                            }
                            onDelete={(parameterId) =>
                              onDeletePromptSetParameter(selectedPromptSet.id, parameterId)
                            }
                            onInsertToken={(parameterKey) =>
                              onInsertPromptSetParameterToken(selectedSnippet.id, parameterKey)
                            }
                            onKeyChange={(parameterId, nextKey) =>
                              onPromptSetParameterKeyChange(
                                selectedPromptSet.id,
                                parameterId,
                                nextKey
                              )
                            }
                            onLabelChange={(parameterId, nextLabel) =>
                              onPromptSetParameterLabelChange(
                                selectedPromptSet.id,
                                parameterId,
                                nextLabel
                              )
                            }
                            onPatternChange={(parameterId, nextPattern) =>
                              onPromptSetParameterPatternChange(
                                selectedPromptSet.id,
                                parameterId,
                                nextPattern
                              )
                            }
                            onRequiredChange={(parameterId, nextRequired) =>
                              onPromptSetParameterRequiredChange(
                                selectedPromptSet.id,
                                parameterId,
                                nextRequired
                              )
                            }
                            onScopeChange={(parameterId, nextScope) =>
                              onPromptSetParameterScopeChange(
                                selectedPromptSet.id,
                                parameterId,
                                nextScope
                              )
                            }
                            parameter={parameter}
                            scopeOptions={scopeOptions}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
                <div className="snippet-manager__parameter-header">
                  <h5 className="snippet-manager__subtitle">
                    Snippet Variables ({selectedSnippet.parameters.length}/{maxParameters})
                  </h5>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={selectedSnippet.parameters.length >= maxParameters}
                    onClick={onAddSnippetParameter}
                    type="button"
                  >
                    Add Parameter
                  </button>
                </div>
                {selectedSnippet.parameters.length === 0 ? (
                  <p className="hint snippet-manager__meta">
                    Add parameters and reference them in the template with tokens like{" "}
                    {buildParameterToken("target")}. Snippet-scoped variables are best for one-off
                    overrides on top of any selected prompt set.
                  </p>
                ) : (
                  <div className="snippet-manager__parameter-list">
                    {selectedSnippet.parameters.map((parameter) => (
                      <SnippetParameterCard
                        buildParameterToken={buildParameterToken}
                        deleteButtonLabel="Delete Parameter"
                        formatScopeLabel={formatScopeLabel}
                        getPatternError={getPatternError}
                        key={parameter.id}
                        onDefaultChange={(parameterId, nextDefaultValue) =>
                          onSnippetParameterDefaultChange(
                            selectedSnippet.id,
                            parameterId,
                            nextDefaultValue
                          )
                        }
                        onDelete={(parameterId) =>
                          onDeleteSnippetParameter(selectedSnippet.id, parameterId)
                        }
                        onInsertToken={(parameterKey) =>
                          onInsertSnippetParameterToken(selectedSnippet.id, parameterKey)
                        }
                        onKeyChange={(parameterId, nextKey) =>
                          onSnippetParameterKeyChange(selectedSnippet.id, parameterId, nextKey)
                        }
                        onLabelChange={(parameterId, nextLabel) =>
                          onSnippetParameterLabelChange(selectedSnippet.id, parameterId, nextLabel)
                        }
                        onPatternChange={(parameterId, nextPattern) =>
                          onSnippetParameterPatternChange(
                            selectedSnippet.id,
                            parameterId,
                            nextPattern
                          )
                        }
                        onRequiredChange={(parameterId, nextRequired) =>
                          onSnippetParameterRequiredChange(
                            selectedSnippet.id,
                            parameterId,
                            nextRequired
                          )
                        }
                        onScopeChange={(parameterId, nextScope) =>
                          onSnippetParameterScopeChange(selectedSnippet.id, parameterId, nextScope)
                        }
                        parameter={parameter}
                        scopeOptions={scopeOptions}
                      />
                    ))}
                  </div>
                )}
                <p className="hint snippet-manager__meta">
                  Placeholders: {"${clipboard}"} {"${date}"} {"${time}"} {"${datetime}"}{" "}
                  {"${sessionName}"} {"${host}"} {"${username}"} {"${tabTitle}"}{" "}
                  {buildParameterToken("name")}
                </p>
                {missingParameterKeys.length > 0 ? (
                  <p className="hint snippet-manager__meta">
                    Missing parameter definitions: {missingParameterKeys.join(", ")}
                  </p>
                ) : null}
                {shadowedPromptSetKeys.length > 0 ? (
                  <p className="hint snippet-manager__meta">
                    Snippet variables override prompt-set keys: {shadowedPromptSetKeys.join(", ")}
                  </p>
                ) : null}
                {unusedParameterKeys.length > 0 ? (
                  <p className="hint snippet-manager__meta">
                    Unused effective variables for this snippet: {unusedParameterKeys.join(", ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="hint snippet-manager__empty">Select or create a snippet to edit.</p>
            )}
          </section>
        </div>
        <div className="modal__actions">
          <button className="primary-button" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SnippetParameterCard({
  parameter,
  scopeOptions,
  buildParameterToken,
  formatScopeLabel,
  getPatternError,
  onKeyChange,
  onLabelChange,
  onDefaultChange,
  onPatternChange,
  onScopeChange,
  onRequiredChange,
  onInsertToken,
  onDelete,
  deleteButtonLabel
}: {
  parameter: CommandSnippetParameterView;
  scopeOptions: CommandSnippetVariableScopeOption[];
  buildParameterToken: (key: string) => string;
  formatScopeLabel: (scope: CommandSnippetVariableScopeId) => string;
  getPatternError: (pattern: string) => string | null;
  onKeyChange: (parameterId: string, nextKey: string) => void;
  onLabelChange: (parameterId: string, nextLabel: string) => void;
  onDefaultChange: (parameterId: string, nextDefaultValue: string) => void;
  onPatternChange: (parameterId: string, nextPattern: string) => void;
  onScopeChange: (parameterId: string, nextScope: CommandSnippetVariableScopeId) => void;
  onRequiredChange: (parameterId: string, nextRequired: boolean) => void;
  onInsertToken: (parameterKey: string) => void;
  onDelete: (parameterId: string) => void;
  deleteButtonLabel: string;
}) {
  const patternError = getPatternError(parameter.pattern);

  return (
    <div className="snippet-manager__parameter-card">
      <div className="snippet-manager__parameter-grid">
        <label className="snippet-manager__field">
          Key
          <input
            onChange={(event) => onKeyChange(parameter.id, event.target.value)}
            type="text"
            value={parameter.key}
          />
        </label>
        <label className="snippet-manager__field">
          Label
          <input
            onChange={(event) => onLabelChange(parameter.id, event.target.value)}
            type="text"
            value={parameter.label}
          />
        </label>
        <label className="snippet-manager__field">
          Default Value
          <input
            onChange={(event) => onDefaultChange(parameter.id, event.target.value)}
            type="text"
            value={parameter.defaultValue}
          />
        </label>
        <label className="snippet-manager__field">
          Regex Pattern
          <input
            onChange={(event) => onPatternChange(parameter.id, event.target.value)}
            placeholder="^[a-z0-9_-]+$"
            type="text"
            value={parameter.pattern}
          />
        </label>
        <label className="snippet-manager__field">
          Variable Scope
          <select
            onChange={(event) =>
              onScopeChange(parameter.id, event.target.value as CommandSnippetVariableScopeId)
            }
            value={parameter.scope}
          >
            {scopeOptions.map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="snippet-manager__parameter-actions">
        <label className="settings-checkbox">
          <input
            checked={parameter.required}
            onChange={(event) => onRequiredChange(parameter.id, event.target.checked)}
            type="checkbox"
          />
          <span>Required</span>
        </label>
        <button
          className="secondary-button secondary-button--small"
          onClick={() => onInsertToken(parameter.key)}
          type="button"
        >
          Insert {buildParameterToken(parameter.key)}
        </button>
        <button
          className="secondary-button secondary-button--small"
          onClick={() => onDelete(parameter.id)}
          type="button"
        >
          {deleteButtonLabel}
        </button>
      </div>
      <p className="hint snippet-manager__meta">
        Token: {buildParameterToken(parameter.key)} | Scope: {formatScopeLabel(parameter.scope)}
        {patternError ? ` | Invalid regex: ${patternError}` : ""}
      </p>
    </div>
  );
}
