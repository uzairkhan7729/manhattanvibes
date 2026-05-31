import type { IpcMain } from 'electron';

import type { Db } from './db';

/**
 * IPC handlers exposed by the main process for sync operations. The renderer
 * pushes ops into outbox and asks main to drain (so SQLite stays single-writer).
 */
interface QueueOpInput {
  clientOpId: string;
  ts: string;
  op: 'ORDER_CREATE' | 'PAYMENT_CAPTURE';
  payload: unknown;
}

interface DrainConfig {
  apiBase: string;
  accessToken: string;
}

interface OutboxRow {
  client_op_id: string;
  ts: string;
  op: string;
  payload: string;
  status: string;
  attempts: number;
  last_error: string | null;
}

export function registerSyncIpc(ipc: IpcMain, db: Db): void {
  ipc.handle('outbox:enqueue', (_e, op: QueueOpInput): void => {
    db.prepare(`
      INSERT INTO outbox (client_op_id, ts, op, payload)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(client_op_id) DO NOTHING
    `).run(op.clientOpId, op.ts, op.op, JSON.stringify(op.payload));
  });

  ipc.handle('outbox:list', (_e, status: string | null): OutboxRow[] => {
    if (status) return db.prepare('SELECT * FROM outbox WHERE status = ? ORDER BY created_at').all(status) as OutboxRow[];
    return db.prepare('SELECT * FROM outbox ORDER BY created_at DESC LIMIT 100').all() as OutboxRow[];
  });

  ipc.handle('outbox:depth', (): number => {
    const row = db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'").get() as { n: number };
    return row.n;
  });

  ipc.handle('outbox:drain', async (_e, cfg: DrainConfig): Promise<{ applied: number; failed: number; conflicts: number }> => {
    const pending = db.prepare("SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 50").all() as OutboxRow[];
    if (pending.length === 0) return { applied: 0, failed: 0, conflicts: 0 };

    let applied = 0, failed = 0, conflicts = 0;
    try {
      const res = await fetch(`${cfg.apiBase}/api/v1/sync`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${cfg.accessToken}`,
        },
        body: JSON.stringify({
          deviceId: getOrSetDeviceId(db),
          ops: pending.map((r) => ({
            clientOpId: r.client_op_id,
            ts: r.ts,
            op: r.op,
            payload: JSON.parse(r.payload) as unknown,
          })),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        for (const row of pending) {
          db.prepare('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE client_op_id = ?').run(`HTTP ${res.status}: ${txt.slice(0, 200)}`, row.client_op_id);
        }
        failed = pending.length;
        return { applied, failed, conflicts };
      }
      const body = await res.json() as { results: Array<{ clientOpId: string; outcome: 'applied' | 'duplicate' | 'conflict' | 'invalid'; canonicalId?: string; error?: string }> };

      const tx = db.transaction((results: typeof body.results) => {
        for (const r of results) {
          if (r.outcome === 'applied' || r.outcome === 'duplicate') {
            db.prepare("UPDATE outbox SET status = 'acked' WHERE client_op_id = ?").run(r.clientOpId);
            applied++;
          } else if (r.outcome === 'conflict') {
            db.prepare("UPDATE outbox SET status = 'conflict', last_error = ? WHERE client_op_id = ?").run(r.error ?? 'conflict', r.clientOpId);
            conflicts++;
          } else {
            db.prepare("UPDATE outbox SET status = 'failed', last_error = ? WHERE client_op_id = ?").run(r.error ?? 'invalid', r.clientOpId);
            failed++;
          }
        }
      });
      tx(body.results);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const row of pending) {
        db.prepare('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE client_op_id = ?').run(msg, row.client_op_id);
      }
      failed = pending.length;
    }
    return { applied, failed, conflicts };
  });
}

function getOrSetDeviceId(db: Db): string {
  const row = db.prepare("SELECT value FROM kv WHERE key = 'deviceId'").get() as { value?: string } | undefined;
  if (row?.value) return row.value;
  const id = `POS-${Math.random().toString(36).slice(2, 10)}`;
  db.prepare('INSERT INTO kv (key, value) VALUES (?, ?)').run('deviceId', id);
  return id;
}
