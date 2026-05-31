// Lightweight fetch client used by both server and client components.
// On the server (Next.js) we hit the API origin directly; on the client we use
// the Next.js rewrite at /api/* (avoids CORS in dev).

const SERVER_BASE = process.env.API_BASE_URL ?? 'http://localhost:8088';
const CLIENT_BASE = '';                                            // rewritten by next.config

function base(): string { return typeof window === 'undefined' ? SERVER_BASE : CLIENT_BASE; }

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

export async function apiGet<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const r = await fetch(`${base()}/api/v1${path}`, {
    headers: { accept: 'application/json', ...(headers ?? {}) },
    cache: 'no-store',
  });
  return parse<T>(r);
}

export async function apiPost<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const r = await fetch(`${base()}/api/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(headers ?? {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return parse<T>(r);
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
