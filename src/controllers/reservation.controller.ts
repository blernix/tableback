import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Reservation from '../models/Reservation.model';
import DayBlock from '../models/DayBlock.model';
import Restaurant from '../models/Restaurant.model';
import logger from '../utils/logger';
import { z } from 'zod';
import {
  sendConfirmationEmail,
  sendDirectConfirmationEmail,
  sendPendingReservationEmail,
  sendReservationUpdateEmail,
} from '../services/emailService';

// Validation schemas
const createReservationSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').trim(),
  customerEmail: z.string().email('Invalid email').trim(),
  customerPhone: z.string().min(1, 'Phone is required').trim(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  numberOfGuests: z.number().int().min(1, 'At least 1 guest is required'),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  notes: z.string().trim().optional(),
  sendEmail: z.boolean().optional().default(true), // Default to true for backward compatibility
});

const updateReservationSchema = z.object({
  customerName: z.string().min(1).trim().optional(),
  customerEmail: z.string().email().trim().optional(),
  customerPhone: z.string().min(1).trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional(),
  numberOfGuests: z.number().int().min(1).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  notes: z.string().trim().optional(),
  sendEmail: z.boolean().optional().default(true), // Default to true for backward compatibility
});

// Get all reservations for restaurant
export const getReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { startDate, endDate, status } = req.query;

    interface ReservationFilter {
      restaurantId: Types.ObjectId;
      date?: { $gte: Date; $lte: Date };
      status?: string;
    }

    const filter: ReservationFilter = { restaurantId: req.user.restaurantId };

    // Filter by date range
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    // Filter by status
    if (status && typeof status === 'string') {
      filter.status = status;
    }

    const reservations = await Reservation.find(filter)
      .sort({ date: 1, time: 1 })
      .select('-__v');

    res.status(200).json({ reservations });
  } catch (error) {
    logger.error('Error fetching reservations:', error);
    res.status(500).json({ error: { message: 'Failed to fetch reservations' } });
  }
};

// Get single reservation
export const getReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    const reservation = await Reservation.findOne({
      _id: id,
      restaurantId: req.user.restaurantId,
    }).select('-__v');

    if (!reservation) {
      res.status(404).json({ error: { message: 'Reservation not found' } });
      return;
    }

    res.status(200).json({ reservation });
  } catch (error) {
    logger.error('Error fetching reservation:', error);
    res.status(500).json({ error: { message: 'Failed to fetch reservation' } });
  }
};

// Create reservation
export const createReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = createReservationSchema.parse(req.body);

    // Check if the date is blocked
    const isBlocked = await DayBlock.findOne({
      restaurantId: req.user.restaurantId,
      date: new Date(validatedData.date),
    });

    if (isBlocked) {
      res.status(400).json({
        error: {
          message: 'This date is blocked for reservations',
          reason: isBlocked.reason,
        },
      });
      return;
    }

    const reservation = new Reservation({
      restaurantId: req.user.restaurantId,
      customerName: validatedData.customerName,
      customerEmail: validatedData.customerEmail,
      customerPhone: validatedData.customerPhone,
      date: new Date(validatedData.date),
      time: validatedData.time,
      numberOfGuests: validatedData.numberOfGuests,
      status: validatedData.status || 'pending',
      notes: validatedData.notes || '',
    });

    await reservation.save();

    logger.info(`Reservation created for restaurant ID: ${req.user.restaurantId}, Customer: ${reservation.customerName}`);

    // Send email notifications (only if sendEmail is true)
    if (validatedData.sendEmail !== false) {
      try {
        const restaurant = await Restaurant.findById(req.user.restaurantId);
        if (restaurant) {
          const restaurantData = {
            _id: restaurant._id.toString(),
            name: restaurant.name,
            email: restaurant.email,
            phone: restaurant.phone,
          };

          const reservationData = {
            _id: reservation._id.toString(),
            customerName: reservation.customerName,
            customerEmail: reservation.customerEmail,
            customerPhone: reservation.customerPhone || '',
            date: reservation.date,
            time: reservation.time,
            partySize: reservation.numberOfGuests,
            restaurantId: restaurant._id.toString(),
            status: reservation.status,
            notes: reservation.notes || '',
          };

          // If restaurant creates reservation with confirmed status (phone reservation)
          if (reservation.status === 'confirmed') {
            await sendDirectConfirmationEmail(reservationData, restaurantData);
          } else if (reservation.status === 'pending') {
            // For pending reservations, send pending email
            await sendPendingReservationEmail(reservationData, restaurantData);
          }

          // Restaurant does NOT receive email when they create their own reservations
          // Only send email to customer
          logger.info(`Email notifications sent for reservation ${reservation._id}`);
        }
      } catch (emailError) {
        logger.error('Error sending reservation emails:', emailError);
        // Don't fail the request if email fails
      }
    } else {
      logger.info(`Email sending skipped for reservation ${reservation._id} (sendEmail=false)`);
    }

    res.status(201).json({ reservation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors
        }
      });
      return;
    }

    logger.error('Error creating reservation:', error);
    res.status(500).json({ error: { message: 'Failed to create reservation' } });
  }
};

