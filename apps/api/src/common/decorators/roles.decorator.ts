import { SetMetadata } from "@nestjs/common";
import type { Role } from "@clinic/shared";

export const ROLES_KEY = "roles";

/** Coarse role gate for a route — see docs/rbac.md, RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
