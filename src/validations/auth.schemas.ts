import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'restaurant', 'commercial']),
  restaurantId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newEmail: z.string().email('Invalid email format'),
});

export const signupSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  restaurantAddress: z.string().min(5, 'Address must be at least 5 characters'),
  restaurantPhone: z.string().min(10, 'Phone must be at least 10 characters'),
  restaurantEmail: z.string().email('Invalid restaurant email format'),
  ownerEmail: z.string().email('Invalid email format'),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters'),
  acceptedTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
  plan: z.enum(['starter', 'pro'], {
    errorMap: () => ({ message: 'Plan must be either starter or pro' }),
  }),
  website: z.string().max(0, 'Invalid submission').optional(),
});

export const resumePaymentSchema = z.object({
  restaurantEmail: z.string().email('Invalid restaurant email format'),
  ownerEmail: z.string().email('Invalid owner email format'),
});
