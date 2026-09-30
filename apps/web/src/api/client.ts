/** The one way the web app talks to the API. Every request names the role it acts as, so four
 *  signed-in roles can share one browser, and carries X-Relay-Client, which the API requires on
 *  every change as a guard against cross-site requests. */

export type Role = "dispatcher" | "loader" | "driver" | "store_manager";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }

  get offline(): boolean {
    return this.status === 0;
  }
}

type Options = {
  role?: Role;
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(method: string, path: string, { role, body, signal }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Relay-Client": "web" };
  if (role) headers["X-Relay-Role"] = role;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "No connection");
  }
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = undefined;
    }
    const message =
      detail && typeof detail === "object" && "detail" in detail && typeof detail.detail === "string"
        ? detail.detail
        : response.statusText;
    throw new ApiError(response.status, message, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<Options, "body">) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<Options, "body">) =>
    request<T>("POST", path, { ...options, body: body ?? {} }),
  patch: <T>(path: string, body?: unknown, options?: Omit<Options, "body">) =>
    request<T>("PATCH", path, { ...options, body: body ?? {} }),
};
