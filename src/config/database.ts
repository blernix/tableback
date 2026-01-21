import mongoose from 'mongoose';
import logger from '../utils/logger';

let isShuttingDown = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Configure Mongoose with production-ready options
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maximum number of socket connections
      minPoolSize: 2, // Minimum number of socket connections
      retryWrites: true, // Retry write operations
      retryReads: true, // Retry read operations
    });

    logger.info('MongoDB connected successfully');
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');

      // Attempt to reconnect if not shutting down
      if (!isShuttingDown) {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          logger.info(`Attempting to reconnect to MongoDB (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

          setTimeout(() => {
            connectDatabase().catch(err => {
              logger.error('Failed to reconnect to MongoDB:', err);

              // If all reconnect attempts failed, exit process
              if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                logger.error('Max reconnection attempts reached. Exiting...');
                process.exit(1);
              }
            });
          }, RECONNECT_DELAY);
        }
      }
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
      reconnectAttempts = 0;
    });

    process.on('SIGINT', async () => {
      isShuttingDown = true;
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);

    // Retry connection if not at max attempts
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      logger.info(`Retrying MongoDB connection (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

      setTimeout(() => {
        connectDatabase().catch(err => {
          logger.error('Retry failed:', err);
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            process.exit(1);
          }
        });
      }, RECONNECT_DELAY);
    } else {
      process.exit(1);
    }
  }
};

export default connectDatabase;
