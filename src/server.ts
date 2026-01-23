import app from './app';
import connectDatabase from './config/database';
import logger from './utils/logger';
import { validateEnv } from './config/env.validation';
import mongoose from 'mongoose';

const PORT = process.env.PORT || 4000;

/**
 * Setup global error handlers for uncaught exceptions and unhandled rejections
 */
function setupErrorHandlers(): void {
  // Catch uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);

    // Only exit on critical errors, not MongoDB connection issues
    const isCritical = !(
      error.message?.includes('Mongo') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('socket') ||
      error.message?.includes('timeout')
    );

    if (isCritical) {
      logger.error('Critical error detected, exiting...');
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    } else {
      logger.warn('Non-critical error, continuing...');
    }
  });

  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', reason);

    // Don't exit on MongoDB errors - they're handled by Mongoose reconnection logic
    const reasonStr = String(reason);
    const isMongoError = reasonStr.includes('Mongo') ||
                        reasonStr.includes('ECONNREFUSED') ||
                        reasonStr.includes('socket') ||
                        reasonStr.includes('timeout');

    if (!isMongoError) {
      logger.error('Non-MongoDB rejection, exiting...');
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    } else {
      logger.warn('MongoDB-related rejection, letting Mongoose handle it...');
    }
  });

  logger.info('Global error handlers registered');
}

const startServer = async () => {
  try {
    // Validate environment variables
    validateEnv();

    // Connect to database
    await connectDatabase();

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
    });

    // Configure server timeouts to prevent hanging connections
    server.keepAliveTimeout = 65000; // Slightly higher than typical load balancer timeout (60s)
    server.headersTimeout = 66000; // Should be higher than keepAliveTimeout

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        // Close MongoDB connection gracefully
        try {
          await mongoose.connection.close(false);
          logger.info('MongoDB connection closed gracefully');
        } catch (error) {
          logger.error('Error closing MongoDB:', error);
        }

        process.exit(0);
      });

      // Force shutdown after 15 seconds if graceful shutdown hangs
      setTimeout(() => {
        logger.warn('Forcing shutdown after timeout');
        process.exit(1);
      }, 15000);
    };

    // Register graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Setup global error handlers
setupErrorHandlers();

// Start the server
startServer();
