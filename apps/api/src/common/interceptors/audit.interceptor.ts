import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import {
  AUDIT_RESOURCE_KEY,
  AUDIT_SKIP_KEY,
} from "../decorators/audit-resource.decorator";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser, TenantContext } from "../types/auth.types";
import { hashIdentifier } from "../utils/hash";

const CLINICAL_RESOURCES = new Set([
  "MedicalRecord",
  "TreatmentNote",
  "Document",
]);
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Writes an append-only AuditLog entry: actor, action, resource type/id,
 * tenant, hashed IP/UA, redacted metadata — never the clinical content
 * itself. See docs/privacy-model.md, Audit log privacy.
 *
 * Logs every mutating request against a tenant-scoped resource, plus
 * CLINIC_ADMIN reads of clinical resources (elevated-severity logging per
 * docs/rbac.md — compliance-investigation access, not routine use).
 * Platform (/admin/*) actions are logged explicitly by their own services
 * using the platform client, not by this interceptor — see
 * docs/multi-tenancy.md, cross-tenant actions are audited with an explicit
 * reason code, which only the calling service has.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const skip = this.reflector.getAllAndOverride<boolean>(AUDIT_SKIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const resourceType = this.reflector.getAllAndOverride<string | undefined>(
      AUDIT_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skip || !resourceType) return next.handle();

    const user = request.user as AuthenticatedUser | undefined;
    const tenant = request.tenant as TenantContext | undefined;
    if (!user || !tenant) return next.handle();

    const isMutation = MUTATING.has(request.method);
    const isElevatedRead =
      request.method === "GET" &&
      user.role === "CLINIC_ADMIN" &&
      CLINICAL_RESOURCES.has(resourceType);

    if (!isMutation && !isElevatedRead) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const resourceId = (
          request.params as Record<string, string> | undefined
        )?.id;
        void this.prisma
          .runTenant(tenant, (tx) =>
            tx.auditLog.create({
              data: {
                clinicId: tenant.clinicId,
                actorUserId: user.sub,
                actorRole: user.role ?? null,
                action: `${request.method} ${context.getClass().name}.${context.getHandler().name}`,
                resourceType,
                resourceId: resourceId ?? null,
                ipHash: hashIdentifier(request.ip) ?? null,
                userAgentHash:
                  hashIdentifier(request.headers["user-agent"]) ?? null,
                metadata: isElevatedRead ? { elevatedRead: true } : undefined,
              },
            }),
          )
          .catch(() => {
            // Audit-log failure must never break the primary request, but is
            // never silently swallowed in a way that hides a broken pipeline
            // — a production deployment should wire this to error monitoring.
          });
      }),
    );
  }
}
