import { Router } from 'express';
import * as twoFactorController from '../controllers/twoFactor.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  enableTwoFactorSchema,
  verifyLoginTwoFactorSchema,
  useRecoveryCodeSchema,
} from '../validations/twoFactor.schemas';
import { createLimiter } from '../middleware/rateLimiterFactory';

const router = Router();

const twoFactorVerifyLimiter = createLimiter('2fa_verify', {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: {
      message: 'Too many 2FA verification attempts. Please try again later.',
    },
  },
});

const twoFactorSetupLimiter = createLimiter('2fa_setup', {
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: {
      message: 'Too many 2FA setup attempts. Please try again later.',
    },
  },
});

router.post(
  '/verify-login',
  twoFactorVerifyLimiter,
  validate({ body: verifyLoginTwoFactorSchema }),
  twoFactorController.verifyLoginTwoFactor
);

router.post(
  '/recovery',
  twoFactorVerifyLimiter,
  validate({ body: useRecoveryCodeSchema }),
  twoFactorController.useRecoveryCode
);

router.use(authenticateToken);

router.get('/status', twoFactorController.getTwoFactorStatus);

router.post(
  '/setup/generate',
  twoFactorSetupLimiter,
  twoFactorController.generateSetup
);

router.post(
  '/setup/enable',
  twoFactorSetupLimiter,
  validate({ body: enableTwoFactorSchema }),
  twoFactorController.enableTwoFactor
);

router.post('/disable', twoFactorController.disableTwoFactor);

export default router;
