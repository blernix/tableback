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
    // Give time for logging before exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Give time for logging before exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
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
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Give existing connections 10 seconds to finish
      setTimeout(async () => {
        logger.info('Forcing shutdown after timeout');

        // Close MongoDB connection
        try {
          await mongoose.connection.close(false);
          logger.info('MongoDB connection closed');
        } catch (error) {
          logger.error('Error closing MongoDB:', error);
        }

        process.exit(0);
      }, 10000);
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
