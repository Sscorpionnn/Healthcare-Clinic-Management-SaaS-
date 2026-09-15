import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type {
  AccessTokenPayload,
  PreauthTokenPayload,
} from "../common/types/auth.types";

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired session");
    }
  }

  signPreauthToken(userId: string): string {
    const payload: PreauthTokenPayload = {
      sub: userId,
      purpose: "clinic-selection",
    };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: 5 * 60,
    });
  }

  async verifyPreauthToken(token: string): Promise<PreauthTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<PreauthTokenPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      if (payload.purpose !== "clinic-selection")
        throw new Error("wrong purpose");
      return payload;
    } catch {
      throw new UnauthorizedException(
        "Invalid or expired clinic-selection session",
      );
    }
  }

  get accessTokenTtlMs(): number {
    return parseDuration(this.config.get<string>("JWT_ACCESS_TTL", "15m"));
  }

  get refreshTokenTtlMs(): number {
    return parseDuration(this.config.get<string>("JWT_REFRESH_TTL", "7d"));
  }
}

/** Parses a small duration grammar ("15m", "7d", "30s") into milliseconds. */
function parseDuration(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) return 15 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
    unit as "s" | "m" | "h" | "d"
  ];
  return amount * unitMs;
}
