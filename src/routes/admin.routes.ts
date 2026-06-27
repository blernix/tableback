import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createRestaurantSchema,
  updateRestaurantSchema,
  createRestaurantUserSchema,
  updateUserSchema,
  createCommercialUserSchema,
  manageSubscriptionSchema,
  getRestaurantsQuery,
  getRestaurantUsersQuery,
  getRestaurantAnalyticsQuery,
  exportQuery,
  restaurantIdParam,
  restaurantUserIdParam,
  userIdParam,
  commercialIdParam,
  notificationAnalyticsRestaurantIdParam,
} from '../validations/admin.schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole(['admin']));

router.get(
  '/restaurants',
  validate({ query: getRestaurantsQuery }),
  adminController.getRestaurants
);
router.post(
  '/restaurants',
  validate({ body: createRestaurantSchema }),
  adminController.createRestaurant
);
router.get(
  '/restaurants/:id',
  validate({ params: restaurantIdParam }),
  adminController.getRestaurantById
);
router.put(
  '/restaurants/:id',
  validate({ body: updateRestaurantSchema, params: restaurantIdParam }),
  adminController.updateRestaurant
);
router.delete(
  '/restaurants/:id',
  validate({ params: restaurantIdParam }),
  adminController.deleteRestaurant
);
router.put(
  '/restaurants/:id/regenerate-api-key',
  validate({ params: restaurantIdParam }),
  adminController.regenerateApiKey
);

router.get(
  '/restaurants/:restaurantId/users',
  validate({ query: getRestaurantUsersQuery, params: restaurantUserIdParam }),
  adminController.getRestaurantUsers
);
router.post(
  '/restaurants/:restaurantId/users',
  validate({ body: createRestaurantUserSchema, params: restaurantUserIdParam }),
  adminController.createRestaurantUser
);
router.put(
  '/users/:userId',
  validate({ body: updateUserSchema, params: userIdParam }),
  adminController.updateUser
);
router.delete(
  '/users/:userId',
  validate({ params: userIdParam }),
  adminController.deleteUser
);

router.get('/dashboard', adminController.getAdminDashboard);
router.get('/monitoring', adminController.getRestaurantMonitoring);

router.get(
  '/restaurants/:id/analytics',
  validate({ query: getRestaurantAnalyticsQuery, params: restaurantIdParam }),
  adminController.getRestaurantAnalytics
);

router.get(
  '/export/restaurants',
  validate({ query: exportQuery }),
  adminController.exportRestaurants
);
router.get(
  '/export/users',
  validate({ query: exportQuery }),
  adminController.exportUsers
);
router.get(
  '/export/reservations',
  validate({ query: exportQuery }),
  adminController.exportReservations
);
router.get(
  '/export/notifications',
  validate({ query: exportQuery }),
  adminController.exportNotificationAnalytics
);

router.get('/analytics/notifications', adminController.getNotificationAnalytics);
router.get(
  '/analytics/notifications/restaurant/:restaurantId',
  validate({ params: notificationAnalyticsRestaurantIdParam }),
  adminController.getRestaurantNotificationAnalyticsController
);

router.post('/quotas/reset-monthly', adminController.resetMonthlyQuotas);

router.post(
  '/restaurants/:id/subscription/manage',
  validate({ body: manageSubscriptionSchema, params: restaurantIdParam }),
  adminController.manageSubscription
);
router.get(
  '/restaurants/:id/subscription/sync-status',
  validate({ params: restaurantIdParam }),
  adminController.getSubscriptionSyncStatus
);

router.get('/commercials', adminController.getCommercialUsers);
router.get(
  '/commercials/:id',
  validate({ params: commercialIdParam }),
  adminController.getCommercialDetail
);
router.delete(
  '/commercials/:id',
  validate({ params: commercialIdParam }),
  adminController.deleteCommercialUser
);
router.post(
  '/commercials',
  validate({ body: createCommercialUserSchema }),
  adminController.createCommercialUser
);

export default router;
