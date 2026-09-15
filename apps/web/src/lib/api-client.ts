"use client";

// Browser-side API client. Tokens live only in httpOnly cookies the browser
// can't read — see docs/architecture.md "Frontend shape". This file only
// ever reads the *non*-httpOnly `csrf_token` cookie, by design (the
// double-submit CSRF pattern requires the client to be able to read it).
import { API_V1_PREFIX, PUBLIC_API_URL } from "./config";
import { ApiError, parseErrorResponse } from "./api-error";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${PUBLIC_API_URL}${API_V1_PREFIX}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": readCookie("csrf_token") ?? "" },
    })
      .then((res) => res.ok)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Skip the automatic refresh-and-retry on 401 (used by auth endpoints themselves). */
  skipAuthRetry?: boolean;
};

function buildUrl(path: string, query?: ApiFetchOptions["query"]): string {
  const url = new URL(`${API_V1_PREFIX}${path}`, PUBLIC_API_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const url = buildUrl(path, options.query);

  const doFetch = () =>
    fetch(url, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(MUTATING_METHODS.has(method)
          ? { "X-CSRF-Token": readCookie("csrf_token") ?? "" }
          : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let response = await doFetch();

  if (
    response.status === 401 &&
    !options.skipAuthRetry &&
    path !== "/auth/refresh"
  ) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await doFetch();
    } else {
      if (typeof window !== "undefined") {
        // Plain module, not a component — useRouter() isn't available here.
        // A full navigation is also the right call on session loss: it
        // drops all client-side (React Query, form) state rather than
        // leaving stale authenticated UI mounted.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }
      throw new ApiError({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
      });
    }
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};
