import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../utils/logger';
import User from '../models/User.model';

export enum TokenType {
  PASSWORD_RESET = 'password-reset',
  RESERVATION_CANCEL = 'reservation-cancel',
}

interface BaseTokenPayload {
  type: TokenType;
  iat?: number;
  exp?: number;
}

interface ReservationCancelPayload extends BaseTokenPayload {
  type: TokenType.RESERVATION_CANCEL;
  reservationId: string;
  restaurantId: string;
}

type TokenPayload = ReservationCancelPayload;

interface TokenValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables');
}

const TOKEN_EXPIRATION = {
  PASSWORD_RESET_HOURS: 1,
  RESERVATION_CANCEL: '48h',
};

/**
 * Generate a password reset token (random, stored in DB, single-use)
 */
export async function generatePasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');

  await User.findByIdAndUpdate(userId, {
    passwordResetToken: token,
    passwordResetExpires: new Date(Date.now() + TOKEN_EXPIRATION.PASSWORD_RESET_HOURS * 60 * 60 * 1000),
  });

  logger.info('Password reset token stored', { userId });
  return token;
}

/**
 * Validate a password reset token (DB lookup, single-use)
 */
export async function validatePasswordResetToken(
  token: string
): Promise<TokenValidationResult<{ userId: string }>> {
  try {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return { valid: false, error: 'Token invalide ou expiré' };
    }

    return { valid: true, data: { userId: user._id.toString() } };
  } catch (error: any) {
    logger.error('Error validating password reset token:', error);
    return { valid: false, error: 'Token validation failed' };
  }
}

/**
 * Clear the password reset token after successful use
 */
export async function clearPasswordResetToken(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, {
    passwordResetToken: null,
    passwordResetExpires: null,
  });
}

export function generateReservationCancelToken(reservationId: string, restaurantId: string): string {
  const payload: ReservationCancelPayload = {
    type: TokenType.RESERVATION_CANCEL,
    reservationId,
    restaurantId,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION.RESERVATION_CANCEL,
  } as SignOptions);

  logger.info('Reservation cancel token generated', { reservationId, restaurantId });
  return token;
}

export function validateReservationCancelToken(
  token: string
): TokenValidationResult<{ reservationId: string; restaurantId: string }> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    if (decoded.type !== TokenType.RESERVATION_CANCEL) {
      return { valid: false, error: 'Invalid token type' };
    }

    const payload = decoded as ReservationCancelPayload;
    return { valid: true, data: { reservationId: payload.reservationId, restaurantId: payload.restaurantId } };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') return { valid: false, error: 'Token expired' };
    if (error.name === 'JsonWebTokenError') return { valid: false, error: 'Invalid token' };
    return { valid: false, error: 'Token validation failed' };
  }
}

export function validateToken(token: string): TokenValidationResult<TokenPayload> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return { valid: true, data: decoded };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') return { valid: false, error: 'Token expired' };
    if (error.name === 'JsonWebTokenError') return { valid: false, error: 'Invalid token' };
    return { valid: false, error: 'Token validation failed' };
  }
}
