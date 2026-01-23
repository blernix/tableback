import { Request, Response } from 'express';
import User from '../models/User.model';
import logger from '../utils/logger';
import { z } from 'zod';
import {
  generateTwoFactorSetup,
  verifyTwoFactorCode,
  verifyRecoveryCode,
  encryptTwoFactorData,
  decryptTwoFactorSecret,
  generateRecoveryCodes,
} from '../services/twoFactorService';
import { verifyTempToken } from '../utils/tempToken';
import { generateToken } from '../utils/jwt';

// Validation schemas


const enableTwoFactorSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits'),
  secret: z.string().min(1, 'Secret is required'),
});

const verifyLoginTwoFactorSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits'),
  tempToken: z.string().min(1, 'Temporary token is required'),
});

const useRecoveryCodeSchema = z.object({
  recoveryCode: z.string()
    .min(1, 'Recovery code is required')
    .regex(/^[A-F0-9]{12}$/, 'Invalid recovery code format (must be 12 uppercase hex characters)'),
  tempToken: z.string().min(1, 'Temporary token is required'),
});



// Generate 2FA setup (secret + QR code)
export const generateSetup = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Unauthorized' } });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    // If 2FA is already enabled, return error
    if (user.twoFactorEnabled) {
      res.status(400).json({ error: { message: '2FA is already enabled' } });
      return;
    }

    // Generate new 2FA setup (without recovery codes yet - they'll be generated on enablement)
    const setup = await generateTwoFactorSetup(user.email);

    // Store the secret temporarily in the user session (or return it)
    // For security, we'll return it to the client but they must verify it immediately
    // Note: Recovery codes will be generated when 2FA is actually enabled
    res.status(200).json({
      secret: setup.secret,
      qrCodeUrl: setup.qrCodeUrl,
      recoveryCodes: [], // Empty array - real codes generated on enablement
    });
  } catch (error) {
    logger.error('Error generating 2FA setup:', error);
    res.status(500).json({ error: { message: 'Failed to generate 2FA setup' } });
  }
};

// Enable 2FA after verification
export const enableTwoFactor = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Unauthorized' } });
      return;
    }

    const validatedData = enableTwoFactorSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    // Verify the token
    const isValid = verifyTwoFactorCode(validatedData.secret, validatedData.token);
    if (!isValid) {
      res.status(400).json({ error: { message: 'Invalid verification code' } });
      return;
    }

    logger.debug(`Enabling 2FA for user: ${user.email}, secret: ${validatedData.secret}`);

    // Generate recovery codes BEFORE encryption so we can return them in plain text
    const recoveryCodes = generateRecoveryCodes();

    // Encrypt and store the 2FA data
    const encryptedData = encryptTwoFactorData(
      validatedData.secret,
      recoveryCodes
    );

    // Update user
    user.twoFactorEnabled = true;
    user.twoFactorSecret = JSON.stringify({
      encrypted: encryptedData.encryptedSecret,
      iv: encryptedData.secretIv,
      authTag: encryptedData.secretAuthTag,
    });
    user.twoFactorRecoveryCodes = encryptedData.encryptedRecoveryCodes;
    user.twoFactorRecoveryIv = encryptedData.recoveryIv;
    user.twoFactorRecoveryAuthTag = encryptedData.recoveryAuthTag;

    await user.save();

    logger.info(`2FA enabled for user: ${user.email}`);

    res.status(200).json({
      message: 'Two-factor authentication enabled successfully',
      recoveryCodes: recoveryCodes, // ✅ Return PLAIN TEXT codes, not encrypted
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error enabling 2FA:', error);
    res.status(500).json({ error: { message: 'Failed to enable 2FA' } });
  }
};

// Disable 2FA
export const disableTwoFactor = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Unauthorized' } });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    // Only disable if currently enabled
    if (!user.twoFactorEnabled) {
      res.status(400).json({ error: { message: '2FA is not enabled' } });
      return;
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorRecoveryCodes = [];
    user.twoFactorRecoveryIv = undefined;
    user.twoFactorRecoveryAuthTag = undefined;

    await user.save();

    logger.info(`2FA disabled for user: ${user.email}`);

    res.status(200).json({
      message: 'Two-factor authentication disabled successfully',
    });
  } catch (error) {
    logger.error('Error disabling 2FA:', error);
    res.status(500).json({ error: { message: 'Failed to disable 2FA' } });
  }
};

