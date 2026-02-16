import dotenv from 'dotenv';
import logger from '../utils/logger';
import { cleanupInactiveRestaurants } from './cleanup-inactive-restaurants';
import { sendPaymentReminders } from './send-payment-reminders';

dotenv.config();

async function dailyMaintenance(): Promise<void> {
  logger.info('Starting daily maintenance');
  const startTime = Date.now();

  try {
    // Step 1: Send payment reminders
    logger.info('Step 1/2: Sending payment reminders');
    await sendPaymentReminders();

    // Step 2: Cleanup inactive restaurants
    logger.info('Step 2/2: Cleaning up inactive restaurants');
    await cleanupInactiveRestaurants();

    const duration = Date.now() - startTime;
    logger.info(`Daily maintenance completed in ${duration}ms`);
  } catch (error) {
    logger.error('Daily maintenance failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  dailyMaintenance()
    .then(() => {
      logger.info('Daily maintenance script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Daily maintenance script failed:', error);
      process.exit(1);
    });
}

export { dailyMaintenance };
