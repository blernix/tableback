import { Request, Response } from 'express';

import logger from '../utils/logger';
import { applyWidgetDefaults } from '../config/widgetDefaults';

/**
 * Controller pour les routes de type "vanity URL" avec slugs
 * Remplace les anciennes routes qui utilisaient l'API key
 */

// GET /embed/reservations/:slug
export const getEmbedBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;
    
    const widgetConfig = applyWidgetDefaults(restaurant.widgetConfig);

    res.json({
      restaurant: {
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        openingHours: restaurant.openingHours,
        reservationConfig: restaurant.reservationConfig,
        tablesConfig: restaurant.tablesConfig,
        widgetConfig,
      },
    });
  } catch (error) {
    logger.error('Error getting restaurant by slug:', error);
    res.status(500).json({
      error: { message: 'Failed to get restaurant information' }
    });
  }
};

// GET /api/public/restaurant-info (avec slug)
export const getRestaurantInfoBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;
    
    res.json({
      restaurant: {
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        openingHours: restaurant.openingHours,
        reservationConfig: restaurant.reservationConfig,
        tablesConfig: {
          totalTables: restaurant.tablesConfig.totalTables,
          averageCapacity: restaurant.tablesConfig.averageCapacity,
        },
        widgetConfig: applyWidgetDefaults(restaurant.widgetConfig),
      },
    });
  } catch (error) {
    logger.error('Error getting restaurant info by slug:', error);
    res.status(500).json({
      error: { message: 'Failed to get restaurant information' }
    });
  }
};