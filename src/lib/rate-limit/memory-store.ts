import { RateLimitStore, RateLimitResult } from "./types";

interface WindowRecord {
  timestamps: number[];
}

/**
 * In-memory sliding-window rate limiter for local development and unit tests.
 * Note: Process-local. For distributed production deployments (e.g. Vercel serverless),
 * a distributed persistent store such as Upstash Redis or PostgreSQL rate-limiting must be attached.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly name = "MemoryRateLimitStore";
  readonly isDistributed = false;

  private hits = new Map<string, WindowRecord>();

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.hits.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.hits.set(key, record);
    }

    // Filter out timestamps outside the active window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    const count = record.timestamps.length;
    const resetAt = record.timestamps[0] ? record.timestamps[0] + windowMs : now + windowMs;

    if (count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        resetAt,
      };
    }

    // Record this hit
    record.timestamps.push(now);

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - (count + 1)),
      resetAt,
    };
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  clear(): void {
    this.hits.clear();
  }
}
