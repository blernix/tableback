/**
 * Generate a temporary token for 2FA verification
 * This token is short-lived (5 minutes) and used during the 2FA verification flow
 */
export function generateTempToken(userId: string): string {
  // Simple temporary token - in production, use a proper JWT with short expiration
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return Buffer.from(`${userId}:${timestamp}:${random}`).toString('base64');
}

/**
 * Verify temporary token and extract userId
 * Returns { userId: string, isValid: boolean }
 */
export function verifyTempToken(tempToken: string): { userId: string; isValid: boolean } {
  try {
    const decoded = Buffer.from(tempToken, 'base64').toString('utf8');
    const [userId, timestamp, _unused] = decoded.split(':');
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    
    // Token expires after 5 minutes
    if (now - tokenTime > 5 * 60 * 1000) {
      return { userId: '', isValid: false };
    }
    
    return { userId, isValid: !!userId };
  } catch (_error) {
    return { userId: '', isValid: false };
  }
}