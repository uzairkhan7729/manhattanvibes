import { contextBridge, ipcRenderer } from 'electron';

interface OutboxRow {
  client_op_id: string;
  ts: string;
  op: string;
  payload: string;
  status: string;
  attempts: number;
  last_error: string | null;
}

interface QueueOp {
  clientOpId: string;
  ts: string;
  op: 'ORDER_CREATE' | 'PAYMENT_CAPTURE';
  payload: unknown;
}

const api = {
  kv: {
    get: (key: string)              => ipcRenderer.invoke('kv:get', key) as Promise<string | null>,
    set: (key: string, value: string) => ipcRenderer.invoke('kv:set', key, value) as Promise<void>,
    del: (key: string)              => ipcRenderer.invoke('kv:del', key) as Promise<void>,
  },
  outbox: {
    enqueue: (op: QueueOp)          => ipcRenderer.invoke('outbox:enqueue', op) as Promise<void>,
    list:    (status?: string)      => ipcRenderer.invoke('outbox:list', status ?? null) as Promise<OutboxRow[]>,
    depth:   ()                     => ipcRenderer.invoke('outbox:depth') as Promise<number>,
    drain:   (apiBase: string, accessToken: string) =>
      ipcRenderer.invoke('outbox:drain', { apiBase, accessToken }) as Promise<{ applied: number; failed: number; conflicts: number }>,
  },
};

/**
 * Expose the API on window.mv. Main always sets contextIsolation:true, so
 * contextBridge is always the right path. We previously gated this on
 * `process.contextIsolated` but that's undefined in ESM preload contexts,
 * which made the bridge silently fall through to globalThis (isolated from
 * the renderer) and window.mv was never defined.
 */
try {
  contextBridge.exposeInMainWorld('mv', api);
} catch (err: unknown) {
  // eslint-disable-next-line no-console
  console.error('[preload] contextBridge.exposeInMainWorld failed:', err);
}

export type MvApi = typeof api;
