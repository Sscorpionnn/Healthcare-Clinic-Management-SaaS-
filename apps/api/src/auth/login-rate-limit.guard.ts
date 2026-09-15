import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.module";

/**
 * Dedicated per-IP AND per-account brute-force defense for the
 * authentication bootstrap endpoints, on top of the general ThrottlerGuard
 * — see docs/threat-model.md T4. Configured via `RATE_LIMIT_LOGIN_MAX` /
 * `RATE_LIMIT_LOGIN_WINDOW_SECONDS`.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const max = this.config.get<number>("RATE_LIMIT_LOGIN_MAX", 5);
    const windowSeconds = this.config.get<number>(
      "RATE_LIMIT_LOGIN_WINDOW_SECONDS",
      60,
    );

    const email =
      typeof request.body?.email === "string"
        ? request.body.email.toLowerCase()
        : undefined;
    const keys = [
      `rl:auth:ip:${request.ip}`,
      ...(email ? [`rl:auth:email:${email}`] : []),
    ];

    for (const key of keys) {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, windowSeconds);
      }
      if (count > max) {
        throw new HttpException(
          {
            title: "Too many attempts",
            detail: "Please wait before trying again.",
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }
}
