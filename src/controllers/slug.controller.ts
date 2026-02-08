import { Request, Response } from 'express';

import logger from '../utils/logger';

/**
 * Controller pour les routes de type "vanity URL" avec slugs
 * Remplace les anciennes routes qui utilisaient l'API key
 */

// GET /embed/reservations/:slug
export const getEmbedBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;
    
    // Récupérer la configuration widget
    const widgetConfig = restaurant.widgetConfig || {
      primaryColor: '#0066FF',
      secondaryColor: '#2A2A2A',
      fontFamily: 'system-ui, sans-serif',
      borderRadius: '4px',
      // Button specific colors
      buttonBackgroundColor: (restaurant.widgetConfig as any)?.primaryColor || '#0066FF',
      buttonTextColor: '#FFFFFF',
      buttonHoverColor: '#0052EB',
      // Floating button configs
      buttonText: (restaurant.widgetConfig as any)?.buttonText || 'Réserver une table',
      buttonPosition: (restaurant.widgetConfig as any)?.buttonPosition || 'bottom-right',
      buttonStyle: (restaurant.widgetConfig as any)?.buttonStyle || 'round',
      buttonIcon: (restaurant.widgetConfig as any)?.buttonIcon !== false,
      modalWidth: (restaurant.widgetConfig as any)?.modalWidth || '500px',
      modalHeight: (restaurant.widgetConfig as any)?.modalHeight || '600px',
    };

    res.json({
      restaurant: {
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        openingHours: restaurant.openingHours,
        reservationConfig: restaurant.reservationConfig,
        tablesConfig: restaurant.tablesConfig,
        widgetConfig: widgetConfig,
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
        widgetConfig: restaurant.widgetConfig || {
          primaryColor: '#0066FF',
          secondaryColor: '#2A2A2A',
          fontFamily: 'system-ui, sans-serif',
          borderRadius: '4px',
          // Button specific colors
      buttonBackgroundColor: (restaurant.widgetConfig as any)?.primaryColor || '#0066FF',
          buttonTextColor: '#FFFFFF',
          buttonHoverColor: '#0052EB',
          // Floating button configs
      buttonText: (restaurant.widgetConfig as any)?.buttonText || 'Réserver une table',
      buttonPosition: (restaurant.widgetConfig as any)?.buttonPosition || 'bottom-right',
      buttonStyle: (restaurant.widgetConfig as any)?.buttonStyle || 'round',
      buttonIcon: (restaurant.widgetConfig as any)?.buttonIcon !== false,
      modalWidth: (restaurant.widgetConfig as any)?.modalWidth || '500px',
      modalHeight: (restaurant.widgetConfig as any)?.modalHeight || '600px',
        },
      },
    });
  } catch (error) {
    logger.error('Error getting restaurant info by slug:', error);
    res.status(500).json({
      error: { message: 'Failed to get restaurant information' }
    });
  }
};