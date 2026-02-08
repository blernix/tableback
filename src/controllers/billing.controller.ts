import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  getSubscriptionDetails,
  cancelSubscription,
} from '../services/stripe.service';
import { stripe, STRIPE_CONFIG } from '../config/stripe.config';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';

/**
 * Create Stripe Checkout Session
 * POST /api/billing/create-checkout
 */
export const createCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      plan: z.enum(['starter', 'pro']),
      restaurantId: z.string(),
    });

    const { plan, restaurantId } = schema.parse(req.body);

    // Verify restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Check if restaurant already has an active subscription
    if (restaurant.subscription?.stripeSubscriptionId) {
      const isActive = restaurant.isSubscriptionActive();
      if (isActive) {
        res.status(400).json({
          error: {
            message: 'Restaurant already has an active subscription',
            currentPlan: restaurant.subscription.plan,
          },
        });
        return;
      }
    }

    // Create checkout session
    const session = await createCheckoutSession({
      restaurantId,
      plan,
      email: restaurant.email,
    });

    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
      return;
    }

    logger.error('Failed to create checkout session:', error);
    res.status(500).json({ error: { message: 'Failed to create checkout session' } });
  }
};

/**
 * Create Stripe Customer Portal Session
 * POST /api/billing/create-portal
 */
export const createPortal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(401).json({ error: { message: 'Not authenticated' } });
      return;
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    if (!restaurant.subscription?.stripeCustomerId) {
      res.status(400).json({
        error: { message: 'No subscription found' },
      });
      return;
    }

    // Create portal session
    const session = await createPortalSession({
      customerId: restaurant.subscription.stripeCustomerId,
    });

    res.status(200).json({
      url: session.url,
    });
  } catch (error) {
    logger.error('Failed to create portal session:', error);
    res.status(500).json({ error: { message: 'Failed to create portal session' } });
  }
};

/**
 * Handle Stripe Webhook
 * POST /api/billing/webhook
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).json({ error: { message: 'Missing stripe-signature header' } });
    return;
  }

  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_CONFIG.webhook.secret
    );

    logger.info(`Received Stripe webhook: ${event.type}`, { eventId: event.id });

    // Handle the event asynchronously
    handleWebhookEvent(event).catch((error) => {
      logger.error('Webhook handler error:', error);
    });

    // Respond immediately to Stripe
    res.status(200).json({ received: true });
  } catch (error: any) {
    logger.error('Webhook signature verification failed:', error);
    res.status(400).json({
      error: { message: `Webhook Error: ${error.message}` },
    });
  }
};

/**
 * Get current subscription details
 * GET /api/billing/subscription
 */
export const getSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(401).json({ error: { message: 'Not authenticated' } });
      return;
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // If no subscription, return basic info
    if (!restaurant.subscription) {
      res.status(200).json({
        accountType: restaurant.accountType,
        subscription: null,
      });
      return;
    }

    // Get Stripe subscription details
    const { subscription, customer } = await getSubscriptionDetails(
      req.user.restaurantId.toString()
    );

    res.status(200).json({
      accountType: restaurant.accountType,
      subscription: {
        plan: restaurant.subscription.plan,
        status: restaurant.subscription.status,
        currentPeriodStart: restaurant.subscription.currentPeriodStart,
        currentPeriodEnd: restaurant.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: restaurant.subscription.cancelAtPeriodEnd,
        isActive: restaurant.isSubscriptionActive(),
      },
      stripe: {
        customerId: restaurant.subscription.stripeCustomerId,
        subscriptionId: restaurant.subscription.stripeSubscriptionId,
        customer: customer
          ? {
              email: customer.email,
              name: customer.name,
            }
          : null,
        subscription: subscription
          ? {
        cancelAt: (subscription as any).cancel_at,
              canceledAt: (subscription as any).canceled_at,
              trialEnd: (subscription as any).trial_end,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error('Failed to get subscription:', error);
    res.status(500).json({ error: { message: 'Failed to get subscription details' } });
  }
};

/**
 * Cancel subscription
 * POST /api/billing/cancel
 */
export const cancelSub = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(401).json({ error: { message: 'Not authenticated' } });
      return;
    }

    const schema = z.object({
      immediately: z.boolean().optional(),
    });

    const { immediately } = schema.parse(req.body);

    const subscription = await cancelSubscription({
      restaurantId: req.user.restaurantId.toString(),
      immediately,
    });

    res.status(200).json({
      message: immediately
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at the end of the billing period',
      subscription: {
        id: subscription.id,
        cancelAt: subscription.cancel_at,
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        currentPeriodEnd: (subscription as any).current_period_end,
      },
    });
  } catch (error: any) {
    logger.error('Failed to cancel subscription:', error);
    res.status(500).json({
      error: { message: error.message || 'Failed to cancel subscription' },
    });
  }
};

/**
 * Get available plans
 * GET /api/billing/plans
 */
export const getPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = [
      {
        id: 'starter',
        name: STRIPE_CONFIG.products.starter.name,
        price: STRIPE_CONFIG.products.starter.amount / 100,
        currency: STRIPE_CONFIG.products.starter.currency,
        interval: STRIPE_CONFIG.products.starter.interval,
        features: STRIPE_CONFIG.products.starter.features,
        priceId: STRIPE_CONFIG.products.starter.priceId,
      },
      {
        id: 'pro',
        name: STRIPE_CONFIG.products.pro.name,
        price: STRIPE_CONFIG.products.pro.amount / 100,
        currency: STRIPE_CONFIG.products.pro.currency,
        interval: STRIPE_CONFIG.products.pro.interval,
        features: STRIPE_CONFIG.products.pro.features,
        priceId: STRIPE_CONFIG.products.pro.priceId,
      },
    ];

    res.status(200).json({ plans });
  } catch (error) {
    logger.error('Failed to get plans:', error);
    res.status(500).json({ error: { message: 'Failed to get plans' } });
  }
};
