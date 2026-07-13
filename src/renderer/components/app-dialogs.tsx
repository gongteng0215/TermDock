import type { MutableRefObject } from "react";

import { ModalShell } from "./modal-shell";

export interface MoveGroupDialogView {
  sessionIds: string[];
  targetGroup: string;
}

export interface MoveGroupDialogModalProps {
  dialog: MoveGroupDialogView | null;
  groupOptions: string[];
  onClose: () => void;
  onSubmit: () => void;
  onTargetGroupChange: (value: string) => void;
}

export type AppDialogMode = "alert" | "confirm" | "prompt" | "choice";

export interface AppDialogOptionView {
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

export type AppDialogView =
  | AppAlertDialogView
  | AppConfirmDialogView
  | AppPromptDialogView
  | AppChoiceDialogView;

export interface AppDialogModalProps {
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
  const title = dialog
    ? dialog.sessionIds.length > 1
      ? `Move ${dialog.sessionIds.length} Sessions`
      : "Move Session"
    : "Move Session";

  return (
    <ModalShell
      modalClassName="modal--compact app-dialog"
      onClose={onClose}
      open={Boolean(dialog)}
      title={title}
    >
      {dialog ? (
        <>
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
        </>
      ) : null}
    </ModalShell>
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
  const modalClassName = !dialog
    ? "modal--compact app-dialog"
    : dialog.mode === "choice"
      ? "modal--compact app-dialog app-dialog--choice"
      : (dialog.mode === "alert" || dialog.mode === "confirm") && dialog.detailText
        ? "modal--compact app-dialog app-dialog--details"
        : "modal--compact app-dialog";

  return (
    <ModalShell
      modalClassName={modalClassName}
      onClose={onClose}
      open={Boolean(dialog)}
      title={dialog?.title ?? "Dialog"}
    >
      {dialog ? (
        <>
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
            className={
              dialog.mode === "choice" ? "modal__actions app-dialog__choice-actions" : "modal__actions"
            }
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
        </>
      ) : null}
    </ModalShell>
  );
}
