import { useCallback, type Dispatch, type SetStateAction } from "react";

type DisconnectReportScope = "allSessions" | "activeSession";
type DisconnectReportTriggerFilter = "all" | "status" | "error";
type DisconnectReportTimeRange = "all" | "5m" | "30m" | "1h" | "24h";

interface DisconnectReportCapturePreferencesLike {
  enabled: boolean;
}

interface DisconnectReportViewPreferencesLike {
  query: string;
  scope: DisconnectReportScope;
  timeRange: DisconnectReportTimeRange;
  trigger: DisconnectReportTriggerFilter;
}

interface UseDisconnectDiagnosticsUiActionsArgs {
  defaults: DisconnectReportViewPreferencesLike;
  setDisconnectReportCapturePreferences: Dispatch<
    SetStateAction<DisconnectReportCapturePreferencesLike>
  >;
  setDisconnectReportQuery: Dispatch<SetStateAction<string>>;
  setDisconnectReportScope: Dispatch<SetStateAction<DisconnectReportScope>>;
  setDisconnectReportTimeRange: Dispatch<SetStateAction<DisconnectReportTimeRange>>;
  setDisconnectReportTriggerFilter: Dispatch<
    SetStateAction<DisconnectReportTriggerFilter>
  >;
}

export function useDisconnectDiagnosticsUiActions({
  defaults,
  setDisconnectReportCapturePreferences,
  setDisconnectReportQuery,
  setDisconnectReportScope,
  setDisconnectReportTimeRange,
  setDisconnectReportTriggerFilter
}: UseDisconnectDiagnosticsUiActionsArgs) {
  const resetDisconnectReportViewFilters = useCallback(() => {
    setDisconnectReportScope(defaults.scope);
    setDisconnectReportTriggerFilter(defaults.trigger);
    setDisconnectReportTimeRange(defaults.timeRange);
    setDisconnectReportQuery(defaults.query);
  }, [
    defaults.query,
    defaults.scope,
    defaults.timeRange,
    defaults.trigger,
    setDisconnectReportQuery,
    setDisconnectReportScope,
    setDisconnectReportTimeRange,
    setDisconnectReportTriggerFilter
  ]);

  const setDisconnectReportCaptureEnabled = useCallback(
    (enabled: boolean) => {
      setDisconnectReportCapturePreferences({
        enabled
      });
    },
    [setDisconnectReportCapturePreferences]
  );

  const setDisconnectReportQueryValue = useCallback(
    (value: string) => {
      setDisconnectReportQuery(value.slice(0, 160));
    },
    [setDisconnectReportQuery]
  );

  const setDisconnectReportScopeValue = useCallback(
    (value: string) => {
      setDisconnectReportScope(value as DisconnectReportScope);
    },
    [setDisconnectReportScope]
  );

  const setDisconnectReportTimeRangeValue = useCallback(
    (value: string) => {
      setDisconnectReportTimeRange(value as DisconnectReportTimeRange);
    },
    [setDisconnectReportTimeRange]
  );

  const setDisconnectReportTriggerFilterValue = useCallback(
    (value: string) => {
      setDisconnectReportTriggerFilter(value as DisconnectReportTriggerFilter);
    },
    [setDisconnectReportTriggerFilter]
  );

  return {
    resetDisconnectReportViewFilters,
    setDisconnectReportCaptureEnabled,
    setDisconnectReportQueryValue,
    setDisconnectReportScopeValue,
    setDisconnectReportTimeRangeValue,
    setDisconnectReportTriggerFilterValue
  };
}
