import { NextResponse } from "next/server";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/auth/session";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { REQUEST_ID_HEADER } from "@/lib/request-id";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_SERVER_ERROR";

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly status = 400;
  readonly fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export class ConflictError extends Error {
  readonly code = "CONFLICT";
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export interface StandardApiErrorBody {
  error: string;
  code: ApiErrorCode;
  message: string;
  fields?: Record<string, string[]>;
  details?: Array<{ path: string; message: string }>;
  issues?: Array<{ path: string; message: string }>;
  requestId?: string;
}

/**
 * Normalizes Zod validation issues into safe, field-mapped objects.
 */
export function formatZodError(error: ZodError): {
  fields: Record<string, string[]>;
  details: Array<{ path: string; message: string }>;
  summaryMessage: string;
} {
  const fields: Record<string, string[]> = {};
  const details: Array<{ path: string; message: string }> = [];

  for (const issue of error.issues) {
    const pathStr = issue.path.join(".") || "body";
    if (!fields[pathStr]) {
      fields[pathStr] = [];
    }
    fields[pathStr].push(issue.message);
    details.push({
      path: pathStr,
      message: issue.message,
    });
  }

  const first = details[0];
  const summaryMessage = first
    ? `${first.path !== "body" && first.path !== "root" ? `${first.path}: ` : ""}${first.message}`
    : "Validation error";

  return { fields, details, summaryMessage };
}

/**
 * Helper to attach requestId header to error responses
 */
function withRequestIdHeader(
  res: NextResponse<StandardApiErrorBody>,
  requestId?: string
): NextResponse<StandardApiErrorBody> {
  if (requestId) {
    try {
      res.headers.set(REQUEST_ID_HEADER, requestId);
    } catch {
      // Ignore on immutable response
    }
  }
  return res;
}

/**
 * Centralized API error handler:
 * - Maps known domain errors to 400, 401, 403, 404, 409, 500
 * - Normalizes Zod validation errors to standardized field-level breakdowns
 * - Prevents leaking stack traces, SQL errors, or database credentials
 * - Emits canonical structured error logs with requestId exactly once
 * - Preserves backward compatibility with clients reading `data.error` as a string
 */
export function handleApiError(
  error: unknown,
  contextMessage?: string,
  requestId?: string
): NextResponse<StandardApiErrorBody> {
  if (error instanceof UnauthorizedError) {
    const message = error.message || "Authentication required";
    return withRequestIdHeader(
      NextResponse.json(
        {
          error: message,
          code: "AUTHENTICATION_REQUIRED",
          message,
        },
        { status: 401 }
      ),
      requestId
    );
  }

  if (error instanceof ForbiddenError) {
    const message = error.message || "Forbidden";
    return withRequestIdHeader(
      NextResponse.json(
        {
          error: message,
          code: "FORBIDDEN",
          message,
        },
        { status: 403 }
      ),
      requestId
    );
  }

  if (error instanceof NotFoundError) {
    const message = error.message || "Not found";
    return withRequestIdHeader(
      NextResponse.json(
        {
          error: message,
          code: "NOT_FOUND",
          message,
        },
        { status: 404 }
      ),
      requestId
    );
  }

  if (error instanceof ValidationError) {
    const message = error.message || "Validation error";
    const details = Object.entries(error.fields || {}).flatMap(([path, msgs]) =>
      msgs.map((m) => ({ path, message: m }))
    );
    return withRequestIdHeader(
      NextResponse.json(
        {
          error: message,
          code: "VALIDATION_ERROR",
          message,
          fields: error.fields,
          details,
          issues: details,
        },
        { status: 400 }
      ),
      requestId
    );
  }

  if (error instanceof ZodError) {
    const { fields, details, summaryMessage } = formatZodError(error);
    return withRequestIdHeader(
      NextResponse.json(
        {
          error: summaryMessage,
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          fields,
          details,
          issues: details,
        },
        { status: 400 }
      ),
      requestId
    );
  }

  if (error instanceof ConflictError) {
    const message = error.message || "Resource conflict";
    return withRequestIdHeader(
      NextResponse.json(
        {
          error: message,
          code: "CONFLICT",
          message,
        },
        { status: 409 }
      ),
      requestId
    );
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === "RATE_LIMIT_EXCEEDED"
  ) {
    const err = error as { message?: string; retryAfterSeconds?: number };
    const message = err.message || "Too many requests. Please try again later.";
    const retryAfter = err.retryAfterSeconds || 60;
    const res = NextResponse.json(
      {
        error: message,
        code: "RATE_LIMIT_EXCEEDED" as ApiErrorCode,
        message,
      },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(retryAfter));
    return withRequestIdHeader(res, requestId);
  }

  // Handle known Prisma errors safely without leaking internal database schema details
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const message = "A resource with these details already exists";
      return withRequestIdHeader(
        NextResponse.json(
          {
            error: message,
            code: "CONFLICT",
            message,
          },
          { status: 409 }
        ),
        requestId
      );
    }
    if (error.code === "P2025") {
      const message = "Requested resource not found";
      return withRequestIdHeader(
        NextResponse.json(
          {
            error: message,
            code: "NOT_FOUND",
            message,
          },
          { status: 404 }
        ),
        requestId
      );
    }
    if (error.code === "P2003") {
      const message = "Referenced resource does not exist";
      return withRequestIdHeader(
        NextResponse.json(
          {
            error: message,
            code: "VALIDATION_ERROR",
            message,
          },
          { status: 400 }
        ),
        requestId
      );
    }
  }

  // Canonical error logging: log unexpected 500 error exactly once with server-side stack & diagnostics
  try {
    logger.error(contextMessage || "API Unexpected Internal Error", {
      requestId,
      error,
    });
  } catch {
    // Safe fallback: never let logger throw
  }

  return withRequestIdHeader(
    NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        ...(requestId ? { requestId } : {}),
      },
      { status: 500 }
    ),
    requestId
  );
}
