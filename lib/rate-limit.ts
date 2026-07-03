import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 1000) {
    buckets.forEach((bucket, staleKey) => {
      if (bucket.resetAt < now) buckets.delete(staleKey);
    });
  }
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > max;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}
