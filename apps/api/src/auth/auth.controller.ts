import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import {
  acceptInviteSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  selectClinicSchema,
} from "@clinic/shared";
import { Public } from "../common/decorators/public.decorator";
import { SkipCsrf } from "../common/decorators/skip-csrf.decorator";
import { SkipAudit } from "../common/decorators/audit-resource.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod/zod-validation.pipe";
import {
  PREAUTH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../common/constants";
import {
  clearSessionCookies,
  setPreauthCookie,
  setSessionCookies,
} from "../common/utils/cookies";
import type { AuthenticatedUser } from "../common/types/auth.types";
import { AuthService } from "./auth.service";
import { LoginRateLimitGuard } from "./login-rate-limit.guard";
import { PrismaService } from "../common/prisma/prisma.service";

@Controller("auth")
@SkipAudit()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private cookieEnv() {
    return {
      isProduction: this.config.get("NODE_ENV") === "production",
      cookieDomain: this.config.get<string>("COOKIE_DOMAIN"),
    };
  }

  @Public()
  @SkipCsrf()
  @UseGuards(LoginRateLimitGuard)
  @UsePipes(new ZodValidationPipe(loginSchema))
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body.email, body.password, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (result.requiresClinicSelection) {
      setPreauthCookie(res, this.cookieEnv(), result.preauthToken);
      return { requiresClinicSelection: true, memberships: result.memberships };
    }

    setSessionCookies(res, this.cookieEnv(), result);
    return { user: result.user };
  }

  @Public()
  @SkipCsrf()
  @UsePipes(new ZodValidationPipe(selectClinicSchema))
  @Post("select-clinic")
  @HttpCode(HttpStatus.OK)
  async selectClinic(
    @Body() body: { membershipId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const preauthToken = req.cookies?.[PREAUTH_TOKEN_COOKIE];
    if (!preauthToken) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ title: "Missing clinic-selection session", status: 401 });
    }
    const session = await this.auth.selectClinic(
      preauthToken,
      body.membershipId,
      { ip: req.ip, userAgent: req.headers["user-agent"] },
    );
    setSessionCookies(res, this.cookieEnv(), session);
    res.clearCookie(PREAUTH_TOKEN_COOKIE, {
      domain: this.cookieEnv().cookieDomain,
      path: "/",
    });
    return { user: session.user };
  }

  @Public()
  @SkipCsrf()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!rawRefreshToken) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ title: "No session to refresh", status: 401 });
    }
    const session = await this.auth.refresh(rawRefreshToken, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setSessionCookies(res, this.cookieEnv(), session);
    return { user: session.user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_TOKEN_COOKIE]);
    clearSessionCookies(res, this.cookieEnv());
  }

  @Public()
  @SkipCsrf()
  @UsePipes(new ZodValidationPipe(acceptInviteSchema))
  @Post("invite/accept")
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Body() body: { token: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.acceptInvite(body.token, body.password, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setSessionCookies(res, this.cookieEnv(), session);
    return { user: session.user };
  }

  @Public()
  @SkipCsrf()
  @UseGuards(LoginRateLimitGuard)
  @UsePipes(new ZodValidationPipe(requestPasswordResetSchema))
  @Post("password-reset/request")
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPasswordReset(@Body() body: { email: string }) {
    await this.auth.requestPasswordReset(body.email);
    return { title: "If that email exists, a reset link has been sent." };
  }

  @Public()
  @SkipCsrf()
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(
    @Body() body: { token: string; password: string },
  ) {
    await this.auth.confirmPasswordReset(body.token, body.password);
    return { title: "Password updated." };
  }

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    if (user.isSuperAdmin) {
      return { id: user.sub, isSuperAdmin: true };
    }
    const memberships = await this.prisma.platform.membership.findMany({
      where: { userId: user.sub, status: "ACTIVE" },
      include: { clinic: true },
    });
    return {
      id: user.sub,
      isSuperAdmin: false,
      currentMembershipId: user.membershipId,
      currentClinicId: user.clinicId,
      currentRole: user.role,
      memberships: memberships.map((m) => ({
        membershipId: m.id,
        clinicId: m.clinicId,
        clinicName: m.clinic.name,
        role: m.role,
      })),
    };
  }
}
