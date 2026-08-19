import { forwardRef } from "react";

export interface WorkbenchContextMenuAction {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export interface WorkbenchContextMenuProps {
  actions: WorkbenchContextMenuAction[];
  contextLabel?: string | null;
  contextLabelTitle?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WorkbenchContextMenu = forwardRef<HTMLDivElement, WorkbenchContextMenuProps>(
  function WorkbenchContextMenu(
    { actions, contextLabel = null, contextLabelTitle = "Target", x, y, width, height },
    ref
  ) {
    const left = Math.max(8, Math.min(x, window.innerWidth - width));
    const top = Math.max(8, Math.min(y, window.innerHeight - height));

    return (
      <div
        className="sftp-context-menu"
        onContextMenu={(event) => event.preventDefault()}
        ref={ref}
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`
        }}
      >
        {contextLabel ? (
          <div className="sftp-context-menu__context" title={contextLabel}>
            <span>{contextLabelTitle}</span>
            <code>{contextLabel}</code>
          </div>
        ) : null}
        {actions.map((action) => (
          <button
            className={
              action.danger ? "sftp-context-menu__item is-danger" : "sftp-context-menu__item"
            }
            disabled={action.disabled}
            key={action.id}
            onClick={action.onSelect}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  }
);
