import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  changeEmailSchema,
  signupSchema,
} from '../validations/auth.schemas';
import { createLimiter } from '../middleware/rateLimiterFactory';
import { forgotPasswordEmailRateLimit } from '../middleware/rateLimitPerEmail.middleware';
import logger from '../utils/logger';

const router = Router();

const loginLimiter = createLimiter('auth_login', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: {
    error: {
      message: 'Too many login attempts. Please try again later.',
    },
  },
  handler: (req, res) => {
    logger.warn(`🚨 Login rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      error: {
        message: 'Too many login attempts. Please try again later.',
      },
    });
  },
});

const forgotPasswordLimiter = createLimiter('auth_forgot', {
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: {
      message: 'Too many password reset attempts. Please try again later.',
    },
  },
  handler: (req, res) => {
    logger.warn(`🚨 Forgot password rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      error: {
        message: 'Too many password reset attempts. Please try again later.',
      },
    });
  },
});

const resetPasswordLimiter = createLimiter('auth_reset', {
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: {
      message: 'Too many password reset attempts. Please try again later.',
    },
  },
  handler: (req, res) => {
    logger.warn(`🚨 Reset password rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
    });
    res.status(429).json({
      error: {
        message: 'Too many password reset attempts. Please try again later.',
      },
    });
  },
});

const registerLimiter = createLimiter('auth_register', {
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: {
      message: 'Too many registration attempts. Please try again later.',
    },
  },
  handler: (req, res) => {
    logger.warn(`🚨 Registration rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      error: {
        message: 'Too many registration attempts. Please try again later.',
      },
    });
  },
});

const signupLimiter = createLimiter('auth_signup', {
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: {
      message: 'Too many signup attempts. Please try again later.',
    },
  },
  handler: (req, res) => {
    logger.warn(`🚨 Signup rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
      email: req.body?.ownerEmail,
      restaurantName: req.body?.restaurantName,
    });
    res.status(429).json({
      error: {
        message: 'Too many signup attempts. Please try again later.',
      },
    });
  },
});

router.post(
  '/register',
  registerLimiter,
  authenticateToken,
  authorizeRole(['admin']),
  validate({ body: registerSchema }),
  authController.register
);

router.post(
  '/signup',
  signupLimiter,
  validate({ body: signupSchema }),
  authController.signup
);

router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  authController.login
);

router.get('/verify-email/:token', authController.verifyEmail);

const resendVerificationLimiter = createLimiter('auth_resend_verify', {
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: { message: 'Trop de demandes. Réessayez dans 15 minutes.' } },
});

router.post(
  '/resend-verification',
  resendVerificationLimiter,
  authController.resendVerification
);

router.post('/refresh', authController.refreshToken);

router.post('/logout', authenticateToken, authController.logout);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordEmailRateLimit,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  resetPasswordLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);

router.post(
  '/change-password',
  authenticateToken,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

router.post(
  '/change-email',
  authenticateToken,
  validate({ body: changeEmailSchema }),
  authController.changeEmail
);

export default router;
