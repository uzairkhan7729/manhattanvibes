/**
 * Thin fetch wrapper for the Manhattan Vibes API.
 *
 * - Bearer token loaded from auth store
 * - Automatic refresh on 401 (single in-flight refresh; subsequent calls await it)
 * - RFC 7807 error parsing
 */
import { useAuthStore } from './auth-store';

const BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let inflightRefresh: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return false;
  inflightRefresh = (async () => {
    try {
      const r = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!r.ok) { clear(); return false; }
      const data = await r.json() as { accessToken: string; refreshToken: string; expiresIn: number };
      setTokens(data.accessToken, data.refreshToken, data.expiresIn);
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

async function rawRequest<T>(method: string, path: string, body?: unknown, attemptRefresh = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (r.status === 401 && attemptRefresh && accessToken) {
    const refreshed = await refreshOnce();
    if (refreshed) return rawRequest<T>(method, path, body, false);
  }

  const text = await r.text();
  const parsed: unknown = text ? (() => { try { return JSON.parse(text) as unknown; } catch { return text; } })() : null;
  if (!r.ok) {
    const p = parsed as { code?: string; title?: string; detail?: string; fields?: Record<string, string> } | string | null;
    if (p && typeof p === 'object') {
      throw new ApiError(r.status, p.code ?? 'error', p.detail ?? p.title ?? `HTTP ${r.status}`, p.fields);
    }
    throw new ApiError(r.status, 'error', `HTTP ${r.status}: ${String(p ?? '')}`);
  }
  return parsed as T;
}

export const api = {
  get:    <T>(path: string)                       => rawRequest<T>('GET',    path),
  post:   <T>(path: string, body?: unknown)       => rawRequest<T>('POST',   path, body),
  patch:  <T>(path: string, body?: unknown)       => rawRequest<T>('PATCH',  path, body),
  del:    <T>(path: string)                       => rawRequest<T>('DELETE', path),
};
