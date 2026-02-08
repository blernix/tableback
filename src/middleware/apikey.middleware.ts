import { Request, Response, NextFunction } from 'express';
import Restaurant, { IRestaurant } from '../models/Restaurant.model';
import logger from '../utils/logger';

// Extend Express Request type to include restaurant
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      restaurant?: IRestaurant;
    }
  }
}

export const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip API key verification for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string;
    const slug = req.headers['x-slug'] as string;

    // Support both API key (legacy) and slug (new system)
    if (!apiKey && !slug) {
      res.status(401).json({
        error: {
          message: 'API key or slug is required. Please provide it in the X-API-Key or X-Slug header.',
        },
      });
      return;
    }

    let restaurant;
    
    if (slug) {
      // Find restaurant by slug (new system)
      restaurant = await Restaurant.findOne({ publicSlug: slug, status: 'active' });
      
      if (!restaurant) {
        res.status(401).json({
          error: {
            message: 'Invalid slug or restaurant is inactive',
          },
        });
        return;
      }
    } else {
      // Find restaurant by API key (legacy system)
      restaurant = await Restaurant.findOne({ apiKey, status: 'active' });

      if (!restaurant) {
        res.status(401).json({
          error: {
            message: 'Invalid API key or restaurant is inactive',
          },
        });
        return;
      }
    }

    // Attach restaurant to request
    req.restaurant = restaurant;
    logger.info(`Restaurant identified: ${restaurant.name} (ID: ${restaurant._id}, Slug: ${restaurant.publicSlug})`);
    next();
  } catch (error) {
    logger.error('Restaurant verification error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error during restaurant verification',
      },
    });
  }
};
