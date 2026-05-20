import { Suspense, lazy } from "react";

import type { CommandHistoryManagerModalProps } from "./workbench-modals";

const LazyCommandHistoryManagerModal = lazy(async () => ({
  default: (await import("./workbench-modals")).CommandHistoryManagerModal
}));

interface CommandHistoryManagerModalHostProps {
  modalProps: CommandHistoryManagerModalProps;
}

export function CommandHistoryManagerModalHost({
  modalProps
}: CommandHistoryManagerModalHostProps) {
  if (!modalProps.open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazyCommandHistoryManagerModal {...modalProps} />
    </Suspense>
  );
}
