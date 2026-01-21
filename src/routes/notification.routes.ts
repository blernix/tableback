import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticateToken, authenticateFlexible } from '../middleware/auth.middleware';

const router = Router();

// GET /api/notifications/vapid-public-key - Get VAPID public key (public)
router.get('/vapid-public-key', notificationController.getVapidPublicKeyController);

// GET /api/notifications/status - Get push notification status (public)
router.get('/status', notificationController.getPushNotificationStatus);

// GET /api/notifications/stream - Stream real-time notifications via SSE
// Uses flexible auth to support cookies (EventSource can't send custom headers)
router.get('/stream', authenticateFlexible, notificationController.streamNotifications);

// All other routes below require standard authentication
router.use(authenticateToken);

// POST /api/notifications/subscribe - Subscribe to push notifications
router.post('/subscribe', notificationController.subscribeToPushNotifications);

// DELETE /api/notifications/unsubscribe - Unsubscribe from push notifications
router.delete('/unsubscribe', notificationController.unsubscribeFromPushNotifications);

// GET /api/notifications/preferences - Get notification preferences
router.get('/preferences', notificationController.getNotificationPreferences);

// PUT /api/notifications/preferences - Update notification preferences
router.put('/preferences', notificationController.updateNotificationPreferences);

export default router;