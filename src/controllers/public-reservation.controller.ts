import { Request, Response } from 'express';
import Reservation from '../models/Reservation.model';
import Restaurant from '../models/Restaurant.model';
import DayBlock from '../models/DayBlock.model';
import Closure from '../models/Closure.model';
import logger from '../utils/logger';
import { z } from 'zod';
import { validateReservationCancelToken } from '../services/tokenService';
import {
  sendCancellationConfirmationEmail,
  sendPendingReservationEmail,
  sendRestaurantNotificationEmail,
} from '../services/emailService';
import { sendPushNotificationToRestaurant } from '../services/pushNotificationService';
import { emitToRestaurant, createReservationEvent } from '../services/sseService';
import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';
import { sanitizeReservationInput } from '../utils/sanitize';

// Validation schema for public reservation creation with enhanced security
const createPublicReservationSchema = z
  .object({
    customerName: z
      .string()
      .min(2, 'Le nom doit contenir au moins 2 caractères')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères')
      .trim()
      .refine((val) => !/[<>{}]/g.test(val), {
        message: 'Le nom contient des caractères non autorisés',
      }),
    customerEmail: z
      .string()
      .email('Email invalide')
      .max(255, "L'email ne peut pas dépasser 255 caractères")
      .trim()
      .toLowerCase()
      .refine((val) => !/[<>{}]/g.test(val), {
        message: "L'email contient des caractères non autorisés",
      }),
    customerPhone: z
      .string()
      .min(10, 'Le numéro de téléphone doit contenir au moins 10 chiffres')
      .max(20, 'Le numéro de téléphone ne peut pas dépasser 20 caractères')
      .trim()
      .refine(
        (val) => /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(val),
        {
          message: 'Format de téléphone invalide',
        }
      ),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)')
      .refine(
        (val) => {
          const date = new Date(val);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date >= today;
        },
        {
          message: 'La date ne peut pas être dans le passé',
        }
      )
      .refine(
        (val) => {
          const date = new Date(val);
          const maxDate = new Date();
          maxDate.setMonth(maxDate.getMonth() + 6); // Maximum 6 months in advance
          return date <= maxDate;
        },
        {
          message: 'La date ne peut pas être plus de 6 mois dans le futur',
        }
      ),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format de temps invalide (HH:MM)'),
    numberOfGuests: z
      .number()
      .int()
      .min(1, 'Au moins 1 personne est requise')
      .max(20, 'Le nombre maximum de personnes est 20'),
    notes: z
      .string()
      .max(500, 'Les notes ne peuvent pas dépasser 500 caractères')
      .trim()
      .optional()
      .default(''),
    // Honeypot field for bot detection (should be empty)
    _honeypot: z.string().max(0, 'Invalid request').optional().default(''),
  })
  .strict(); // Reject any additional fields not in the schema

