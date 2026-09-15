import { SetMetadata } from "@nestjs/common";

export const SKIP_CSRF_KEY = "skipCsrf";

/**
 * Exempts a route from the double-submit CSRF check. Use ONLY for the
 * bootstrap auth endpoints that run before any `csrf_token` cookie exists
 * (login, select-clinic, refresh, invite/accept, password-reset) — see
 * docs/api-contract.md. Every other mutating route must be CSRF-checked.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
