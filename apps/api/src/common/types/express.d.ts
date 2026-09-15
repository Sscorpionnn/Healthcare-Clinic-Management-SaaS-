import type { AuthenticatedUser, TenantContext } from "./auth.types";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenant?: TenantContext;
    }
  }
}

export {};
