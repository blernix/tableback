import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface BrevoTemplate {
  passwordReset: number;
  pendingReservation: number;
  confirmation: number;
  directConfirmation: number;
  cancellationConfirmation: number;
}

interface BrevoRetryConfig {
  maxAttempts: number;
  minTimeout: number;
  maxTimeout: number;
}

interface BrevoConfig {
  apiKey: string | undefined;
  senderEmail: string;
  senderName: string;
  templates: BrevoTemplate;
  enabled: boolean;
  retry: BrevoRetryConfig;
  timeout: number;
}

const brevoConfig: BrevoConfig = {
  apiKey: process.env.BREVO_API_KEY,
  senderEmail: process.env.EMAIL_SENDER || 'reservation@mastertable.fr',
  senderName: 'TableMaster',

  // Template IDs (will be filled in Story 1.2)
  templates: {
    passwordReset: parseInt(process.env.BREVO_TEMPLATE_PASSWORD_RESET || '1', 10),
    pendingReservation: parseInt(process.env.BREVO_TEMPLATE_PENDING || '2', 10),
    confirmation: parseInt(process.env.BREVO_TEMPLATE_CONFIRMATION || '3', 10),
    directConfirmation: parseInt(process.env.BREVO_TEMPLATE_DIRECT || '4', 10),
    cancellationConfirmation: parseInt(process.env.BREVO_TEMPLATE_CANCELLATION || '5', 10),
  },

  // Email sending enabled (feature flag)
  enabled: process.env.EMAIL_ENABLED !== 'false',

  // Retry configuration
  retry: {
    maxAttempts: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
  },

  // Timeout for API calls (5 seconds)
  timeout: 5000,
};

// Validation
if (brevoConfig.enabled && !brevoConfig.apiKey) {
  throw new Error('BREVO_API_KEY is required when EMAIL_ENABLED=true');
}

export default brevoConfig;
