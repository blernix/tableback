import Reservation from '../models/Reservation.model';
import Restaurant from '../models/Restaurant.model';
import { sendReminderEmail } from './emailService';
import logger from '../utils/logger';

const REMINDER_INTERVAL_MINUTES = 30;

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderCron(): void {
  logger.info(`📅 Reminder cron started (every ${REMINDER_INTERVAL_MINUTES} min)`);

  const runReminders = async () => {
    try {
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

          if (!restaurant) {
            logger.warn(`Restaurant ${reservation.restaurantId} not found for reminder, skipping`);
            continue;
          }

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
