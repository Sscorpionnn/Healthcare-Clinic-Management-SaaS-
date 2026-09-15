import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { CSRF_HEADER, CSRF_TOKEN_COOKIE, MUTATING_METHODS } from "../constants";
import { SKIP_CSRF_KEY } from "../decorators/skip-csrf.decorator";
import { timingSafeEqualString } from "../utils/hash";

/**
 * Double-submit CSRF defense: every mutating request must echo the
 * `csrf_token` cookie value in the `X-CSRF-Token` header. Also validates
 * `Origin`/`Referer` against `CORS_ORIGIN` as defense in depth — see
 * docs/api-contract.md and docs/threat-model.md T8.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!MUTATING_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const allowedOrigin = this.config.get<string>("CORS_ORIGIN");
    const origin = request.headers.origin ?? request.headers.referer;
    if (allowedOrigin && origin && !origin.startsWith(allowedOrigin)) {
      throw new ForbiddenException("Origin not allowed");
    }

    const cookieToken = request.cookies?.[CSRF_TOKEN_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];

    if (
      !cookieToken ||
      typeof headerToken !== "string" ||
      !timingSafeEqualString(cookieToken, headerToken)
    ) {
      throw new ForbiddenException("Missing or invalid CSRF token");
    }

    return true;
  }
}
