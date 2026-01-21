import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface PushConfig {
  vapidPublicKey: string | undefined;
  vapidPrivateKey: string | undefined;
  vapidSubject: string;
  enabled: boolean;
  retry: {
    maxAttempts: number;
    minTimeout: number;
    maxTimeout: number;
  };
  timeout: number;
}

const pushConfig: PushConfig = {
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:notifications@tablemaster.fr',
  enabled: process.env.PUSH_ENABLED !== 'false',
  retry: {
    maxAttempts: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
  },
  timeout: 5000,
};

// Validation
if (pushConfig.enabled) {
  if (!pushConfig.vapidPublicKey) {
    throw new Error('VAPID_PUBLIC_KEY is required when PUSH_ENABLED=true');
  }
  if (!pushConfig.vapidPrivateKey) {
    throw new Error('VAPID_PRIVATE_KEY is required when PUSH_ENABLED=true');
  }
  if (!pushConfig.vapidSubject) {
    throw new Error('VAPID_SUBJECT is required when PUSH_ENABLED=true');
  }
}

export default pushConfig;