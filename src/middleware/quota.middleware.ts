import { Request, Response, NextFunction } from 'express';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';

/**
 * Middleware to check if restaurant can create a new reservation
 * Enforces monthly quota for Starter plan (100 reservations/month)
 *
 * Usage: Add before reservation creation endpoints
 */
export const checkReservationQuota = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip quota check for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return next();
    }

    // Get restaurant ID from authenticated user or API key
    let restaurantId: string | undefined;

    if (req.user?.restaurantId) {
      // Authenticated request (dashboard)
      restaurantId = req.user.restaurantId.toString();
    } else if (req.restaurant?._id) {
      // Public API request (verifyApiKey middleware already fetched restaurant)
      restaurantId = req.restaurant._id.toString();
    }

    if (!restaurantId) {
      res.status(400).json({
        error: { message: 'Restaurant ID not found' }
      });
      return;
    }

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      res.status(404).json({
        error: { message: 'Restaurant not found' }
      });
      return;
    }

    // Check if restaurant can create a reservation
    if (!restaurant.canCreateReservation()) {
      const quotaInfo = restaurant.getReservationQuotaInfo();

      logger.warn(`Reservation quota exceeded for restaurant: ${restaurant.name} (ID: ${restaurantId})`);

      res.status(403).json({
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Vous avez atteint votre limite mensuelle de réservations.',
          details: {
            current: quotaInfo.current,
            limit: quotaInfo.limit,
            plan: restaurant.subscription?.plan || 'starter',
          },
          action: 'Passez au plan Pro pour des réservations illimitées.',
        }
      });
      return;
    }

    // Quota OK, proceed to next middleware
    next();
  } catch (error) {
    logger.error('Error checking reservation quota:', error);
    res.status(500).json({
      error: { message: 'Failed to check reservation quota' }
    });
  }
};
