import { Types } from 'mongoose';
import NotificationAnalytics, {
  NotificationType,
  NotificationEventType,
  NotificationStatus,
} from '../models/NotificationAnalytics.model';
import logger from '../utils/logger';

export interface LogNotificationParams {
  userId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  notificationType: NotificationType;
  eventType: NotificationEventType;
  
  // Optional fields
  pushEndpoint?: string;
  pushMessageId?: string;
  emailTo?: string;
  emailMessageId?: string;
  sseClientId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateNotificationStatusParams {
  notificationId: Types.ObjectId;
  status: NotificationStatus;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a notification attempt
 */
export async function logNotification(
  params: LogNotificationParams
): Promise<Types.ObjectId | null> {
  try {
    const {
      userId,
      restaurantId,
      notificationType,
      eventType,
      pushEndpoint,
      pushMessageId,
      emailTo,
      emailMessageId,
      sseClientId,
      metadata = {},
    } = params;

    // Determine initial status based on notification type
    let status: NotificationStatus = 'sent';
    
    // For SSE, delivered immediately upon sending
    if (notificationType === 'sse') {
      status = 'delivered';
    }

    const notification = await NotificationAnalytics.create({
      userId,
      restaurantId,
      notificationType,
      eventType,
      status,
      pushEndpoint,
      pushMessageId,
      emailTo,
      emailMessageId,
      sseClientId,
      metadata,
      sentAt: new Date(),
      ...(status === 'delivered' ? { deliveredAt: new Date() } : {}),
    });

    logger.info('Notification logged for analytics', {
      notificationId: notification._id,
      userId,
      restaurantId,
      notificationType,
      eventType,
      status,
    });

    return notification._id;
  } catch (error) {
    logger.error('Failed to log notification for analytics', {
      error,
      params,
    });
    return null;
  }
}

/**
 * Update notification status
 */
export async function updateNotificationStatus(
  params: UpdateNotificationStatusParams
): Promise<boolean> {
  try {
    const {
      notificationId,
      status,
      errorCode,
      errorMessage,
      metadata,
    } = params;

    const updateData: any = {
      status,
    };

    // Set timestamp based on status
    const now = new Date();
    switch (status) {
      case 'delivered':
        updateData.deliveredAt = now;
        break;
      case 'opened':
        updateData.openedAt = now;
        break;
      case 'clicked':
        updateData.clickedAt = now;
        break;
      case 'failed':
        updateData.failedAt = now;
        break;
    }

    // Add error info if provided
    if (errorCode) updateData.errorCode = errorCode;
    if (errorMessage) updateData.errorMessage = errorMessage;

    // Merge metadata if provided
    if (metadata) {
      updateData.$set = updateData.$set || {};
      updateData.$set.metadata = metadata;
    }

    const result = await NotificationAnalytics.findByIdAndUpdate(
      notificationId,
      updateData,
      { new: true }
    );

    if (!result) {
      logger.warn('Notification not found for status update', { notificationId });
      return false;
    }

    logger.info('Notification status updated', {
      notificationId,
      oldStatus: result.status,
      newStatus: status,
    });

    return true;
  } catch (error) {
    logger.error('Failed to update notification status', {
      error,
      params,
    });
    return false;
  }
}

/**
 * Log push notification delivery
 */
export async function logPushNotification(
  userId: Types.ObjectId,
  restaurantId: Types.ObjectId,
  eventType: NotificationEventType,
  pushEndpoint: string,
  pushMessageId?: string,
  metadata?: Record<string, any>
): Promise<Types.ObjectId | null> {
  return logNotification({
    userId,
    restaurantId,
    notificationType: 'push',
    eventType,
    pushEndpoint,
    pushMessageId,
    metadata,
  });
}

/**
 * Log email notification
 */
export async function logEmailNotification(
  userId: Types.ObjectId,
  restaurantId: Types.ObjectId,
  eventType: NotificationEventType,
  emailTo: string,
  emailMessageId?: string,
  metadata?: Record<string, any>
): Promise<Types.ObjectId | null> {
  return logNotification({
    userId,
    restaurantId,
    notificationType: 'email',
    eventType,
    emailTo,
    emailMessageId,
    metadata,
  });
}

/**
 * Log SSE notification
 */
export async function logSseNotification(
  userId: Types.ObjectId,
  restaurantId: Types.ObjectId,
  eventType: NotificationEventType,
  sseClientId?: string,
  metadata?: Record<string, any>
): Promise<Types.ObjectId | null> {
  return logNotification({
    userId,
    restaurantId,
    notificationType: 'sse',
    eventType,
    sseClientId,
    metadata,
  });
}

/**
 * Mark notification as delivered
 */
export async function markNotificationDelivered(
  notificationId: Types.ObjectId,
  metadata?: Record<string, any>
): Promise<boolean> {
  return updateNotificationStatus({
    notificationId,
    status: 'delivered',
    metadata,
  });
}

/**
 * Mark notification as opened
 */
export async function markNotificationOpened(
  notificationId: Types.ObjectId
): Promise<boolean> {
  return updateNotificationStatus({
    notificationId,
    status: 'opened',
  });
}

/**
 * Mark notification as clicked
 */
export async function markNotificationClicked(
  notificationId: Types.ObjectId
): Promise<boolean> {
  return updateNotificationStatus({
    notificationId,
    status: 'clicked',
  });
}

/**
 * Mark notification as failed
 */
export async function markNotificationFailed(
  notificationId: Types.ObjectId,
  errorCode?: string,
  errorMessage?: string
): Promise<boolean> {
  return updateNotificationStatus({
    notificationId,
    status: 'failed',
    errorCode,
    errorMessage,
  });
}

/**
 * Get notification analytics for a restaurant
 */
export async function getRestaurantNotificationAnalytics(
  restaurantId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const match: any = { restaurantId };

    if (startDate || endDate) {
      match.sentAt = {};
      if (startDate) match.sentAt.$gte = startDate;
      if (endDate) match.sentAt.$lte = endDate;
    }

    const result = await NotificationAnalytics.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            notificationType: '$notificationType',
            eventType: '$eventType',
            status: '$status',
          },
          count: { $sum: 1 },
          avgDeliveryTime: {
            $avg: {
              $cond: [
                { $ne: ['$deliveredAt', null] },
                { $divide: [{ $subtract: ['$deliveredAt', '$sentAt'] }, 1000] },
                null,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: {
            notificationType: '$_id.notificationType',
            eventType: '$_id.eventType',
          },
          total: { $sum: '$count' },
          byStatus: {
            $push: {
              status: '$_id.status',
              count: '$count',
            },
          },
          avgDeliveryTime: { $avg: '$avgDeliveryTime' },
        },
      },
      {
        $project: {
          notificationType: '$_id.notificationType',
          eventType: '$_id.eventType',
          total: 1,
          byStatus: 1,
          avgDeliveryTime: 1,
          _id: 0,
        },
      },
      { $sort: { notificationType: 1, eventType: 1 } },
    ]);

