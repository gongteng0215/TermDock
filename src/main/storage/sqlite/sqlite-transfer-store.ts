import type {
  PersistedTransferHistoryItem,
  PersistedTransferPendingRestoreItem
} from "../../../shared/transfer-persistence.js";
import type Database from "better-sqlite3";

interface TransferHistoryRow {
  entry_key: string;
  session_id: string;
  direction: string;
  status: string;
  name: string;
  local_path: string;
  remote_path: string;
  updated_at: number;
  attempt_count: number;
  message: string | null;
}

interface TransferPendingRow {
  entry_key: string;
  session_id: string;
  direction: string;
  local_path: string;
  remote_path: string;
  name: string;
}

function rowToHistoryItem(row: TransferHistoryRow): PersistedTransferHistoryItem {
  const item: PersistedTransferHistoryItem = {
    key: row.entry_key,
    sessionId: row.session_id,
    direction: row.direction as PersistedTransferHistoryItem["direction"],
    status: row.status as PersistedTransferHistoryItem["status"],
    name: row.name,
    localPath: row.local_path,
    remotePath: row.remote_path,
    updatedAt: row.updated_at,
    attemptCount: row.attempt_count
  };
  if (row.message) {
    item.message = row.message;
  }
  return item;
}

function rowToPendingItem(row: TransferPendingRow): PersistedTransferPendingRestoreItem {
  return {
    key: row.entry_key,
    sessionId: row.session_id,
    direction: row.direction as PersistedTransferPendingRestoreItem["direction"],
    localPath: row.local_path,
    remotePath: row.remote_path,
    name: row.name
  };
}

export class SqliteTransferStore {
  private readonly db: Database.Database;
  private readonly insertHistory: Database.Statement;
  private readonly insertPending: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertHistory = this.db.prepare(`
INSERT INTO transfer_history (
  entry_key, session_id, direction, status, name, local_path, remote_path,
  updated_at, attempt_count, message
) VALUES (
  @entry_key, @session_id, @direction, @status, @name, @local_path, @remote_path,
  @updated_at, @attempt_count, @message
)`);
    this.insertPending = this.db.prepare(`
INSERT INTO transfer_pending_restore (
  entry_key, session_id, direction, local_path, remote_path, name
) VALUES (
  @entry_key, @session_id, @direction, @local_path, @remote_path, @name
)`);
  }

  listHistory(): PersistedTransferHistoryItem[] {
    const rows = this.db
      .prepare("SELECT * FROM transfer_history ORDER BY updated_at DESC")
      .all() as TransferHistoryRow[];
    return rows.map(rowToHistoryItem);
  }

  isHistoryEmpty(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM transfer_history").get() as {
      count: number;
    };
    return row.count === 0;
  }

  replaceHistory(items: PersistedTransferHistoryItem[]): void {
    const replace = this.db.transaction((next: PersistedTransferHistoryItem[]) => {
      this.db.prepare("DELETE FROM transfer_history").run();
      for (const item of next) {
        this.insertHistory.run({
          entry_key: item.key,
          session_id: item.sessionId,
          direction: item.direction,
          status: item.status,
          name: item.name,
          local_path: item.localPath,
          remote_path: item.remotePath,
          updated_at: item.updatedAt,
          attempt_count: item.attemptCount,
          message: item.message ?? null
        });
      }
    });
    replace(items);
  }

  listPendingRestore(): PersistedTransferPendingRestoreItem[] {
    const rows = this.db
      .prepare("SELECT * FROM transfer_pending_restore")
      .all() as TransferPendingRow[];
    return rows.map(rowToPendingItem);
  }

  isPendingRestoreEmpty(): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM transfer_pending_restore")
      .get() as { count: number };
    return row.count === 0;
  }

  replacePendingRestore(items: PersistedTransferPendingRestoreItem[]): void {
    const replace = this.db.transaction((next: PersistedTransferPendingRestoreItem[]) => {
      this.db.prepare("DELETE FROM transfer_pending_restore").run();
      for (const item of next) {
        this.insertPending.run({
          entry_key: item.key,
          session_id: item.sessionId,
          direction: item.direction,
          local_path: item.localPath,
          remote_path: item.remotePath,
          name: item.name
        });
      }
    });
    replace(items);
  }
}
