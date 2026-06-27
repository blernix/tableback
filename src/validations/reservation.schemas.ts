import { z } from 'zod';

export const createReservationSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').trim(),
  customerEmail: z.string().email('Invalid email').trim(),
  customerPhone: z.string().min(1, 'Phone is required').trim(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  numberOfGuests: z.number().int().min(1, 'At least 1 guest is required'),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  notes: z.string().trim().optional(),
});

export const updateReservationSchema = z.object({
  customerName: z.string().min(1).trim().optional(),
  customerEmail: z.string().email().trim().optional(),
  customerPhone: z.string().min(1).trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional(),
  numberOfGuests: z.number().int().min(1).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  notes: z.string().trim().optional(),
});

export const getReservationsQuery = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
});

export const reservationIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid reservation ID'),
});
