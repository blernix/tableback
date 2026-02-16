import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import logger from '../utils/logger';

dotenv.config();

// Connect to MongoDB
async function connectToDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(mongoUri);
  logger.info('Connected to MongoDB');
}

// Calculate cutoff date (7 days ago)
function getCutoffDate(): Date {
  const cutoffDays = parseInt(process.env.INACTIVE_CLEANUP_DAYS || '7', 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
  return cutoffDate;
}

// Main cleanup function
async function cleanupInactiveRestaurants(): Promise<void> {
  try {
    await connectToDatabase();

    const cutoffDate = getCutoffDate();
    logger.info(`Cleaning up inactive restaurants created before ${cutoffDate.toISOString()}`);

    // Find inactive self-service restaurants without Stripe subscription
    const inactiveRestaurants = await Restaurant.find({
      status: 'inactive',
      accountType: 'self-service',
      createdAt: { $lt: cutoffDate },
      $or: [
        { 'subscription.stripeSubscriptionId': { $exists: false } },
        { 'subscription.stripeSubscriptionId': null },
      ],
    });

    logger.info(`Found ${inactiveRestaurants.length} inactive restaurants to clean up`);

    let deletedCount = 0;
    let userDeletedCount = 0;

    for (const restaurant of inactiveRestaurants) {
      try {
        // Delete associated user
        const userResult = await User.deleteMany({ restaurantId: restaurant._id });
        userDeletedCount += userResult.deletedCount;

        // Delete restaurant
        await Restaurant.findByIdAndDelete(restaurant._id);
        deletedCount++;

        logger.info(`Cleaned up inactive restaurant: ${restaurant.name} (${restaurant._id})`, {
          restaurantId: restaurant._id,
          email: restaurant.email,
          createdAt: restaurant.createdAt,
          usersDeleted: userResult.deletedCount,
        });
      } catch (error) {
        logger.error(`Failed to clean up restaurant ${restaurant._id}:`, error);
      }
    }

    logger.info('Cleanup completed', {
      restaurantsDeleted: deletedCount,
      usersDeleted: userDeletedCount,
      totalInactiveFound: inactiveRestaurants.length,
    });

    // Also log restaurants that were kept (recent or have Stripe subscription)
    const keptRestaurants = await Restaurant.find({
      status: 'inactive',
      accountType: 'self-service',
      $or: [
        { createdAt: { $gte: cutoffDate } },
        { 'subscription.stripeSubscriptionId': { $exists: true, $ne: null } },
      ],
    });

    logger.info(
      `${keptRestaurants.length} inactive restaurants were kept (recent or have Stripe subscription)`
    );
    for (const restaurant of keptRestaurants) {
      logger.debug('Restaurant kept:', {
        id: restaurant._id,
        name: restaurant.name,
        email: restaurant.email,
        createdAt: restaurant.createdAt,
        hasStripeId: !!restaurant.subscription?.stripeSubscriptionId,
      });
    }
  } catch (error) {
    logger.error('Cleanup failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  cleanupInactiveRestaurants()
    .then(() => {
      logger.info('Cleanup script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Cleanup script failed:', error);
      process.exit(1);
    });
}

export { cleanupInactiveRestaurants };