// Create a reservation (public endpoint)
export const createPublicReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;

    // Step 1: Sanitize all inputs to prevent XSS and injection attacks
    const sanitizedInput = sanitizeReservationInput(req.body);

    // Step 2: Check honeypot field - if filled, it's likely a bot
    if (sanitizedInput._honeypot && sanitizedInput._honeypot.length > 0) {
      logger.warn('Honeypot triggered - potential bot detected', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      // Return success to not alert the bot, but don't create reservation
      res.status(201).json({
        reservation: {
          message: 'Réservation enregistrée',
        },
      });
      return;
    }

    // Step 3: Validate sanitized data with Zod schema
    const validatedData = createPublicReservationSchema.parse(sanitizedInput);

    // Check if the date is blocked
    const isBlocked = await DayBlock.findOne({
      restaurantId: restaurant._id,
      date: new Date(validatedData.date),
    });

    if (isBlocked) {
      res.status(400).json({
        error: {
          message: 'This date is not available for reservations',
          reason: isBlocked.reason,
        },
      });
      return;
    }

    // Check if the date is in a closure period
    const requestedDate = new Date(validatedData.date);
    const closure = await Closure.findOne({
      restaurantId: restaurant._id,
      startDate: { $lte: requestedDate },
      endDate: { $gte: requestedDate },
    });

    if (closure) {
      res.status(400).json({
        error: {
          message: 'The restaurant is closed on this date',
          reason: closure.reason,
        },
      });
      return;
    }

    // Check opening hours for the requested day
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as
      | 'monday'
      | 'tuesday'
      | 'wednesday'
      | 'thursday'
      | 'friday'
      | 'saturday'
      | 'sunday';

    const daySchedule = restaurant.openingHours[dayOfWeek];

    if (daySchedule.closed) {
      res.status(400).json({
        error: {
          message: `The restaurant is closed on ${dayOfWeek}s`,
        },
      });
      return;
    }

    // Check if the requested time is within opening hours
    if (restaurant.reservationConfig.useOpeningHours && daySchedule.slots.length > 0) {
      const requestedTime = validatedData.time;
      let isWithinOpeningHours = false;

      for (const slot of daySchedule.slots) {
        if (requestedTime >= slot.start && requestedTime <= slot.end) {
          isWithinOpeningHours = true;
          break;
        }
      }

      if (!isWithinOpeningHours) {
        res.status(400).json({
          error: {
            message: 'The requested time is outside of opening hours',
            openingHours: daySchedule.slots,
          },
        });
        return;
      }
    }

    // Create the reservation with pending status
    const reservation = new Reservation({
      restaurantId: restaurant._id,
      customerName: validatedData.customerName,
      customerEmail: validatedData.customerEmail,
      customerPhone: validatedData.customerPhone,
      date: new Date(validatedData.date),
      time: validatedData.time,
      numberOfGuests: validatedData.numberOfGuests,
      status: 'pending',
      notes: validatedData.notes || '',
    });

    await reservation.save();

    // Increment reservation count for quota tracking (Starter plan)
    try {
      await restaurant.incrementReservationCount();
      logger.debug(`Reservation count incremented for restaurant: ${restaurant.name}`);
    } catch (quotaError) {
      logger.error('Error incrementing reservation count:', quotaError);
      // Don't fail the request if quota increment fails
    }

    logger.info(`Public reservation created for restaurant: ${restaurant.name}, Customer: ${reservation.customerName}`);

    // Send SSE event for real-time dashboard updates
    try {
      const event = createReservationEvent('reservation_created', reservation, restaurant._id);
      emitToRestaurant(restaurant._id, event);
      logger.debug(`SSE event emitted: reservation_created for reservation ${reservation._id}`);
    } catch (sseError) {
      logger.error('Error emitting SSE event:', sseError);
      // Don't fail the request if SSE fails
    }

    // Send email notifications
    try {
      // Send confirmation to customer
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

      const restaurantData = {
        _id: restaurant._id.toString(),
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
      };

      await sendPendingReservationEmail(reservationData, restaurantData);

      // Send notification to restaurant
      await sendRestaurantNotificationEmail(reservationData, restaurantData, 'created');
      
      // Send push notification to restaurant users
      await sendPushNotificationToRestaurant(
        restaurant._id,
        {
          title: 'Nouvelle réservation',
          body: `Nouvelle réservation de ${reservationData.customerName} pour ${reservationData.date} à ${reservationData.time}`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          data: {
            reservationId: reservationData._id,
            type: 'reservation_created',
            url: `/reservations/${reservationData._id}`,
          },
          tag: `reservation-${reservationData._id}`,
        },
        'reservation_created'
      );
    } catch (emailError) {
      logger.error('Error sending reservation emails:', emailError);
    }

    res.status(201).json({
      reservation: {
        _id: reservation._id,
        customerName: reservation.customerName,
        customerEmail: reservation.customerEmail,
        customerPhone: reservation.customerPhone,
        date: reservation.date,
        time: reservation.time,
        numberOfGuests: reservation.numberOfGuests,
        status: reservation.status,
        notes: reservation.notes,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error creating public reservation:', error);
    res.status(500).json({ error: { message: 'Failed to create reservation' } });
  }
};

// Check availability for a specific date
export const checkAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;
    const { date } = req.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({
        error: {
          message: 'Invalid date format. Use YYYY-MM-DD',
        },
      });
      return;
    }

    const requestedDate = new Date(date);

    // Check if the date is blocked
    const dayBlock = await DayBlock.findOne({
      restaurantId: restaurant._id,
      date: requestedDate,
    });

    if (dayBlock) {
      res.json({
        available: false,
        reason: 'blocked',
        message: dayBlock.reason || 'This date is blocked',
      });
      return;
    }

    // Check if the date is in a closure period
    const closure = await Closure.findOne({
      restaurantId: restaurant._id,
      startDate: { $lte: requestedDate },
      endDate: { $gte: requestedDate },
    });

    if (closure) {
      res.json({
        available: false,
        reason: 'closed',
        message: closure.reason || 'Restaurant is closed',
      });
      return;
    }

    // Check opening hours
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as
      | 'monday'
      | 'tuesday'
      | 'wednesday'
      | 'thursday'
      | 'friday'
      | 'saturday'
      | 'sunday';

    const daySchedule = restaurant.openingHours[dayOfWeek];

    if (daySchedule.closed) {
      res.json({
        available: false,
        reason: 'closed',
        message: `Restaurant is closed on ${dayOfWeek}s`,
      });
      return;
    }

    // Get existing reservations for the date
    const existingReservations = await Reservation.countDocuments({
      restaurantId: restaurant._id,
      date: requestedDate,
      status: { $nin: ['cancelled'] },
    });

    res.json({
      available: true,
      openingHours: daySchedule.slots,
      existingReservations,
      defaultDuration: restaurant.reservationConfig.defaultDuration,
    });
  } catch (error) {
    logger.error('Error checking availability:', error);
    res.status(500).json({ error: { message: 'Failed to check availability' } });
  }
};

