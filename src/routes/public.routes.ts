import { Router } from 'express';
import * as publicController from '../controllers/public.controller';
import * as publicReservationController from '../controllers/public-reservation.controller';
import { verifyApiKey } from '../middleware/apikey.middleware';

const router = Router();

// Public routes - no authentication required, only API key

// Get menu by API key (legacy - no middleware)
router.get('/menu/:apiKey', publicController.getMenuByApiKey);

// Get menu PDF by restaurant ID (stable URL for QR codes)
router.get('/menu/pdf/:restaurantId', publicController.getMenuPdfById);

// Reservation endpoints (require API key in header)
router.post('/reservations', verifyApiKey, publicReservationController.createPublicReservation);
router.get('/availability/:date', verifyApiKey, publicReservationController.checkAvailability);
router.get('/time-slots/:date', verifyApiKey, publicReservationController.getAvailableTimeSlots);
router.get('/restaurant-info', verifyApiKey, publicReservationController.getRestaurantInfo);
router.get('/upcoming-closures', verifyApiKey, publicReservationController.getUpcomingClosures);

// Cancel reservation via email link (public - no API key required)
router.get('/reservations/cancel', publicReservationController.cancelReservation);

export default router;
