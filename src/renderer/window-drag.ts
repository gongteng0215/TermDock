import type { MouseEvent as ReactMouseEvent } from "react";

export function beginWindowDrag(event: ReactMouseEvent<HTMLElement>): void {
  if (event.button !== 0) {
    return;
  }
  const systemApi = window.termdock?.system;
  if (!systemApi?.startWindowDrag || !systemApi.stopWindowDrag) {
    return;
  }
  event.preventDefault();
  systemApi.startWindowDrag({
    screenX: event.screenX,
    screenY: event.screenY
  });
  const stop = () => {
    systemApi.stopWindowDrag();
    window.removeEventListener("mouseup", stop);
    window.removeEventListener("blur", stop);
  };
  window.addEventListener("mouseup", stop);
  window.addEventListener("blur", stop);
}
