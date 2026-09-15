import type { Response } from "express";
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  PREAUTH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../constants";

export interface CookieEnv {
  isProduction: boolean;
  cookieDomain?: string;
}

function baseOptions(env: CookieEnv, maxAgeMs: number, httpOnly: boolean) {
  return {
    httpOnly,
    secure: env.isProduction,
    sameSite: "strict" as const,
    domain: env.cookieDomain,
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function setSessionCookies(
  res: Response,
  env: CookieEnv,
  tokens: {
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
    accessTtlMs: number;
    refreshTtlMs: number;
  },
) {
  res.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    baseOptions(env, tokens.accessTtlMs, true),
  );
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    baseOptions(env, tokens.refreshTtlMs, true),
  );
  // Non-httpOnly by design: the frontend must read it to echo it back in the
  // X-CSRF-Token header (double-submit pattern) — see docs/api-contract.md.
  res.cookie(
    CSRF_TOKEN_COOKIE,
    tokens.csrfToken,
    baseOptions(env, tokens.refreshTtlMs, false),
  );
}

export function setPreauthCookie(
  res: Response,
  env: CookieEnv,
  preauthToken: string,
) {
  res.cookie(
    PREAUTH_TOKEN_COOKIE,
    preauthToken,
    baseOptions(env, 5 * 60 * 1000, true),
  );
}

export function clearSessionCookies(res: Response, env: CookieEnv) {
  for (const name of [
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    CSRF_TOKEN_COOKIE,
    PREAUTH_TOKEN_COOKIE,
  ]) {
    res.clearCookie(name, { domain: env.cookieDomain, path: "/" });
  }
}
