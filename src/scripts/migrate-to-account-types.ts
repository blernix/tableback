/**
 * Migration script to add accountType field to existing restaurants
 * Run this once after deploying the new Restaurant model
 *
 * Usage:
 * npx ts-node src/scripts/migrate-to-account-types.ts
 */

import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function migrateRestaurants() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find all restaurants that don't have accountType set
    const restaurants = await Restaurant.find({
      accountType: { $exists: false },
    });

    logger.info(`Found ${restaurants.length} restaurants to migrate`);

    if (restaurants.length === 0) {
      logger.info('No restaurants to migrate. All restaurants already have accountType.');
      await mongoose.disconnect();
      return;
    }

    // Update all existing restaurants to 'managed' type
    const result = await Restaurant.updateMany(
      { accountType: { $exists: false } },
      {
        $set: {
          accountType: 'managed',
        },
      }
    );

    logger.info(`Migration completed successfully:`);
    logger.info(`- Matched documents: ${result.matchedCount}`);
    logger.info(`- Modified documents: ${result.modifiedCount}`);

    // Verify migration
    const verifyManaged = await Restaurant.countDocuments({ accountType: 'managed' });
    const verifySelfService = await Restaurant.countDocuments({ accountType: 'self-service' });
    const verifyTotal = await Restaurant.countDocuments();

    logger.info(`Post-migration stats:`);
    logger.info(`- Total restaurants: ${verifyTotal}`);
    logger.info(`- Managed accounts: ${verifyManaged}`);
    logger.info(`- Self-service accounts: ${verifySelfService}`);

    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateRestaurants();
