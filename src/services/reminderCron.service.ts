import mongoose from 'mongoose';
import Reservation from '../models/Reservation.model';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import { sendReminderEmail } from './emailService';
import logger from '../utils/logger';

const REMINDER_INTERVAL_MINUTES = 30;
const INACTIVE_CLEANUP_DAYS = 60;

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderCron(): void {
  logger.info(`📅 Reminder cron started (every ${REMINDER_INTERVAL_MINUTES} min)`);
  logger.info(`   Inactive cleanup: ${INACTIVE_CLEANUP_DAYS} days after cancellation`);

  const runReminders = async () => {
    try {
      await sendReservationReminders();
      await cleanupInactiveAccounts();
    } catch (err) {
      logger.error('❌ Reminder cron error:', err);
    }
  };

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

      await Reservation.updateOne(
        { _id: reservation._id },
        { $set: { reminderSent: true, reminderSentAt: new Date() } }
      );

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

      logger.info(`✅ Reminder sent to ${reservation.customerEmail} for ${restaurant.name}`);
    } catch (err) {
      logger.error(`❌ Failed to send reminder for reservation ${reservation._id}:`, err);
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
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await User.deleteMany({ restaurantId: restaurant._id }, { session });
        await Reservation.deleteMany({ restaurantId: restaurant._id }, { session });
        await Restaurant.deleteOne({ _id: restaurant._id }, { session });
      });
      logger.info(`🗑️  Deleted inactive restaurant: ${restaurant.name} (${restaurant._id})`);
    } catch (err: any) {
      if (err.errorLabels?.includes?.('TransientTransactionError')) {
        logger.warn(`Transaction retry failed for ${restaurant._id}, will retry next cron cycle`);
      } else {
        logger.error(`❌ Failed to cleanup restaurant ${restaurant._id}:`, err);
      }
    } finally {
      await session.endSession();
    }
  }
}
