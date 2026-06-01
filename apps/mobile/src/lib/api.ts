import { useAuth } from './auth';
import { API_BASE } from './config';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

let inflightRefresh: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  const { refreshToken, setSession, clear, userId } = useAuth.getState();
  if (!refreshToken || !userId) return false;
  inflightRefresh = (async () => {
    try {
      const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
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
  const init: RequestInit = {
    method,
    headers: {
      accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const r = await fetch(`${API_BASE}/api/v1${path}`, init);

  if (r.status === 401 && attemptRefresh && headers?.authorization) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      const fresh = useAuth.getState().accessToken;
      return request<T>(method, path, body, { ...headers, authorization: `Bearer ${fresh}` }, false);
    }
  }

  const text = await r.text();
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
