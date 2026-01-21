import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import User from '../models/User.model';
import { generateToken } from '../utils/jwt';
import logger from '../utils/logger';
import { z } from 'zod';
import { sendPasswordResetEmail } from '../services/emailService';
import { validatePasswordResetToken } from '../services/tokenService';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'restaurant']),
  restaurantId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// Register new user (admin only operation via admin routes)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      res.status(409).json({ error: { message: 'User already exists with this email' } });
      return;
    }

    // Validate restaurant role has restaurantId
    if (validatedData.role === 'restaurant' && !validatedData.restaurantId) {
      res.status(400).json({
        error: { message: 'Restaurant users must be associated with a restaurant' }
      });
      return;
    }

    // Create user
    const user = new User({
      email: validatedData.email,
      password: validatedData.password,
      role: validatedData.role,
      restaurantId: validatedData.restaurantId || null,
    });

    await user.save();

    // Generate token
    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    });

    logger.info(`User registered: ${user.email} (${user.role})`);

    // Set HttpOnly cookie for SSE authentication
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' as 'strict' | 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    };
    res.cookie('auth_token', token, cookieOptions);

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors
        }
      });
      return;
    }

    logger.error('Registration error:', error);
    res.status(500).json({ error: { message: 'Failed to register user' } });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);

    // Find user by email
    const user = await User.findOne({ email: validatedData.email });
    if (!user) {
      res.status(401).json({ error: { message: 'Invalid credentials' } });
      return;
    }

    // Check if user is active
    if (user.status !== 'active') {
      res.status(403).json({ error: { message: 'Account is inactive' } });
      return;
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(validatedData.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: { message: 'Invalid credentials' } });
      return;
    }

    // Generate token
    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    });

    logger.info(`User logged in: ${user.email}`);

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
          details: error.errors
        }
      });
      return;
    }

    logger.error('Login error:', error);
    res.status(500).json({ error: { message: 'Failed to login' } });
  }
};

// Logout (client-side token removal mainly)
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info(`User logged out: ${req.user?.email}`);

    // Clear the auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' as 'strict' | 'lax',
      path: '/',
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: { message: 'Failed to logout' } });
  }
};

// Forgot password - Send reset email
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);

    // Find user by email
    const user = await User.findOne({ email: validatedData.email });

    // Always return success to prevent email enumeration attacks
    // Don't reveal if the email exists or not
    if (!user) {
      logger.info(`Password reset requested for non-existent email: ${validatedData.email}`);
      res.status(200).json({
        message: 'If the email exists, a password reset link has been sent',
      });
      return;
    }

    // Check if user is active
    if (user.status !== 'active') {
      logger.warn(`Password reset requested for inactive user: ${user.email}`);
      res.status(200).json({
        message: 'If the email exists, a password reset link has been sent',
      });
      return;
    }

    // Send password reset email with generated token
    const emailResult = await sendPasswordResetEmail({
      _id: user._id.toString(),
      email: user.email,
      name: user.email, // Users don't have a name field, use email
    });

    if (!emailResult.success) {
      logger.error(`Failed to send password reset email to ${user.email}:`, emailResult.error);
      // Still return success to user to prevent email enumeration
    } else {
      logger.info(`Password reset email sent to: ${user.email}`);
    }

    res.status(200).json({
      message: 'If the email exists, a password reset link has been sent',
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

    logger.error('Forgot password error:', error);
    res.status(500).json({ error: { message: 'Failed to process password reset request' } });
  }
};

// Refresh JWT token
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: { message: 'Token required' } });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not defined');
      res.status(500).json({ error: { message: 'Server configuration error' } });
      return;
    }

    // Verify the current token (allow expired tokens for refresh)
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret, { ignoreExpiration: true }) as {
        userId: string;
        email: string;
        role: 'admin' | 'restaurant' | 'server';
        restaurantId?: string;
        exp?: number;
      };
    } catch (error) {
      res.status(401).json({ error: { message: 'Invalid token' } });
      return;
    }

    // Check if token is within grace period (7 days after expiration)
    const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (decoded.exp) {
      const expirationDate = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeSinceExpiration = now - expirationDate;

      if (timeSinceExpiration > GRACE_PERIOD_MS) {
        res.status(401).json({
          error: {
            message: 'Token has expired beyond the refresh grace period. Please login again.'
          }
        });
        return;
      }
    }

    // Generate new token with same payload
    const newToken = generateToken({
      userId: new Types.ObjectId(decoded.userId),
      email: decoded.email,
      role: decoded.role,
      restaurantId: decoded.restaurantId ? new Types.ObjectId(decoded.restaurantId) : undefined,
    });

    logger.info(`Token refreshed for user: ${decoded.email}`);

    res.status(200).json({
      token: newToken,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: { message: 'Failed to refresh token' } });
  }
};

// Reset password with token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = resetPasswordSchema.parse(req.body);

    // Validate the reset token
    const tokenValidation = validatePasswordResetToken(validatedData.token);

    if (!tokenValidation.valid) {
      res.status(400).json({
        error: {
          message: tokenValidation.error || 'Invalid or expired reset token',
        },
      });
      return;
    }

    // Find user by ID from token
    const user = await User.findById(tokenValidation.data!.userId);

    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    // Check if user is active
    if (user.status !== 'active') {
      res.status(403).json({ error: { message: 'Account is inactive' } });
      return;
    }

    // Update password (will be hashed by the pre-save hook in User model)
    user.password = validatedData.newPassword;
    await user.save();

    logger.info(`Password reset successful for user: ${user.email}`);

    res.status(200).json({
      message: 'Password has been reset successfully',
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

    logger.error('Reset password error:', error);
    res.status(500).json({ error: { message: 'Failed to reset password' } });
  }
};

// Change password (authenticated users)
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = changePasswordSchema.parse(req.body);

    // Get authenticated user from request
    if (!req.user?.userId) {
      res.status(401).json({ error: { message: 'Unauthorized' } });
      return;
    }

    // Find user
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(validatedData.currentPassword);
    if (!isPasswordValid) {
      res.status(401).json({ error: { message: 'Current password is incorrect' } });
      return;
    }

    // Update password
    user.password = validatedData.newPassword;
    user.mustChangePassword = false; // Reset the flag
    await user.save();

    logger.info(`Password changed successfully for user: ${user.email}`);

    res.status(200).json({
      message: 'Password changed successfully',
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

    logger.error('Change password error:', error);
    res.status(500).json({ error: { message: 'Failed to change password' } });
  }
};
