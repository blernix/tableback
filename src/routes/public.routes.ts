import { Router, Request, Response, NextFunction } from 'express';
import * as publicController from '../controllers/public.controller';
import * as publicReservationController from '../controllers/public-reservation.controller';
import * as slugController from '../controllers/slug.controller';
import * as slugManagementController from '../controllers/slug-management.controller';
import { verifyApiKey } from '../middleware/apikey.middleware';
import { verifySlug } from '../middleware/slug.middleware';
import { checkReservationQuota } from '../middleware/quota.middleware';
import { reservationRateLimiter } from '../middleware/reservationRateLimit.middleware';

const router = Router();

// Middleware to disable caching for all public API routes
// This prevents 304 Not Modified responses that break iframe cross-origin communication
const noCacheMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Apply no-cache middleware to all public routes
router.use(noCacheMiddleware);

// Public routes - no authentication required, only API key

// Get menu by API key (legacy - no middleware)
router.get('/menu/:apiKey', publicController.getMenuByApiKey);

// Get menu PDF by restaurant ID (stable URL for QR codes)
router.get('/menu/pdf/:restaurantId', publicController.getMenuPdfById);

// Reservation endpoints (require API key in header)
// Apply rate limiting BEFORE other middleware to prevent abuse
router.post(
  '/reservations',
  reservationRateLimiter,
  verifyApiKey,
  checkReservationQuota,
  publicReservationController.createPublicReservation
);
router.get('/availability/:date', verifyApiKey, publicReservationController.checkAvailability);
router.get('/time-slots/:date', verifyApiKey, publicReservationController.getAvailableTimeSlots);
router.get('/restaurant-info', verifyApiKey, publicReservationController.getRestaurantInfo);
router.get('/upcoming-closures', verifyApiKey, publicReservationController.getUpcomingClosures);
router.get('/widget-config', verifyApiKey, publicReservationController.getWidgetConfig);

// Cancel reservation via email link (public - no API key required)
router.get('/reservations/cancel', publicReservationController.cancelReservation);

// Vérification de disponibilité des slugs (publique)
router.get('/check-slug-availability/:slug', slugManagementController.checkSlugAvailability);

// ===== VANITY URL SYSTEM - Nouveau système avec slugs =====
// Ces routes remplacent progressivement l'ancien système avec API key

// Route embed avec slug dans l'URL (pour iframes/widgets)
router.get('/embed/reservations/:slug', verifySlug, slugController.getEmbedBySlug);

// Routes de gestion des slugs (nécessitent authentification)
import slugRoutes from './slug.routes';

// Montage des routes de gestion des slugs
router.use('/restaurant', slugRoutes);

export default router;
