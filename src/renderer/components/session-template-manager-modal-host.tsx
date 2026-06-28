import { Suspense, lazy } from "react";

import type { SessionTemplateManagerModalProps } from "./session-template-manager-modal";

const LazySessionTemplateManagerModal = lazy(async () => ({
  default: (await import("./session-template-manager-modal")).SessionTemplateManagerModal
}));

interface SessionTemplateManagerModalHostProps {
  modalProps: SessionTemplateManagerModalProps;
}

export function SessionTemplateManagerModalHost({
  modalProps
}: SessionTemplateManagerModalHostProps) {
  if (!modalProps.open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazySessionTemplateManagerModal {...modalProps} />
    </Suspense>
  );
}
