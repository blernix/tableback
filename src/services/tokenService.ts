import jwt, { SignOptions } from 'jsonwebtoken';
import logger from '../utils/logger';

// Token types
export enum TokenType {
  PASSWORD_RESET = 'password-reset',
  RESERVATION_CANCEL = 'reservation-cancel',
}

// JWT Payload interfaces
interface BaseTokenPayload {
  type: TokenType;
  iat?: number;
  exp?: number;
}

interface PasswordResetPayload extends BaseTokenPayload {
  type: TokenType.PASSWORD_RESET;
  userId: string;
}

interface ReservationCancelPayload extends BaseTokenPayload {
  type: TokenType.RESERVATION_CANCEL;
  reservationId: string;
  restaurantId: string;
}

type TokenPayload = PasswordResetPayload | ReservationCancelPayload;

// Token validation result
interface TokenValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}

// JWT Secret from environment
const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables');
}

// Token expiration times
const TOKEN_EXPIRATION = {
  PASSWORD_RESET: '24h', // 24 hours
  RESERVATION_CANCEL: '48h', // 48 hours (enough time before reservation)
};

/**
 * Generate a password reset token
 *
 * @param userId - User ID
 * @returns JWT token string
 */
export function generatePasswordResetToken(userId: string): string {
  const payload: PasswordResetPayload = {
    type: TokenType.PASSWORD_RESET,
    userId,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION.PASSWORD_RESET,
  } as SignOptions);

  logger.info('Password reset token generated', {
    userId,
    expiresIn: TOKEN_EXPIRATION.PASSWORD_RESET,
  });

  return token;
}

/**
 * Validate a password reset token
 *
 * @param token - JWT token string
 * @returns Validation result with userId if valid
 */
export function validatePasswordResetToken(
  token: string
): TokenValidationResult<{ userId: string }> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    // Check token type
    if (decoded.type !== TokenType.PASSWORD_RESET) {
      logger.warn('Invalid token type for password reset', {
        expectedType: TokenType.PASSWORD_RESET,
        receivedType: decoded.type,
      });
      return {
        valid: false,
        error: 'Invalid token type',
      };
    }

    const payload = decoded as PasswordResetPayload;

    logger.info('Password reset token validated', {
      userId: payload.userId,
    });

    return {
      valid: true,
      data: { userId: payload.userId },
    };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Password reset token expired', { token });
      return {
        valid: false,
        error: 'Token expired',
      };
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid password reset token', {
        error: error.message,
      });
      return {
        valid: false,
        error: 'Invalid token',
      };
    }

    logger.error('Error validating password reset token', {
      error: error.message,
    });
    return {
      valid: false,
      error: 'Token validation failed',
    };
  }
}

/**
 * Generate a reservation cancellation token
 *
 * @param reservationId - Reservation ID
 * @returns JWT token string
 */
export function generateReservationCancelToken(reservationId: string, restaurantId: string): string {
  const payload: ReservationCancelPayload = {
    type: TokenType.RESERVATION_CANCEL,
    reservationId,
    restaurantId,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION.RESERVATION_CANCEL,
  } as SignOptions);

  logger.info('Reservation cancel token generated', {
    reservationId,
    restaurantId,
    expiresIn: TOKEN_EXPIRATION.RESERVATION_CANCEL,
  });

  return token;
}

/**
 * Validate a reservation cancellation token
 *
 * @param token - JWT token string
 * @returns Validation result with reservationId if valid
 */
export function validateReservationCancelToken(
  token: string
): TokenValidationResult<{ reservationId: string; restaurantId: string }> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    // Check token type
    if (decoded.type !== TokenType.RESERVATION_CANCEL) {
      logger.warn('Invalid token type for reservation cancel', {
        expectedType: TokenType.RESERVATION_CANCEL,
        receivedType: decoded.type,
      });
      return {
        valid: false,
        error: 'Invalid token type',
      };
    }

    const payload = decoded as ReservationCancelPayload;

    logger.info('Reservation cancel token validated', {
      reservationId: payload.reservationId,
      restaurantId: payload.restaurantId,
    });

    return {
      valid: true,
      data: { reservationId: payload.reservationId, restaurantId: payload.restaurantId },
    };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Reservation cancel token expired', { token });
      return {
        valid: false,
        error: 'Token expired',
      };
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid reservation cancel token', {
        error: error.message,
      });
      return {
        valid: false,
        error: 'Invalid token',
      };
    }

    logger.error('Error validating reservation cancel token', {
      error: error.message,
    });
    return {
      valid: false,
      error: 'Token validation failed',
    };
  }
}

/**
 * Generic token validation (auto-detects type)
 *
 * @param token - JWT token string
 * @returns Validation result with decoded payload
 */
export function validateToken(
  token: string
): TokenValidationResult<TokenPayload> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    logger.info('Token validated', {
      type: decoded.type,
    });

    return {
      valid: true,
      data: decoded,
    };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired', { token });
      return {
        valid: false,
        error: 'Token expired',
      };
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid token', {
        error: error.message,
      });
      return {
        valid: false,
        error: 'Invalid token',
      };
    }

    logger.error('Error validating token', {
      error: error.message,
    });
    return {
      valid: false,
      error: 'Token validation failed',
    };
  }
}
