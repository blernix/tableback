import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.model';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

const updateAdminPassword = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined');
    }

    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected');

    // Find admin user
    const admin = await User.findOne({ email: 'admin@tablemaster.com' });
    if (!admin) {
      logger.error('Admin user not found');
      process.exit(1);
    }

    logger.info(`Found admin: ${admin.email}, status: ${admin.status}`);

    // Update password
    admin.password = 'admin123'; // Will be hashed by pre-save hook
    await admin.save();

    logger.info('Admin password updated to "admin123"');
    process.exit(0);
  } catch (error) {
    logger.error('Error updating admin password:', error);
    process.exit(1);
  }
};

updateAdminPassword();