// Layer 1 (application) tenant isolation — see docs/multi-tenancy.md.
// Layer 2 (Postgres RLS, prisma/rls.sql) is what makes isolation fail
// closed even if this layer has a bug; this layer exists so most queries
// never rely on RLS alone and so an accidental cross-tenant query is
// rejected before it reaches the database at all.
import { Prisma, PrismaClient } from "../generated/client";

// Models that carry `clinicId` directly and must always be scoped.
// (`Clinic` itself is excluded — its own `id` *is* the tenant id, scoped
// by the caller explicitly, not via this list.)
export const TENANT_SCOPED_MODELS = [
  "Department",
  "Membership",
  "DoctorProfile",
  "PatientProfile",
  "AvailabilitySlot",
  "Appointment",
  "MedicalRecord",
  "TreatmentNote",
  "Document",
  "Invoice",
  "Notification",
  "AuditLog",
  "DataExportRequest",
  "DeletionRequest",
] as const;

const LIST_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);
const BULK_WRITE_OPERATIONS = new Set(["updateMany", "deleteMany"]);
const CREATE_OPERATIONS = new Set(["create"]);
const CREATE_MANY_OPERATIONS = new Set(["createMany"]);

// Operations that address a single row by a unique key (id, etc). These
// cannot safely have `clinicId` merged into `where` by a generic extension
// (Prisma requires `findUnique`/`update`/`delete` `where` to reference a
// unique constraint only). Services MUST NOT call these directly for
// tenant-scoped models — use `assertTenantOwned` first, or the `ByIdScoped`
// helpers on `TenantScopedClient` below.
const UNSAFE_SINGLE_ROW_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

export type TenantContext = {
  clinicId: string;
};

/**
 * Wraps a Prisma transaction client so that every query against a
 * tenant-scoped model is automatically constrained to `clinicId`, and
 * disallows the single-row operations that can't be safely auto-scoped
 * (call `tenantScoped.byId(...)` instead — see below).
 */
export function tenantScopedClient(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
): Prisma.TransactionClient {
  // Prisma's `$transaction` interactive-callback client type doesn't
  // surface `$extends` in its public type even though it exists at
  // runtime (it's the same extended client the outer PrismaClient
  // produces) — cast at this one boundary rather than losing type safety
  // on every caller of this function.
  const extendable = tx as unknown as {
    $extends: (config: unknown) => Prisma.TransactionClient;
  };
  return extendable.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: unknown) => Promise<unknown>;
        }) {
          if (
            !model ||
            !(TENANT_SCOPED_MODELS as readonly string[]).includes(model)
          ) {
            return query(args);
          }

          if (UNSAFE_SINGLE_ROW_OPERATIONS.has(operation)) {
            throw new Error(
              `Refusing unscoped single-row operation '${operation}' on tenant-scoped model '${model}'. ` +
                `Use the byId()/updateById()/deleteById() helpers, which verify clinicId first.`,
            );
          }

          const scopedArgs = args as Record<string, unknown>;

          if (
            LIST_OPERATIONS.has(operation) ||
            BULK_WRITE_OPERATIONS.has(operation)
          ) {
            scopedArgs.where = {
              ...(scopedArgs.where as object | undefined),
              clinicId: ctx.clinicId,
            };
          } else if (CREATE_OPERATIONS.has(operation)) {
            scopedArgs.data = {
              ...(scopedArgs.data as object | undefined),
              clinicId: ctx.clinicId,
            };
          } else if (CREATE_MANY_OPERATIONS.has(operation)) {
            const data = scopedArgs.data;
            scopedArgs.data = Array.isArray(data)
              ? data.map((row) => ({ ...row, clinicId: ctx.clinicId }))
              : data;
          }

          return query(scopedArgs as never);
        },
      },
    },
  });
}

/**
 * Opens one transaction, sets the Postgres RLS session variable
 * (`SET LOCAL`, transaction-scoped only — safe with pooled connections),
 * and runs `callback` with a tenant-scoped client. This is the standard
 * entry point every request handler uses for tenant-data access.
 */
export async function withTenantContext<T>(
  prisma: PrismaClient,
  ctx: TenantContext,
  callback: (tx: ReturnType<typeof tenantScopedClient>) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Parameterized to avoid any injection via clinicId even though it is
    // always a server-derived UUID, never client input.
    await tx.$executeRaw`SELECT set_config('app.current_clinic_id', ${ctx.clinicId}, true)`;
    return callback(tenantScopedClient(tx, ctx));
  });
}

/**
 * Fetch a single row by id, scoped to the tenant, for models excluded from
 * generic auto-scoping. Returns null both when the row doesn't exist and
 * when it belongs to another tenant — callers must map both to 404, never
 * distinguish them in the response (see docs/multi-tenancy.md, IDOR
 * prevention).
 */
export async function byIdScoped<
  Model extends { findFirst: (args: unknown) => Promise<unknown> },
>(
  delegate: Model,
  id: string,
  clinicId: string,
): Promise<ReturnType<Model["findFirst"]>> {
  return delegate.findFirst({ where: { id, clinicId } }) as ReturnType<
    Model["findFirst"]
  >;
}
