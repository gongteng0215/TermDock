import { Suspense, lazy } from "react";

import type { OperationCenterModalProps } from "./workbench-modals";

const LazyOperationCenterModal = lazy(async () => ({
  default: (await import("./workbench-modals")).OperationCenterModal
}));

interface OperationCenterModalHostProps {
  modalProps: OperationCenterModalProps;
}

export function OperationCenterModalHost({
  modalProps
}: OperationCenterModalHostProps) {
  if (!modalProps.open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazyOperationCenterModal {...modalProps} />
    </Suspense>
  );
}
