import webPush, { PushSubscription } from 'web-push';
import pushConfig from '../config/push.config';
import logger from '../utils/logger';
import PushSubscriptionModel from '../models/PushSubscription.model';
import NotificationPreferencesModel from '../models/NotificationPreferences.model';
import UserModel from '../models/User.model';
import { Types } from 'mongoose';
import { 
  logPushNotification, 
  markNotificationDelivered, 
  markNotificationFailed 
} from './notificationAnalyticsService';

// Types
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string; // Used to replace previous notifications with same tag
  data?: {
    url?: string;
    reservationId?: string;
    type: 'reservation_created' | 'reservation_confirmed' | 'reservation_cancelled' | 'reservation_updated' | 'general';
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

// Initialize web-push with VAPID keys
if (pushConfig.enabled && pushConfig.vapidPublicKey && pushConfig.vapidPrivateKey) {
  webPush.setVapidDetails(
    pushConfig.vapidSubject,
    pushConfig.vapidPublicKey,
    pushConfig.vapidPrivateKey
  );
  logger.info('Web Push initialized with VAPID keys');
} else if (pushConfig.enabled) {
  logger.warn('Push notifications enabled but VAPID keys not configured');
}

/**
 * Store a push subscription for a user
 */
export async function storePushSubscription(
  userId: Types.ObjectId,
  subscription: PushSubscription,
  userAgent?: string
): Promise<boolean> {
  try {
    if (!pushConfig.enabled) {
      logger.info('Push notifications disabled, skipping subscription storage');
      return false;
    }

    // Validate subscription
    if (!subscription.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
      throw new Error('Invalid push subscription: missing required fields');
    }

    // Store or update subscription
    await PushSubscriptionModel.findOneAndUpdate(
      { userId, endpoint: subscription.endpoint },
      {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent,
      },
      { upsert: true, new: true }
    );

    logger.info('Push subscription stored/updated', { userId, endpoint: subscription.endpoint });
    return true;
  } catch (error) {
    logger.error('Failed to store push subscription', { error, userId });
    return false;
  }
}

/**
 * Remove a push subscription
 */
export async function removePushSubscription(
  userId: Types.ObjectId,
  endpoint: string
): Promise<boolean> {
  try {
    const result = await PushSubscriptionModel.deleteOne({ userId, endpoint });
    const deleted = result.deletedCount > 0;
    
    if (deleted) {
      logger.info('Push subscription removed', { userId, endpoint });
    } else {
      logger.warn('Push subscription not found for removal', { userId, endpoint });
    }
    
    return deleted;
  } catch (error) {
    logger.error('Failed to remove push subscription', { error, userId, endpoint });
    return false;
  }
}

/**
 * Get all push subscriptions for a user
 */
export async function getUserPushSubscriptions(
  userId: Types.ObjectId
): Promise<PushSubscription[]> {
  try {
    const subscriptions = await PushSubscriptionModel.find({ userId });
    return subscriptions.map(sub => ({
      endpoint: sub.endpoint,
      keys: {
        auth: sub.keys.auth,
        p256dh: sub.keys.p256dh,
      },
    }));
  } catch (error) {
    logger.error('Failed to get user push subscriptions', { error, userId });
    return [];
  }
}

/**
 * Send a push notification to a single subscription
 */
async function sendToSubscription(
  subscription: PushSubscription,
  payload: PushNotificationPayload
): Promise<PushNotificationResult> {
  try {
    if (!pushConfig.enabled) {
      logger.info('Push notifications disabled, skipping notification');
      return { success: true, skipped: true };
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/badge-72x72.png',
      image: payload.image,
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions,
    });

    // Send notification
    const result = await webPush.sendNotification(subscription, notificationPayload);
    
    logger.info('Push notification sent successfully', {
      endpoint: subscription.endpoint,
      messageId: result.headers?.['message-id'],
    });

    return {
      success: true,
      messageId: result.headers?.['message-id'],
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    const statusCode = error.statusCode;
    
    logger.error('Failed to send push notification', {
      error: errorMessage,
      statusCode,
      endpoint: subscription.endpoint,
    });

    // If subscription is invalid (410 Gone), remove it
    if (statusCode === 410) {
      logger.info('Removing expired push subscription', { endpoint: subscription.endpoint });
      try {
        await PushSubscriptionModel.deleteOne({ endpoint: subscription.endpoint });
      } catch (deleteError) {
        logger.error('Failed to remove expired subscription', { deleteError });
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send push notification to a specific user
 * Checks user's notification preferences before sending
 */
export async function sendPushNotificationToUser(
  userId: Types.ObjectId,
  payload: PushNotificationPayload,
  eventType?: string,
  restaurantId?: Types.ObjectId
): Promise<PushNotificationResult[]> {
  try {
    if (!pushConfig.enabled) {
      logger.info('Push notifications disabled, skipping notification');
      return [{ success: true, skipped: true }];
    }

    // Get restaurantId if not provided
    let userRestaurantId = restaurantId;
    if (!userRestaurantId) {
      const user = await UserModel.findById(userId).select('restaurantId');
      if (!user || !user.restaurantId) {
        logger.warn('User not found or has no restaurant association', { userId });
        return [{ success: true, skipped: true }];
      }
      userRestaurantId = user.restaurantId;
    }

    // Check user notification preferences
    if (eventType) {
      const preferences = await NotificationPreferencesModel.findOne({ userId });
      if (preferences && !preferences.shouldSendPush(eventType)) {
        logger.info('User has disabled push notifications for this event type', {
          userId,
          eventType,
        });
        return [{ success: true, skipped: true }];
      }
    }

    // Get user's push subscriptions
    const subscriptions = await getUserPushSubscriptions(userId);
    if (subscriptions.length === 0) {
      logger.info('User has no push subscriptions', { userId });
      return [{ success: true, skipped: true }];
    }

    // Send to all subscriptions
    const results: PushNotificationResult[] = [];
    for (const subscription of subscriptions) {
      // Log notification attempt for analytics
      const analyticsId = await logPushNotification(
        userId,
        userRestaurantId,
        eventType as any || 'general',
        subscription.endpoint
      );

      const result = await sendToSubscription(subscription, payload);

      // Update analytics based on result
      if (analyticsId) {
        if (result.success) {
          await markNotificationDelivered(analyticsId, {
            pushMessageId: result.messageId,
          });
        } else {
          await markNotificationFailed(
            analyticsId,
            result.error?.substring(0, 50),
            result.error
          );
        }
      }

      results.push(result);
    }

    return results;
  } catch (error) {
    logger.error('Failed to send push notification to user', { error, userId });
    return [{ success: false, error: String(error) }];
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: Types.ObjectId[],
  payload: PushNotificationPayload,
  eventType?: string
): Promise<{ userId: Types.ObjectId; results: PushNotificationResult[] }[]> {
  const results = [];
  
  for (const userId of userIds) {
    const userResults = await sendPushNotificationToUser(userId, payload, eventType);
    results.push({ userId, results: userResults });
  }
  
  return results;
}

/**
 * Send reservation notification based on event type
 */
export async function sendReservationNotification(
  userId: Types.ObjectId,
  reservation: any,
  eventType: 'reservation_created' | 'reservation_confirmed' | 'reservation_cancelled' | 'reservation_updated'
): Promise<PushNotificationResult[]> {
  const titles = {
    reservation_created: 'Nouvelle réservation',
    reservation_confirmed: 'Réservation confirmée',
    reservation_cancelled: 'Réservation annulée',
    reservation_updated: 'Réservation modifiée',
  };

  const bodies = {
    reservation_created: `Nouvelle réservation pour ${reservation.customerName} le ${reservation.date}`,
    reservation_confirmed: `Votre réservation pour ${reservation.date} à ${reservation.time} a été confirmée`,
    reservation_cancelled: `La réservation pour ${reservation.date} à ${reservation.time} a été annulée`,
    reservation_updated: `Votre réservation a été mise à jour pour ${reservation.date} à ${reservation.time}`,
  };

  const payload: PushNotificationPayload = {
    title: titles[eventType],
    body: bodies[eventType],
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {
      reservationId: reservation._id?.toString(),
      type: eventType,
      url: `/reservations/${reservation._id}`,
    },
    tag: `reservation-${reservation._id}`,
  };

  // Extract restaurantId from reservation
  const restaurantId = reservation.restaurantId || reservation.restaurant;
  
  return sendPushNotificationToUser(userId, payload, eventType, restaurantId);
}

/**
 * Send push notification to all users of a restaurant
 */
export async function sendPushNotificationToRestaurant(
  restaurantId: Types.ObjectId,
  payload: PushNotificationPayload,
  eventType?: string
): Promise<Array<{ userId: Types.ObjectId; results: PushNotificationResult[] }>> {
  try {
    // Get all users associated with this restaurant
    const users = await UserModel.find({
      restaurantId,
      role: { $in: ['restaurant', 'server'] },
      status: 'active',
    }).select('_id');

    if (users.length === 0) {
      logger.info('No active users found for restaurant', { restaurantId });
      return [];
    }

    const userIds = users.map(user => user._id);
    
    // Send to all users
    const results = [];
    for (const userId of userIds) {
      const userResults = await sendPushNotificationToUser(userId, payload, eventType, restaurantId);
      results.push({ userId, results: userResults });
    }

    logger.info('Push notifications sent to restaurant users', {
      restaurantId,
      userCount: users.length,
      eventType,
    });

    return results;
  } catch (error) {
    logger.error('Failed to send push notification to restaurant users', {
      error,
      restaurantId,
    });
    return [];
  }
}

/**
 * Get VAPID public key for client-side subscription
 */
export function getVapidPublicKey(): string | undefined {
  return pushConfig.vapidPublicKey;
}

/**
 * Check if push notifications are enabled
 */
export function isPushEnabled(): boolean {
  return pushConfig.enabled;
}