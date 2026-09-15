export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const CSRF_TOKEN_COOKIE = "csrf_token";
export const PREAUTH_TOKEN_COOKIE = "preauth_token";
export const CSRF_HEADER = "x-csrf-token";

export const PREAUTH_TTL_SECONDS = 5 * 60;

export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
