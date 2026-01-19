import { Request, Response, NextFunction } from 'express';

interface EmailRateLimitEntry {
  count: number;
  firstAttempt: number;
}

/**
 * In-memory email rate limiter
 *
 * NOTE: This implementation is suitable for single-instance deployments.
 * For production environments with multiple instances, consider using Redis
 * to ensure atomic operations across all instances:
 * - Use Redis INCR for atomic counter increments
 * - Use Redis EXPIRE for automatic cleanup
 * - Libraries like 'rate-limit-redis' can help with this
 */
class EmailRateLimiter {
  private attempts = new Map<string, EmailRateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(windowMs: number, maxAttempts: number) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    // Only start cleanup interval in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupInterval();
    }
  }

  startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  attempt(email: string): boolean {
    this.cleanup();

    const now = Date.now();
    const entry = this.attempts.get(email);

    if (!entry) {
      this.attempts.set(email, { count: 1, firstAttempt: now });
      return true;
    }

    // Check if window has passed
    if (now - entry.firstAttempt > this.windowMs) {
      // Reset counter
      this.attempts.set(email, { count: 1, firstAttempt: now });
      return true;
    }

    // Check if max attempts exceeded
    if (entry.count >= this.maxAttempts) {
      return false;
    }

    // Increment counter atomically by creating a new object
    // This prevents race conditions with concurrent requests
    this.attempts.set(email, {
      count: entry.count + 1,
      firstAttempt: entry.firstAttempt
    });
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [email, entry] of this.attempts.entries()) {
      if (now - entry.firstAttempt > this.windowMs) {
        this.attempts.delete(email);
      }
    }
  }

  // For testing only
  reset(): void {
    this.attempts.clear();
    this.stopCleanupInterval();
  }
}

// Create rate limiter for forgot password: 3 attempts per hour per email
const emailRateLimiter = new EmailRateLimiter(60 * 60 * 1000, 3);

// Export for testing
export { emailRateLimiter };

export function forgotPasswordEmailRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const email = req.body?.email;
  
  if (!email || typeof email !== 'string') {
    // If no email, skip rate limiting (validation will catch it later)
    return next();
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  if (!emailRateLimiter.attempt(normalizedEmail)) {
    res.status(429).json({
      error: {
        message: 'Too many password reset attempts for this email. Please try again later.'
      }
    });
    return;
  }
  
  next();
}