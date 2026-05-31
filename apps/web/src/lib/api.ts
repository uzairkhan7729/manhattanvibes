// Lightweight fetch client used by both server and client components.
// On the server (Next.js) we hit the API origin directly; on the client we use
// the Next.js rewrite at /api/* (avoids CORS in dev).
//
// On the client, transparently refresh-and-retry once on a 401, using the
// persisted refresh token from useAuth. Single-flight refresh: concurrent
// requests share one in-flight refresh call so we don't burn the rotation
// chain (every refresh invalidates the previous refresh token).

import { useAuth } from './auth-store';

const SERVER_BASE = process.env.API_BASE_URL ?? 'http://localhost:8088';
const CLIENT_BASE = '';                                            // rewritten by next.config
const isBrowser = (): boolean => typeof window !== 'undefined';

function base(): string { return isBrowser() ? CLIENT_BASE : SERVER_BASE; }

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

let inflightRefresh: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (!isBrowser()) return false;
  if (inflightRefresh) return inflightRefresh;
  const { refreshToken, setTokens, clear } = useAuth.getState();
  if (!refreshToken) return false;

  inflightRefresh = (async () => {
    try {
      const r = await fetch(`${base()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (!r.ok) { clear(); return false; }
      const data = await r.json() as { accessToken: string; refreshToken: string; expiresIn: number };
      setTokens(data.accessToken, data.refreshToken);
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

/**
 * If the caller passed an `Authorization: Bearer …` header that's now stale,
 * swap it for the freshly-rotated token before retrying.
 */
function refreshAuthHeader(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers || !headers.authorization) return headers;
  const token = isBrowser() ? useAuth.getState().accessToken : null;
  if (!token) return headers;
  return { ...headers, authorization: `Bearer ${token}` };
}

async function request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>, attemptRefresh = true): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const r = await fetch(`${base()}/api/v1${path}`, init);

  if (r.status === 401 && attemptRefresh && headers?.authorization) {
    const ok = await refreshOnce();
    if (ok) return request<T>(method, path, body, refreshAuthHeader(headers), false);
  }

  return parse<T>(r);
}

export async function apiGet<T>(path: string, headers?: Record<string, string>): Promise<T> {
  return request<T>('GET', path, undefined, headers);
}

export async function apiPost<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  return request<T>('POST', path, body, headers);
}

async function parse<T>(r: Response): Promise<T> {
  const text = await r.text();
  const parsed: unknown = text ? (() => { try { return JSON.parse(text) as unknown; } catch { return text; } })() : null;
  if (!r.ok) {
    const p = parsed as { code?: string; detail?: string; title?: string } | string | null;
    if (p && typeof p === 'object') throw new ApiError(r.status, p.code ?? 'error', p.detail ?? p.title ?? `HTTP ${r.status}`);
    throw new ApiError(r.status, 'error', `HTTP ${r.status}`);
  }
  return parsed as T;
}
