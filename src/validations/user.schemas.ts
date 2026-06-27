import { z } from 'zod';

export const createServerUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateServerUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const serverUserIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});
