const requestCounts = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count };
}

const EXTRACTION_LIMITS: RateLimitConfig = { windowMs: 60000, maxRequests: 5 };
const API_LIMITS: RateLimitConfig = { windowMs: 60000, maxRequests: 30 };
const WEBHOOK_LIMITS: RateLimitConfig = { windowMs: 60000, maxRequests: 100 };

export function checkExtractionRateLimit(userId: string) {
  return checkRateLimit(`extract:${userId}`, EXTRACTION_LIMITS);
}

export function checkApiRateLimit(key: string) {
  return checkRateLimit(`api:${key}`, API_LIMITS);
}

export function checkWebhookRateLimit(key: string) {
  return checkRateLimit(`webhook:${key}`, WEBHOOK_LIMITS);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts) {
    if (now > entry.resetTime) requestCounts.delete(key);
  }
}, 60000);
