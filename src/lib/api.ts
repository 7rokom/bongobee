// Central Laravel API client (Phase 3 rewiring).
// Same-origin: the React SPA and the Laravel API are served from the same host,
// so relative "/api/..." URLs need no CORS handling.
//
// Sanctum issues a SEPARATE bearer token per guard (admin/employee, reseller,
// digital customer). We store them under distinct localStorage keys and pick the
// right one automatically from the request path.

const BASE = '/api';

export type TokenScope = 'admin' | 'reseller' | 'digital';

const TOKEN_KEYS: Record<TokenScope, string> = {
  admin: 'bongobee_admin_token',
  reseller: 'bongobee_reseller_token',
  digital: 'bongobee_digital_token',
};

export function setToken(scope: TokenScope, token: string): void {
  try { localStorage.setItem(TOKEN_KEYS[scope], token); } catch { /* ignore */ }
}

export function getToken(scope: TokenScope): string | null {
  try { return localStorage.getItem(TOKEN_KEYS[scope]); } catch { return null; }
}

export function clearToken(scope: TokenScope): void {
  try { localStorage.removeItem(TOKEN_KEYS[scope]); } catch { /* ignore */ }
}

// Decide which guard token a path belongs to. Public endpoints return null.
function scopeForPath(path: string): TokenScope | null {
  if (path.startsWith('/auth/reseller') || path.startsWith('/reseller')) return 'reseller';
  if (path.startsWith('/auth/digital') || path.startsWith('/digital/my-orders')) return 'digital';
  if (path.startsWith('/auth/admin') || path.startsWith('/admin')) return 'admin';
  return null; // /public/*, /digital storefront listing, etc.
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  payload?: any;
  constructor(message: string, status: number, errors?: Record<string, string[]>, payload?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.payload = payload;
  }
}

interface RequestOptions {
  scope?: TokenScope | null; // override automatic scope selection
  headers?: Record<string, string>;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(options.headers || {}) };

  // "/rs" (reseller-shared) paths are used by stores that run in BOTH the admin
  // and reseller-portal contexts — attach whichever guard token is present.
  if (path.startsWith('/rs/')) {
    const token = getToken('admin') || getToken('reseller') || getToken('digital');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } else {
    const scope = options.scope === undefined ? scopeForPath(path) : options.scope;
    if (scope) {
      const token = getToken(scope);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (scope === 'reseller') {
        // Admin impersonating a reseller: no reseller token exists, use admin token.
        // The backend reseller endpoints accept auth:admin,reseller for this reason.
        const adminToken = getToken('admin');
        if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      }
    }
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // browser sets multipart boundary
  } else if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });

  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data?.errors, data);
  }

  return data as T;
}

export const api = {
  get: <T = any>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T = any>(path: string, body?: any, options?: RequestOptions) => request<T>('POST', path, body, options),
  put: <T = any>(path: string, body?: any, options?: RequestOptions) => request<T>('PUT', path, body, options),
  patch: <T = any>(path: string, body?: any, options?: RequestOptions) => request<T>('PATCH', path, body, options),
  del: <T = any>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, options),
};
