import { useCallback, useEffect, useRef, useState } from "react";

type AppDialogMode = "alert" | "confirm" | "prompt" | "choice";

interface AppDialogBaseState {
  mode: AppDialogMode;
  title: string;
  message: string;
  confirmLabel: string;
}

interface AppAlertDialogState extends AppDialogBaseState {
  mode: "alert";
  detailText?: string;
}

interface AppConfirmDialogState extends AppDialogBaseState {
  mode: "confirm";
  cancelLabel: string;
  danger?: boolean;
  detailText?: string;
}

interface AppPromptDialogState extends AppDialogBaseState {
  mode: "prompt";
  cancelLabel: string;
  value: string;
  multiline?: boolean;
  inputType?: "text" | "password";
}

interface AppChoiceDialogOption {
  value: string;
  label: string;
  danger?: boolean;
}

interface AppChoiceDialogState extends AppDialogBaseState {
  mode: "choice";
  cancelLabel: string;
  detailText?: string;
  options: AppChoiceDialogOption[];
}

type AppDialogState =
  | AppAlertDialogState
  | AppConfirmDialogState
  | AppPromptDialogState
  | AppChoiceDialogState;

interface AppAlertDialogOptions {
  title?: string;
  confirmLabel?: string;
  detailText?: string;
  translateDetailText?: boolean;
}

interface AppConfirmDialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  detailText?: string;
}

interface AppPromptDialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  inputType?: "text" | "password";
}

interface AppChoiceDialogOptions {
  title?: string;
  cancelLabel?: string;
  detailText?: string;
}

interface UseAppDialogArgs {
  pushAppHintMessage: (
    message: string,
    options?: { level?: "info" | "warn"; durationMs?: number }
  ) => void;
  tr: (value: string) => string;
  trMultiline: (value: string) => string;
}

