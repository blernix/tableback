import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRole(['admin']));

// Restaurant management
router.get('/restaurants', adminController.getRestaurants);
router.post('/restaurants', adminController.createRestaurant);
router.get('/restaurants/:id', adminController.getRestaurantById);
router.put('/restaurants/:id', adminController.updateRestaurant);
router.delete('/restaurants/:id', adminController.deleteRestaurant);
router.put('/restaurants/:id/regenerate-api-key', adminController.regenerateApiKey);

// Restaurant user management
router.get('/restaurants/:restaurantId/users', adminController.getRestaurantUsers);
router.post('/restaurants/:restaurantId/users', adminController.createRestaurantUser);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);

// Admin dashboard
router.get('/dashboard', adminController.getAdminDashboard);

// Restaurant monitoring
router.get('/monitoring', adminController.getRestaurantMonitoring);

// Restaurant analytics
router.get('/restaurants/:id/analytics', adminController.getRestaurantAnalytics);

// Data export
router.get('/export/restaurants', adminController.exportRestaurants);
router.get('/export/users', adminController.exportUsers);
router.get('/export/reservations', adminController.exportReservations);
router.get('/export/notifications', adminController.exportNotificationAnalytics);

// Notification analytics
router.get('/analytics/notifications', adminController.getNotificationAnalytics);
router.get('/analytics/notifications/restaurant/:restaurantId', adminController.getRestaurantNotificationAnalyticsController);

// Quota management
router.post('/quotas/reset-monthly', adminController.resetMonthlyQuotas);

// Subscription management
router.post('/restaurants/:id/subscription/manage', adminController.manageSubscription);

export default router;
