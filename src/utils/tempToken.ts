import crypto from 'crypto';

/**
 * Generate a temporary token for 2FA verification
 * This token is short-lived (5 minutes) and used during the 2FA verification flow
 */
export function generateTempToken(userId: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  return Buffer.from(`${userId}:${timestamp}:${random}`).toString('base64');
}

/**
 * Verify temporary token and extract userId
 * Returns { userId: string, isValid: boolean }
 */
export function verifyTempToken(tempToken: string): { userId: string; isValid: boolean } {
  try {
    const decoded = Buffer.from(tempToken, 'base64').toString('utf8');
    const [userId, timestamp] = decoded.split(':');
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    
    // Token expires after 5 minutes
    if (now - tokenTime > 5 * 60 * 1000) {
      return { userId: '', isValid: false };
    }
    
    return { userId, isValid: !!userId };
  } catch {
    return { userId: '', isValid: false };
  }
}