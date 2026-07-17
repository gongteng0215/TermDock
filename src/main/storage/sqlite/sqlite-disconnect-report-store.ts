import type { PersistedDisconnectReportItem } from "../../../shared/disconnect-report-persistence.js";
import type Database from "better-sqlite3";

interface DisconnectReportRow {
  id: string;
  created_at: string;
  session_id: string;
  payload_json: string;
}

export class SqliteDisconnectReportStore {
  private readonly db: Database.Database;
  private readonly insertReport: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertReport = this.db.prepare(`
INSERT INTO disconnect_reports (id, created_at, session_id, payload_json)
VALUES (@id, @created_at, @session_id, @payload_json)
`);
  }

  isEmpty(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM disconnect_reports").get() as {
      count: number;
    };
    return row.count === 0;
  }

  list(): PersistedDisconnectReportItem[] {
    const rows = this.db
      .prepare("SELECT * FROM disconnect_reports ORDER BY created_at DESC")
      .all() as DisconnectReportRow[];
    const items: PersistedDisconnectReportItem[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.payload_json) as PersistedDisconnectReportItem;
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

  replaceAll(items: PersistedDisconnectReportItem[]): void {
    const replace = this.db.transaction((next: PersistedDisconnectReportItem[]) => {
      this.db.prepare("DELETE FROM disconnect_reports").run();
      for (const item of next) {
        this.insertReport.run({
          id: item.id,
          created_at: item.createdAt,
          session_id: item.sessionId,
          payload_json: JSON.stringify(item)
        });
      }
    });
    replace(items);
  }
}
