import { z } from 'zod';

export const subscribeToPushSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url('Invalid endpoint URL'),
    keys: z.object({
      auth: z.string().min(1),
      p256dh: z.string().min(1),
    }),
  }),
  userAgent: z.string().optional(),
});

export const unsubscribeFromPushSchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
});

export const updateNotificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  reservationCreated: z.boolean().optional(),
  reservationConfirmed: z.boolean().optional(),
  reservationCancelled: z.boolean().optional(),
  reservationUpdated: z.boolean().optional(),
});
