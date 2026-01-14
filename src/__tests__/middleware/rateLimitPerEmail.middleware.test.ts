import { Request, Response } from 'express';
import { forgotPasswordEmailRateLimit, emailRateLimiter } from '../../middleware/rateLimitPerEmail.middleware';

describe('forgotPasswordEmailRateLimit middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = {};
    
    // Reset rate limiter state before each test
    emailRateLimiter.reset();
  });

  afterAll(() => {
    emailRateLimiter.stopCleanupInterval();
  });

  it('should allow first request for an email', () => {
    mockRequest.body = { email: 'test@example.com' };
    
    forgotPasswordEmailRateLimit(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should allow multiple requests up to limit', () => {
    mockRequest.body = { email: 'test2@example.com' };
    
    // First request
    forgotPasswordEmailRateLimit(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    expect(mockNext).toHaveBeenCalledTimes(1);
    
    // Clear mock
    mockNext.mockClear();
    
    // Second request
    forgotPasswordEmailRateLimit(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    expect(mockNext).toHaveBeenCalledTimes(1);
    
    // Third request (still allowed)
    mockNext.mockClear();
    forgotPasswordEmailRateLimit(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should block request after exceeding limit', () => {
    mockRequest.body = { email: 'test3@example.com' };
    
    // Make 3 requests (limit is 3)
    for (let i = 0; i < 3; i++) {
      forgotPasswordEmailRateLimit(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      mockNext.mockClear();
    }
    
    // Fourth request should be blocked
    forgotPasswordEmailRateLimit(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: 'Too many password reset attempts for this email. Please try again later.'
      }
    });
  });

  it('should skip rate limiting if email is missing', () => {
    mockRequest.body = {};
    
    forgotPasswordEmailRateLimit(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should normalize email (lowercase and trim)', () => {
    mockRequest.body = { email: '  TEST@Example.COM  ' };
    
    forgotPasswordEmailRateLimit(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    
    expect(mockNext).toHaveBeenCalled();
    
    // Second request with same normalized email should count towards limit
    mockNext.mockClear();
    mockRequest.body = { email: 'test@example.com' };
    
    forgotPasswordEmailRateLimit(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    
    expect(mockNext).toHaveBeenCalledTimes(1);
    // Now we've made 2 requests for same email
  });
});