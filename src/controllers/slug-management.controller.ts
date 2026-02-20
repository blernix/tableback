import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';
import { z } from 'zod';

// Liste des slugs réservés (routes existantes de l'application)
const RESERVED_SLUGS = [
  // Routes principales
  'dashboard',
  'login',
  'signup',
  'admin',
  'embed',
  'api',
  // Pages légales
  'cgv',
  'cookies',
  'legal',
  'privacy',
  // Autres
  'favicon.ico',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  // Préfixes système
  '_next',
  '_vercel',
  'public',
  'static',
];

// Validation schema pour la mise à jour du slug
const updateSlugSchema = z.object({
  slug: z
    .string()
    .min(3, 'Le slug doit faire au moins 3 caractères')
    .max(50, 'Le slug ne peut pas dépasser 50 caractères')
    .regex(
      /^[a-z0-9-]+$/,
      'Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets'
    )
    .refine((slug) => !RESERVED_SLUGS.includes(slug), {
      message: 'Ce slug est réservé. Veuillez en choisir un autre.',
    })
    .refine(
      (slug) =>
        !slug.startsWith('dashboard-') && !slug.startsWith('admin-') && !slug.startsWith('api-'),
      {
        message: 'Le slug ne peut pas commencer par "dashboard-", "admin-" ou "api-"',
      }
    ),
});

/**
 * Met à jour le slug personnalisé du restaurant (Feature Pro)
 *
 * PUT /api/restaurant/slug
 */
export const updateRestaurantSlug = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({
        error: { message: 'User not associated with a restaurant' },
      });
      return;
    }

    // Validation
    const validatedData = updateSlugSchema.parse(req.body);

    const restaurant = await Restaurant.findById(req.user.restaurantId);

    if (!restaurant) {
      res.status(404).json({
        error: { message: 'Restaurant not found' },
      });
      return;
    }

    // Vérifier que c'est un compte Pro
    if (restaurant.accountType !== 'self-service' || restaurant.subscription?.plan !== 'pro') {
      res.status(403).json({
        error: { message: 'Custom slug is only available for Pro plan subscribers' },
      });
      return;
    }

    // Vérifier que le slug n'est pas déjà utilisé
    const existingRestaurant = await Restaurant.findOne({
      publicSlug: validatedData.slug,
      _id: { $ne: restaurant._id }, // Exclure le restaurant actuel
    });

    if (existingRestaurant) {
      res.status(409).json({
        error: {
          message: 'This slug is already taken',
          available: false,
        },
      });
      return;
    }

    // Sauvegarder l'ancien slug pour log
    const oldSlug = restaurant.publicSlug;

    // Mettre à jour le slug
    restaurant.publicSlug = validatedData.slug;
    await restaurant.save();

    logger.info(
      `Restaurant slug updated: ${oldSlug} → ${validatedData.slug} (ID: ${restaurant._id})`
    );

    res.json({
      message: 'Slug updated successfully',
      slug: validatedData.slug,
      available: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error updating restaurant slug:', error);
    res.status(500).json({
      error: { message: 'Failed to update slug' },
    });
  }
};

/**
 * Vérifie la disponibilité d'un slug
 *
 * GET /api/restaurant/check-slug-availability/:slug
 */
export const checkSlugAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    if (!slug) {
      res.status(400).json({
        error: { message: 'Slug is required' },
      });
      return;
    }

    // Validation basique
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      res.status(400).json({
        error: {
          message:
            'Invalid slug format. Use only lowercase letters, numbers, and hyphens (3-50 characters)',
          available: false,
        },
      });
      return;
    }

    // Vérifier si le slug est réservé
    if (
      RESERVED_SLUGS.includes(slug) ||
      slug.startsWith('dashboard-') ||
      slug.startsWith('admin-') ||
      slug.startsWith('api-')
    ) {
      res.status(400).json({
        error: {
          message: 'Ce slug est réservé. Veuillez en choisir un autre.',
          available: false,
        },
      });
      return;
    }

    // Vérifier si le slug est déjà utilisé
    const existingRestaurant = await Restaurant.findOne({ publicSlug: slug });

    res.json({
      slug: slug,
      available: !existingRestaurant,
      message: existingRestaurant ? 'This slug is already taken' : 'This slug is available',
    });
  } catch (error) {
    logger.error('Error checking slug availability:', error);
    res.status(500).json({
      error: { message: 'Failed to check slug availability' },
    });
  }
};
