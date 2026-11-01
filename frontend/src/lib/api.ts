function resolveApiBase(value: string | undefined): string {
  const configured = value?.trim();
  if (!configured) {
    if (import.meta.env.PROD) {
      throw new Error('VITE_API_URL must be set for a production frontend build.');
    }
    return '/api';
  }
  return configured.replace(/\/+$/, '');
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const formatDate = (value: string) => new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(value));
export const percent = (value: number | null | undefined) => `${Math.round((value ?? 0) * 100)}%`;
