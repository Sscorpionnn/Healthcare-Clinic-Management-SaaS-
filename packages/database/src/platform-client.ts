// Platform-level Prisma client — bound to the `clinic_platform` DB role
// (BYPASSRLS). Used exclusively by SUPER_ADMIN platform operations in the
// `clinics` admin module (creating/suspending clinics, platform-wide audit
// metadata). Never import this in a tenant-data module.
import { PrismaClient } from "../generated/client";

let platformClient: PrismaClient | null = null;

export function getPlatformClient(): PrismaClient {
  if (!platformClient) {
    const url = process.env.DATABASE_URL_PLATFORM;
    if (!url) {
      throw new Error("DATABASE_URL_PLATFORM is not set");
    }
    platformClient = new PrismaClient({ datasources: { db: { url } } });
  }
  return platformClient;
}
