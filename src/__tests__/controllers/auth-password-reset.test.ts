import { Request, Response } from 'express';
import { forgotPassword, resetPassword } from '../../controllers/auth.controller';
import User from '../../models/User.model';
import { sendPasswordResetEmail } from '../../services/emailService';
import { validatePasswordResetToken } from '../../services/tokenService';

// Mock dependencies
jest.mock('../../models/User.model');
jest.mock('../../services/emailService');
jest.mock('../../services/tokenService');

describe('Auth Controller - Password Reset', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {};
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    jest.clearAllMocks();
  });

  describe('forgotPassword', () => {
    it('should return success even if user does not exist (security)', async () => {
      mockRequest.body = { email: 'nonexistent@example.com' };

      (User.findOne as jest.Mock).mockResolvedValue(null);

      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'If the email exists, a password reset link has been sent',
      });
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send password reset email for active user', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        status: 'active',
      };

      mockRequest.body = { email: 'user@example.com' };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (sendPasswordResetEmail as jest.Mock).mockResolvedValue({ success: true });

      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(sendPasswordResetEmail).toHaveBeenCalledWith({
        _id: 'user-123',
        email: 'user@example.com',
        name: 'user@example.com',
      });
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'If the email exists, a password reset link has been sent',
      });
    });

    it('should not reveal if user is inactive (security)', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        status: 'inactive',
      };

      mockRequest.body = { email: 'user@example.com' };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'If the email exists, a password reset link has been sent',
      });
    });

    it('should return success even if email sending fails (security)', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        status: 'active',
      };

      mockRequest.body = { email: 'user@example.com' };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (sendPasswordResetEmail as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Email service error',
      });

      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'If the email exists, a password reset link has been sent',
      });
    });

    it('should return validation error for invalid email', async () => {
      mockRequest.body = { email: 'invalid-email' };

      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          message: 'Validation error',
          details: expect.any(Array),
        },
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        status: 'active',
        password: 'old-password',
        save: jest.fn().mockResolvedValue(true),
      };

      mockRequest.body = {
        token: 'valid-reset-token',
        newPassword: 'newPassword123',
      };

      (validatePasswordResetToken as jest.Mock).mockReturnValue({
        valid: true,
        data: { userId: 'user-123' },
      });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockUser.password).toBe('newPassword123');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Password has been reset successfully',
      });
    });

    it('should reject invalid token', async () => {
      mockRequest.body = {
        token: 'invalid-token',
        newPassword: 'newPassword123',
      };

      (validatePasswordResetToken as jest.Mock).mockReturnValue({
        valid: false,
        error: 'Invalid token',
      });

      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          message: 'Invalid token',
        },
      });
    });

    it('should reject expired token', async () => {
      mockRequest.body = {
        token: 'expired-token',
        newPassword: 'newPassword123',
      };

      (validatePasswordResetToken as jest.Mock).mockReturnValue({
        valid: false,
        error: 'Token expired',
      });

      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          message: 'Token expired',
        },
      });
    });

    it('should return 404 if user not found', async () => {
      mockRequest.body = {
        token: 'valid-token',
        newPassword: 'newPassword123',
      };

      (validatePasswordResetToken as jest.Mock).mockReturnValue({
        valid: true,
        data: { userId: 'user-123' },
      });
      (User.findById as jest.Mock).mockResolvedValue(null);

      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        error: { message: 'User not found' },
      });
    });

    it('should reject reset for inactive user', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        status: 'inactive',
      };

      mockRequest.body = {
        token: 'valid-token',
        newPassword: 'newPassword123',
      };

      (validatePasswordResetToken as jest.Mock).mockReturnValue({
        valid: true,
        data: { userId: 'user-123' },
      });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        error: { message: 'Account is inactive' },
      });
    });

    it('should return validation error for short password', async () => {
      mockRequest.body = {
        token: 'valid-token',
        newPassword: '123', // Too short
      };

      await resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          message: 'Validation error',
          details: expect.any(Array),
        },
      });
    });
  });
});
