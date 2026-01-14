import { Request, Response, NextFunction } from 'express';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';

// Extend Express Request type to include restaurant
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      restaurant?: any;
    }
  }
}

export const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: {
          message: 'API key is required. Please provide it in the X-API-Key header.',
        },
      });
      return;
    }

    // Find restaurant by API key
    const restaurant = await Restaurant.findOne({ apiKey, status: 'active' });

    if (!restaurant) {
      res.status(401).json({
        error: {
          message: 'Invalid API key or restaurant is inactive',
        },
      });
      return;
    }

    // Attach restaurant to request
    req.restaurant = restaurant;
    next();
  } catch (error) {
    logger.error('API key verification error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error during API key verification',
      },
    });
  }
};
