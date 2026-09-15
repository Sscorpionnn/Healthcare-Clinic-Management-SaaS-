import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Uniform `application/problem+json` (RFC 9457) error shape for every
 * response — see docs/api-contract.md. Never leaks stack traces or ORM
 * error text in production (docs/threat-model.md T11).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");
  // Redact 500 detail everywhere except explicit local development — a
  // "test"/"staging" environment gets the same treatment as production
  // rather than accidentally leaking internals (docs/threat-model.md T11).
  private readonly redactInternalDetail =
    process.env.NODE_ENV !== "development";

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = "Internal Server Error";
    let detail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        title = body;
      } else if (typeof body === "object" && body !== null) {
        const asRecord = body as Record<string, unknown>;
        title =
          (asRecord.title as string) ??
          (exception.message || HttpException.name);
        detail =
          (asRecord.detail as string) ??
          (Array.isArray(asRecord.message)
            ? asRecord.message.join("; ")
            : (asRecord.message as string));
      } else {
        title = exception.message;
      }
    } else {
      // Unhandled/unexpected error — never leak internals to the client.
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    if (
      this.redactInternalDetail &&
      status === HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      detail = undefined;
    }

    response.status(status).type("application/problem+json").json({
      type: "about:blank",
      title,
      status,
      detail,
      instance: request.originalUrl,
    });
  }
}
