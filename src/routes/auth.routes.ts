import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { forgotPasswordEmailRateLimit } from '../middleware/rateLimitPerEmail.middleware';
import logger from '../utils/logger';

const router = Router();

// Rate limiter for login - STRICT protection against brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  skipSuccessfulRequests: true, // ✅ Don't count successful logins (only failed attempts)
  message: {
    error: {
      message: 'Too many login attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`🚨 Login rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      error: {
        message: 'Too many login attempts. Please try again later.'
      }
    });
  },
});

// Rate limiter for forgot password - Prevent abuse
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: {
    error: {
      message: 'Too many password reset attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`🚨 Forgot password rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      error: {
        message: 'Too many password reset attempts. Please try again later.'
      }
    });
  },
});

// Rate limiter for reset password - Prevent brute force on reset tokens
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour (higher than forgot-password since valid tokens are needed)
  message: {
    error: {
      message: 'Too many password reset attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`🚨 Reset password rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
    });
    res.status(429).json({
      error: {
        message: 'Too many password reset attempts. Please try again later.'
      }
    });
  },
});

// Rate limiter for user registration - Prevent account spam
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: {
    error: {
      message: 'Too many registration attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`🚨 Registration rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      error: {
        message: 'Too many registration attempts. Please try again later.'
      }
    });
  },
});

// Rate limiter for self-service signup - Prevent abuse
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour per IP (stricter than register)
  message: {
    error: {
      message: 'Too many signup attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`🚨 Signup rate limit exceeded for IP ${req.ip}`, {
      ip: req.ip,
      email: req.body?.ownerEmail,
      restaurantName: req.body?.restaurantName,
    });
    res.status(429).json({
      error: {
        message: 'Too many signup attempts. Please try again later.'
      }
    });
  },
});

// POST /api/auth/register - Register new user (admin only, rate limited)
router.post('/register', registerLimiter, authenticateToken, authorizeRole(['admin']), authController.register);

// POST /api/auth/signup - Self-service signup (public, rate limited)
router.post('/signup', signupLimiter, authController.signup);

// POST /api/auth/login - Login user (rate limited)
router.post('/login', loginLimiter, authController.login);

// POST /api/auth/refresh - Refresh JWT token
router.post('/refresh', authController.refreshToken);

// POST /api/auth/logout - Logout user (requires authentication)
router.post('/logout', authenticateToken, authController.logout);

// POST /api/auth/forgot-password - Request password reset email
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordEmailRateLimit, authController.forgotPassword);

// POST /api/auth/reset-password - Reset password with token (rate limited to prevent token brute force)
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

// POST /api/auth/change-password - Change password (requires authentication)
router.post('/change-password', authenticateToken, authController.changePassword);

// POST /api/auth/change-email - Change email (requires authentication)
router.post('/change-email', authenticateToken, authController.changeEmail);

export default router;