// Get available time slots for a date
export const getAvailableTimeSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;
    const { date } = req.params;


    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({
        error: {
          message: 'Invalid date format. Use YYYY-MM-DD',
        },
      });
      return;
    }

    const requestedDate = new Date(date);

    // Check if date is available using checkAvailability logic
    const dayBlock = await DayBlock.findOne({
      restaurantId: restaurant._id,
      date: requestedDate,
    });

    if (dayBlock) {
      res.json({
        available: false,
        slots: [],
        reason: 'Date is blocked',
      });
      return;
    }

    const closure = await Closure.findOne({
      restaurantId: restaurant._id,
      startDate: { $lte: requestedDate },
      endDate: { $gte: requestedDate },
    });

    if (closure) {
      res.json({
        available: false,
        slots: [],
        reason: 'Restaurant is closed',
      });
      return;
    }

    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as
      | 'monday'
      | 'tuesday'
      | 'wednesday'
      | 'thursday'
      | 'friday'
      | 'saturday'
      | 'sunday';

    const daySchedule = restaurant.openingHours[dayOfWeek];

    if (daySchedule.closed) {
      res.json({
        available: false,
        slots: [],
        reason: 'Restaurant is closed on this day',
      });
      return;
    }

    // Generate time slots based on opening hours
    const slots: string[] = [];

    for (const period of daySchedule.slots) {
      const [startHour, startMinute] = period.start.split(':').map(Number);
      const [endHour, endMinute] = period.end.split(':').map(Number);

      let currentHour = startHour;
      let currentMinute = startMinute;

      while (
        currentHour < endHour ||
        (currentHour === endHour && currentMinute <= endMinute - restaurant.reservationConfig.defaultDuration)
      ) {
        const timeSlot = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        slots.push(timeSlot);

        // Increment by 30 minutes
        currentMinute += 30;
        if (currentMinute >= 60) {
          currentHour += 1;
          currentMinute -= 60;
        }
      }
    }

    // Get existing reservations for the date
    const existingReservations = await Reservation.find({
      restaurantId: restaurant._id,
      date: requestedDate,
      status: { $nin: ['cancelled'] },
    }).select('time numberOfGuests');

    res.json({
      available: true,
      slots,
      existingReservations: existingReservations.map(r => ({
        time: r.time,
        numberOfGuests: r.numberOfGuests,
      })),
      config: {
        defaultDuration: restaurant.reservationConfig.defaultDuration,
        totalTables: restaurant.tablesConfig.totalTables,
        averageCapacity: restaurant.tablesConfig.averageCapacity,
      },
    });
  } catch (error) {
    logger.error('Error getting available time slots:', error);
    res.status(500).json({ error: { message: 'Failed to get available time slots' } });
  }
};

// Get restaurant information (public)
export const getRestaurantInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;

    res.json({
      restaurant: {
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        openingHours: restaurant.openingHours,
        reservationConfig: restaurant.reservationConfig,
        tablesConfig: {
          totalTables: restaurant.tablesConfig.totalTables,
          averageCapacity: restaurant.tablesConfig.averageCapacity,
        },
        widgetConfig: restaurant.widgetConfig || {
          primaryColor: '#0066FF',
          secondaryColor: '#2A2A2A',
          fontFamily: 'system-ui, sans-serif',
          borderRadius: '4px',
        },
      },
    });
  } catch (error) {
    logger.error('Error getting restaurant info:', error);
    res.status(500).json({ error: { message: 'Failed to get restaurant information' } });
  }
};

