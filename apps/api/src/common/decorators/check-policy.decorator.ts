import { SetMetadata, Type } from "@nestjs/common";
import type { ResourcePolicy } from "../types/policy";

export const POLICY_KEY = "policy";

/** Attaches a row-level ownership policy (resolved via ModuleRef by PolicyGuard) to a route. */
export const CheckPolicy = (policy: Type<ResourcePolicy>) =>
  SetMetadata(POLICY_KEY, policy);
