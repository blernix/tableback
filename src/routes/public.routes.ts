import { Router, Request, Response, NextFunction } from 'express';
import * as publicController from '../controllers/public.controller';
import * as publicReservationController from '../controllers/public-reservation.controller';
import * as slugController from '../controllers/slug.controller';
import * as slugManagementController from '../controllers/slug-management.controller';
import { verifyApiKey } from '../middleware/apikey.middleware';
import { verifySlug } from '../middleware/slug.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createPublicReservationSchema,
  checkAvailabilityParam,
  getTimeSlotsParam,
  cancelReservationQuery,
  upcomingClosuresQuery,
  embedReservationParam,
} from '../validations/public.schemas';
import { checkSlugAvailabilityParam } from '../validations/slug.schemas';
import { checkReservationQuota } from '../middleware/quota.middleware';
import { reservationRateLimiter } from '../middleware/reservationRateLimit.middleware';

const router = Router();

const noCacheMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

router.use(noCacheMiddleware);

router.get('/menu/:apiKey', publicController.getMenuByApiKey);
router.get('/menu/pdf/:restaurantId', publicController.getMenuPdfById);

router.post(
  '/reservations',
  reservationRateLimiter,
  verifyApiKey,
  checkReservationQuota,
  validate({ body: createPublicReservationSchema }),
  publicReservationController.createPublicReservation
);
router.get(
  '/availability/:date',
  verifyApiKey,
  validate({ params: checkAvailabilityParam }),
  publicReservationController.checkAvailability
);
router.get(
  '/time-slots/:date',
  verifyApiKey,
  validate({ params: getTimeSlotsParam }),
  publicReservationController.getAvailableTimeSlots
);
router.get('/restaurant-info', verifyApiKey, publicReservationController.getRestaurantInfo);
router.get(
  '/upcoming-closures',
  verifyApiKey,
  validate({ query: upcomingClosuresQuery }),
  publicReservationController.getUpcomingClosures
);
router.get('/widget-config', verifyApiKey, publicReservationController.getWidgetConfig);

router.get(
  '/reservations/cancel',
  validate({ query: cancelReservationQuery }),
  publicReservationController.cancelReservation
);

router.get(
  '/check-slug-availability/:slug',
  validate({ params: checkSlugAvailabilityParam }),
  slugManagementController.checkSlugAvailability
);

router.get(
  '/embed/reservations/:slug',
  verifySlug,
  validate({ params: embedReservationParam }),
  slugController.getEmbedBySlug
);

import slugRoutes from './slug.routes';
router.use('/restaurant', slugRoutes);

export default router;
