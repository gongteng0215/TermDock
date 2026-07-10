import type { MouseEventHandler } from "react";

interface PrivilegedUploadRecoveryActionsProps {
  language: "en" | "zh-CN";
  onStage?: MouseEventHandler<HTMLButtonElement>;
  onCopyCommand?: MouseEventHandler<HTMLButtonElement>;
  onPasteCommand?: MouseEventHandler<HTMLButtonElement>;
  onTrySudoSave?: MouseEventHandler<HTMLButtonElement>;
  onRevealLocal?: MouseEventHandler<HTMLButtonElement>;
  stageBusy?: boolean;
  sudoBusy?: boolean;
  hasCommand?: boolean;
  hasLocalPath?: boolean;
}

function tr(language: "en" | "zh-CN", english: string, chinese: string): string {
  return language === "zh-CN" ? chinese : english;
}

export function PrivilegedUploadRecoveryActions({
  language,
  onStage,
  onCopyCommand,
  onPasteCommand,
  onTrySudoSave,
  onRevealLocal,
  stageBusy = false,
  sudoBusy = false,
  hasCommand = false,
  hasLocalPath = false
}: PrivilegedUploadRecoveryActionsProps) {
  return (
    <div className="privileged-recovery-actions" role="group" aria-label="Privileged path recovery">
      {onStage ? (
        <button
          className="button button--ghost privileged-recovery-actions__button"
          disabled={stageBusy}
          onClick={onStage}
          type="button"
        >
          {stageBusy
            ? tr(language, "Staging…", "暂存中…")
            : tr(language, "Stage to Server", "暂存到服务器")}
        </button>
      ) : null}
      {onTrySudoSave ? (
        <button
          className="button button--ghost privileged-recovery-actions__button"
          disabled={sudoBusy}
          onClick={onTrySudoSave}
          type="button"
        >
          {sudoBusy
            ? tr(language, "Trying sudo…", "尝试 sudo…")
            : tr(language, "Try sudo -n Save", "尝试 sudo -n 写回")}
        </button>
      ) : null}
      {onCopyCommand && hasCommand ? (
        <button
          className="button button--ghost privileged-recovery-actions__button"
          onClick={onCopyCommand}
          type="button"
        >
          {tr(language, "Copy sudo Command", "复制 sudo 命令")}
        </button>
      ) : null}
      {onPasteCommand && hasCommand ? (
        <button
          className="button button--ghost privileged-recovery-actions__button"
          onClick={onPasteCommand}
          type="button"
        >
          {tr(language, "Paste into Terminal", "粘贴到终端")}
        </button>
      ) : null}
      {onRevealLocal && hasLocalPath ? (
        <button
          className="button button--ghost privileged-recovery-actions__button"
          onClick={onRevealLocal}
          type="button"
        >
          {tr(language, "Reveal Local Draft", "打开本地草稿")}
        </button>
      ) : null}
    </div>
  );
}
