import { Router } from 'express';
import * as restaurantController from '../controllers/restaurant.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { upload } from '../config/storage.config';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for file uploads (10 uploads per hour per IP)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: {
    error: {
      message: 'Too many upload attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All restaurant routes require authentication
router.use(authenticateToken);

// Restaurant data - accessible to restaurant and server roles
router.get('/me', authorizeRole(['restaurant', 'server']), restaurantController.getMyRestaurant);
router.get('/dashboard-stats', authorizeRole(['restaurant', 'server']), restaurantController.getDashboardStats);

// Restaurant configuration - only accessible to restaurant role
router.put('/basic-info', authorizeRole(['restaurant']), restaurantController.updateBasicInfo);
router.put('/opening-hours', authorizeRole(['restaurant']), restaurantController.updateOpeningHours);
router.post('/logo', authorizeRole(['restaurant']), uploadLimiter, upload.single('logo'), restaurantController.uploadLogo);
router.delete('/logo', authorizeRole(['restaurant']), restaurantController.deleteLogo);

// Menu - only accessible to restaurant role
router.post('/menu/pdf', authorizeRole(['restaurant']), uploadLimiter, upload.single('pdf'), restaurantController.uploadMenuPdf);
router.put('/menu/mode', authorizeRole(['restaurant']), restaurantController.switchMenuMode);
router.post('/menu/qrcode/generate', authorizeRole(['restaurant']), restaurantController.generateMenuQrCode);

// Tables Configuration - only accessible to restaurant role
router.put('/tables-config', authorizeRole(['restaurant']), restaurantController.updateTablesConfig);

// Reservation Configuration - only accessible to restaurant role
router.put('/reservation-config', authorizeRole(['restaurant']), restaurantController.updateReservationConfig);

// Closures - only accessible to restaurant role
router.get('/closures', authorizeRole(['restaurant']), restaurantController.getClosures);
router.post('/closures', authorizeRole(['restaurant']), restaurantController.createClosure);
router.delete('/closures/:id', authorizeRole(['restaurant']), restaurantController.deleteClosure);

export default router;
