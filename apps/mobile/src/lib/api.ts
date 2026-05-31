import { API_BASE } from './config';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const r = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
  get:  <T>(path: string, headers?: Record<string, string>)               => request<T>('GET',  path, undefined, headers),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>('POST', path, body, headers),
};
