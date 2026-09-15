import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PLATFORM_ROUTE_KEY } from "../decorators/platform-route.decorator";
import type { AuthenticatedUser } from "../types/auth.types";

/**
 * Attaches an immutable tenant context to the request, sourced ONLY from
 * the verified JWT claims set by AuthGuard — never from route params, query,
 * or body. See docs/multi-tenancy.md, Layer 1.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPlatformRoute = this.reflector.getAllAndOverride<boolean>(
      IS_PLATFORM_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) return true; // @Public() route with no session — nothing to scope

    if (isPlatformRoute) {
      if (!user.isSuperAdmin) {
        throw new ForbiddenException("Platform route requires SUPER_ADMIN");
      }
      return true;
    }

    if (user.isSuperAdmin) {
      // SUPER_ADMIN tokens carry no clinicId and must use /admin/* routes for
      // any cross-tenant action; they have no tenant context for ordinary routes.
      throw new ForbiddenException(
        "SUPER_ADMIN must use platform routes for this operation",
      );
    }

    if (!user.clinicId) {
      throw new ForbiddenException("Session is missing tenant context");
    }

    request.tenant = { clinicId: user.clinicId };
    return true;
  }
}
