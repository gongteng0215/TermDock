import { useSyncExternalStore } from "react";
import { GripHorizontal, Minus, Square, X } from "lucide-react";

function isWindowsPlatform(): boolean {
  return typeof navigator !== "undefined" && /win/i.test(navigator.platform);
}

function subscribeUiTheme(onStoreChange: () => void): () => void {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-ui-theme"]
  });
  return () => observer.disconnect();
}

function readUiThemeId(): string {
  if (typeof document === "undefined") {
    return "default";
  }
  return document.documentElement.dataset.uiTheme ?? "default";
}

function beginWindowDrag(event: React.MouseEvent<HTMLElement>): void {
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

export function AppWindowChrome() {
  const uiThemeId = useSyncExternalStore(subscribeUiTheme, readUiThemeId, () => "default");

  if (!isWindowsPlatform()) {
    return null;
  }

  const systemApi = window.termdock?.system;
  if (
    !systemApi?.minimizeWindow ||
    !systemApi.toggleMaximizeWindow ||
    !systemApi.closeWindow ||
    !systemApi.startWindowDrag ||
    !systemApi.stopWindowDrag
  ) {
    return null;
  }

  const isTech = uiThemeId === "tech";

  return (
    <>
      {isTech ? (
        <div
          aria-hidden="true"
          className="app-window-drag-strip"
          onMouseDown={beginWindowDrag}
          title="Drag to move"
        />
      ) : null}
      <div
        className={
          isTech ? "app-window-chrome" : "app-window-chrome app-window-chrome--default"
        }
        aria-label="Window controls"
      >
        <div className="app-window-chrome__panel">
          {isTech ? (
            <>
              <div
                className="app-window-chrome__drag"
                onMouseDown={beginWindowDrag}
                title="Drag to move window"
              >
                <GripHorizontal aria-hidden="true" size={14} strokeWidth={2} />
                <span>Move</span>
              </div>
              <i className="app-window-chrome__divider" aria-hidden="true" />
            </>
          ) : (
            <div
              aria-hidden="true"
              className="app-window-chrome__drag app-window-chrome__drag--default"
              onMouseDown={beginWindowDrag}
              title="Drag to move window"
            />
          )}
          <button
            aria-label="Minimize"
            className="app-window-chrome__button"
            onClick={() => {
              void systemApi.minimizeWindow();
            }}
            title="Minimize"
            type="button"
          >
            <Minus aria-hidden="true" size={14} strokeWidth={2} />
          </button>
          <button
            aria-label="Maximize"
            className="app-window-chrome__button"
            onClick={() => {
              void systemApi.toggleMaximizeWindow();
            }}
            title="Maximize"
            type="button"
          >
            <Square aria-hidden="true" size={11} strokeWidth={2} />
          </button>
          <button
            aria-label="Close"
            className="app-window-chrome__button app-window-chrome__button--close"
            onClick={() => {
              void systemApi.closeWindow();
            }}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </>
  );
}
