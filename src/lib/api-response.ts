import { NextResponse } from "next/server";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/auth/session";
import { ZodError } from "zod";

/**
 * Standardized API error handler to ensure predictable HTTP status codes
 * (401, 403, 404, 400, 500) without exposing internal stack traces or secrets to clients.
 */
export function handleApiError(error: unknown, contextMessage?: string): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message || "Authentication required" },
      { status: 401 }
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message || "Forbidden" },
      { status: 403 }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message || "Not found" },
      { status: 404 }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation error",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  // Log unexpected errors internally without leaking internals to client
  console.error(contextMessage || "API Error:", error);

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
