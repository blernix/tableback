import jwt from 'jsonwebtoken';
import {
  generatePasswordResetToken,
  validatePasswordResetToken,
  generateReservationCancelToken,
  validateReservationCancelToken,
  validateToken,
  TokenType,
} from '../../services/tokenService';

describe('TokenService', () => {
  const TEST_USER_ID = 'user-123';
  const TEST_RESERVATION_ID = 'res-456';
  const TEST_RESTAURANT_ID = 'rest-789';

  beforeAll(() => {
    // Ensure JWT_SECRET is set for tests
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test-secret-key-for-testing';
    }
  });

  describe('Password Reset Tokens', () => {
    it('should generate a password reset token', () => {
      const token = generatePasswordResetToken(TEST_USER_ID);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should validate a valid password reset token', () => {
      const token = generatePasswordResetToken(TEST_USER_ID);
      const result = validatePasswordResetToken(token);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.userId).toBe(TEST_USER_ID);
      expect(result.error).toBeUndefined();
    });

    it('should reject an expired password reset token', () => {
      // Create an expired token (expired 1 hour ago)
      const expiredToken = jwt.sign(
        {
          type: TokenType.PASSWORD_RESET,
          userId: TEST_USER_ID,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      const result = validatePasswordResetToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(result.data).toBeUndefined();
    });

    it('should reject an invalid password reset token', () => {
      const invalidToken = 'invalid.token.here';
      const result = validatePasswordResetToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
      expect(result.data).toBeUndefined();
    });

    it('should reject a token with wrong type', () => {
      // Create a reservation cancel token
      const wrongTypeToken = generateReservationCancelToken(TEST_RESERVATION_ID, TEST_RESTAURANT_ID);

      // Try to validate it as password reset token
      const result = validatePasswordResetToken(wrongTypeToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token type');
      expect(result.data).toBeUndefined();
    });

    it('should include correct payload in token', () => {
      const token = generatePasswordResetToken(TEST_USER_ID);
      const decoded = jwt.decode(token) as any;

      expect(decoded.type).toBe(TokenType.PASSWORD_RESET);
      expect(decoded.userId).toBe(TEST_USER_ID);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('Reservation Cancel Tokens', () => {
    it('should generate a reservation cancel token', () => {
      const token = generateReservationCancelToken(TEST_RESERVATION_ID, TEST_RESTAURANT_ID);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should validate a valid reservation cancel token', () => {
      const token = generateReservationCancelToken(TEST_RESERVATION_ID, TEST_RESTAURANT_ID);
      const result = validateReservationCancelToken(token);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.reservationId).toBe(TEST_RESERVATION_ID);
      expect(result.data?.restaurantId).toBe(TEST_RESTAURANT_ID);
      expect(result.error).toBeUndefined();
    });

    it('should reject an expired reservation cancel token', () => {
      // Create an expired token (expired 1 hour ago)
      const expiredToken = jwt.sign(
        {
          type: TokenType.RESERVATION_CANCEL,
          reservationId: TEST_RESERVATION_ID,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      const result = validateReservationCancelToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(result.data).toBeUndefined();
    });

    it('should reject an invalid reservation cancel token', () => {
      const invalidToken = 'invalid.token.here';
      const result = validateReservationCancelToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
      expect(result.data).toBeUndefined();
    });

    it('should reject a token with wrong type', () => {
      // Create a password reset token
      const wrongTypeToken = generatePasswordResetToken(TEST_USER_ID);

      // Try to validate it as reservation cancel token
      const result = validateReservationCancelToken(wrongTypeToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token type');
      expect(result.data).toBeUndefined();
    });

    it('should include correct payload in token', () => {
      const token = generateReservationCancelToken(TEST_RESERVATION_ID, TEST_RESTAURANT_ID);
      const decoded = jwt.decode(token) as any;

      expect(decoded.type).toBe(TokenType.RESERVATION_CANCEL);
      expect(decoded.reservationId).toBe(TEST_RESERVATION_ID);
      expect(decoded.restaurantId).toBe(TEST_RESTAURANT_ID);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('Generic Token Validation', () => {
    it('should validate any valid token type', () => {
      const passwordToken = generatePasswordResetToken(TEST_USER_ID);
      const result1 = validateToken(passwordToken);

      expect(result1.valid).toBe(true);
      expect(result1.data?.type).toBe(TokenType.PASSWORD_RESET);

      const cancelToken = generateReservationCancelToken(TEST_RESERVATION_ID, TEST_RESTAURANT_ID);
      const result2 = validateToken(cancelToken);

      expect(result2.valid).toBe(true);
      expect(result2.data?.type).toBe(TokenType.RESERVATION_CANCEL);
    });

    it('should reject expired tokens', () => {
      const expiredToken = jwt.sign(
        {
          type: TokenType.PASSWORD_RESET,
          userId: TEST_USER_ID,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      const result = validateToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should reject invalid tokens', () => {
      const result = validateToken('invalid.token.here');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('Token Expiration Times', () => {
    it('should set password reset token to expire in 24 hours', () => {
      const token = generatePasswordResetToken(TEST_USER_ID);
      const decoded = jwt.decode(token) as any;

      const expirationTime = decoded.exp - decoded.iat;
      const expectedTime = 24 * 60 * 60; // 24 hours in seconds

      expect(expirationTime).toBe(expectedTime);
    });

    it('should set reservation cancel token to expire in 48 hours', () => {
      const token = generateReservationCancelToken(TEST_RESERVATION_ID, TEST_RESTAURANT_ID);
      const decoded = jwt.decode(token) as any;

      const expirationTime = decoded.exp - decoded.iat;
      const expectedTime = 48 * 60 * 60; // 48 hours in seconds

      expect(expirationTime).toBe(expectedTime);
    });
  });

  describe('Token Security', () => {
    it('should generate different tokens for same user ID', async () => {
      const token1 = generatePasswordResetToken(TEST_USER_ID);

      // Wait 1001ms to ensure different iat timestamps (JWT uses seconds)
      await new Promise(resolve => setTimeout(resolve, 1001));

      const token2 = generatePasswordResetToken(TEST_USER_ID);

      // Tokens should be different due to different iat timestamps
      expect(token1).not.toBe(token2);
    });

    it('should not be able to forge a token without secret', () => {
      // Create a token with wrong secret
      const forgedToken = jwt.sign(
        {
          type: TokenType.PASSWORD_RESET,
          userId: TEST_USER_ID,
        },
        'wrong-secret',
        { expiresIn: '24h' }
      );

      const result = validatePasswordResetToken(forgedToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });
});
