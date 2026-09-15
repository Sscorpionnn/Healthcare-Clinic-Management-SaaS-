import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Opt a route OUT of the default-deny auth requirement. Every route is
 * authenticated unless explicitly marked @Public() — see docs/threat-model.md
 * T3. Keep this list short and intentional; each use is a route that never
 * requires a session.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
