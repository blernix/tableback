import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter specifically for reservation creation
 * Prevents abuse by limiting the number of reservations per IP
 *
 * Limits:
 * - 5 reservations per 15 minutes per IP
 * - Stricter than general API rate limit to prevent spam/bot reservations
 */
export const reservationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 reservations per window
  message: {
    error: {
      message: 'Trop de tentatives de réservation. Veuillez réessayer dans 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests
  skipSuccessfulRequests: false,
  // Skip failed requests
  skipFailedRequests: false,
  // Custom key generator (use IP address)
  keyGenerator: (req: Request): string => {
    // Try to get real IP from various headers (for proxies/load balancers)
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];

    if (typeof forwardedFor === 'string') {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwardedFor.split(',')[0].trim();
    }

    if (typeof realIp === 'string') {
      return realIp;
    }

    // Fallback to socket IP
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  // Custom handler for when limit is exceeded
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        message: 'Trop de tentatives de réservation. Veuillez réessayer dans 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: '15 minutes',
      },
    });
  },
});

/**
 * Stricter rate limiter for suspicious activity
 * Can be enabled if we detect bot-like behavior
 */
export const strictReservationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Maximum 3 reservations per hour
  message: {
    error: {
      message: 'Activité suspecte détectée. Veuillez réessayer plus tard.',
      code: 'SUSPICIOUS_ACTIVITY',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0].trim();
    }

    if (typeof realIp === 'string') {
      return realIp;
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});
