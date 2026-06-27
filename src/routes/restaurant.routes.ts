import { Router } from 'express';
import * as restaurantController from '../controllers/restaurant.controller';
import * as slugManagementController from '../controllers/slug-management.controller';
import * as customerController from '../controllers/customer.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  updateBasicInfoSchema,
  updateOpeningHoursSchema,
  switchMenuModeSchema,
  updateTablesConfigSchema,
  updateReservationConfigSchema,
  createClosureSchema,
  updateWidgetConfigSchema,
  sendContactMessageSchema,
  closureIdParam,
} from '../validations/restaurant.schemas';
import {
  createCustomerSchema,
  updateCustomerSchema,
  getCustomersQuery,
  searchCustomersQuery,
  exportCustomersQuery,
  customerIdParam,
} from '../validations/customer.schemas';
import { updateRestaurantSlugSchema } from '../validations/slug.schemas';
import { verifyProPlan } from '../middleware/subscription.middleware';
import { createLimiter } from '../middleware/rateLimiterFactory';
import { upload } from '../config/storage.config';

const router = Router();

const uploadLimiter = createLimiter('upload', {
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: {
      message: 'Too many upload attempts. Please try again later.',
    },
  },
});

router.use(authenticateToken);

router.get('/me', authorizeRole(['restaurant', 'server']), restaurantController.getMyRestaurant);
router.get(
  '/dashboard-stats',
  authorizeRole(['restaurant', 'server']),
  restaurantController.getDashboardStats
);

router.put(
  '/basic-info',
  authorizeRole(['restaurant']),
  validate({ body: updateBasicInfoSchema }),
  restaurantController.updateBasicInfo
);
router.put(
  '/opening-hours',
  authorizeRole(['restaurant']),
  validate({ body: updateOpeningHoursSchema }),
  restaurantController.updateOpeningHours
);
router.post(
  '/logo',
  authorizeRole(['restaurant']),
  uploadLimiter,
  upload.single('logo'),
  restaurantController.uploadLogo
);
router.delete('/logo', authorizeRole(['restaurant']), restaurantController.deleteLogo);

router.post(
  '/menu/pdf',
  authorizeRole(['restaurant']),
  uploadLimiter,
  upload.single('pdf'),
  restaurantController.uploadMenuPdf
);
router.put(
  '/menu/mode',
  authorizeRole(['restaurant']),
  validate({ body: switchMenuModeSchema }),
  restaurantController.switchMenuMode
);
router.post(
  '/menu/qrcode/generate',
  authorizeRole(['restaurant']),
  restaurantController.generateMenuQrCode
);

router.put(
  '/widget-config',
  authorizeRole(['restaurant']),
  verifyProPlan,
  validate({ body: updateWidgetConfigSchema }),
  restaurantController.updateWidgetConfig
);

router.put(
  '/slug',
  authorizeRole(['restaurant']),
  verifyProPlan,
  validate({ body: updateRestaurantSlugSchema }),
  slugManagementController.updateRestaurantSlug
);

router.put(
  '/tables-config',
  authorizeRole(['restaurant']),
  validate({ body: updateTablesConfigSchema }),
  restaurantController.updateTablesConfig
);

router.put(
  '/reservation-config',
  authorizeRole(['restaurant']),
  validate({ body: updateReservationConfigSchema }),
  restaurantController.updateReservationConfig
);

router.post(
  '/contact',
  authorizeRole(['restaurant', 'server']),
  validate({ body: sendContactMessageSchema }),
  restaurantController.sendContactMessage
);

router.get('/closures', authorizeRole(['restaurant']), restaurantController.getClosures);
router.post(
  '/closures',
  authorizeRole(['restaurant']),
  validate({ body: createClosureSchema }),
  restaurantController.createClosure
);
router.delete(
  '/closures/:id',
  authorizeRole(['restaurant']),
  validate({ params: closureIdParam }),
  restaurantController.deleteClosure
);

router.get(
  '/customers',
  authorizeRole(['restaurant', 'server']),
  validate({ query: getCustomersQuery }),
  customerController.getCustomers
);
router.get(
  '/customers/search',
  authorizeRole(['restaurant', 'server']),
  validate({ query: searchCustomersQuery }),
  customerController.searchCustomers
);
router.get(
  '/customers/export',
  authorizeRole(['restaurant']),
  validate({ query: exportCustomersQuery }),
  customerController.exportCustomers
);
router.get(
  '/customers/:id',
  authorizeRole(['restaurant', 'server']),
  validate({ params: customerIdParam }),
  customerController.getCustomerById
);
router.post(
  '/customers',
  authorizeRole(['restaurant', 'server']),
  validate({ body: createCustomerSchema }),
  customerController.createCustomer
);
router.put(
  '/customers/:id',
  authorizeRole(['restaurant', 'server']),
  validate({ body: updateCustomerSchema, params: customerIdParam }),
  customerController.updateCustomer
);

export default router;