// Update reservation
export const updateReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;
    const validatedData = updateReservationSchema.parse(req.body);

    // Check if the new date (if provided) is blocked
    if (validatedData.date) {
      const isBlocked = await DayBlock.findOne({
        restaurantId: req.user.restaurantId,
        date: new Date(validatedData.date),
      });

      if (isBlocked) {
        res.status(400).json({
          error: {
            message: 'This date is blocked for reservations',
            reason: isBlocked.reason,
          },
        });
        return;
      }
    }

    const updateData: any = { ...validatedData };
    if (validatedData.date) {
      updateData.date = new Date(validatedData.date);
    }

    const reservation = await Reservation.findOneAndUpdate(
      {
        _id: id,
        restaurantId: req.user.restaurantId,
      },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!reservation) {
      res.status(404).json({ error: { message: 'Reservation not found' } });
      return;
    }

    logger.info(`Reservation updated: ID ${id}`);

    // Send email notifications for status changes or date/time changes (only if sendEmail is true)
    if ((validatedData.status || validatedData.date || validatedData.time) && validatedData.sendEmail !== false) {
      try {
        const restaurant = await Restaurant.findById(req.user.restaurantId);
        if (restaurant) {
          const restaurantData = {
            _id: restaurant._id.toString(),
            name: restaurant.name,
            email: restaurant.email,
            phone: restaurant.phone,
          };

          const reservationData = {
            _id: reservation._id.toString(),
            customerName: reservation.customerName,
            customerEmail: reservation.customerEmail,
            customerPhone: reservation.customerPhone || '',
            date: reservation.date,
            time: reservation.time,
            partySize: reservation.numberOfGuests,
            restaurantId: restaurant._id.toString(),
            status: reservation.status,
            notes: reservation.notes || '',
          };

          // If status changed to confirmed, send confirmation email with cancellation link
          if (validatedData.status === 'confirmed' && reservation.status === 'confirmed') {
            await sendConfirmationEmail(reservationData, restaurantData);
          } else {
            // For other updates, use the new email system
            await sendReservationUpdateEmail(reservationData, restaurantData);
          }

          // Restaurant does NOT receive email when they update their own reservations
          // Only send email to customer
          logger.info(`Email notifications sent for reservation update ${id}`);
        }
      } catch (emailError) {
        logger.error('Error sending update emails:', emailError);
        // Don't fail the request if email fails
      }
    } else if (validatedData.sendEmail === false) {
      logger.info(`Email sending skipped for reservation update ${id} (sendEmail=false)`);
    }

    res.status(200).json({ reservation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors
        }
      });
      return;
    }

    logger.error('Error updating reservation:', error);
    res.status(500).json({ error: { message: 'Failed to update reservation' } });
  }
};

// Delete reservation
export const deleteReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    const reservation = await Reservation.findOneAndDelete({
      _id: id,
      restaurantId: req.user.restaurantId,
    });

    if (!reservation) {
      res.status(404).json({ error: { message: 'Reservation not found' } });
      return;
    }

    logger.info(`Reservation deleted: ID ${id}`);

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting reservation:', error);
    res.status(500).json({ error: { message: 'Failed to delete reservation' } });
  }
};
