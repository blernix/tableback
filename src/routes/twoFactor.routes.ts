import { Router } from 'express';
import * as twoFactorController from '../controllers/twoFactor.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for 2FA verification (5 attempts per 15 minutes per IP)
const twoFactorVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: {
    error: {
      message: 'Too many 2FA verification attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for 2FA setup (10 attempts per hour per IP)
const twoFactorSetupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    error: {
      message: 'Too many 2FA setup attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes (no authentication required, use temporary tokens)
// POST /api/2fa/verify-login - Verify 2FA code during login
router.post('/verify-login', twoFactorVerifyLimiter, twoFactorController.verifyLoginTwoFactor);

// POST /api/2fa/recovery - Use recovery code for login
router.post('/recovery', twoFactorVerifyLimiter, twoFactorController.useRecoveryCode);

// Protected routes (require authentication)
router.use(authenticateToken);

// GET /api/2fa/status - Get 2FA status for current user
router.get('/status', twoFactorController.getTwoFactorStatus);

// POST /api/2fa/setup/generate - Generate new 2FA secret and QR code
router.post('/setup/generate', twoFactorSetupLimiter, twoFactorController.generateSetup);

// POST /api/2fa/setup/enable - Enable 2FA with verification code
router.post('/setup/enable', twoFactorSetupLimiter, twoFactorController.enableTwoFactor);

// POST /api/2fa/disable - Disable 2FA for current user
router.post('/disable', twoFactorController.disableTwoFactor);

export default router;