// Verify 2FA code during login
export const verifyLoginTwoFactor = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = verifyLoginTwoFactorSchema.parse(req.body);

    // Verify temporary token
    const tempToken = verifyTempToken(validatedData.tempToken);
    if (!tempToken.isValid) {
      res.status(401).json({ error: { message: 'Invalid or expired temporary token' } });
      return;
    }

    const user = await User.findById(tempToken.userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    // Check if 2FA is enabled for this user
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(400).json({ error: { message: '2FA is not enabled for this account' } });
      return;
    }

    // Decrypt secret
    const secretData = JSON.parse(user.twoFactorSecret);
    logger.debug(`2FA verification attempt for user: ${user.email}, token: ${validatedData.token}`);
    logger.debug(`Secret data: ${JSON.stringify(secretData)}`);
    
    const secret = decryptTwoFactorSecret(
      secretData.encrypted,
      secretData.iv,
      secretData.authTag
    );
    
    logger.debug(`Decrypted secret: ${secret}`);

    // Verify the token
    const isValid = verifyTwoFactorCode(secret, validatedData.token);
    logger.debug(`Token verification result: ${isValid}`);
    if (!isValid) {
      res.status(400).json({ error: { message: 'Invalid verification code' } });
      return;
    }

    // Generate full JWT token after successful 2FA verification
    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    });

    logger.info(`User logged in with 2FA: ${user.email}`);

    // Set HttpOnly cookie for SSE authentication
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' as 'strict' | 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    };
    res.cookie('auth_token', token, cookieOptions);

    res.status(200).json({
      message: '2FA verification successful',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        mustChangePassword: user.mustChangePassword,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error verifying 2FA login:', error);
    res.status(500).json({ error: { message: 'Failed to verify 2FA' } });
  }
};

// Use recovery code
export const useRecoveryCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = useRecoveryCodeSchema.parse(req.body);
    const tempToken = verifyTempToken(validatedData.tempToken || '');
    
    if (!tempToken.isValid) {
      res.status(401).json({ error: { message: 'Invalid or expired temporary token' } });
      return;
    }

    const user = await User.findById(tempToken.userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    if (!user.twoFactorEnabled || !user.twoFactorRecoveryCodes?.length || !user.twoFactorRecoveryIv || !user.twoFactorRecoveryAuthTag) {
      res.status(400).json({ error: { message: 'No recovery codes available' } });
      return;
    }

    // Verify recovery code
    const verificationResult = verifyRecoveryCode(
      user.twoFactorRecoveryCodes,
      user.twoFactorRecoveryIv!,
      user.twoFactorRecoveryAuthTag!,
      validatedData.recoveryCode.toUpperCase()
    );
    
    if (!verificationResult.isValid) {
      res.status(400).json({ error: { message: 'Invalid recovery code' } });
      return;
    }
    
    // Update user with remaining recovery codes (if any)
    user.twoFactorRecoveryCodes = verificationResult.updatedEncryptedRecoveryCodes || [];
    if (verificationResult.updatedIv && verificationResult.updatedAuthTag) {
      user.twoFactorRecoveryIv = verificationResult.updatedIv;
      user.twoFactorRecoveryAuthTag = verificationResult.updatedAuthTag;
    }
    
    await user.save();
    
    // Generate full JWT token after successful recovery code verification
    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    });

    logger.info(`User logged in with recovery code: ${user.email}`);

    // Set HttpOnly cookie for SSE authentication
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' as 'strict' | 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    };
    res.cookie('auth_token', token, cookieOptions);

    res.status(200).json({
      message: 'Recovery code accepted',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        mustChangePassword: user.mustChangePassword,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error using recovery code:', error);
    res.status(500).json({ error: { message: 'Failed to use recovery code' } });
  }
};

// Get 2FA status
export const getTwoFactorStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Unauthorized' } });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    res.status(200).json({
      twoFactorEnabled: user.twoFactorEnabled,
      hasRecoveryCodes: user.twoFactorRecoveryCodes && user.twoFactorRecoveryCodes.length > 0,
    });
  } catch (error) {
    logger.error('Error getting 2FA status:', error);
    res.status(500).json({ error: { message: 'Failed to get 2FA status' } });
  }
};