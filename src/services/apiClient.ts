/**
 * Drop-in replacement for xanoClient.ts
 *
 * Instead of calling Xano, this calls our own Next.js API routes at /api/...
 * The shape is identical — all service files (journey.ts, providers.ts, etc.)
 * work without any changes except swapping the import.
 */

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const BASE_URL =
  typeof window !== "undefined"
    ? "" // relative in browser
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}/api${path}`;

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // 204 No Content
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed: ${res.status} ${res.statusText}`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}
