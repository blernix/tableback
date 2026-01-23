import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import logger from '../utils/logger';

// Configure authenticator for TOTP (30-second intervals, window of 2 for better tolerance)
// window: 2 means ±2 time steps (60 seconds before/after) for clock drift tolerance
authenticator.options = {
  step: 30,
  window: 2,
};

// Configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-encryption-key-for-dev-only';
const ALGORITHM = 'aes-256-gcm';

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
}

export interface TwoFactorVerificationResult {
  isValid: boolean;
  isRecoveryCode?: boolean;
}

/**
 * Encrypt sensitive data (secret, recovery codes)
 */
function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return { encrypted, iv: iv.toString('hex'), authTag };
}

/**
 * Decrypt sensitive data
 */
function decrypt(encrypted: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a new 2FA setup for a user
 * Note: Recovery codes are generated separately when 2FA is actually enabled
 */
export async function generateTwoFactorSetup(email: string): Promise<TwoFactorSetup> {
  try {
    // Generate secret
    const secret = authenticator.generateSecret();

    // Generate QR code URL
    const otpauthUrl = authenticator.keyuri(email, 'TableMaster', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      secret,
      qrCodeUrl,
    };
  } catch (error) {
    logger.error('Error generating 2FA setup:', error);
    throw new Error('Failed to generate 2FA setup');
  }
}

/**
 * Verify a TOTP code
 */
export function verifyTwoFactorCode(secret: string, token: string): boolean {
  try {
    logger.debug(`[2FA] Verifying token: ${token} for secret: ${secret.substring(0, 8)}...`);
    
    // Generate expected token for current time for debugging
    const expectedToken = authenticator.generate(secret);
    const timeRemaining = authenticator.timeRemaining();
    const timeUsed = authenticator.timeUsed();
    
    logger.debug(`[2FA] Current time - used: ${timeUsed}s, remaining: ${timeRemaining}s`);
    logger.debug(`[2FA] Expected token for current time: ${expectedToken}`);
    
    // Also check previous and next windows for debugging
    const now = Date.now();
    // @ts-ignore
    const prevToken = authenticator.generate(secret, now - 30000); // 30 seconds ago
    // @ts-ignore
    const nextToken = authenticator.generate(secret, now + 30000); // 30 seconds later
    
    logger.debug(`[2FA] Previous window token: ${prevToken}`);
    logger.debug(`[2FA] Next window token: ${nextToken}`);
    
    const isValid = authenticator.verify({ secret, token });
    logger.debug(`[2FA] Verification result: ${isValid}`);
    
    return isValid;
  } catch (error) {
    logger.error('Error verifying 2FA code:', error);
    return false;
  }
}

/**
 * Verify a recovery code
 */
export function verifyRecoveryCode(encryptedRecoveryCodes: string[], iv: string, authTag: string, code: string): { isValid: boolean; updatedEncryptedRecoveryCodes?: string[]; updatedIv?: string; updatedAuthTag?: string } {
  try {
    // Decrypt recovery codes
    const decrypted = decrypt(encryptedRecoveryCodes.join('|'), iv, authTag);
    const recoveryCodes = decrypted.split('|');
    
    // Check if code exists
    const index = recoveryCodes.indexOf(code);
    if (index === -1) {
      return { isValid: false };
    }
    
    // Remove used recovery code
    recoveryCodes.splice(index, 1);
    
    // If no recovery codes left, return empty array
    if (recoveryCodes.length === 0) {
      return { 
        isValid: true, 
        updatedEncryptedRecoveryCodes: [],
        updatedIv: iv,
        updatedAuthTag: authTag
      };
    }
    
    // Re-encrypt remaining recovery codes
    const updatedRecoveryCodesString = recoveryCodes.join('|');
    const encryptedRecoveryData = encrypt(updatedRecoveryCodesString);
    
    return { 
      isValid: true, 
      updatedEncryptedRecoveryCodes: [encryptedRecoveryData.encrypted],
      updatedIv: encryptedRecoveryData.iv,
      updatedAuthTag: encryptedRecoveryData.authTag
    };
  } catch (error) {
    logger.error('Error verifying recovery code:', error);
    return { isValid: false };
  }
}

/**
 * Encrypt two-factor secret and recovery codes for storage
 */
export function encryptTwoFactorData(secret: string, recoveryCodes: string[]): {
  encryptedSecret: string;
  secretIv: string;
  secretAuthTag: string;
  encryptedRecoveryCodes: string[];
  recoveryIv: string;
  recoveryAuthTag: string;
} {
  // Encrypt secret
  const encryptedSecretData = encrypt(secret);
  
  // Encrypt recovery codes (store as pipe-separated string)
  const recoveryCodesString = recoveryCodes.join('|');
  const encryptedRecoveryData = encrypt(recoveryCodesString);
  
  return {
    encryptedSecret: encryptedSecretData.encrypted,
    secretIv: encryptedSecretData.iv,
    secretAuthTag: encryptedSecretData.authTag,
    encryptedRecoveryCodes: [encryptedRecoveryData.encrypted],
    recoveryIv: encryptedRecoveryData.iv,
    recoveryAuthTag: encryptedRecoveryData.authTag,
  };
}

/**
 * Decrypt two-factor secret for verification
 */
export function decryptTwoFactorSecret(encryptedSecret: string, iv: string, authTag: string): string {
  return decrypt(encryptedSecret, iv, authTag);
}

/**
 * Generate backup codes for a user
 */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => 
    crypto.randomBytes(6).toString('hex').toUpperCase()
  );
}