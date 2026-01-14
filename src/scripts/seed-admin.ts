import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.model';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined');
    }

    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      logger.info('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Get admin credentials from environment variables with development defaults
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tablemaster.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Validate admin credentials in production
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
        throw new Error(
          'ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required in production. ' +
          'Please set them in your .env.production file.'
        );
      }
      
      if (adminPassword === 'admin123') {
        logger.warn('⚠️  Using default password in production is highly insecure!');
      }
    } else {
      logger.warn('⚠️  Using development default credentials. Change these in production!');
    }

    // Create admin user
    const adminUser = new User({
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    });

    await adminUser.save();
    logger.info('Admin user created successfully!');
    logger.info(`Email: ${adminEmail}`);
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Password: ${adminPassword}`);
    }
    logger.info('⚠️  Please change this password in production!');

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
