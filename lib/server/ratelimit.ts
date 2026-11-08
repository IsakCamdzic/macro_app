import "server-only";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// In-memory fallback bucket for development / testing when Upstash Redis is not configured
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  key: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const response = await fetch(`${redisUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, windowSeconds],
        ]),
      });

      if (response.ok) {
        const results = await response.json();
        const currentCount = results[0].result as number;
        return {
          success: currentCount <= limit,
          limit,
          remaining: Math.max(0, limit - currentCount),
          reset: now + windowMs,
        };
      }
    } catch {
      // Fallback to local memory limiter on transient error
    }
  }

  // Memory fallback
  const record = memoryStore.get(key);
  if (!record || now > record.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowMs,
    };
  }

  record.count += 1;
  const success = record.count <= limit;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - record.count),
    reset: record.resetAt,
  };
}
