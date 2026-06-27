import { z } from 'zod';

export const createDayBlockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().trim().optional(),
});

export const bulkCreateDayBlocksSchema = z.object({
  dates: z.array(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  ).min(1).max(100),
  reason: z.string().trim().optional(),
});

export const checkDayBlockParam = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export const dayBlockIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid day block ID'),
});
