import { Suspense, lazy } from "react";

import type { CommandSnippetManagerModalProps } from "./command-snippet-manager-modal";

const LazyCommandSnippetManagerModal = lazy(async () => ({
  default: (await import("./command-snippet-manager-modal")).CommandSnippetManagerModal
}));

interface CommandSnippetManagerModalHostProps {
  modalProps: CommandSnippetManagerModalProps;
}

export function CommandSnippetManagerModalHost({
  modalProps
}: CommandSnippetManagerModalHostProps) {
  if (!modalProps.open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazyCommandSnippetManagerModal {...modalProps} />
    </Suspense>
  );
}
