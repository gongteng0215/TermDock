import { useCallback, useState } from "react";

type OperationCenterAppJobCategory = "sessions" | "snippets" | "diagnostics";
type OperationCenterAppJobStatus = "running" | "succeeded" | "failed";

interface OperationCenterAppJob {
  id: string;
  category: OperationCenterAppJobCategory;
  title: string;
  description: string;
  status: OperationCenterAppJobStatus;
  startedAt: number;
  finishedAt?: number;
  detail?: string;
  outputPath?: string;
}

interface UseOperationCenterAppJobsArgs {
  copyTextToClipboard: (text: string) => Promise<boolean>;
  createJobId: () => string;
  maxJobs: number;
  setError: (message: string | null) => void;
  showAppAlert: (
    message: string,
    options?: {
      title?: string;
    }
  ) => Promise<void>;
  toLogMessage: (error: unknown) => string;
  writeAppLog: (
    level: "info" | "warn" | "error",
    scope: string,
    message: string,
    context?: unknown
  ) => void;
}

export function useOperationCenterAppJobs({
  copyTextToClipboard,
  createJobId,
  maxJobs,
  setError,
  showAppAlert,
  toLogMessage,
  writeAppLog
}: UseOperationCenterAppJobsArgs) {
  const [operationCenterAppJobs, setOperationCenterAppJobs] = useState<OperationCenterAppJob[]>([]);

  const startOperationCenterAppJob = useCallback(
    (input: Pick<OperationCenterAppJob, "category" | "title" | "description">) => {
      const entry: OperationCenterAppJob = {
        id: createJobId(),
        category: input.category,
        title: input.title,
        description: input.description,
        status: "running",
        startedAt: Date.now()
      };
      setOperationCenterAppJobs((prev) => [entry, ...prev].slice(0, maxJobs));
      return entry.id;
    },
    [createJobId, maxJobs]
  );

  const finishOperationCenterAppJob = useCallback(
    (
      jobId: string,
      status: Extract<OperationCenterAppJobStatus, "succeeded" | "failed">,
      options?: {
        detail?: string;
        outputPath?: string;
      }
    ) => {
      const normalizedJobId = jobId.trim();
      if (!normalizedJobId) {
        return;
      }
      setOperationCenterAppJobs((prev) =>
        prev.map((entry) =>
          entry.id !== normalizedJobId
            ? entry
            : {
                ...entry,
                status,
                finishedAt: Date.now(),
                detail: options?.detail?.trim() || entry.detail,
                outputPath: options?.outputPath?.trim() || entry.outputPath
              }
        )
      );
    },
    []
  );

  const removeOperationCenterAppJob = useCallback((jobId: string) => {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) {
      return;
    }
    setOperationCenterAppJobs((prev) => prev.filter((entry) => entry.id !== normalizedJobId));
  }, []);

  const clearFinishedOperationCenterAppJobs = useCallback(() => {
    setOperationCenterAppJobs((prev) => prev.filter((entry) => entry.status === "running"));
  }, []);

  const copyOperationCenterAppJobOutputPath = useCallback(
    async (jobId: string) => {
      const job = operationCenterAppJobs.find((entry) => entry.id === jobId) ?? null;
      const outputPath = job?.outputPath?.trim() ?? "";
      if (!outputPath) {
        return;
      }
      try {
        const copied = await copyTextToClipboard(outputPath);
        await showAppAlert(
          copied
            ? `Output path copied to clipboard.\n${outputPath}`
            : `Clipboard unavailable.\n${outputPath}`,
          {
            title: "Operation Center"
          }
        );
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        writeAppLog(
          "error",
          "renderer:operation-center",
          "Failed to copy tracked app-job output path.",
          caughtError
        );
      }
    },
    [
      copyTextToClipboard,
      operationCenterAppJobs,
      setError,
      showAppAlert,
      toLogMessage,
      writeAppLog
    ]
  );

  return {
    clearFinishedOperationCenterAppJobs,
    copyOperationCenterAppJobOutputPath,
    finishOperationCenterAppJob,
    operationCenterAppJobs,
    removeOperationCenterAppJob,
    startOperationCenterAppJob
  };
}
