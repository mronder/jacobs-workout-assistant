/**
 * Simple in-memory rate limiter for Cloudflare Workers.
 * Uses a sliding window counter per IP. Since Workers isolates are
 * short-lived, this won't persist across deployments — but it prevents
 * brute-force attacks during an active isolate's lifetime.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 60 seconds
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

/**
 * Check if a request is rate-limited.
 * @returns null if allowed, or a Response if rate-limited
 */
export function checkRateLimit(
  request: Request,
  maxAttempts: number = 10,
  windowMs: number = 15 * 60 * 1000, // 15 minutes
): Response | null {
  cleanup(windowMs);

  const ip = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';

  const now = Date.now();
  const cutoff = now - windowMs;
  let entry = store.get(ip);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= maxAttempts) {
    const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
    return new Response(
      JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      },
    );
  }

  entry.timestamps.push(now);
  return null;
}
