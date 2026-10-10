export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the next slot frees up (0 when allowed). */
  retryAfterMs: number;
}

/**
 * Sliding-window rate limiter kept in memory. Good for a single server
 * process; on multi-instance deployments each instance keeps its own count.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    const windowStart = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterMs: recent[0] + this.windowMs - now };
    }
    recent.push(now);
    this.hits.set(key, recent);
    this.prune(windowStart);
    return { allowed: true, remaining: this.limit - recent.length, retryAfterMs: 0 };
  }

  private prune(windowStart: number): void {
    if (this.hits.size < 1000) return;
    for (const [key, times] of this.hits) {
      if (times.every((t) => t <= windowStart)) this.hits.delete(key);
    }
  }
}

export const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);

export const checkRateLimiter = new RateLimiter(RATE_LIMIT, 60 * 60 * 1000);

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
