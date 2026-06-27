import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticateToken, authenticateFlexible } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  subscribeToPushSchema,
  unsubscribeFromPushSchema,
  updateNotificationPreferencesSchema,
} from '../validations/notification.schemas';

const router = Router();

router.get('/vapid-public-key', notificationController.getVapidPublicKeyController);
router.get('/status', notificationController.getPushNotificationStatus);
router.get('/stream', authenticateFlexible, notificationController.streamNotifications);

router.use(authenticateToken);

router.post(
  '/subscribe',
  validate({ body: subscribeToPushSchema }),
  notificationController.subscribeToPushNotifications
);

router.delete(
  '/unsubscribe',
  validate({ body: unsubscribeFromPushSchema }),
  notificationController.unsubscribeFromPushNotifications
);

router.get('/preferences', notificationController.getNotificationPreferences);

router.put(
  '/preferences',
  validate({ body: updateNotificationPreferencesSchema }),
  notificationController.updateNotificationPreferences
);

export default router;
