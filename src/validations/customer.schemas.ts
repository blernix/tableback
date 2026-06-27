import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').trim(),
  email: z.string().email('Invalid email format').trim().toLowerCase(),
  phone: z.string().min(1, 'Phone is required').trim(),
  tags: z.array(z.string().min(1).trim()).optional().default([]),
  notes: z.string().max(2000).trim().optional().default(''),
  marketingConsent: z.boolean().optional().default(false),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).trim().optional(),
  phone: z.string().min(1).trim().optional(),
  tags: z.array(z.string().min(1).trim()).optional(),
  notes: z.string().max(2000).trim().optional(),
});

export const getCustomersQuery = z.object({
  page: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  search: z.string().optional(),
  sort: z.enum(['name', 'recent', 'oldest', 'first']).optional(),
  tag: z.string().optional(),
});

export const searchCustomersQuery = z.object({
  q: z.string().min(1, 'Search query is required'),
});

export const exportCustomersQuery = z.object({
  tag: z.string().optional(),
  format: z.enum(['json']).optional(),
});

export const customerIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID'),
});
