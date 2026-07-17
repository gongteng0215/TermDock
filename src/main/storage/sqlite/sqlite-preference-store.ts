import {
  filterDurableAppPreferences,
  isDurableAppPreferenceKey,
  type PersistedAppPreferences
} from "../../../shared/app-preference-persistence.js";
import type Database from "better-sqlite3";

interface PreferenceRow {
  pref_key: string;
  payload_json: string;
  updated_at: number;
}

export class SqlitePreferenceStore {
  private readonly db: Database.Database;
  private readonly upsertPreference: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.upsertPreference = this.db.prepare(`
INSERT INTO app_preferences (pref_key, payload_json, updated_at)
VALUES (@pref_key, @payload_json, @updated_at)
ON CONFLICT(pref_key) DO UPDATE SET
  payload_json = excluded.payload_json,
  updated_at = excluded.updated_at
`);
  }

  isEmpty(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM app_preferences").get() as {
      count: number;
    };
    return row.count === 0;
  }

  listAll(): PersistedAppPreferences {
    const rows = this.db
      .prepare("SELECT * FROM app_preferences ORDER BY pref_key ASC")
      .all() as PreferenceRow[];
    const entries: PersistedAppPreferences = {};
    for (const row of rows) {
      try {
        entries[row.pref_key] = JSON.parse(row.payload_json);
      } catch {
        // Skip corrupt rows.
      }
    }
    return entries;
  }

  set(key: string, value: unknown): void {
    if (
      typeof key !== "string" ||
      !key.trim() ||
      value === undefined ||
      !isDurableAppPreferenceKey(key.trim())
    ) {
      return;
    }
    this.upsertPreference.run({
      pref_key: key.trim(),
      payload_json: JSON.stringify(value),
      updated_at: Date.now()
    });
  }

  upsertMany(entries: PersistedAppPreferences): void {
    const filtered = filterDurableAppPreferences(entries);
    const upsert = this.db.transaction((next: PersistedAppPreferences) => {
      const updatedAt = Date.now();
      for (const [prefKey, value] of Object.entries(next)) {
        this.upsertPreference.run({
          pref_key: prefKey,
          payload_json: JSON.stringify(value),
          updated_at: updatedAt
        });
      }
    });
    upsert(filtered);
  }

  replaceAll(entries: PersistedAppPreferences): void {
    const filtered = filterDurableAppPreferences(entries);
    const replace = this.db.transaction((next: PersistedAppPreferences) => {
      this.db.prepare("DELETE FROM app_preferences").run();
      const updatedAt = Date.now();
      for (const [prefKey, value] of Object.entries(next)) {
        this.upsertPreference.run({
          pref_key: prefKey,
          payload_json: JSON.stringify(value),
          updated_at: updatedAt
        });
      }
    });
    replace(filtered);
  }
}
