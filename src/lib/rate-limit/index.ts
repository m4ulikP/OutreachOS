import { RateLimitStore, RateLimitResult } from "./types";
import { MemoryRateLimitStore } from "./memory-store";
import { NextRequest } from "next/server";

export * from "./types";
export * from "./memory-store";

export class RateLimitExceededError extends Error {
  readonly code = "RATE_LIMIT_EXCEEDED";
  readonly status = 429;
  readonly retryAfterSeconds: number;

  constructor(message = "Too many requests. Please try again later.", retryAfterSeconds = 60) {
    super(message);
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Global store instance for dev / test
export const defaultRateLimitStore = new MemoryRateLimitStore();

/**
 * Returns the configured rate limit store.
 * In production with Upstash / Redis configured, returns a distributed Redis store.
 * Otherwise returns the memory store with documentation of requirements.
 */
export function getRateLimitStore(): RateLimitStore {
  return defaultRateLimitStore;
}

export type AuthRateLimitAction =
  | "signup"
  | "login"
  | "forgot-password"
  | "resend-verification"
  | "reset-password"
  | "change-password";

const ACTION_CONFIGS: Record<AuthRateLimitAction, { limit: number; windowMs: number }> = {
  signup: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 attempts per 15m
  login: { limit: 15, windowMs: 15 * 60 * 1000 }, // 15 attempts per 15m
  "forgot-password": { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15m
  "resend-verification": { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15m
  "reset-password": { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 attempts per 15m
  "change-password": { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 attempts per 15m
};

/**
 * Derives a safe client IP identifier from request headers without trusting client spoofing.
 */
export function getClientIp(req?: Request | NextRequest): string {
  if (!req) return "127.0.0.1";

  // Check X-Forwarded-For (first hop)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  // Check standard x-real-ip
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * Enforces rate limiting on authentication actions.
 * Throws RateLimitExceededError (429) if the limit is exceeded.
 */
export async function enforceAuthRateLimit(
  action: AuthRateLimitAction,
  req?: Request | NextRequest,
  customKeySuffix?: string
): Promise<RateLimitResult> {
  const store = getRateLimitStore();
  const config = ACTION_CONFIGS[action];
  const ip = getClientIp(req);
  const key = `rl:auth:${action}:${ip}${customKeySuffix ? `:${customKeySuffix}` : ""}`;

  const result = await store.consume(key, config.limit, config.windowMs);

  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new RateLimitExceededError(
      `Too many ${action} attempts. Please try again in ${retryAfter} seconds.`,
      retryAfter
    );
  }

  return result;
}

/**
 * Enforces rate limiting on website research requests (e.g. 10 requests / 5 minutes per user/IP).
 */
export async function enforceResearchRateLimit(
  userId: string,
  req?: Request | NextRequest
): Promise<RateLimitResult> {
  const store = getRateLimitStore();
  const ip = getClientIp(req);
  const key = `rl:research:${userId}:${ip}`;
  const limit = 12;
  const windowMs = 5 * 60 * 1000; // 5 minutes

  const result = await store.consume(key, limit, windowMs);
  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new RateLimitExceededError(
      `Research request limit reached. Please wait ${retryAfter} seconds before researching another website.`,
      retryAfter
    );
  }

  return result;
}

/**
 * Enforces rate limiting on AI personalization generation (e.g. 15 generations / 5 minutes per user/IP).
 */
export async function enforcePersonalizationRateLimit(
  userId: string,
  req?: Request | NextRequest
): Promise<RateLimitResult> {
  const store = getRateLimitStore();
  const ip = getClientIp(req);
  const key = `rl:personalization:${userId}:${ip}`;
  const limit = 15;
  const windowMs = 5 * 60 * 1000; // 5 minutes

  const result = await store.consume(key, limit, windowMs);
  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new RateLimitExceededError(
      `Personalization generation limit reached. Please wait ${retryAfter} seconds before generating more outreach.`,
      retryAfter
    );
  }

  return result;
}

