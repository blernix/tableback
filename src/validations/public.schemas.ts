import { z } from 'zod';

export const createPublicReservationSchema = z.object({
  customerName: z.string().min(2).max(100).trim()
    .refine((v) => !/[<>{}]/g.test(v), 'Invalid characters in name'),
  customerEmail: z.string().email().max(255).trim().toLowerCase()
    .refine((v) => !/[<>{}]/g.test(v), 'Invalid characters in email'),
  customerPhone: z.string().min(10).max(20).trim()
    .refine(
      (v) => /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(v),
      'Invalid phone number format'
    ),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  numberOfGuests: z.number().int().min(1).max(20, 'Maximum 20 guests'),
  notes: z.string().max(500).trim().optional().default(''),
  _honeypot: z.string().max(0, 'Invalid submission').optional().default(''),
  consentMarketing: z.boolean().optional().default(false),
  consentDataProcessing: z.boolean().optional().default(false),
}).strict();

export const checkAvailabilityParam = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

export const getTimeSlotsParam = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

export const cancelReservationQuery = z.object({
  token: z.string().min(1, 'Cancellation token is required'),
});

export const upcomingClosuresQuery = z.object({
  days: z.string().optional()
    .transform((v) => (v ? parseInt(v, 10) : 30))
    .pipe(z.number().int().min(1).max(90)),
});

export const embedReservationParam = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
});
