import type { MutableRefObject } from "react";

import { UiIcon } from "./ui-icon";

interface MoveGroupDialogView {
  sessionIds: string[];
  targetGroup: string;
}

interface MoveGroupDialogModalProps {
  dialog: MoveGroupDialogView | null;
  groupOptions: string[];
  onClose: () => void;
  onSubmit: () => void;
  onTargetGroupChange: (value: string) => void;
}

type AppDialogMode = "alert" | "confirm" | "prompt" | "choice";

interface AppDialogOptionView {
  value: string;
  label: string;
  danger?: boolean;
}

interface AppDialogBaseView {
  cancelLabel: string;
  confirmLabel: string;
  message: string;
  mode: AppDialogMode;
  title: string;
}

interface AppAlertDialogView extends Omit<AppDialogBaseView, "cancelLabel" | "mode"> {
  mode: "alert";
  detailText?: string;
}

interface AppConfirmDialogView extends AppDialogBaseView {
  mode: "confirm";
  danger?: boolean;
  detailText?: string;
}

interface AppPromptDialogView extends AppDialogBaseView {
  mode: "prompt";
  multiline?: boolean;
  inputType?: "text" | "password";
}

interface AppChoiceDialogView extends AppDialogBaseView {
  mode: "choice";
  detailText?: string;
  options: AppDialogOptionView[];
}

type AppDialogView =
  | AppAlertDialogView
  | AppConfirmDialogView
  | AppPromptDialogView
  | AppChoiceDialogView;

interface AppDialogModalProps {
  dialog: AppDialogView | null;
  inputElementRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  inputValue: string;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onResolveOption: (value: string) => void;
  onSubmit: () => void;
}

export function MoveGroupDialogModal({
  dialog,
  groupOptions,
  onClose,
  onSubmit,
  onTargetGroupChange
}: MoveGroupDialogModalProps) {
  if (!dialog) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal modal--compact app-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Move Sessions to Group"
      >
        <div className="modal__header">
          <h3>
            {dialog.sessionIds.length > 1 ? `Move ${dialog.sessionIds.length} Sessions` : "Move Session"}
          </h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="app-dialog__message">Select target group from the list.</p>
        <form
          className="session-form app-dialog"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label>
            Target Group
            <select
              onChange={(event) => onTargetGroupChange(event.target.value)}
              value={dialog.targetGroup}
            >
              <option value="">Ungrouped</option>
              {groupOptions.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </select>
          </label>
          <div className="modal__actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" type="submit">
              Move
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AppDialogModal({
  dialog,
  inputElementRef,
  inputValue,
  onClose,
  onInputChange,
  onResolveOption,
  onSubmit
}: AppDialogModalProps) {
  if (!dialog) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className={
          dialog.mode === "choice"
            ? "modal modal--compact app-dialog app-dialog--choice"
            : (dialog.mode === "alert" || dialog.mode === "confirm") && dialog.detailText
              ? "modal modal--compact app-dialog app-dialog--details"
              : "modal modal--compact app-dialog"
        }
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={dialog.title}
      >
        <div className="modal__header">
          <h3>{dialog.title}</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="app-dialog__message">{dialog.message}</p>
        {dialog.mode === "prompt" ? (
          dialog.multiline ? (
            <textarea
              className="app-dialog__textarea"
              onChange={(event) => onInputChange(event.target.value)}
              ref={(element) => {
                inputElementRef.current = element;
              }}
              rows={6}
              value={inputValue}
            />
          ) : (
            <input
              className="app-dialog__input"
              onChange={(event) => onInputChange(event.target.value)}
              ref={(element) => {
                inputElementRef.current = element;
              }}
              type={dialog.inputType ?? "text"}
              value={inputValue}
            />
          )
        ) : (dialog.mode === "alert" || dialog.mode === "confirm" || dialog.mode === "choice") &&
          dialog.detailText ? (
          <textarea
            className="app-dialog__textarea app-dialog__textarea--readonly"
            readOnly
            value={dialog.detailText}
          />
        ) : null}
        {dialog.mode === "prompt" && dialog.multiline ? (
          <p className="hint app-dialog__hint">Use Ctrl+Enter to confirm.</p>
        ) : null}
        <div
          className={dialog.mode === "choice" ? "modal__actions app-dialog__choice-actions" : "modal__actions"}
        >
          {dialog.mode !== "alert" ? (
            <button
              className={
                dialog.mode === "choice"
                  ? "secondary-button app-dialog__choice-cancel"
                  : "secondary-button"
              }
              onClick={onClose}
              type="button"
            >
              {dialog.cancelLabel}
            </button>
          ) : null}
          {dialog.mode === "choice"
            ? dialog.options?.map((option) => (
                <button
                  className={
                    option.danger
                      ? "primary-button app-dialog__confirm--danger"
                      : "primary-button"
                  }
                  key={option.value}
                  onClick={() => onResolveOption(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))
            : (
                <button
                  className={
                    dialog.mode === "confirm" && dialog.danger
                      ? "primary-button app-dialog__confirm--danger"
                      : "primary-button"
                  }
                  onClick={onSubmit}
                  type="button"
                >
                  {dialog.confirmLabel}
                </button>
              )}
        </div>
      </div>
    </div>
  );
}
