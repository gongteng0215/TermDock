import { useMemo } from "react";

type TransferConflictStrategy = "overwrite" | "skip" | "rename";

interface SftpTransferPreferencesLike {
  uploadConcurrency: number;
  downloadConcurrency: number;
  uploadRateLimitKiBps: number;
  downloadRateLimitKiBps: number;
  scheduleWindowEnabled: boolean;
  scheduleWindowStartMinutes: number;
  scheduleWindowEndMinutes: number;
  scheduleWindowDays: number[];
}

interface SftpScheduleDayOptionLike {
  value: number;
  label: string;
}

interface SftpSchedulePresetLike {
  id: string;
  label: string;
  description: string;
  scheduleWindowEnabled: boolean;
  scheduleWindowStartMinutes: number;
  scheduleWindowEndMinutes: number;
  scheduleWindowDays: number[];
}

interface SftpTransferPolicyPackLike {
  id: string;
  name: string;
  description: string;
  updatedAtIso: string;
  preferences: SftpTransferPreferencesLike;
}

interface SftpTransferPolicyPackSyncStateLike {
  lastPulledAtIso: string | null;
  lastPushedAtIso: string | null;
}

interface ActiveSessionTransferConflictStrategyLike {
  upload: TransferConflictStrategy | null;
  download: TransferConflictStrategy | null;
}

interface UseSftpSettingsViewModelsArgs {
  activeSessionId: string | null;
  activeSessionTransferConflictStrategy: ActiveSessionTransferConflictStrategyLike | null;
  activeSftpTransferSchedulePresetId: string | null;
  formatPortForwardTimestamp: (isoString?: string) => string;
  formatSftpTransferPolicyPackSummary: (preferences: SftpTransferPreferencesLike) => string;
  formatTransferConflictStrategyLabel: (
    strategy: TransferConflictStrategy | null | undefined
  ) => string;
  getSchedulePresetSummary: (preset: SftpSchedulePresetLike) => string;
  isSftpTransferWindowOpen: boolean;
  maxSftpTransferConcurrency: number;
  maxRetryBatchConfirmThreshold: number;
  minRetryBatchConfirmThreshold: number;
  nextSftpTransferWindowOpeningLabel: string | null;
  scheduleDayOptions: readonly SftpScheduleDayOptionLike[];
  schedulePresets: readonly SftpSchedulePresetLike[];
  sftpTransferPolicyPacks: SftpTransferPolicyPackLike[];
  sftpTransferPolicyPackSyncState: SftpTransferPolicyPackSyncStateLike;
  sftpTransferPreferences: SftpTransferPreferencesLike;
  sftpTransferScheduleSummary: string;
}

