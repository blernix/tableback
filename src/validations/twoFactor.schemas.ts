import { z } from 'zod';

export const enableTwoFactorSchema = z.object({
  token: z.string().length(6, 'Token must be exactly 6 digits'),
  secret: z.string().min(1, 'Secret is required'),
});

export const verifyLoginTwoFactorSchema = z.object({
  token: z.string().length(6, 'Token must be exactly 6 digits'),
  tempToken: z.string().min(1, 'Temporary token is required'),
});

export const useRecoveryCodeSchema = z.object({
  recoveryCode: z.string()
    .min(1)
    .regex(/^[A-F0-9]{12}$/, 'Invalid recovery code format (12 uppercase hex characters)'),
  tempToken: z.string().min(1, 'Temporary token is required'),
});
