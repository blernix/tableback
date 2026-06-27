import { z } from 'zod';

export const createRestaurantSchema = z.object({
  name: z.string().min(1).trim(),
  address: z.string().min(1).trim(),
  phone: z.string().min(1).trim(),
  email: z.string().email().trim().toLowerCase(),
  plan: z.enum(['starter', 'pro']),
  trialDays: z.number().int().min(0).max(30).optional().default(14),
  discountPercent: z.number().int().min(0).max(70).optional().default(0),
  tablesConfig: z.object({
    totalTables: z.number().int().min(1).default(10),
    averageCapacity: z.number().int().min(1).default(20),
  }).optional().default({ totalTables: 10, averageCapacity: 20 }),
});

export const getMyRestaurantsQuery = z.object({
  page: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  search: z.string().optional(),
});

export const updateMyObjectivesSchema = z.object({
  monthlySignups: z.number().int().min(1).max(100),
});

export const updateRestaurantNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const restaurantIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid restaurant ID'),
});
