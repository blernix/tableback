import { Request, Response, NextFunction } from 'express';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';

/**
 * Middleware pour récupérer un restaurant par son slug (vanity URL)
 * Remplace le middleware verifyApiKey pour les nouvelles URLs
 */
export const verifySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      res.status(400).json({
        error: { message: 'Slug is required' }
      });
      return;
    }

    // Trouver le restaurant par slug
    const restaurant = await Restaurant.findOne({ publicSlug: slug });
    
    if (!restaurant) {
      res.status(404).json({
        error: { message: 'Restaurant not found' }
      });
      return;
    }

    // Vérifier que le restaurant est actif
    if (restaurant.status !== 'active') {
      res.status(403).json({
        error: { message: 'Restaurant is not active' }
      });
      return;
    }

    // Ajouter le restaurant à la requête (comme verifyApiKey)
    req.restaurant = restaurant;
    
    logger.info(`Restaurant found by slug: ${slug} (ID: ${restaurant._id})`);
    next();
  } catch (error) {
    logger.error('Error verifying slug:', error);
    res.status(500).json({
      error: { message: 'Failed to verify slug' }
    });
  }
};