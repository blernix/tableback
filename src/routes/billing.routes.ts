import { Router } from 'express';
import {
  createCheckout,
  createPortal,
  getSubscription,
  cancelSub,
  getPlans,
} from '../controllers/billing.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createCheckoutSchema,
  cancelSubscriptionSchema,
} from '../validations/billing.schemas';
import { verifySubscription } from '../middleware/subscription.middleware';

const router = Router();

router.get('/plans', getPlans);

router.post(
  '/create-checkout',
  authenticateToken,
  validate({ body: createCheckoutSchema }),
  createCheckout
);

router.post(
  '/create-portal',
  authenticateToken,
  verifySubscription,
  createPortal
);

router.get('/subscription', authenticateToken, getSubscription);

router.post(
  '/cancel',
  authenticateToken,
  verifySubscription,
  validate({ body: cancelSubscriptionSchema }),
  cancelSub
);

export default router;
