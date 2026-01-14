import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { forgotPasswordEmailRateLimit } from '../middleware/rateLimitPerEmail.middleware';

const router = Router();

// Rate limiter for forgot password (5 attempts per hour per IP)
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
});

// Rate limiter for user registration (5 attempts per hour per IP)
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
});

// POST /api/auth/register - Register new user (admin only, rate limited)
router.post('/register', registerLimiter, authenticateToken, authorizeRole(['admin']), authController.register);

// POST /api/auth/login - Login user
router.post('/login', authController.login);

// POST /api/auth/refresh - Refresh JWT token
router.post('/refresh', authController.refreshToken);

// POST /api/auth/logout - Logout user (requires authentication)
router.post('/logout', authenticateToken, authController.logout);

// POST /api/auth/forgot-password - Request password reset email
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordEmailRateLimit, authController.forgotPassword);

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', authController.resetPassword);

export default router;
