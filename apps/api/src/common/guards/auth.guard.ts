import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { TokenService } from "../../auth/token.service";
import { ACCESS_TOKEN_COOKIE } from "../constants";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Default-deny authentication. Every route requires a valid `access_token`
 * cookie unless explicitly marked `@Public()` — see docs/threat-model.md T3.
 *
 * Also re-validates clinic/membership/user active status against the
 * database (not just JWT claims) so a suspension takes effect immediately
 * rather than waiting for the 15-minute access-token TTL to expire — see
 * docs/multi-tenancy.md, Tenant lifecycle / Suspension.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) throw new UnauthorizedException("Authentication required");

    const payload = await this.tokens.verifyAccessToken(token);

    if (payload.isSuperAdmin) {
      const user = await this.prisma.platform.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive || !user.isSuperAdmin) {
        throw new UnauthorizedException("Session no longer valid");
      }
      request.user = payload;
      return true;
    }

    if (!payload.clinicId || !payload.membershipId) {
      throw new UnauthorizedException("Malformed session");
    }

    const membership = await this.prisma.runTenant(
      { clinicId: payload.clinicId },
      (tx) =>
        tx.membership.findFirst({
          where: {
            id: payload.membershipId,
            userId: payload.sub,
            clinicId: payload.clinicId,
          },
          include: { user: true, clinic: true },
        }),
    );

    if (
      !membership ||
      membership.status !== "ACTIVE" ||
      !membership.user.isActive ||
      membership.clinic.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException("Session no longer valid");
    }

    request.user = payload;
    return true;
  }
}
