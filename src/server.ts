import app from './app';
import connectDatabase from './config/database';
import logger from './utils/logger';
import { validateEnv } from './config/env.validation';

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

  // Handle SIGTERM for graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    process.exit(0);
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
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Setup global error handlers
setupErrorHandlers();

// Start the server
startServer();
