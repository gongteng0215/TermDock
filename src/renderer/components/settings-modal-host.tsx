import { Suspense, lazy } from "react";
import type { ComponentProps } from "react";

import type { SettingsModalContent } from "./settings-modal-content";
import type { SettingsModalShell } from "./settings-modal-shell";

const LazySettingsModalShell = lazy(async () => ({
  default: (await import("./settings-modal-shell")).SettingsModalShell
}));

const LazySettingsModalContent = lazy(async () => ({
  default: (await import("./settings-modal-content")).SettingsModalContent
}));

interface SettingsModalHostProps {
  shellProps: Omit<ComponentProps<typeof SettingsModalShell>, "children">;
  contentProps: ComponentProps<typeof SettingsModalContent>;
}

export function SettingsModalHost({
  shellProps,
  contentProps
}: SettingsModalHostProps) {
  if (!shellProps.open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazySettingsModalShell {...shellProps}>
        <LazySettingsModalContent {...contentProps} />
      </LazySettingsModalShell>
    </Suspense>
  );
}
