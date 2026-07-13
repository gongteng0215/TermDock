import type { ReactNode } from "react";

import { ModalShell } from "./modal-shell";
import { UiIcon, type UiIconName } from "./ui-icon";

export interface SettingsSectionNavItem {
  id: string;
  label: string;
  icon: UiIconName;
}

export interface SettingsModalShellProps {
  open: boolean;
  activeSectionId: string;
  sections: SettingsSectionNavItem[];
  sectionTitle: string;
  titleLabel: string;
  sectionsAriaLabel: string;
  doneLabel: string;
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
  titleLabel,
  sectionsAriaLabel,
  doneLabel,
  versionLabel,
  onSelectSection,
  onClose,
  children
}: SettingsModalShellProps) {
  return (
    <ModalShell
      backdropClassName="modal-backdrop--settings"
      footer={
        <div className="modal__actions settings-panel__footer">
          <button className="primary-button" onClick={onClose} type="button">
            {doneLabel}
          </button>
        </div>
      }
      modalClassName="modal--settings"
      onClose={onClose}
      open={open}
      title={titleLabel}
    >
      <div className="settings-layout">
        <div aria-label={sectionsAriaLabel} className="settings-nav" role="tablist">
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
              <UiIcon name={section.icon} />
              <span>{section.label}</span>
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
    </ModalShell>
  );
}
