import { Suspense, lazy } from "react";

import type { SessionCreateModalProps } from "./session-create-modal";

const LazySessionCreateModal = lazy(async () => ({
  default: (await import("./session-create-modal")).SessionCreateModal
}));

interface SessionCreateModalHostProps {
  modalProps: SessionCreateModalProps;
}

export function SessionCreateModalHost({
  modalProps
}: SessionCreateModalHostProps) {
  if (!modalProps.open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazySessionCreateModal {...modalProps} />
    </Suspense>
  );
}
