/**
 * Migration script to update existing Starter plan restaurants from limit 100 to 50
 *
 * Run with: npx ts-node src/scripts/update-quota-limits.ts
 */

import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';

async function updateQuotaLimits() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tablemaster';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find all self-service Starter restaurants with old limit (100) or missing limit
    const restaurants = await Restaurant.find({
      accountType: 'self-service',
      'subscription.plan': 'starter',
      $or: [
        { 'reservationQuota.limit': 100 },
        { 'reservationQuota.limit': { $exists: false } },
        { 'reservationQuota.limit': { $gt: 50 } }, // Catch any limit > 50
      ],
    });

    logger.info(`Found ${restaurants.length} Starter restaurants to update`);

    let updatedCount = 0;

    for (const restaurant of restaurants) {
      // Update limit to 50
      if (!restaurant.reservationQuota) {
        restaurant.reservationQuota = {
          monthlyCount: 0,
          lastResetDate: new Date(),
          limit: 50,
          emailsSent: {
            at80: false,
            at90: false,
            at100: false,
          },
        };
      } else {
        restaurant.reservationQuota.limit = 50;
      }

      await restaurant.save();
      updatedCount++;

      logger.info(`Updated quota limit for restaurant: ${restaurant.name} (${restaurant._id}) - New limit: 50`);
    }

    logger.info(`✅ Successfully updated ${updatedCount} restaurants`);

    // Verify
    const starterWith50 = await Restaurant.countDocuments({
      accountType: 'self-service',
      'subscription.plan': 'starter',
      'reservationQuota.limit': 50,
    });

    const starterWith100 = await Restaurant.countDocuments({
      accountType: 'self-service',
      'subscription.plan': 'starter',
      'reservationQuota.limit': 100,
    });

    const starterNoQuota = await Restaurant.countDocuments({
      accountType: 'self-service',
      'subscription.plan': 'starter',
      $or: [
        { reservationQuota: { $exists: false } },
        { 'reservationQuota.limit': { $exists: false } },
      ],
    });

    logger.info(`\nVerification:`);
    logger.info(`- Starter plans with limit 50: ${starterWith50}`);
    logger.info(`- Starter plans with limit 100: ${starterWith100}`);
    logger.info(`- Starter plans without quota: ${starterNoQuota}`);

    if (starterWith100 > 0 || starterNoQuota > 0) {
      logger.warn(`⚠️ There are still ${starterWith100 + starterNoQuota} restaurants that need attention`);
    }

    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
updateQuotaLimits()
  .then(() => {
    logger.info('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });