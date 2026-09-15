import { SetMetadata } from "@nestjs/common";

export const IS_PLATFORM_ROUTE_KEY = "isPlatformRoute";

/**
 * Marks a route as a platform-level (/admin/*) operation. TenantGuard skips
 * clinic-scoping for these; RolesGuard still requires SUPER_ADMIN. Use only
 * in the `clinics` admin module and platform-wide audit-log reads.
 */
export const PlatformRoute = () => SetMetadata(IS_PLATFORM_ROUTE_KEY, true);
