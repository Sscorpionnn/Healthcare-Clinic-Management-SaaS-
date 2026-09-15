import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { TenantContext } from "../types/auth.types";

/** The authenticated tenant context attached by TenantGuard. Never derived from params/body/query. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);