    return result;
  } catch (error) {
    logger.error('Failed to get restaurant notification analytics', {
      error,
      restaurantId,
    });
    return [];
  }
}

/**
 * Get notification delivery rate for a restaurant
 */
export async function getNotificationDeliveryRate(
  restaurantId: Types.ObjectId,
  days: number = 30
): Promise<{
  push: { delivered: number; total: number; rate: number };
  email: { delivered: number; total: number; rate: number };
  sse: { delivered: number; total: number; rate: number };
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const match = {
      restaurantId,
      sentAt: { $gte: startDate },
    };

    const result = await NotificationAnalytics.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            notificationType: '$notificationType',
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Initialize counters
    const counters: Record<string, { delivered: number; total: number }> = {
      push: { delivered: 0, total: 0 },
      email: { delivered: 0, total: 0 },
      sse: { delivered: 0, total: 0 },
    };

    // Process aggregation results
    result.forEach(item => {
      const type = item._id.notificationType;
      const status = item._id.status;
      const count = item.count;

      if (counters[type]) {
        counters[type].total += count;
        if (status === 'delivered' || status === 'opened' || status === 'clicked') {
          counters[type].delivered += count;
        }
      }
    });

    // Calculate rates
    const response = {
      push: {
        delivered: counters.push.delivered,
        total: counters.push.total,
        rate: counters.push.total > 0 ? counters.push.delivered / counters.push.total : 0,
      },
      email: {
        delivered: counters.email.delivered,
        total: counters.email.total,
        rate: counters.email.total > 0 ? counters.email.delivered / counters.email.total : 0,
      },
      sse: {
        delivered: counters.sse.delivered,
        total: counters.sse.total,
        rate: counters.sse.total > 0 ? counters.sse.delivered / counters.sse.total : 0,
      },
    };

    return response;
  } catch (error) {
    logger.error('Failed to get notification delivery rate', {
      error,
      restaurantId,
    });
    
    // Return default values on error
    return {
      push: { delivered: 0, total: 0, rate: 0 },
      email: { delivered: 0, total: 0, rate: 0 },
      sse: { delivered: 0, total: 0, rate: 0 },
    };
  }
}