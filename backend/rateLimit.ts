import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    // Allow process to exit without waiting on the timer
    this.cleanupInterval.unref?.();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) this.store.delete(key);
    }
  }

  check(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }
}

const limiter = new RateLimiter();

function getClientIP(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

/** In-memory rate limit. Prefer user id when authenticated. */
export function rateLimit(maxRequests = 100, windowSeconds = 60) {
  const windowMs = windowSeconds * 1000;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIP(req);
    const normalizedPath = req.path.replace(/\/+$/, "") || "/";
    const userId = (req.session as { user?: { id?: string } } | undefined)?.user
      ?.id;
    const key = userId
      ? `uid:${userId}:${normalizedPath}:${req.method}`
      : `ip:${ip}:${normalizedPath}:${req.method}`;
    const result = limiter.check(key, maxRequests, windowMs);

    res.set("X-RateLimit-Limit", String(maxRequests));
    res.set("X-RateLimit-Remaining", String(result.remaining));
    res.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      return res.status(429).json({
        message: "Quá nhiều yêu cầu, vui lòng thử lại sau.",
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
    }

    next();
  };
}
