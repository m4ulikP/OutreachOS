/**
 * Request ID Extraction, Validation & Generation
 * Enforces safe bounded request IDs to prevent log injection and HTTP header splitting.
 */

export const REQUEST_ID_HEADER = "x-request-id";
export const CORRELATION_ID_HEADER = "x-correlation-id";

// Safe bounded format: alphanumeric, underscore, hyphen, 8 to 64 chars
const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Validates whether an incoming request ID meets strict safety criteria:
 * - Must be a string
 * - Length between 8 and 64 characters
 * - Alphanumeric, underscores, or hyphens only
 * - Contains NO control characters, newlines, carriage returns, or spaces
 */
export function isValidRequestId(id: unknown): id is string {
  if (typeof id !== "string") {
    return false;
  }
  const trimmed = id.trim();
  if (trimmed.length < 8 || trimmed.length > 64) {
    return false;
  }
  // Reject any control characters, newlines, or whitespace
  if (/[\r\n\x00-\x1F\x7F\s]/.test(trimmed)) {
    return false;
  }
  return SAFE_REQUEST_ID_PATTERN.test(trimmed);
}

/**
 * Generates a standard cryptographically random UUID v4 request ID.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Resolves an incoming request ID if valid, or securely generates a fresh UUID.
 */
export function resolveRequestId(incoming?: string | null): string {
  if (incoming && isValidRequestId(incoming)) {
    return incoming.trim();
  }
  return generateRequestId();
}

/**
 * Extracts and resolves a canonical request ID from Headers or a Request object.
 */
export function extractRequestId(
  source: Headers | { headers: Headers | Record<string, string | string[] | undefined> } | null | undefined
): string {
  if (!source) {
    return generateRequestId();
  }

  let incoming: string | null | undefined = null;

  if (source instanceof Headers) {
    incoming = source.get(REQUEST_ID_HEADER) || source.get(CORRELATION_ID_HEADER);
  } else if ("headers" in source) {
    const headers = source.headers;
    if (headers instanceof Headers) {
      incoming = headers.get(REQUEST_ID_HEADER) || headers.get(CORRELATION_ID_HEADER);
    } else if (headers && typeof headers === "object") {
      const raw = headers[REQUEST_ID_HEADER] ?? headers[CORRELATION_ID_HEADER];
      incoming = Array.isArray(raw) ? raw[0] : raw;
    }
  }

  return resolveRequestId(incoming);
}
