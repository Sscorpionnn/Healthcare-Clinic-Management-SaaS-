import "server-only";
import { cookies } from "next/headers";
import { API_V1_PREFIX, PUBLIC_API_URL } from "./config";
import { ApiError, parseErrorResponse } from "./api-error";
import type { CurrentUser } from "./types";

const API_URL = process.env.API_URL ?? PUBLIC_API_URL;

/**
 * Server-side fetch for use in Server Components / Server Actions. Forwards
 * the visitor's session cookies to the API (server-to-server calls don't
 * carry browser cookies automatically) so `GET /auth/me` and other reads
 * are made as the authenticated user, never with elevated/service creds.
 */
export async function apiFetchServer<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${API_URL}${API_V1_PREFIX}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader,
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return (await response.json()) as T;
}

/** Returns null (never throws) when the visitor has no valid session — the
 * common case for layout-level auth checks. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await apiFetchServer<CurrentUser>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
