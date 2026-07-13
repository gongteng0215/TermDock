import { useEffect, type RefObject } from "react";

export interface UseDismissableLayerOptions {
  open: boolean;
  onDismiss: () => void;
  rootRef: RefObject<HTMLElement | null>;
  /** Close when pointer lands outside root. Default true. */
  closeOnOutsidePointer?: boolean;
  /** Close on Escape. Default true. */
  closeOnEscape?: boolean;
  /** Close on window resize/scroll. Default false (menus usually want true). */
  closeOnWindowLayoutChange?: boolean;
  /** Optional Escape handler; return false to skip default dismiss. */
  onEscape?: (event: KeyboardEvent) => boolean | void;
}

export function useDismissableLayer({
  open,
  onDismiss,
  rootRef,
  closeOnOutsidePointer = true,
  closeOnEscape = true,
  closeOnWindowLayoutChange = false,
  onEscape
}: UseDismissableLayerOptions): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!closeOnOutsidePointer) {
        return;
      }
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      onDismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!closeOnEscape || event.key !== "Escape") {
        return;
      }
      if (onEscape) {
        const shouldDismiss = onEscape(event);
        if (shouldDismiss === false) {
          return;
        }
      }
      event.preventDefault();
      onDismiss();
    };

    const handleWindowLayoutChange = () => {
      if (!closeOnWindowLayoutChange) {
        return;
      }
      onDismiss();
    };

    if (closeOnOutsidePointer) {
      window.addEventListener("pointerdown", handlePointerDown, true);
    }
    if (closeOnEscape) {
      window.addEventListener("keydown", handleKeyDown);
    }
    if (closeOnWindowLayoutChange) {
      window.addEventListener("resize", handleWindowLayoutChange);
      window.addEventListener("scroll", handleWindowLayoutChange, true);
    }

    return () => {
      if (closeOnOutsidePointer) {
        window.removeEventListener("pointerdown", handlePointerDown, true);
      }
      if (closeOnEscape) {
        window.removeEventListener("keydown", handleKeyDown);
      }
      if (closeOnWindowLayoutChange) {
        window.removeEventListener("resize", handleWindowLayoutChange);
        window.removeEventListener("scroll", handleWindowLayoutChange, true);
      }
    };
  }, [
    closeOnEscape,
    closeOnOutsidePointer,
    closeOnWindowLayoutChange,
    onDismiss,
    onEscape,
    open,
    rootRef
  ]);
}
