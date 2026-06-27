import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';

async function emailAttempt(email: string, windowMs: number, maxAttempts: number): Promise<boolean> {
  const redis = await getRedisClient();
  if (redis) {
    try {
      const key = `ratelimit:email:${email}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pExpire(key, windowMs);
      }
      return count <= maxAttempts;
    } catch {
      // Fall through to in-memory
    }
  }

  return inMemoryAttempt(email, windowMs, maxAttempts);
}

interface EmailRateLimitEntry {
  count: number;
  firstAttempt: number;
}

const memoryStore = new Map<string, EmailRateLimitEntry>();
let cleanupTimer: NodeJS.Timeout | null = null;

function ensureCleanup(): void {
  if (cleanupTimer || process.env.NODE_ENV === 'test') return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [email, entry] of memoryStore.entries()) {
      if (now - entry.firstAttempt > 60 * 60 * 1000) {
        memoryStore.delete(email);
      }
    }
  }, 5 * 60 * 1000);
}

function inMemoryAttempt(email: string, windowMs: number, maxAttempts: number): boolean {
  ensureCleanup();
  const now = Date.now();
  const entry = memoryStore.get(email);

  if (!entry || now - entry.firstAttempt > windowMs) {
    memoryStore.set(email, { count: 1, firstAttempt: now });
    return true;
  }

  if (entry.count >= maxAttempts) return false;

  memoryStore.set(email, { count: entry.count + 1, firstAttempt: entry.firstAttempt });
  return true;
}

export function resetEmailRateLimiter(): void {
  memoryStore.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

export function forgotPasswordEmailRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const email = req.body?.email;

  if (!email || typeof email !== 'string') {
    return next();
  }

  const normalizedEmail = email.toLowerCase().trim();

  emailAttempt(normalizedEmail, 60 * 60 * 1000, 3).then((allowed) => {
    if (allowed) {
      next();
    } else {
      res.status(429).json({
        error: {
          message: 'Too many password reset attempts for this email. Please try again later.',
        },
      });
    }
  });
}
