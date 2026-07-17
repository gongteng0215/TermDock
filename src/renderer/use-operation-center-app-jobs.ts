import { useCallback, useRef, useState } from "react";

type OperationCenterAppJobCategory = "sessions" | "snippets" | "diagnostics";
type OperationCenterAppJobStatus = "running" | "succeeded" | "failed" | "canceled";

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
  const canceledJobIdsRef = useRef(new Set<string>());

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
      canceledJobIdsRef.current.delete(entry.id);
      setOperationCenterAppJobs((prev) => [entry, ...prev].slice(0, maxJobs));
      return entry.id;
    },
    [createJobId, maxJobs]
  );

  const isOperationCenterAppJobCanceled = useCallback((jobId: string) => {
    const normalizedJobId = jobId.trim();
    return normalizedJobId.length > 0 && canceledJobIdsRef.current.has(normalizedJobId);
  }, []);

  const cancelOperationCenterAppJob = useCallback((jobId: string) => {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) {
      return;
    }
    canceledJobIdsRef.current.add(normalizedJobId);
    setOperationCenterAppJobs((prev) =>
      prev.map((entry) =>
        entry.id !== normalizedJobId || entry.status !== "running"
          ? entry
          : {
              ...entry,
              status: "canceled",
              finishedAt: Date.now(),
              detail:
                entry.detail ??
                "Cancellation requested. In-flight single-shot work may still finish in the background."
            }
      )
    );
  }, []);

  const finishOperationCenterAppJob = useCallback(
    (
      jobId: string,
      status: Extract<OperationCenterAppJobStatus, "succeeded" | "failed" | "canceled">,
      options?: {
        detail?: string;
        outputPath?: string;
      }
    ) => {
      const normalizedJobId = jobId.trim();
      if (!normalizedJobId) {
        return;
      }
      const preferredStatus =
        canceledJobIdsRef.current.has(normalizedJobId) && status !== "succeeded"
          ? "canceled"
          : canceledJobIdsRef.current.has(normalizedJobId) && status === "succeeded"
            ? "canceled"
            : status;
      if (preferredStatus === "canceled") {
        canceledJobIdsRef.current.add(normalizedJobId);
      } else {
        canceledJobIdsRef.current.delete(normalizedJobId);
      }
      setOperationCenterAppJobs((prev) =>
        prev.map((entry) =>
          entry.id !== normalizedJobId
            ? entry
            : entry.status === "canceled"
              ? {
                  ...entry,
                  detail: options?.detail?.trim() || entry.detail,
                  outputPath: options?.outputPath?.trim() || entry.outputPath
                }
              : {
                  ...entry,
                  status: preferredStatus,
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
    canceledJobIdsRef.current.delete(normalizedJobId);
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
    cancelOperationCenterAppJob,
    clearFinishedOperationCenterAppJobs,
    copyOperationCenterAppJobOutputPath,
    finishOperationCenterAppJob,
    isOperationCenterAppJobCanceled,
    operationCenterAppJobs,
    removeOperationCenterAppJob,
    startOperationCenterAppJob
  };
}
