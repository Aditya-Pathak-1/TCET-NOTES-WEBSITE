const BASE = '/api/v1';

type FetchOptions = RequestInit & { json?: unknown };

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { json, ...rest } = options;
  const headers: Record<string, string> = {
    ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(rest.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json().then((d: { data: T }) => d.data);
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', json: body });
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PUT', json: body });
}

export async function apiDelete(path: string): Promise<void> {
  return apiFetch<void>(path, { method: 'DELETE' });
}

/** Multipart upload (POST or PUT with a file) */
export async function apiUpload<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method, body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json().then((d: { data: T }) => d.data);
}
