import { createLimiter } from './rateLimiterFactory';

function ipKeyGenerator(req: any): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];

  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }
  if (typeof realIp === 'string') {
    return realIp;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export const reservationRateLimiter = createLimiter('reservation', {
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: ipKeyGenerator,
  message: {
    error: {
      message: 'Trop de tentatives de réservation. Veuillez réessayer dans 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

export const strictReservationRateLimiter = createLimiter('reservation_strict', {
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: ipKeyGenerator,
  message: {
    error: {
      message: 'Activité suspecte détectée. Veuillez réessayer plus tard.',
      code: 'SUSPICIOUS_ACTIVITY',
    },
  },
});
