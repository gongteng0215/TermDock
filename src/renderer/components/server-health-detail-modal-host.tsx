import { Suspense, lazy } from "react";

import type { ServerHealthDetailModalProps } from "./server-health-detail-modal";

const LazyServerHealthDetailModal = lazy(async () => ({
  default: (await import("./server-health-detail-modal")).ServerHealthDetailModal
}));

interface ServerHealthDetailModalHostProps {
  modalProps: ServerHealthDetailModalProps;
}

export function ServerHealthDetailModalHost({
  modalProps
}: ServerHealthDetailModalHostProps) {
  if (!modalProps.open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazyServerHealthDetailModal {...modalProps} />
    </Suspense>
  );
}
