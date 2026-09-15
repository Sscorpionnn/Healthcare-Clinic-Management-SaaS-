import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Type,
} from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import type { Request } from "express";
import { POLICY_KEY } from "../decorators/check-policy.decorator";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser, TenantContext } from "../types/auth.types";
import type { ResourcePolicy } from "../types/policy";

/**
 * Row-level ownership enforcement — see docs/rbac.md, PolicyGuard. Runs
 * after RolesGuard. A denied policy check maps to 404 (never 403) so a
 * cross-tenant/cross-owner probe cannot distinguish "not yours" from
 * "doesn't exist" — see docs/multi-tenancy.md, IDOR prevention.
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyType = this.reflector.getAllAndOverride<
      Type<ResourcePolicy> | undefined
    >(POLICY_KEY, [context.getHandler(), context.getClass()]);
    if (!policyType) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    const tenant = request.tenant as TenantContext | undefined;
    if (!user || !tenant) {
      throw new ForbiddenException(
        "Missing authentication context for policy check",
      );
    }

    const policy = this.moduleRef.get(policyType, { strict: false });
    const allowed = await this.prisma.runTenant(tenant, (tx) =>
      policy.check({
        user,
        tenant,
        params: request.params as Record<string, string>,
        tx,
      }),
    );

    if (!allowed) {
      throw new NotFoundException();
    }
    return true;
  }
}
