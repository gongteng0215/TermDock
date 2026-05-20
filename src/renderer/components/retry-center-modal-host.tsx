import { Suspense, lazy } from "react";

import type { RetryCenterModalProps } from "./workbench-modals";

const LazyRetryCenterModal = lazy(async () => ({
  default: (await import("./workbench-modals")).RetryCenterModal
}));

interface RetryCenterModalHostProps {
  modalProps: RetryCenterModalProps;
}

export function RetryCenterModalHost({
  modalProps
}: RetryCenterModalHostProps) {
  if (!modalProps.open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazyRetryCenterModal {...modalProps} />
    </Suspense>
  );
}
