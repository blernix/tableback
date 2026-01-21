import logger from '../utils/logger';

interface EnvValidation {
  required: Record<string, string>;
  optional: Record<string, string>;
}

// Define required and optional environment variables
const envConfig: EnvValidation = {
  required: {
    MONGODB_URI: 'MongoDB connection string',
    JWT_SECRET: 'JWT secret for token generation',
  },
  optional: {
    NODE_ENV: 'development, production, test (default: development)',
    PORT: 'Port for the server (default: 4000)',
    CORS_ORIGINS: 'Comma-separated list of CORS origins (default: http://localhost:3000)',
    BREVO_API_KEY: 'Brevo API key for email service',
    EMAIL_ENABLED: 'Enable email sending (true/false, default: true)',
    EMAIL_SENDER: 'Sender email address for emails',
    GCS_PROJECT_ID: 'Google Cloud Storage project ID',
    GCS_BUCKET_NAME: 'Google Cloud Storage bucket name',
    GCS_CREDENTIALS: 'Google Cloud Storage credentials as JSON string (recommended for production)',
    GCS_KEY_FILENAME: 'Path to GCS service account key file (for local development)',
    SMTP_HOST: 'SMTP host for nodemailer (optional)',
    SMTP_PORT: 'SMTP port (default: 587)',
    SMTP_USER: 'SMTP username',
    SMTP_PASS: 'SMTP password',
    SMTP_SECURE: 'Use secure connection (true/false)',
    ADMIN_EMAIL: 'Email for initial admin user (default: admin@tablemaster.com)',
    ADMIN_PASSWORD: 'Password for initial admin user (default: admin123)',
    VAPID_PUBLIC_KEY: 'VAPID public key for web push notifications',
    VAPID_PRIVATE_KEY: 'VAPID private key for web push notifications',
    VAPID_SUBJECT: 'VAPID subject (mailto: email address)',
    PUSH_ENABLED: 'Enable push notifications (true/false, default: true)',
  },
};

/**
 * Validate environment variables at startup
 * @throws Error if required environment variables are missing
 */
export function validateEnv(): void {
  const missing: string[] = [];
  
  // Check required variables
  for (const [key, description] of Object.entries(envConfig.required)) {
    if (!process.env[key]) {
      missing.push(`${key} (${description})`);
    }
  }
  
  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables:\n${missing.map(m => `  - ${m}`).join('\n')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  // Log optional variables that are set
  const setOptional: string[] = [];
  for (const [key] of Object.entries(envConfig.optional)) {
    if (process.env[key]) {
      setOptional.push(`${key}: ${process.env[key]?.substring(0, 20)}${process.env[key] && process.env[key]!.length > 20 ? '...' : ''}`);
    }
  }
  
  logger.info('Environment validation passed', {
    required: Object.keys(envConfig.required).length,
    optionalSet: setOptional.length,
    nodeEnv: process.env.NODE_ENV || 'development',
  });
  
  // Additional validation based on conditions
  if (process.env.EMAIL_ENABLED !== 'false' && !process.env.BREVO_API_KEY) {
    logger.warn('EMAIL_ENABLED is true but BREVO_API_KEY is not set. Email functionality may be limited.');
  }
  
  // GCS configuration validation
  const hasGcsConfig = process.env.GCS_PROJECT_ID || process.env.GCS_BUCKET_NAME;

  if (hasGcsConfig) {
    if (!process.env.GCS_PROJECT_ID) {
      logger.warn('GCS_BUCKET_NAME is set but GCS_PROJECT_ID is not. File uploads may not work.');
    }
    if (!process.env.GCS_BUCKET_NAME) {
      logger.warn('GCS_PROJECT_ID is set but GCS_BUCKET_NAME is not. File uploads may not work.');
    }

    // Check credentials are provided
    const hasCredentials = process.env.GCS_CREDENTIALS || process.env.GCS_KEY_FILENAME;
    if (!hasCredentials) {
      logger.warn('GCS configuration detected but neither GCS_CREDENTIALS nor GCS_KEY_FILENAME is set. File uploads will fail.');
    }

    // Validate GCS_CREDENTIALS format if provided
    if (process.env.GCS_CREDENTIALS) {
      try {
        const credentials = JSON.parse(process.env.GCS_CREDENTIALS);
        if (!credentials.type || !credentials.project_id || !credentials.private_key) {
          logger.warn('GCS_CREDENTIALS is missing required fields (type, project_id, private_key)');
        } else {
          logger.info('GCS_CREDENTIALS validated successfully');
        }
      } catch (error) {
        logger.error('GCS_CREDENTIALS is not valid JSON. File uploads will fail.');
      }
    }
  }

  // CORS configuration check for production
  if (process.env.NODE_ENV === 'production') {
    const corsOrigins = process.env.CORS_ORIGINS || 'http://localhost:3000';
    if (corsOrigins.includes('localhost') || corsOrigins.includes('127.0.0.1')) {
      logger.warn('CORS_ORIGINS contains localhost addresses in production. This may be a security risk.');
    }
    if (corsOrigins === '*' || corsOrigins.includes('*')) {
      logger.warn('CORS_ORIGINS contains wildcard (*) in production. Consider restricting to specific domains.');
    }

    // Admin credentials check for production
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tablemaster.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (adminEmail === 'admin@tablemaster.com') {
      logger.warn('ADMIN_EMAIL is using default value in production. Consider changing to a custom email.');
    }
    
    if (adminPassword === 'admin123') {
      logger.warn('ADMIN_PASSWORD is using default value in production. This is a serious security risk!');
    }
  }
}