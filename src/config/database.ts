import mongoose from 'mongoose';
import logger from '../utils/logger';

const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Configure Mongoose with production-ready options for hundreds of concurrent users
    // Mongoose automatically handles reconnection, so we don't need manual retry logic
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000, // Timeout after 30s
      socketTimeoutMS: 25000, // Socket timeout 25s - CRITICAL: prevents queries from hanging forever
      maxPoolSize: 200, // Support up to 200 concurrent connections (for hundreds of users)
      minPoolSize: 10, // Keep 10 connections ready
      maxIdleTimeMS: 60000, // Close idle connections after 1 minute to free resources
      retryWrites: true, // Retry write operations
      retryReads: true, // Retry read operations
      heartbeatFrequencyMS: 10000, // Send heartbeat every 10s to keep connection alive
      connectTimeoutMS: 30000, // Initial connection timeout
      compressors: ['zlib'], // Compress network traffic to reduce bandwidth
      maxConnecting: 10, // Limit simultaneous connection attempts
    });

    logger.info('MongoDB connected successfully');

    // Enable slow query logging (queries taking longer than 100ms)
    mongoose.set('debug', (collectionName: string, method: string, query: any, _doc: any, options: any) => {
      const startTime = Date.now();
      logger.debug(`MongoDB Query: ${collectionName}.${method}`, { query, options });

      // Log slow queries
      setTimeout(() => {
        const duration = Date.now() - startTime;
        if (duration > 100) {
          logger.warn(`Slow MongoDB query detected (${duration}ms): ${collectionName}.${method}`, { query });
        }
      }, 0);
    });

    // Setup event listeners for MongoDB connection events
    // These are for logging only - Mongoose handles reconnection automatically
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Mongoose will attempt automatic reconnection...');
    });

    mongoose.connection.on('connecting', () => {
      logger.info('MongoDB attempting to reconnect...');
    });

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    // Let the calling code (server.ts) handle the error
    throw error;
  }
};

export default connectDatabase;
