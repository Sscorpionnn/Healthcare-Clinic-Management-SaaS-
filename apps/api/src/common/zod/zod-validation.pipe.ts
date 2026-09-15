import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

/**
 * Validates the request body against a shared Zod schema (from
 * `@clinic/shared`) and strips unknown fields — the mass-assignment
 * defense described in docs/rbac.md. Every schema used here must be
 * `.strict()` (or a plain object schema, which Zod treats as stripping by
 * default only with `.strip()`) so unexpected fields like `role` or
 * `clinicId` on a patient DTO are rejected, not silently ignored.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        title: "Validation failed",
        detail: result.error.issues
          .map(
            (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
          )
          .join("; "),
      });
    }
    return result.data;
  }
}
