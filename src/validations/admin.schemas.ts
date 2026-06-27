import { z } from 'zod';

export const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Restaurant name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email format'),
  tablesConfig: z.object({
    totalTables: z.number().min(1).optional(),
    averageCapacity: z.number().min(1).optional(),
  }).optional(),
});

export const updateRestaurantSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  tablesConfig: z.object({
    totalTables: z.number().min(1).optional(),
    averageCapacity: z.number().min(1).optional(),
  }).optional(),
});

export const createRestaurantUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

export const createCommercialUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1).trim().optional(),
});

export const manageSubscriptionSchema = z.object({
  action: z.enum(['change_plan', 'extend_subscription', 'activate', 'cancel']),
  plan: z.enum(['starter', 'pro']).optional(),
  days: z.number().int().min(1).max(365).optional(),
}).refine(
  (data) => {
    if ((data.action === 'change_plan' || data.action === 'activate') && !data.plan) {
      return false;
    }
    if (data.action === 'extend_subscription' && !data.days) {
      return false;
    }
    return true;
  },
  {
    message: 'Missing required field for the specified action',
    path: ['plan'],
  }
);

export const getRestaurantsQuery = z.object({
  page: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export const getRestaurantUsersQuery = z.object({
  page: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

export const getRestaurantAnalyticsQuery = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const exportQuery = z.object({
  page: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 2000))
    .pipe(z.number().int().min(1).max(10000)),
});

export const restaurantIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid restaurant ID'),
});

export const restaurantUserIdParam = z.object({
  restaurantId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid restaurant ID'),
});

export const userIdParam = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});

export const commercialIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid commercial ID'),
});

export const notificationAnalyticsRestaurantIdParam = z.object({
  restaurantId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid restaurant ID'),
});
