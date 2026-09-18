export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix epoch ms when the window resets
}

export interface RateLimitStore {
  readonly name: string;
  readonly isDistributed: boolean;
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  reset?(key: string): Promise<void>;
}
