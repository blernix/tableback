// This file must be imported FIRST in your application entry point
// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import dotenv from 'dotenv';

// Load environment variables before initializing Sentry
dotenv.config();

// Initialize Sentry as early as possible
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Performance monitoring
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
  
  // Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Server name for identifying instances
  serverName: process.env.SERVER_NAME || 'tablemaster-api',
  
  // Release tracking (useful for linking errors to git commits)
  release: process.env.npm_package_version || '1.0.0',
  
  // Send default PII data to Sentry (IP address, etc.)
  sendDefaultPii: true,
  
  // Ignored errors
  ignoreErrors: [
    'ValidationError',
    'UnauthorizedError',
    'ForbiddenError',
    'NotFoundError',
    'RateLimitError',
    // Network errors that are usually transient
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
  ],
  
  // Before send hook to filter events
  beforeSend(event, hint) {
    const error = hint?.originalException;
    
    // Filter out health check errors
    if (event.request?.url?.includes('/health')) {
      return null;
    }
    
    // Filter out specific error messages
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as any).message;
      
      // Ignore rate limit errors (handled by middleware)
      if (message.includes('rate limit') || message.includes('RateLimit')) {
        return null;
      }
      
      // Ignore validation errors (handled by Zod)
      if (message.includes('validation') || message.includes('Validation')) {
        return null;
      }
      
      // Ignore specific MongoDB errors
      if (message.includes('MongoNetworkError') || message.includes('MongoServerError')) {
        // Still capture network errors but with lower sample rate
        if (Math.random() > 0.1) {
          return null;
        }
      }
    }
    
    // Add custom tags for better filtering
    event.tags = {
      ...event.tags,
      service: 'tablemaster-api',
      node_version: process.version,
    };
    
    return event;
  },
  
  // Integrations
  integrations: [
    // Automatically instrument Node.js libraries and frameworks
    Sentry.httpIntegration(),
    // Add profiling integration if enabled
    nodeProfilingIntegration(),
  ],
});

console.log('Sentry initialized');