import type { Dispatch, SetStateAction } from "react";

import type { SettingsModalContentProps } from "./components/settings-modal-content";
import type { SettingsModalShellProps } from "./components/settings-modal-shell";

export type SettingsModalShellFrameProps = Omit<SettingsModalShellProps, "children">;

export interface BuildSettingsModalShellPropsArgs<TSectionId extends string>
  extends Omit<SettingsModalShellFrameProps, "activeSectionId" | "onSelectSection"> {
  activeSectionId: TSectionId;
  setActiveSectionId: Dispatch<SetStateAction<TSectionId>>;
}

export function buildSettingsModalShellProps<TSectionId extends string>({
  activeSectionId,
  setActiveSectionId,
  ...modalProps
}: BuildSettingsModalShellPropsArgs<TSectionId>): SettingsModalShellFrameProps {
  return {
    ...modalProps,
    activeSectionId,
    onSelectSection: (sectionId) => {
      setActiveSectionId(sectionId as TSectionId);
    }
  };
}

export function buildSettingsModalContentProps(
  modalProps: SettingsModalContentProps
): SettingsModalContentProps {
  return modalProps;
}
