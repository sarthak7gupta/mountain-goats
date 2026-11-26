export type { RoomSummary, ServerConfig, User } from './protocol';
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
interface RequestOptions {
  token?: string;
  data?: unknown;
  method?: 'GET' | 'POST';
  /** Milliseconds before giving up; long-poll requests wait longer than the default. */
  timeout?: number;
}
/**
 * One JSON client for every server call. Session cookies travel with the
 * request so an account keeps its seat on any device.
 */
export async function request<T = unknown>(
  path: string,
  { token, data, method, timeout = 10000 }: RequestOptions = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: method ?? (data === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      credentials: 'same-origin',
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new ApiError('Connection failed. Check your network and try again.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      (result as { error?: string }).error || 'Connection failed. Try again.',
      response.status
    );
  return result as T;
}
