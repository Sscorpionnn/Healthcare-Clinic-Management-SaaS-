import { SetMetadata } from "@nestjs/common";

export const AUDIT_RESOURCE_KEY = "auditResource";
export const AUDIT_SKIP_KEY = "auditSkip";

/** Names the resource type recorded in AuditLog.resourceType for this controller/route. */
export const AuditResource = (resourceType: string) =>
  SetMetadata(AUDIT_RESOURCE_KEY, resourceType);

/** Opts a route out of automatic audit logging (e.g. list/read endpoints with no elevated sensitivity). */
export const SkipAudit = () => SetMetadata(AUDIT_SKIP_KEY, true);
