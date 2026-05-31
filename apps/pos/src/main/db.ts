import { app } from 'electron';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export type Db = Database.Database;

/**
 * Local SQLite store.
 *   kv      — small key/value store (auth tokens, branch selection, sync cursor)
 *   outbox  — operations awaiting sync to the central API
 *   inbox   — server-pushed deltas (catalog updates) not yet consumed by the renderer
 *
 * WAL mode for better concurrency. In production this DB is encrypted with
 * SQLCipher; in dev we ship plain SQLite for simplicity.
 */
export function openDb(): Db {
  const dir = join(app.getPath('userData'), 'mv-pos');
  mkdirSync(dir, { recursive: true });
  const db = new Database(join(dir, 'pos.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbox (
      client_op_id TEXT PRIMARY KEY,
      ts           TEXT NOT NULL,
      op           TEXT NOT NULL,
      payload      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      attempts     INTEGER NOT NULL DEFAULT 0,
      last_error   TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox(status, created_at);

    CREATE TABLE IF NOT EXISTS inbox (
      cursor TEXT NOT NULL,
      kind   TEXT NOT NULL,
      payload TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