export function useAppDialog({ pushAppHintMessage, tr, trMultiline }: UseAppDialogArgs) {
  const appDialogInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const appDialogResolverRef = useRef<((value: unknown) => void) | null>(null);
  const appDialogCancelValueRef = useRef<unknown>(undefined);
  const [appDialog, setAppDialog] = useState<AppDialogState | null>(null);
  const [appDialogInput, setAppDialogInput] = useState("");

  const resolveAppDialog = useCallback((result: unknown) => {
    const resolver = appDialogResolverRef.current;
    appDialogResolverRef.current = null;
    appDialogCancelValueRef.current = undefined;
    setAppDialog(null);
    setAppDialogInput("");
    if (resolver) {
      resolver(result);
    }
  }, []);

  const openAppDialog = useCallback((dialog: AppDialogState, cancelResult: unknown): Promise<unknown> => {
    if (appDialogResolverRef.current) {
      appDialogResolverRef.current(appDialogCancelValueRef.current);
    }
    appDialogCancelValueRef.current = cancelResult;
    setAppDialog(dialog);
    setAppDialogInput(dialog.mode === "prompt" ? dialog.value : "");
    return new Promise((resolve) => {
      appDialogResolverRef.current = resolve;
    });
  }, []);

  const showAppAlert = useCallback(
    async (message: string, options?: AppAlertDialogOptions): Promise<void> => {
      const title = tr((options?.title ?? "").trim());
      const translatedMessage = tr(message);
      const hasDetailText = typeof options?.detailText === "string" && options.detailText.trim().length > 0;
      if (hasDetailText) {
        const dialog: AppAlertDialogState = {
          mode: "alert",
          title: title || tr("Notice"),
          message: translatedMessage,
          confirmLabel: tr(options?.confirmLabel ?? "OK"),
          detailText:
            options?.translateDetailText && options.detailText
              ? trMultiline(options.detailText)
              : options?.detailText
        };
        await openAppDialog(dialog, undefined);
        return;
      }
      const summary = hasDetailText ? `${translatedMessage} (${tr("details available")})` : translatedMessage;
      pushAppHintMessage(summary, {
        level: /error|fail|warning|warn/i.test(title) ? "warn" : "info",
        durationMs: hasDetailText ? 5600 : 3600
      });
    },
    [openAppDialog, pushAppHintMessage, tr, trMultiline]
  );

  const showAppConfirm = useCallback(
    async (message: string, options?: AppConfirmDialogOptions): Promise<boolean> => {
      const dialog: AppConfirmDialogState = {
        mode: "confirm",
        title: tr(options?.title ?? "Confirm"),
        message: tr(message),
        confirmLabel: tr(options?.confirmLabel ?? "Confirm"),
        cancelLabel: tr(options?.cancelLabel ?? "Cancel"),
        danger: options?.danger,
        detailText: options?.detailText ? trMultiline(options.detailText) : undefined
      };
      const result = await openAppDialog(dialog, false);
      return result === true;
    },
    [openAppDialog, tr, trMultiline]
  );

  const showAppPrompt = useCallback(
    async (message: string, defaultValue = "", options?: AppPromptDialogOptions): Promise<string | null> => {
      const dialog: AppPromptDialogState = {
        mode: "prompt",
        title: tr(options?.title ?? "Input Required"),
        message: tr(message),
        confirmLabel: tr(options?.confirmLabel ?? "OK"),
        cancelLabel: tr(options?.cancelLabel ?? "Cancel"),
        value: defaultValue,
        multiline: options?.multiline,
        inputType: options?.inputType
      };
      const result = await openAppDialog(dialog, null);
      return typeof result === "string" ? result : null;
    },
    [openAppDialog, tr]
  );

  const showAppChoice = useCallback(
    async (
      message: string,
      choices: AppChoiceDialogOption[],
      options?: AppChoiceDialogOptions
    ): Promise<string | null> => {
      if (!Array.isArray(choices) || choices.length === 0) {
        return null;
      }
      const dialog: AppChoiceDialogState = {
        mode: "choice",
        title: tr(options?.title ?? "Choose Action"),
        message: tr(message),
        confirmLabel: "",
        cancelLabel: tr(options?.cancelLabel ?? "Cancel"),
        detailText: options?.detailText ? trMultiline(options.detailText) : undefined,
        options: choices.map((choice) => ({
          ...choice,
          label: tr(choice.label)
        }))
      };
      const result = await openAppDialog(dialog, null);
      return typeof result === "string" ? result : null;
    },
    [openAppDialog, tr, trMultiline]
  );

  const closeAppDialog = useCallback(() => {
    resolveAppDialog(appDialogCancelValueRef.current);
  }, [resolveAppDialog]);

  const submitAppDialog = useCallback(() => {
    if (!appDialog) {
      return;
    }
    if (appDialog.mode === "choice") {
      return;
    }
    if (appDialog.mode === "confirm") {
      resolveAppDialog(true);
      return;
    }
    if (appDialog.mode === "prompt") {
      resolveAppDialog(appDialogInput);
      return;
    }
    resolveAppDialog(undefined);
  }, [appDialog, appDialogInput, resolveAppDialog]);

  useEffect(() => {
    if (!appDialog) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAppDialog();
      }
      if (event.key === "Enter") {
        if (appDialog.mode === "choice") {
          return;
        }
        if (appDialog.mode === "prompt" && appDialog.multiline && !event.ctrlKey && !event.metaKey) {
          return;
        }
        event.preventDefault();
        submitAppDialog();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [appDialog, closeAppDialog, submitAppDialog]);

  useEffect(() => {
    if (!appDialog || appDialog.mode !== "prompt") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const input = appDialogInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appDialog]);

  useEffect(() => {
    return () => {
      if (appDialogResolverRef.current) {
        appDialogResolverRef.current(appDialogCancelValueRef.current);
        appDialogResolverRef.current = null;
      }
    };
  }, []);

  return {
    appDialog,
    appDialogInput,
    appDialogInputRef,
    closeAppDialog,
    resolveAppDialog,
    setAppDialogInput,
    showAppAlert,
    showAppChoice,
    showAppConfirm,
    showAppPrompt,
    submitAppDialog
  };
}
