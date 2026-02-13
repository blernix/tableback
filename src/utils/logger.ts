import winston from 'winston';
import path from 'path';

const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Create Sentry transport if DSN is available
const createSentryTransport = () => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return null;
  }

  try {
    // Dynamically import @sentry/winston to avoid dependency if not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SentryTransport } = require('@sentry/winston');
    return new SentryTransport({
      level: 'error', // Only send error-level logs to Sentry
      sentry: {
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.npm_package_version || '1.0.0',
        serverName: process.env.SERVER_NAME || 'tablemaster-api',
      },
      // Filter out specific error types
      shouldHandleError: (error: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        // Don't send validation errors to Sentry
        if (error.name === 'ValidationError') {
          return false;
        }
        // Don't send client errors (4xx) to Sentry
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          return false;
        }
        // Don't send rate limit errors
        if (error.message && error.message.includes('rate limit')) {
          return false;
        }
        return true;
      },
      // Add custom tags
      tags: {
        service: 'tablemaster-api',
        node_version: process.version,
      },
    });
  } catch (_error) {
    console.warn('@sentry/winston not available. Sentry logging disabled.');
    return null;
  }
};

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
      })
    ),
  }),
];

// Add Sentry transport if configured
const sentryTransport = createSentryTransport();
if (sentryTransport) {
  transports.push(sentryTransport);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'tablemaster-api' },
  transports,
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
    })
  );
}

export default logger;