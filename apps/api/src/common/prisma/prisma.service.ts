import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  getPlatformClient,
  getPrismaClient,
  withTenantContext,
  type PrismaClient,
  type TenantContext,
} from "@clinic/database";
import type { TenantPrismaClient } from "../types/policy";

/**
 * Thin DI wrapper around the tenant-isolation helpers in `@clinic/database`.
 * Deliberately NOT request-scoped: tenant context is threaded explicitly
 * through method arguments (from `@CurrentTenant()`), not ambient request
 * state, so a service can never accidentally use the wrong tenant context
 * and transactions are never held open across unrelated I/O (e.g. object
 * storage calls) — see docs/multi-tenancy.md.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly app: PrismaClient = getPrismaClient();

  /** BYPASSRLS platform client — clinics admin module only. Never for tenant data. */
  get platform(): PrismaClient {
    return getPlatformClient();
  }

  /** Runs `callback` inside a transaction with RLS tenant context set. */
  runTenant<T>(
    tenant: TenantContext,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return withTenantContext(this.app, tenant, callback);
  }

  async onModuleDestroy() {
    await this.app.$disconnect();
  }
}
