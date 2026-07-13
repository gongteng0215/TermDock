import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";

import { useDismissableLayer } from "../use-dismissable-layer";
import { UiIcon } from "./ui-icon";

export interface ModalShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes on `.modal` (e.g. `modal--settings`, `modal--compact`). */
  modalClassName?: string;
  /** Extra classes on backdrop (e.g. `modal-backdrop--settings`). */
  backdropClassName?: string;
  ariaLabel?: string;
  closeLabel?: string;
  /** Close when clicking the backdrop. Default true. */
  closeOnBackdropClick?: boolean;
  /** Show header close button. Default true. */
  showCloseButton?: boolean;
  footer?: ReactNode;
}

export function ModalShell({
  open,
  title,
  onClose,
  children,
  modalClassName,
  backdropClassName,
  ariaLabel,
  closeLabel,
  closeOnBackdropClick = true,
  showCloseButton = true,
  footer
}: ModalShellProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useDismissableLayer({
    open,
    onDismiss: onClose,
    rootRef: modalRef,
    closeOnOutsidePointer: false,
    closeOnEscape: true,
    closeOnWindowLayoutChange: false
  });

  useEffect(() => {
    if (!open || !modalRef.current) {
      return;
    }
    const focusTarget = modalRef.current.querySelector<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    );
    focusTarget?.focus();
  }, [open]);

  if (!open) {
    return null;
  }

  const backdropClass = ["modal-backdrop", backdropClassName].filter(Boolean).join(" ");
  const modalClass = ["modal", modalClassName].filter(Boolean).join(" ");

  const onBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdropClick) {
      return;
    }
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={backdropClass} onClick={onBackdropClick} role="presentation">
      <div
        aria-label={ariaLabel ?? title}
        aria-modal="true"
        className={modalClass}
        onClick={(event) => event.stopPropagation()}
        ref={modalRef}
        role="dialog"
      >
        <div className="modal__header">
          <h3>{title}</h3>
          {showCloseButton ? (
            <button className="icon-button" onClick={onClose} type="button">
              {closeLabel ?? <UiIcon name="close" />}
            </button>
          ) : null}
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
