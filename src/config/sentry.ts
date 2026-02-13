import * as Sentry from '@sentry/node';
import express from 'express';
import logger from '../utils/logger';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry with Express app
export const initSentry = (_app?: express.Application) => {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('Sentry DSN not configured. Error tracking disabled.');
    return false;
  }

  try {
    const integrations = [];
    
    // Add Express integration if app is provided
    // Note: expressIntegration may not accept arguments in Sentry 10
    // if (app) {
    //   integrations.push(Sentry.expressIntegration({ app }));
    // }
    
    // Add HTTP integration for request tracking
    integrations.push(Sentry.httpIntegration());
    
    // Add MongoDB integration if mongoose is used (requires @sentry/mongo package)
    // integrations.push(Sentry.mongoIntegration());
    
    // Add profiling integration if enabled
    if (process.env.SENTRY_PROFILING_ENABLED === 'true') {
      integrations.push(nodeProfilingIntegration());
    }

    Sentry.init({
      dsn,
      
      // Performance monitoring
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
      
      // Environment
      environment: process.env.NODE_ENV || 'development',
      
      // Server name for identifying instances
      serverName: process.env.SERVER_NAME || 'tablemaster-api',
      
      // Release tracking (useful for linking errors to git commits)
      release: process.env.npm_package_version || '1.0.0',
      
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
          const message = (error as { message: string }).message;
          
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
      integrations,
    });

    logger.info('Sentry initialized successfully.');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
    return false;
  }
};

// Capture an error manually
export const captureError = (error: Error, context?: Record<string, unknown>) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

// Capture a message (info, warning, etc.)
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, { level });
};

// Set user context for error tracking
export const setUserContext = (user: { id?: string; email?: string; restaurantId?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    ip_address: '{{auto}}',
    extras: {
      restaurantId: user.restaurantId,
    },
  });
};

// Clear user context
export const clearUserContext = () => {
  Sentry.setUser(null);
};

// Flush events before shutdown
export const flushSentry = async (timeout = 2000) => {
  try {
    await Sentry.flush(timeout);
    logger.debug('Sentry events flushed.');
  } catch (error) {
    logger.error('Failed to flush Sentry events:', error);
  }
};