// Get widget configuration only (lightweight endpoint for widget)
export const getWidgetConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;

    res.json({
      widgetConfig: {
        // Form colors (affecte le formulaire)
        primaryColor: restaurant.widgetConfig?.primaryColor || '#0066FF',
        secondaryColor: restaurant.widgetConfig?.secondaryColor || '#2A2A2A',
        fontFamily: restaurant.widgetConfig?.fontFamily || 'system-ui, sans-serif',
        borderRadius: restaurant.widgetConfig?.borderRadius || '4px',
        
        // Button specific colors (bouton flottant uniquement)
        buttonBackgroundColor: restaurant.widgetConfig?.buttonBackgroundColor || restaurant.widgetConfig?.primaryColor || '#0066FF',
        buttonTextColor: restaurant.widgetConfig?.buttonTextColor || '#FFFFFF',
        buttonHoverColor: restaurant.widgetConfig?.buttonHoverColor || '#0052CC',
        
        // Floating button general configs
        buttonText: restaurant.widgetConfig?.buttonText || 'Réserver une table',
        buttonStyle: restaurant.widgetConfig?.buttonStyle || 'round',
        buttonPosition: restaurant.widgetConfig?.buttonPosition || 'bottom-right',
        buttonIcon: restaurant.widgetConfig?.buttonIcon !== false, // default false now
        modalWidth: restaurant.widgetConfig?.modalWidth || '500px',
        modalHeight: restaurant.widgetConfig?.modalHeight || '600px',
      },
    });
  } catch (error) {
    logger.error('Error getting widget config:', error);
    res.status(500).json({ error: { message: 'Failed to get widget configuration' } });
  }
};

