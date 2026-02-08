import { Router } from 'express';
import {
  createCheckout,
  createPortal,
  getSubscription,
  cancelSub,
  getPlans,
} from '../controllers/billing.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { verifySubscription } from '../middleware/subscription.middleware';

const router = Router();

/**
 * Public routes
 */

// Get available plans (public - for signup page)
router.get('/plans', getPlans);

// Note: Stripe webhook is handled directly in app.ts
// to preserve raw body for signature verification

/**
 * Protected routes (require authentication)
 */

// Create checkout session (for new signups or upgrades)
router.post('/create-checkout', authenticateToken, createCheckout);

// Create customer portal session (manage subscription)
router.post('/create-portal', authenticateToken, verifySubscription, createPortal);

// Get current subscription details
router.get('/subscription', authenticateToken, getSubscription);

// Cancel subscription
router.post('/cancel', authenticateToken, verifySubscription, cancelSub);

export default router;
