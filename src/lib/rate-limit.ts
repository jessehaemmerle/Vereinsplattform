const buckets = new Map<string, { count: number; resetAt: number }>();

/** Simple in-memory fixed-window limiter (single instance deployment). */
export function rateLimit(key: string, limit = 10, windowMs = 15 * 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
