import Reservation from '../models/Reservation.model';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import { sendReminderEmail, sendPaymentCompletionEmail } from './emailService';
import { createCheckoutSession } from './stripe.service';
import logger from '../utils/logger';

const REMINDER_INTERVAL_MINUTES = 30;
const PAYMENT_REMINDER_DELAY_DAYS = 2; // Send reminder 2 days after signup
const INACTIVE_CLEANUP_DAYS = 30; // Delete inactive accounts after 30 days

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderCron(): void {
  logger.info(`📅 Reminder cron started (every ${REMINDER_INTERVAL_MINUTES} min)`);
  logger.info(`   Payment reminders: ${PAYMENT_REMINDER_DELAY_DAYS} days after signup`);
  logger.info(`   Inactive cleanup: ${INACTIVE_CLEANUP_DAYS} days after signup`);

  const runReminders = async () => {
    try {
      await sendReservationReminders();
      await sendPaymentReminders();
      await cleanupInactiveAccounts();
    } catch (err) {
      logger.error('❌ Reminder cron error:', err);
    }
  };

  // Run immediately on startup, then every N minutes
  runReminders();
  reminderInterval = setInterval(runReminders, REMINDER_INTERVAL_MINUTES * 60 * 1000);
}

export function stopReminderCron(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    logger.info('📅 Reminder cron stopped');
  }
}

async function sendReservationReminders(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const reservations = await Reservation.find({
    date: {
      $gte: new Date(`${tomorrowStr}T00:00:00.000Z`),
      $lte: new Date(`${tomorrowStr}T23:59:59.999Z`),
    },
    status: { $in: ['confirmed', 'pending'] },
    reminderSent: false,
  }).lean();

  if (reservations.length === 0) return;

  logger.info(`📧 Found ${reservations.length} reservations to remind for ${tomorrowStr}`);

  const restaurantCache = new Map<string, any>();

  for (const reservation of reservations) {
    try {
      let restaurant = restaurantCache.get(reservation.restaurantId.toString());
      if (!restaurant) {
        restaurant = await Restaurant.findById(reservation.restaurantId).select('name email phone').lean();
        if (restaurant) restaurantCache.set(reservation.restaurantId.toString(), restaurant);
      }

      if (!restaurant) continue;

      await sendReminderEmail(
        {
          _id: reservation._id.toString(),
          customerName: reservation.customerName,
          customerEmail: reservation.customerEmail,
          customerPhone: reservation.customerPhone,
          date: reservation.date,
          time: reservation.time,
          partySize: reservation.numberOfGuests,
          restaurantId: reservation.restaurantId.toString(),
          status: reservation.status,
          notes: reservation.notes,
        },
        {
          _id: restaurant._id.toString(),
          name: restaurant.name,
          email: restaurant.email,
          phone: restaurant.phone,
        }
      );

      await Reservation.updateOne(
        { _id: reservation._id },
        { $set: { reminderSent: true, reminderSentAt: new Date() } }
      );

      logger.info(`✅ Reminder sent to ${reservation.customerEmail} for ${restaurant.name}`);
    } catch (err) {
      logger.error(`❌ Failed to send reminder for reservation ${reservation._id}:`, err);
    }
  }
}

async function sendPaymentReminders(): Promise<void> {
  const now = new Date();
  const reminderThreshold = new Date(now.getTime() - PAYMENT_REMINDER_DELAY_DAYS * 24 * 60 * 60 * 1000);

  const inactiveRestaurants = await Restaurant.find({
    status: 'inactive',
    accountType: 'self-service',
    createdAt: { $lte: reminderThreshold },
    paymentReminderSentAt: { $exists: false },
  }).lean();

  if (inactiveRestaurants.length === 0) return;

  logger.info(`💳 Found ${inactiveRestaurants.length} inactive restaurants needing payment reminder`);

  for (const restaurant of inactiveRestaurants) {
    try {
      const owner = await User.findOne({
        restaurantId: restaurant._id,
        role: 'restaurant',
        status: 'inactive',
      }).select('email').lean();

      if (!owner) continue;

      const checkoutSession = await createCheckoutSession({
        restaurantId: restaurant._id.toString(),
        plan: (restaurant as any).subscription?.plan || 'starter',
        email: owner.email,
        successUrl: `${process.env.FRONTEND_URL}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${process.env.FRONTEND_URL}/login`,
      });

      await sendPaymentCompletionEmail(
        { name: restaurant.name, email: owner.email },
        checkoutSession.url!,
        INACTIVE_CLEANUP_DAYS - PAYMENT_REMINDER_DELAY_DAYS
      );

      await Restaurant.updateOne(
        { _id: restaurant._id },
        { $set: { paymentReminderSentAt: new Date() } }
      );

      logger.info(`💌 Payment reminder sent to ${owner.email} for ${restaurant.name}`);
    } catch (err) {
      logger.error(`❌ Failed to send payment reminder for ${restaurant.name}:`, err);
    }
  }
}

async function cleanupInactiveAccounts(): Promise<void> {
  const now = new Date();
  const cleanupThreshold = new Date(now.getTime() - INACTIVE_CLEANUP_DAYS * 24 * 60 * 60 * 1000);

  const expiredRestaurants = await Restaurant.find({
    status: 'inactive',
    accountType: 'self-service',
    createdAt: { $lte: cleanupThreshold },
  }).lean();

  if (expiredRestaurants.length === 0) return;

  logger.info(`🗑️  Cleaning up ${expiredRestaurants.length} inactive restaurants (${INACTIVE_CLEANUP_DAYS}+ days)`);

  for (const restaurant of expiredRestaurants) {
    try {
      await User.deleteMany({ restaurantId: restaurant._id });
      await Restaurant.deleteOne({ _id: restaurant._id });
      logger.info(`🗑️  Deleted inactive restaurant: ${restaurant.name} (${restaurant._id})`);
    } catch (err) {
      logger.error(`❌ Failed to cleanup restaurant ${restaurant._id}:`, err);
    }
  }
}
