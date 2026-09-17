/**
 * Centralized API Observability Wrapper
 * - Enforces request ID propagation (downstream and response headers)
 * - Measures request duration with high precision (durationMs)
 * - Emits correlated completion logs for success and error paths
 * - Ensures safe error handling without duplicate ERROR logs
 * - Guarantees logging failures never break incoming requests
 */

import { NextRequest, NextResponse } from "next/server";
import { extractRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { handleApiError } from "@/lib/api-response";

export interface ObservabilityContext {
  requestId: string;
}

export type ObservableApiHandler<TContext = unknown> = (
  req: NextRequest,
  ctx: TContext,
  obs: ObservabilityContext
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route handler with centralized timing, request ID correlation,
 * and completion logging.
 *
 * `ctx` is made optional so that tests and callers invoking `handler(req)` with a single
 * argument continue to work seamlessly.
 */
export function withApiObservability<TContext = unknown>(
  handler: ObservableApiHandler<TContext>
) {
  return async (req: NextRequest, ctx?: TContext): Promise<NextResponse> => {
    const startTime = performance.now();
    const requestId = extractRequestId(req);
    const method = req.method;
    const pathname = req.nextUrl?.pathname || new URL(req.url).pathname;

    let response: NextResponse;

    try {
      response = await handler(req, (ctx ?? ({} as TContext)), { requestId });
    } catch (error: unknown) {
      // Uncaught exception escaping the route handler:
      // Canonical error log emitted exactly once by handleApiError
      response = handleApiError(
        error,
        `Uncaught error in ${method} ${pathname}`,
        requestId
      );
    }

    const durationMs = Math.max(0, Math.round(performance.now() - startTime));

    // Ensure canonical request ID header is returned on every response
    try {
      response.headers.set(REQUEST_ID_HEADER, requestId);
    } catch {
      // Ignore header setting errors on immutable responses
    }

    // Emit request completion log (never throw on logging error)
    try {
      logger.info("API request completed", {
        requestId,
        route: pathname,
        method,
        status: response.status,
        durationMs,
      });
    } catch {
      // Safe fallback: never let logging failures break API requests
    }

    return response;
  };
}
