import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().max(50).trim().optional().or(z.literal('')),
  lastName: z.string().max(50).trim().optional().or(z.literal('')),
  phone: z.string().max(20).trim().optional().or(z.literal('')),
  photoUrl: z.string().max(500).optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});
