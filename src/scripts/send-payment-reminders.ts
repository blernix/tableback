import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import logger from '../utils/logger';
import { sendEmail } from '../services/emailService';

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

// Calculate cutoff dates
function getReminderDates(): { from: Date; to: Date } {
  const reminderHours = parseInt(process.env.PAYMENT_REMINDER_HOURS || '24', 10);
  const fromDate = new Date();
  fromDate.setHours(fromDate.getHours() - reminderHours - 1); // Start of window
  const toDate = new Date();
  toDate.setHours(toDate.getHours() - reminderHours); // End of window (1 hour window)
  return { from: fromDate, to: toDate };
}

// Generate resume payment URL
function generateResumePaymentUrl(restaurantId: string, email: string): string {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/signup/cancel?restaurantId=${restaurantId}&email=${encodeURIComponent(email)}`;
}

// Main reminder function
async function sendPaymentReminders(): Promise<void> {
  try {
    await connectToDatabase();

    const { from, to } = getReminderDates();
    logger.info(
      `Sending payment reminders for restaurants created between ${from.toISOString()} and ${to.toISOString()}`
    );

    // Find inactive self-service restaurants without Stripe subscription
    // Created within the reminder window (24h ago ± 1 hour)
    // That haven't received a reminder yet
    const restaurants = await Restaurant.find({
      status: 'inactive',
      accountType: 'self-service',
      createdAt: { $gte: from, $lt: to },
      $or: [
        { 'subscription.stripeSubscriptionId': { $exists: false } },
        { 'subscription.stripeSubscriptionId': null },
      ],
      paymentReminderSentAt: { $exists: false },
    });

    logger.info(`Found ${restaurants.length} restaurants eligible for payment reminder`);

    let sentCount = 0;
    let errorCount = 0;

    for (const restaurant of restaurants) {
      try {
        // Find associated user (for validation)
        const user = await User.findOne({ restaurantId: restaurant._id });
        if (!user) {
          logger.warn(`No user found for restaurant ${restaurant._id}, skipping`);
          continue;
        }

        const resumeUrl = generateResumePaymentUrl(restaurant._id.toString(), restaurant.email);

        // Send email
        const result = await sendEmail({
          to: restaurant.email,
          toName: restaurant.name,
          subject: 'Completez votre inscription sur TableMaster',
          templateName: 'payment-reminder',
          params: {
            restaurantName: restaurant.name,
            resumeUrl,
            daysRemaining: 6, // 7 days total - 1 day already passed
          },
        });

        if (result.success) {
          // Mark reminder as sent
          restaurant.paymentReminderSentAt = new Date();
          await restaurant.save();
          sentCount++;

          logger.info(
            `Payment reminder sent to ${restaurant.email} for restaurant ${restaurant.name}`,
            {
              restaurantId: restaurant._id,
              email: restaurant.email,
              resumeUrl,
            }
          );
        } else {
          logger.error(`Failed to send payment reminder to ${restaurant.email}:`, result.error);
          errorCount++;
        }
      } catch (error) {
        logger.error(`Error processing restaurant ${restaurant._id}:`, error);
        errorCount++;
      }
    }

    logger.info('Payment reminder sending completed', {
      sentCount,
      errorCount,
      totalEligible: restaurants.length,
    });

    // Also log restaurants that were skipped (already received reminder)
    const alreadyReminded = await Restaurant.countDocuments({
      status: 'inactive',
      accountType: 'self-service',
      createdAt: { $gte: from, $lt: to },
      paymentReminderSentAt: { $exists: true },
    });

    logger.info(`${alreadyReminded} restaurants already received payment reminder`);
  } catch (error) {
    logger.error('Payment reminder script failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  sendPaymentReminders()
    .then(() => {
      logger.info('Payment reminder script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Payment reminder script failed:', error);
      process.exit(1);
    });
}

export { sendPaymentReminders };
