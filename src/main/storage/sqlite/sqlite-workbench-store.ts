import type {
  PersistedCommandSnippetGroup,
  PersistedCommandSnippetScopedValueRecord
} from "../../../shared/command-snippet-persistence.js";
import type {
  PersistedSessionQuickProfile,
  PersistedSessionTemplateRecord
} from "../../../shared/session-workbench-persistence.js";
import type Database from "better-sqlite3";

interface QuickProfileRow {
  id: string;
  payload_json: string;
}

interface SessionTemplateRow {
  id: string;
  updated_at: number;
  has_secret: number;
  payload_json: string;
}

interface SnippetGroupRow {
  id: string;
  payload_json: string;
}

interface SnippetScopedValueRow {
  scope_key: string;
  updated_at: number;
  payload_json: string;
}

export class SqliteWorkbenchStore {
  private readonly db: Database.Database;
  private readonly insertQuickProfile: Database.Statement;
  private readonly insertSessionTemplate: Database.Statement;
  private readonly insertSnippetGroup: Database.Statement;
  private readonly insertSnippetScopedValue: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertQuickProfile = this.db.prepare(`
INSERT INTO session_quick_profiles (id, payload_json)
VALUES (@id, @payload_json)
`);
    this.insertSessionTemplate = this.db.prepare(`
INSERT INTO session_templates (id, updated_at, has_secret, payload_json)
VALUES (@id, @updated_at, @has_secret, @payload_json)
`);
    this.insertSnippetGroup = this.db.prepare(`
INSERT INTO command_snippet_groups (id, payload_json)
VALUES (@id, @payload_json)
`);
    this.insertSnippetScopedValue = this.db.prepare(`
INSERT INTO command_snippet_scoped_values (scope_key, updated_at, payload_json)
VALUES (@scope_key, @updated_at, @payload_json)
`);
  }

  isEmpty(): boolean {
    const row = this.db
      .prepare(
        `
SELECT
  (SELECT COUNT(*) FROM session_quick_profiles) +
  (SELECT COUNT(*) FROM session_templates) +
  (SELECT COUNT(*) FROM command_snippet_groups) +
  (SELECT COUNT(*) FROM command_snippet_scoped_values) AS count
`
      )
      .get() as { count: number };
    return row.count === 0;
  }

  listQuickProfiles(): PersistedSessionQuickProfile[] {
    const rows = this.db
      .prepare("SELECT * FROM session_quick_profiles ORDER BY id ASC")
      .all() as QuickProfileRow[];
    const items: PersistedSessionQuickProfile[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.payload_json) as PersistedSessionQuickProfile;
        if (!parsed || typeof parsed !== "object" || parsed.id !== row.id) {
          continue;
        }
        items.push(parsed);
      } catch {
        // Skip corrupt rows.
      }
    }
    return items;
  }

  replaceQuickProfiles(items: PersistedSessionQuickProfile[]): void {
    const replace = this.db.transaction((next: PersistedSessionQuickProfile[]) => {
      this.db.prepare("DELETE FROM session_quick_profiles").run();
      for (const item of next) {
        this.insertQuickProfile.run({
          id: item.id,
          payload_json: JSON.stringify(item)
        });
      }
    });
    replace(items);
  }

  listSessionTemplates(): PersistedSessionTemplateRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM session_templates ORDER BY updated_at DESC")
      .all() as SessionTemplateRow[];
    const items: PersistedSessionTemplateRecord[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.payload_json) as PersistedSessionTemplateRecord;
        if (!parsed || typeof parsed !== "object" || parsed.id !== row.id) {
          continue;
        }
        items.push({
          ...parsed,
          hasSecret: parsed.hasSecret === true || row.has_secret === 1
        });
      } catch {
        // Skip corrupt rows.
      }
    }
    return items;
  }

  replaceSessionTemplates(
    items: Array<Omit<PersistedSessionTemplateRecord, "hasSecret"> & { secret?: string }>
  ): void {
    const sanitized = items.map(({ secret, ...rest }) => ({
      ...rest,
      hasSecret: typeof secret === "string" && secret.trim().length > 0
    }));
    const replace = this.db.transaction((next: PersistedSessionTemplateRecord[]) => {
      this.db.prepare("DELETE FROM session_templates").run();
      for (const item of next) {
        this.insertSessionTemplate.run({
          id: item.id,
          updated_at: item.updatedAt,
          has_secret: item.hasSecret ? 1 : 0,
          payload_json: JSON.stringify(item)
        });
      }
    });
    replace(sanitized);
  }

  listSnippetGroups(): PersistedCommandSnippetGroup[] {
    const rows = this.db
      .prepare("SELECT * FROM command_snippet_groups ORDER BY id ASC")
      .all() as SnippetGroupRow[];
    const items: PersistedCommandSnippetGroup[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.payload_json) as PersistedCommandSnippetGroup;
        if (!parsed || typeof parsed !== "object" || parsed.id !== row.id) {
          continue;
        }
        items.push(parsed);
      } catch {
        // Skip corrupt rows.
      }
    }
    return items;
  }

  replaceSnippetGroups(items: PersistedCommandSnippetGroup[]): void {
    const replace = this.db.transaction((next: PersistedCommandSnippetGroup[]) => {
      this.db.prepare("DELETE FROM command_snippet_groups").run();
      for (const item of next) {
        this.insertSnippetGroup.run({
          id: item.id,
          payload_json: JSON.stringify(item)
        });
      }
    });
    replace(items);
  }

  listSnippetScopedValues(): Record<string, PersistedCommandSnippetScopedValueRecord> {
    const rows = this.db
      .prepare("SELECT * FROM command_snippet_scoped_values ORDER BY scope_key ASC")
      .all() as SnippetScopedValueRow[];
    const values: Record<string, PersistedCommandSnippetScopedValueRecord> = {};
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.payload_json) as PersistedCommandSnippetScopedValueRecord;
        if (!parsed || typeof parsed !== "object" || typeof parsed.value !== "string") {
          continue;
        }
        values[row.scope_key] = parsed;
      } catch {
        // Skip corrupt rows.
      }
    }
    return values;
  }

  replaceSnippetScopedValues(
    values: Record<string, PersistedCommandSnippetScopedValueRecord>
  ): void {
    const replace = this.db.transaction(
      (next: Record<string, PersistedCommandSnippetScopedValueRecord>) => {
        this.db.prepare("DELETE FROM command_snippet_scoped_values").run();
        for (const [scopeKey, record] of Object.entries(next)) {
          this.insertSnippetScopedValue.run({
            scope_key: scopeKey,
            updated_at: record.updatedAt,
            payload_json: JSON.stringify(record)
          });
        }
      }
    );
    replace(values);
  }
}
