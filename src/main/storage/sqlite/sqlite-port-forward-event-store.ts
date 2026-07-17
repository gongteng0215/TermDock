import type { PersistedPortForwardEventHistoryItem } from "../../../shared/port-forward-event-persistence.js";
import type Database from "better-sqlite3";

interface PortForwardEventRow {
  entry_key: string;
  session_id: string;
  created_at: string;
  payload_json: string;
}

export class SqlitePortForwardEventStore {
  private readonly db: Database.Database;
  private readonly insertEvent: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertEvent = this.db.prepare(`
INSERT INTO port_forward_events (entry_key, session_id, created_at, payload_json)
VALUES (@entry_key, @session_id, @created_at, @payload_json)
`);
  }

  isEmpty(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM port_forward_events").get() as {
      count: number;
    };
    return row.count === 0;
  }

  list(): PersistedPortForwardEventHistoryItem[] {
    const rows = this.db
      .prepare("SELECT * FROM port_forward_events ORDER BY created_at DESC")
      .all() as PortForwardEventRow[];
    const items: PersistedPortForwardEventHistoryItem[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.payload_json) as PersistedPortForwardEventHistoryItem;
        if (!parsed || typeof parsed !== "object" || parsed.key !== row.entry_key) {
          continue;
        }
        items.push(parsed);
      } catch {
        // Skip corrupt rows.
      }
    }
    return items;
  }

  replaceAll(items: PersistedPortForwardEventHistoryItem[]): void {
    const replace = this.db.transaction((next: PersistedPortForwardEventHistoryItem[]) => {
      this.db.prepare("DELETE FROM port_forward_events").run();
      for (const item of next) {
        this.insertEvent.run({
          entry_key: item.key,
          session_id: item.sessionId,
          created_at: item.createdAt,
          payload_json: JSON.stringify(item)
        });
      }
    });
    replace(items);
  }
}
