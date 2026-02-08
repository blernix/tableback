import { Request, Response, NextFunction } from 'express';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';

/**
 * Middleware to verify that the restaurant has an active subscription
 * Only applies to self-service accounts (managed accounts bypass this check)
 */
export const verifySubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'User not authenticated' } });
      return;
    }

    // Admin users bypass subscription checks
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Get the restaurant ID from the user
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      res.status(403).json({
        error: { message: 'User not associated with any restaurant' }
      });
      return;
    }

    // Fetch the restaurant
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Managed accounts don't need subscription verification
    if (restaurant.accountType === 'managed') {
      // Just check if restaurant is active
      if (restaurant.status !== 'active') {
        res.status(403).json({
          error: {
            message: 'Restaurant account is inactive. Please contact support.'
          }
        });
        return;
      }
      next();
      return;
    }

    // Self-service accounts need active subscription
    if (!restaurant.isSubscriptionActive()) {
      const subscriptionStatus = restaurant.subscription?.status || 'none';

      let message = 'Your subscription has expired. Please renew to continue using the service.';

      if (subscriptionStatus === 'past_due') {
        message = 'Your payment is overdue. Please update your payment method.';
      } else if (subscriptionStatus === 'cancelled') {
        message = 'Your subscription has been cancelled. Renew to regain access.';
      } else if (subscriptionStatus === 'trial' && restaurant.subscription?.trialEndsAt) {
        const trialEnd = new Date(restaurant.subscription.trialEndsAt);
        if (new Date() > trialEnd) {
          message = 'Your trial period has ended. Please subscribe to continue.';
        }
      }

      res.status(402).json({
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message,
          subscriptionStatus,
          restaurantId: restaurant._id,
        },
      });
      return;
    }

    // Subscription is active, proceed
    next();
  } catch (error) {
    logger.error('Subscription verification error:', error);
    res.status(500).json({
      error: { message: 'Failed to verify subscription' }
    });
  }
};

/**
 * Middleware to verify that the restaurant has a Pro plan
 * Used for Pro-only features like widget customization
 */
export const verifyProPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'User not authenticated' } });
      return;
    }

    // Admin users bypass plan checks
    if (req.user.role === 'admin') {
      next();
      return;
    }

    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      res.status(403).json({
        error: { message: 'User not associated with any restaurant' }
      });
      return;
    }

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Managed accounts have full access (as if they were Pro)
    if (restaurant.accountType === 'managed') {
      next();
      return;
    }

    // Self-service accounts need Pro plan
    if (restaurant.subscription?.plan !== 'pro') {
      res.status(403).json({
        error: {
          code: 'PRO_PLAN_REQUIRED',
          message: 'This feature is only available for Pro plan subscribers.',
          currentPlan: restaurant.subscription?.plan || 'none',
        },
      });
      return;
    }

    // Verify subscription is also active
    if (!restaurant.isSubscriptionActive()) {
      res.status(402).json({
        error: {
          code: 'SUBSCRIPTION_EXPIRED',
          message: 'Your subscription has expired. Please renew to continue.',
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Pro plan verification error:', error);
    res.status(500).json({
      error: { message: 'Failed to verify plan' }
    });
  }
};
