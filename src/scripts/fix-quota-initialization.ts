/**
 * Migration script to initialize reservationQuota for existing self-service restaurants
 *
 * Run with: npx ts-node src/scripts/fix-quota-initialization.ts
 */

import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';

async function fixQuotaInitialization() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tablemaster';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find all self-service restaurants without quota initialized
    const restaurants = await Restaurant.find({
      accountType: 'self-service',
      $or: [
        { reservationQuota: { $exists: false } },
        { 'reservationQuota.limit': { $exists: false } },
      ],
    });

    logger.info(`Found ${restaurants.length} restaurants to fix`);

    let fixedCount = 0;

    for (const restaurant of restaurants) {
      const plan = restaurant.subscription?.plan || 'starter';

      // Initialize quota based on plan
      restaurant.reservationQuota = {
        monthlyCount: 0,
        lastResetDate: new Date(),
        limit: plan === 'starter' ? 50 : -1,
        emailsSent: {
          at80: false,
          at90: false,
          at100: false,
        },
      };

      await restaurant.save();
      fixedCount++;

      logger.info(`Fixed quota for restaurant: ${restaurant.name} (${restaurant._id}) - Plan: ${plan}, Limit: ${restaurant.reservationQuota.limit}`);
    }

    logger.info(`✅ Successfully fixed ${fixedCount} restaurants`);

    // Verify
    const starterCount = await Restaurant.countDocuments({
      accountType: 'self-service',
      'subscription.plan': 'starter',
      'reservationQuota.limit': 50,
    });

    const proCount = await Restaurant.countDocuments({
      accountType: 'self-service',
      'subscription.plan': 'pro',
      'reservationQuota.limit': -1,
    });

    logger.info(`\nVerification:`);
    logger.info(`- Starter plans with quota 50: ${starterCount}`);
    logger.info(`- Pro plans with unlimited quota: ${proCount}`);

    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
fixQuotaInitialization()
  .then(() => {
    logger.info('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });
