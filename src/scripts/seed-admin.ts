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

    // Create admin user
    const adminUser = new User({
      email: 'admin@tablemaster.com',
      password: 'admin123', // Change this in production!
      role: 'admin',
    });

    await adminUser.save();
    logger.info('Admin user created successfully!');
    logger.info('Email: admin@tablemaster.com');
    logger.info('Password: admin123');
    logger.info('⚠️  Please change this password in production!');

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
