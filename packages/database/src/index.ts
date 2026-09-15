import { PrismaClient } from "../generated/client";

let appClient: PrismaClient | null = null;

/** Default app-role Prisma client (subject to RLS). Singleton per process. */
export function getPrismaClient(): PrismaClient {
  if (!appClient) {
    appClient = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
  }
  return appClient;
}

export * from "../generated/client";
export * from "./tenant-client";
export * from "./platform-client";
export * from "./encryption";
