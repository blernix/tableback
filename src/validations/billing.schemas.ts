import { z } from 'zod';

export const createCheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro']),
  restaurantId: z.string().min(1),
});

export const cancelSubscriptionSchema = z.object({
  immediately: z.boolean().optional(),
});