export function useSftpSettingsViewModels({
  activeSessionId,
  activeSessionTransferConflictStrategy,
  activeSftpTransferSchedulePresetId,
  formatPortForwardTimestamp,
  formatSftpTransferPolicyPackSummary,
  formatTransferConflictStrategyLabel,
  getSchedulePresetSummary,
  isSftpTransferWindowOpen,
  maxSftpTransferConcurrency,
  maxRetryBatchConfirmThreshold,
  minRetryBatchConfirmThreshold,
  nextSftpTransferWindowOpeningLabel,
  scheduleDayOptions,
  schedulePresets,
  sftpTransferPolicyPacks,
  sftpTransferPolicyPackSyncState,
  sftpTransferPreferences,
  sftpTransferScheduleSummary
}: UseSftpSettingsViewModelsArgs) {
  const sftpScheduleDayViews = useMemo(
    () =>
      scheduleDayOptions.map((dayOption) => ({
        value: dayOption.value,
        label: dayOption.label,
        checked: sftpTransferPreferences.scheduleWindowDays.includes(dayOption.value)
      })),
    [scheduleDayOptions, sftpTransferPreferences.scheduleWindowDays]
  );

  const sftpSchedulePresetViews = useMemo(
    () =>
      schedulePresets.map((preset) => ({
        id: preset.id,
        label: preset.label,
        description: preset.description,
        summary: getSchedulePresetSummary(preset),
        isActive: preset.id === activeSftpTransferSchedulePresetId
      })),
    [activeSftpTransferSchedulePresetId, getSchedulePresetSummary, schedulePresets]
  );

  const sftpTransferPolicyPackViews = useMemo(
    () =>
      sftpTransferPolicyPacks.map((pack) => ({
        id: pack.id,
        name: pack.name,
        summary: formatSftpTransferPolicyPackSummary(pack.preferences),
        updatedAtLabel: formatPortForwardTimestamp(pack.updatedAtIso),
        description: pack.description || undefined
      })),
    [formatPortForwardTimestamp, formatSftpTransferPolicyPackSummary, sftpTransferPolicyPacks]
  );

  const sftpTransferPolicyPackLastSyncLabel = useMemo(() => {
    const { lastPulledAtIso, lastPushedAtIso } = sftpTransferPolicyPackSyncState;
    if (!lastPulledAtIso && !lastPushedAtIso) {
      return null;
    }
    return `Last pull: ${
      lastPulledAtIso ? new Date(lastPulledAtIso).toLocaleString() : "never"
    } | last push: ${lastPushedAtIso ? new Date(lastPushedAtIso).toLocaleString() : "never"}`;
  }, [
    sftpTransferPolicyPackSyncState.lastPulledAtIso,
    sftpTransferPolicyPackSyncState.lastPushedAtIso
  ]);

  const sftpConcurrencyHint = `Controls max parallel upload/download tasks. Range: 1-${maxSftpTransferConcurrency}. New installs default uploads to 4 and downloads to 2.`;

  const sftpRateLimitHint = `Per-direction rate limit uses KiB/s. Set 0 to disable throttling. Current upload limit: ${
    sftpTransferPreferences.uploadRateLimitKiBps > 0
      ? `${sftpTransferPreferences.uploadRateLimitKiBps} KiB/s`
      : "unlimited"
  }. Current download limit: ${
    sftpTransferPreferences.downloadRateLimitKiBps > 0
      ? `${sftpTransferPreferences.downloadRateLimitKiBps} KiB/s`
      : "unlimited"
  }.`;

  const sftpScheduleHint = `Schedule window:${
    sftpTransferPreferences.scheduleWindowEnabled
      ? ` ${sftpTransferScheduleSummary}. Transfers are currently ${
          isSftpTransferWindowOpen ? "inside" : "outside"
        } the allowed window.${
          !isSftpTransferWindowOpen && nextSftpTransferWindowOpeningLabel
            ? ` Next queued transfer resume: ${nextSftpTransferWindowOpeningLabel}.`
            : ""
        }`
      : " disabled; queued transfers start immediately when threads are available."
  }`;

  const sftpRetryThresholdHint = `Large retry batches at or above this threshold require confirmation. Set to 0 to disable confirmations. Range: ${minRetryBatchConfirmThreshold}-${maxRetryBatchConfirmThreshold}.`;

  const sftpActiveSessionConflictHint = `Active-session conflict defaults:${
    activeSessionId
      ? ` Upload ${formatTransferConflictStrategyLabel(
          activeSessionTransferConflictStrategy?.upload
        )}, Download ${formatTransferConflictStrategyLabel(
          activeSessionTransferConflictStrategy?.download
        )}.`
      : " Open a terminal tab to configure remembered conflict behavior."
  }`;

  return {
    sftpActiveSessionConflictHint,
    sftpConcurrencyHint,
    sftpRateLimitHint,
    sftpRetryThresholdHint,
    sftpScheduleDayViews,
    sftpScheduleHint,
    sftpSchedulePresetViews,
    sftpTransferPolicyPackLastSyncLabel,
    sftpTransferPolicyPackViews
  };
}
