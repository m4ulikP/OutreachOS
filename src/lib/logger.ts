/**
 * Structured Observability Logger for OutreachOS
 * - Emits NDJSON logs in production for Vercel/cloud log drains
 * - Formats human-friendly logs in development
 * - Automatically redacts secrets, database URLs, tokens, and PII
 * - Captures timing, request IDs, user IDs, and operational events
 * - Serverless safe: zero external heavy dependencies, zero disk writes
 */

import { redactSensitiveData, maskConnectionString } from "@/lib/redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogMetadata {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  code?: string;
  leadId?: string;
  interactionId?: string;
  error?: unknown;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  message: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  code?: string;
  leadId?: string;
  interactionId?: string;
  error?: unknown;
  [key: string]: unknown;
}

function getActiveLogLevel(): LogLevel {
  const envLevel = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel;
  if (envLevel in LOG_LEVEL_SEVERITY) {
    return envLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  const activeLevel = getActiveLogLevel();
  return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[activeLevel];
}

class Logger {
  private baseContext: LogMetadata = {};

  constructor(baseContext: LogMetadata = {}) {
    this.baseContext = baseContext;
  }

  /**
   * Returns a child logger with bound metadata (e.g. requestId, route, userId).
   */
  child(context: LogMetadata): Logger {
    return new Logger({ ...this.baseContext, ...context });
  }

  debug(message: string, meta?: LogMetadata | Error | unknown): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: LogMetadata | Error | unknown): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: LogMetadata | Error | unknown): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: LogMetadata | Error | unknown): void {
    this.log("error", message, meta);
  }

  private log(level: LogLevel, message: string, meta?: LogMetadata | Error | unknown): void {
    if (!shouldLog(level)) {
      return;
    }

    try {
      // 1. Normalize metadata
      let normalizedMeta: Record<string, unknown> = {};
      if (meta instanceof Error) {
        normalizedMeta = {
          error: {
            name: meta.name,
            message: maskConnectionString(meta.message),
            stack: meta.stack ? maskConnectionString(meta.stack) : undefined,
            ...(meta as unknown as Record<string, unknown>),
          },
        };
      } else if (meta && typeof meta === "object") {
        normalizedMeta = { ...(meta as Record<string, unknown>) };
      }

      // Merge base context and active metadata
      const rawEntry: Record<string, unknown> = {
        ...this.baseContext,
        ...normalizedMeta,
      };

      // 2. Extract standard fields
      const requestId = (rawEntry.requestId as string) || undefined;
      const route = (rawEntry.route as string) || undefined;
      const method = (rawEntry.method as string) || undefined;
      const status = typeof rawEntry.status === "number" ? rawEntry.status : undefined;
      const durationMs = typeof rawEntry.durationMs === "number" ? rawEntry.durationMs : undefined;
      const userId = (rawEntry.userId as string) || undefined;
      const code = (rawEntry.code as string) || undefined;
      const leadId = (rawEntry.leadId as string) || undefined;
      const interactionId = (rawEntry.interactionId as string) || undefined;

      // 3. Redact any sensitive keys in remainder
      const sanitizedMeta = redactSensitiveData(rawEntry) as Record<string, unknown>;
      delete sanitizedMeta.requestId;
      delete sanitizedMeta.route;
      delete sanitizedMeta.method;
      delete sanitizedMeta.status;
      delete sanitizedMeta.durationMs;
      delete sanitizedMeta.userId;
      delete sanitizedMeta.code;
      delete sanitizedMeta.leadId;
      delete sanitizedMeta.interactionId;

      const entry: StructuredLogEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase() as "DEBUG" | "INFO" | "WARN" | "ERROR",
        message: maskConnectionString(message),
        ...(requestId ? { requestId } : {}),
        ...(route ? { route } : {}),
        ...(method ? { method } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(userId ? { userId } : {}),
        ...(code ? { code } : {}),
        ...(leadId ? { leadId } : {}),
        ...(interactionId ? { interactionId } : {}),
        ...sanitizedMeta,
      };

      // 4. Determine format: NDJSON in production/JSON mode, human-readable in dev
      const isJsonFormat =
        process.env.LOG_FORMAT === "json" ||
        process.env.NODE_ENV === "production" ||
        process.env.NODE_ENV === "test";

      if (isJsonFormat) {
        const line = JSON.stringify(entry);
        this.emitToConsole(level, line);
      } else {
        const reqStr = requestId ? ` [${requestId}]` : "";
        const durStr = durationMs !== undefined ? ` (${durationMs}ms)` : "";
        const statStr = status !== undefined ? ` [${status}]` : "";
        const formatted = `[${entry.timestamp}] [${entry.level}]${reqStr}${statStr}: ${entry.message}${durStr}`;
        const hasExtra = Object.keys(sanitizedMeta).length > 0;
        if (hasExtra) {
          this.emitToConsole(level, formatted, sanitizedMeta);
        } else {
          this.emitToConsole(level, formatted);
        }
      }
    } catch {
      // Safe fallback: never let logging crash the application
    }
  }

  private emitToConsole(level: LogLevel, ...args: unknown[]): void {
    switch (level) {
      case "error":
        console.error(...args);
        break;
      case "warn":
        console.warn(...args);
        break;
      case "debug":
        console.debug(...args);
        break;
      case "info":
      default:
        console.log(...args);
        break;
    }
  }
}

export const logger = new Logger();
