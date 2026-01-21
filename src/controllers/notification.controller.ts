import { Request, Response } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import {
  storePushSubscription,
  removePushSubscription,
  getVapidPublicKey,
  isPushEnabled,
} from '../services/pushNotificationService';
import { initializeSSE } from '../services/sseService';
import NotificationPreferencesModel from '../models/NotificationPreferences.model';

// Validation schemas
const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url('Invalid endpoint URL'),
    keys: z.object({
      auth: z.string().min(1, 'Auth key is required'),
      p256dh: z.string().min(1, 'P256dh key is required'),
    }),
  }),
  userAgent: z.string().optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
});

const updatePreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  reservationCreated: z.boolean().optional(),
  reservationConfirmed: z.boolean().optional(),
  reservationCancelled: z.boolean().optional(),
  reservationUpdated: z.boolean().optional(),
});

/**
 * Get VAPID public key for push notifications
 */
export const getVapidPublicKeyController = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isPushEnabled()) {
      res.status(503).json({
        error: { message: 'Push notifications are disabled' },
      });
      return;
    }

    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      res.status(500).json({
        error: { message: 'VAPID public key not configured' },
      });
      return;
    }

    res.status(200).json({ publicKey });
  } catch (error) {
    logger.error('Error getting VAPID public key:', error);
    res.status(500).json({ error: { message: 'Failed to get VAPID public key' } });
  }
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPushNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Authentication required' } });
      return;
    }

    const validatedData = subscribeSchema.parse(req.body);
    const { subscription, userAgent } = validatedData;

    const success = await storePushSubscription(req.user.userId, subscription, userAgent);

    if (success) {
      res.status(200).json({ success: true });
    } else {
      res.status(500).json({ error: { message: 'Failed to store push subscription' } });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Invalid request data',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error subscribing to push notifications:', error);
    res.status(500).json({ error: { message: 'Failed to subscribe to push notifications' } });
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPushNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Authentication required' } });
      return;
    }

    const validatedData = unsubscribeSchema.parse(req.body);
    const { endpoint } = validatedData;

    const success = await removePushSubscription(req.user.userId, endpoint);

    if (success) {
      res.status(200).json({ success: true });
    } else {
      res.status(404).json({ error: { message: 'Push subscription not found' } });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Invalid request data',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({ error: { message: 'Failed to unsubscribe from push notifications' } });
  }
};

/**
 * Get user's notification preferences
 */
export const getNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Authentication required' } });
      return;
    }

    let preferences = await NotificationPreferencesModel.findOne({ userId: req.user.userId });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await NotificationPreferencesModel.createDefault(req.user.userId);
      logger.info('Created default notification preferences for user', { userId: req.user.userId });
    }

    // At this point, preferences is guaranteed to be non-null
    const prefs = preferences!;

    res.status(200).json({
      preferences: {
        userId: prefs.userId,
        pushEnabled: prefs.pushEnabled,
        emailEnabled: prefs.emailEnabled,
        reservationCreated: prefs.reservationCreated,
        reservationConfirmed: prefs.reservationConfirmed,
        reservationCancelled: prefs.reservationCancelled,
        reservationUpdated: prefs.reservationUpdated,
        createdAt: prefs.createdAt,
        updatedAt: prefs.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error getting notification preferences:', error);
    res.status(500).json({ error: { message: 'Failed to get notification preferences' } });
  }
};

/**
 * Update user's notification preferences
 */
export const updateNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Authentication required' } });
      return;
    }

    const validatedData = updatePreferencesSchema.parse(req.body);

    // Find existing preferences or create default
    let preferences = await NotificationPreferencesModel.findOne({ userId: req.user.userId });
    if (!preferences) {
      preferences = await NotificationPreferencesModel.createDefault(req.user.userId);
    }

    // At this point, preferences is guaranteed to be non-null
    const prefs = preferences!;

    // Update only provided fields
    if (validatedData.pushEnabled !== undefined) {
      prefs.pushEnabled = validatedData.pushEnabled;
    }
    if (validatedData.emailEnabled !== undefined) {
      prefs.emailEnabled = validatedData.emailEnabled;
    }
    if (validatedData.reservationCreated !== undefined) {
      prefs.reservationCreated = validatedData.reservationCreated;
    }
    if (validatedData.reservationConfirmed !== undefined) {
      prefs.reservationConfirmed = validatedData.reservationConfirmed;
    }
    if (validatedData.reservationCancelled !== undefined) {
      prefs.reservationCancelled = validatedData.reservationCancelled;
    }
    if (validatedData.reservationUpdated !== undefined) {
      prefs.reservationUpdated = validatedData.reservationUpdated;
    }

    await prefs.save();

    res.status(200).json({
      success: true,
      preferences: {
        userId: prefs.userId,
        pushEnabled: prefs.pushEnabled,
        emailEnabled: prefs.emailEnabled,
        reservationCreated: prefs.reservationCreated,
        reservationConfirmed: prefs.reservationConfirmed,
        reservationCancelled: prefs.reservationCancelled,
        reservationUpdated: prefs.reservationUpdated,
        createdAt: prefs.createdAt,
        updatedAt: prefs.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Invalid request data',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error updating notification preferences:', error);
    res.status(500).json({ error: { message: 'Failed to update notification preferences' } });
  }
};

/**
 * Get push notification status (enabled/disabled)
 */
export const getPushNotificationStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      enabled: isPushEnabled(),
      vapidPublicKey: getVapidPublicKey(),
    });
  } catch (error) {
    logger.error('Error getting push notification status:', error);
    res.status(500).json({ error: { message: 'Failed to get push notification status' } });
  }
};

/**
 * Stream real-time notifications via Server-Sent Events (SSE)
 */
export const streamNotifications = (req: Request, res: Response): void => {
  // Only authenticated users can connect to SSE stream
  if (!req.user?.userId || !req.user?.restaurantId) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }

  initializeSSE(req, res);
};