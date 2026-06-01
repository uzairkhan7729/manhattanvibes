import { useAuth } from './auth';
import { getApiBase } from './config';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

// In-memory log accessible from the in-app Debug screen — every call is
// appended here so you can see what URLs were hit and what came back
// without needing a remote debugger.
export interface LogEntry {
  id: number;
  ts: number;
  method: string;
  url: string;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  error?: string;
  response?: string;
}
const MAX_LOG = 50;
let logId = 0;
export const requestLog: LogEntry[] = [];
const logListeners = new Set<() => void>();
function notifyLog(): void { logListeners.forEach((l) => l()); }

function pushLog(e: LogEntry): void {
  requestLog.unshift(e);
  if (requestLog.length > MAX_LOG) requestLog.length = MAX_LOG;
  notifyLog();
}

export function subscribeLog(cb: () => void): () => void {
  logListeners.add(cb);
  return () => { logListeners.delete(cb); };
}

let inflightRefresh: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  const { refreshToken, setSession, clear, userId } = useAuth.getState();
  if (!refreshToken || !userId) return false;
  inflightRefresh = (async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!r.ok) { clear(); return false; }
      const data = await r.json() as { accessToken: string; refreshToken: string };
      setSession(userId, data.accessToken, data.refreshToken);
      return true;
    } catch {
      clear();
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

async function request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>, attemptRefresh = true): Promise<T> {
  const url = `${getApiBase()}/api/v1${path}`;
  const init: RequestInit = {
    method,
    headers: {
      accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const entry: LogEntry = { id: ++logId, ts: Date.now(), method, url };
  const started = Date.now();
  // eslint-disable-next-line no-console
  console.log(`→ ${method} ${url}`);

  let r: Response;
  try {
    r = await fetch(url, init);
  } catch (err: unknown) {
    entry.durationMs = Date.now() - started;
    entry.error = err instanceof Error ? err.message : String(err);
    pushLog(entry);
    // eslint-disable-next-line no-console
    console.error(`✗ ${method} ${url}  network failed:`, entry.error);
    throw new ApiError(0, 'network-failed', `Could not reach ${url}\n${entry.error}`);
  }

  entry.status = r.status;
  entry.ok = r.ok;
  entry.durationMs = Date.now() - started;
  // eslint-disable-next-line no-console
  console.log(`← ${r.status} ${method} ${url} (${entry.durationMs}ms)`);

  if (r.status === 401 && attemptRefresh && headers?.authorization) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      const fresh = useAuth.getState().accessToken;
      pushLog(entry);
      return request<T>(method, path, body, { ...headers, authorization: `Bearer ${fresh}` }, false);
    }
  }

  const text = await r.text();
  entry.response = text.slice(0, 400);
  pushLog(entry);

  const parsed: unknown = text ? (() => { try { return JSON.parse(text) as unknown; } catch { return text; } })() : null;
  if (!r.ok) {
    const p = parsed as { code?: string; detail?: string; title?: string } | string | null;
    if (p && typeof p === 'object') throw new ApiError(r.status, p.code ?? 'error', p.detail ?? p.title ?? `HTTP ${r.status}`);
    throw new ApiError(r.status, 'error', `HTTP ${r.status}`);
  }
  return parsed as T;
}

export const api = {
  get:  <T>(path: string, headers?: Record<string, string>) => request<T>('GET',  path, undefined, headers),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>('POST', path, body, headers),
};