// Cancel reservation via email link (public endpoint with token)
export const cancelReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        error: { message: 'Cancellation token is required' },
      });
      return;
    }

    // Validate the cancellation token
    const tokenValidation = validateReservationCancelToken(token);

    if (!tokenValidation.valid) {
      res.status(400).json({
        error: {
          message: tokenValidation.error || 'Invalid or expired cancellation token',
        },
      });
      return;
    }

    // Find reservation by ID from token
    const reservation = await Reservation.findById(tokenValidation.data!.reservationId);

    if (!reservation) {
      res.status(404).json({ error: { message: 'Reservation not found' } });
      return;
    }

    // Verify restaurantId matches token
    if (reservation.restaurantId.toString() !== tokenValidation.data!.restaurantId) {
      res.status(400).json({ error: { message: 'Invalid cancellation token for this restaurant' } });
      return;
    }

    // Check if reservation is already cancelled
    if (reservation.status === 'cancelled') {
      res.status(400).json({
        error: { message: 'This reservation has already been cancelled' },
      });
      return;
    }

    // Get restaurant information for the email
    const restaurant = await Restaurant.findById(reservation.restaurantId);

    if (!restaurant) {
      logger.error(`Restaurant not found for reservation ${reservation._id}`);
      res.status(500).json({ error: { message: 'Failed to process cancellation' } });
      return;
    }

    // Check if reservation can be cancelled (not in the past)
    // Use restaurant's timezone for accurate comparison
    const restaurantTimezone = restaurant.timezone || 'Europe/Paris';
    const now = toZonedTime(new Date(), restaurantTimezone);

    // Combine date and time in the restaurant's timezone
    const reservationDateStr = format(reservation.date, 'yyyy-MM-dd', { timeZone: 'UTC' });
    const reservationDateTimeStr = `${reservationDateStr}T${reservation.time}:00`;
    const reservationDateTime = fromZonedTime(reservationDateTimeStr, restaurantTimezone);
    const reservationDateTimeInTz = toZonedTime(reservationDateTime, restaurantTimezone);

    if (reservationDateTimeInTz < now) {
      res.status(400).json({
        error: { message: 'Cannot cancel a reservation that has already passed' },
      });
      return;
    }

    // Update reservation status to cancelled
    reservation.status = 'cancelled';
    await reservation.save();

    logger.info(`Reservation cancelled: ${reservation._id} for customer ${reservation.customerName}`);

    // Send cancellation confirmation email to customer
    try {
      const reservationData = {
        _id: reservation._id.toString(),
        customerName: reservation.customerName,
        customerEmail: reservation.customerEmail,
        customerPhone: reservation.customerPhone || '',
        date: reservation.date,
        time: reservation.time,
        partySize: reservation.numberOfGuests,
        restaurantId: reservation.restaurantId.toString(),
        status: 'cancelled' as const,
        notes: reservation.notes || '',
      };

      const restaurantData = {
        _id: restaurant._id.toString(),
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
      };

      await sendCancellationConfirmationEmail(reservationData, restaurantData);
      
      // Send notification to restaurant (added per user request)
      await sendRestaurantNotificationEmail(reservationData, restaurantData, 'cancelled');
    } catch (emailError) {
      logger.error('Error sending cancellation confirmation email:', emailError);
      // Don't fail the cancellation if email fails
    }

    // Return HTML response for better UX
    const htmlResponse = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réservation annulée - TableMaster</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background-color: #f3f4f6;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 500px;
      text-align: center;
    }
    .success-icon {
      font-size: 64px;
      color: #10b981;
      margin-bottom: 20px;
    }
    h1 {
      color: #1f2937;
      margin-bottom: 16px;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .reservation-details {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      margin: 24px 0;
      text-align: left;
    }
    .reservation-details p {
      margin: 8px 0;
      color: #374151;
    }
    .reservation-details strong {
      color: #1f2937;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1>Réservation annulée</h1>
    <p>Votre réservation a été annulée avec succès.</p>

    <div class="reservation-details">
      <p><strong>Restaurant:</strong> ${restaurant.name}</p>
      <p><strong>Date:</strong> ${new Date(reservation.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}</p>
      <p><strong>Heure:</strong> ${reservation.time}</p>
      <p><strong>Nombre de personnes:</strong> ${reservation.numberOfGuests}</p>
    </p>

    <p>Un email de confirmation vous a été envoyé.</p>
    <p>Nous espérons vous revoir bientôt !</p>
  </div>
</body>
</html>
    `;

    res.status(200).send(htmlResponse);
  } catch (error) {
    logger.error('Error cancelling reservation:', error);
    res.status(500).json({ error: { message: 'Failed to cancel reservation' } });
  }
};

// Get upcoming closures (DayBlocks and Closures) for the next N days
export const getUpcomingClosures = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = req.restaurant!;
    const days = parseInt(req.query.days as string) || 30; // Default to 30 days

    // Limit to maximum 90 days to prevent abuse
    const maxDays = Math.min(days, 90);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + maxDays);

    // Fetch all DayBlocks within the range
    const dayBlocks = await DayBlock.find({
      restaurantId: restaurant._id,
      date: {
        $gte: today,
        $lte: endDate,
      },
    })
      .sort({ date: 1 })
      .select('date reason');

    // Fetch all Closures that overlap with the range
    const closures = await Closure.find({
      restaurantId: restaurant._id,
      $or: [
        // Closure starts within range
        {
          startDate: { $gte: today, $lte: endDate },
        },
        // Closure ends within range
        {
          endDate: { $gte: today, $lte: endDate },
        },
        // Closure spans the entire range
        {
          startDate: { $lte: today },
          endDate: { $gte: endDate },
        },
      ],
    })
      .sort({ startDate: 1 })
      .select('startDate endDate reason');

    // Format the response
    const upcomingClosures = [
      // Add DayBlocks
      ...dayBlocks.map(block => ({
        type: 'dayblock' as const,
        date: block.date.toISOString().split('T')[0],
        message: block.reason || 'Jour bloqué',
      })),
      // Add Closures
      ...closures.map(closure => ({
        type: 'closure' as const,
        startDate: closure.startDate.toISOString().split('T')[0],
        endDate: closure.endDate.toISOString().split('T')[0],
        message: closure.reason || 'Fermeture exceptionnelle',
      })),
    ];

    res.json({
      closures: upcomingClosures,
    });

    logger.info(`Upcoming closures fetched for restaurant: ${restaurant.name} (${maxDays} days)`);
  } catch (error) {
    logger.error('Error getting upcoming closures:', error);
    res.status(500).json({ error: { message: 'Failed to get upcoming closures' } });
  }
};
