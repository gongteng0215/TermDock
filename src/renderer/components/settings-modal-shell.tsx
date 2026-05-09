import type { ReactNode } from "react";

import { UiIcon } from "./ui-icon";

interface SettingsSectionNavItem {
  id: string;
  label: string;
}

interface SettingsModalShellProps {
  open: boolean;
  activeSectionId: string;
  sections: SettingsSectionNavItem[];
  sectionTitle: string;
  versionLabel: string;
  onSelectSection: (sectionId: string) => void;
  onClose: () => void;
  children: ReactNode;
}

export function SettingsModalShell({
  open,
  activeSectionId,
  sections,
  sectionTitle,
  versionLabel,
  onSelectSection,
  onClose,
  children
}: SettingsModalShellProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label="Settings"
        aria-modal="true"
        className="modal modal--settings"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h3>Settings</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <div className="settings-layout">
          <div aria-label="Settings sections" className="settings-nav" role="tablist">
            {sections.map((section) => (
              <button
                className={
                  activeSectionId === section.id
                    ? "settings-nav__button is-active"
                    : "settings-nav__button"
                }
                key={section.id}
                onClick={() => onSelectSection(section.id)}
                role="tab"
                type="button"
              >
                {section.label}
              </button>
            ))}
          </div>
          <div className="session-form settings-panel">
            <div className="settings-panel__header">
              <h4 className="settings-group__title">{sectionTitle}</h4>
              <p className="hint settings-panel__version">{versionLabel}</p>
            </div>
            {children}
          </div>
        </div>
        <div className="modal__actions settings-panel__footer">
          <button className="primary-button" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
