/** Durable preference keys dual-written to SQLite in Phase 4 slice 5. */

export const DURABLE_APP_PREFERENCE_KEYS = [
  "termdock.connection-preferences.v1",
  "termdock.terminal-editor-focus.v1",
  "termdock.hotkey-preferences.v1",
  "termdock.file-open-preferences.v1",
  "termdock.sftp-transfer-preferences.v3",
  "termdock.sftp-transfer-policy-packs.v1",
  "termdock.sftp-transfer-policy-pack-sync.v1",
  "termdock.sftp-conflict-strategy.v1",
  "termdock.port-forward-presets.v1",
  "termdock.session-groups.v1",
  "termdock.session-sort-mode.v1",
  "termdock.workspace-profile.v1",
  "termdock.server-health-alert-preferences.v1",
  "termdock.dangerous-command-guard-preferences.v1",
  "termdock.dangerous-command-policy-bundles.v1",
  "termdock.dangerous-command-policy-bundle-sync.v1",
  "termdock.disconnect-report-capture-preferences.v1",
  "termdock.terminal-command-history.v2"
] as const;

export type DurableAppPreferenceKey = (typeof DURABLE_APP_PREFERENCE_KEYS)[number];

export type PersistedAppPreferences = Record<string, unknown>;

export const DURABLE_APP_PREFERENCE_KEY_SET = new Set<string>(DURABLE_APP_PREFERENCE_KEYS);

export function isDurableAppPreferenceKey(key: string): key is DurableAppPreferenceKey {
  return DURABLE_APP_PREFERENCE_KEY_SET.has(key);
}

export function filterDurableAppPreferences(
  entries: PersistedAppPreferences
): PersistedAppPreferences {
  const next: PersistedAppPreferences = {};
  for (const [key, value] of Object.entries(entries)) {
    if (!isDurableAppPreferenceKey(key) || value === undefined) {
      continue;
    }
    next[key] = value;
  }
  return next;
}
