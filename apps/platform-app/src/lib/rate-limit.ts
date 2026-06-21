/**
 * IP-based rate limiting for patient-facing API routes.
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, uses
 * Upstash Redis for accurate distributed rate limiting across all Vercel
 * instances (recommended for production).
 *
 * When those vars are absent, fails open — all requests are allowed. This
 * lets the app run without Redis while still providing the hook to enable
 * real limiting once Vercel KV / Upstash is wired up.
 *
 * To enable: add Vercel KV (or Upstash Redis) in the Vercel dashboard, then
 * install: npm i @upstash/ratelimit @upstash/redis --workspace=apps/platform-app
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

type RateLimitResult = { allowed: boolean; remaining: number; reset: number };

/**
 * Sliding-window rate limit using Upstash REST API directly (no extra npm
 * package needed if you hit the REST endpoint yourself).
 *
 * limit: max requests per window
 * windowSeconds: sliding window duration in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    // No Redis configured — fail open
    return { allowed: true, remaining: limit, reset: 0 };
  }

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;
  const redisKey = `rl:${key}`;

  try {
    // Use Upstash REST API with a sorted-set sliding window
    const pipeline = [
      ["ZREMRANGEBYSCORE", redisKey, "-inf", windowStart.toString()],
      ["ZADD", redisKey, now.toString(), `${now}-${Math.random()}`],
      ["ZCARD", redisKey],
      ["PEXPIRE", redisKey, (windowMs * 2).toString()],
    ];

    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });

    if (!res.ok) return { allowed: true, remaining: limit, reset: 0 };

    const results = (await res.json()) as Array<{ result: unknown }>;
    const count = (results[2]?.result as number) ?? 0;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const reset = Math.ceil((now + windowMs) / 1000);

    return { allowed, remaining, reset };
  } catch {
    // Network error — fail open, don't block patients from paying
    return { allowed: true, remaining: limit, reset: 0 };
  }
}

/** Extract the best available IP from Vercel / standard headers. */
export function getClientIp(req: Request): string {
  const h = (name: string) => (req as Request & { headers: Headers }).headers.get(name);
  return (
    h("x-real-ip") ??
    h("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Apply rate limiting to a patient API route.
 * Returns a 429 Response if the IP has exceeded the limit, otherwise null.
 *
 * Usage:
 *   const limited = await applyRateLimit(req, "ask-ai", 20, 60);
 *   if (limited) return limited;
 */
export async function applyRateLimit(
  req: Request,
  route: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | null> {
  const ip = getClientIp(req);
  const key = `${route}:${ip}`;
  const { allowed, remaining, reset } = await checkRateLimit(key, limit, windowSeconds);

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": windowSeconds.toString(),
        },
      },
    );
  }

  return null;
}
