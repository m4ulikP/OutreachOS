/**
 * Sensitive Data Redaction & Sanitization Engine
 * Protects secrets, credentials, tokens, cookies, database URLs,
 * and PII from leaking into server-side log streams or client responses.
 */

const SENSITIVE_KEY_PATTERN =
  /^(.*password.*|.*token.*|.*apikey.*|.*api_key.*|.*secret.*|authorization|cookie|database_url|direct_url|email|phone|linkedin|linkedinurl|body|requestbody|messagecontent)$/i;

const POSTGRES_URL_PATTERN =
  /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)/gi;

/**
 * Masks database connection strings by redacting password credentials.
 * E.g. postgresql://postgres:secret@localhost:5432/db -> postgresql://postgres:***@localhost:5432/db
 */
export function maskConnectionString(str: string): string {
  if (typeof str !== "string") return str;
  return str.replace(POSTGRES_URL_PATTERN, "$1***$3");
}

/**
 * Checks if an object key is considered sensitive and should be redacted.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key.trim());
}

/**
 * Recursively redacts sensitive keys from objects, arrays, and strings.
 * Safe for deeply nested payloads, circular references, and Error instances.
 */
export function redactSensitiveData<T>(data: T, seen = new WeakSet()): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Sanitize string values (e.g. inline database URLs or authorization tokens)
  if (typeof data === "string") {
    let sanitized = maskConnectionString(data);
    if (sanitized.toLowerCase().startsWith("bearer ") && sanitized.length > 15) {
      return "Bearer [REDACTED]" as unknown as T;
    }
    return sanitized as unknown as T;
  }

  // Primitive non-string types
  if (typeof data !== "object") {
    return data;
  }

  // Avoid circular reference infinite recursion
  if (seen.has(data as object)) {
    return "[Circular]" as unknown as T;
  }
  seen.add(data as object);

  // Handle Error instances safely
  if (data instanceof Error) {
    const sanitizedError: Record<string, unknown> = {
      name: data.name,
      message: maskConnectionString(data.message),
    };
    if (data.stack) {
      sanitizedError.stack = maskConnectionString(data.stack);
    }
    if ("code" in data) {
      sanitizedError.code = (data as unknown as { code: unknown }).code;
    }
    // Copy any custom enumerable properties with redaction
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        sanitizedError[key] = "[REDACTED]";
      } else {
        sanitizedError[key] = redactSensitiveData(value, seen);
      }
    }
    return sanitizedError as unknown as T;
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, seen)) as unknown as T;
  }

  // Handle plain objects
  const sanitizedObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitizedObj[key] = "[REDACTED]";
    } else {
      sanitizedObj[key] = redactSensitiveData(value, seen);
    }
  }

  return sanitizedObj as unknown as T;
}
