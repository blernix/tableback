import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant.model';
import Closure from '../models/Closure.model';
import Reservation from '../models/Reservation.model';
import MenuCategory from '../models/MenuCategory.model';
import Dish from '../models/Dish.model';
import logger from '../utils/logger';
import { z } from 'zod';
import { uploadToGCS, deleteFromGCS } from '../config/storage.config';

// Validation schemas
const updateBasicInfoSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  address: z.string().min(1, 'Address is required').optional(),
  phone: z.string().min(1, 'Phone is required').optional(),
  email: z.string().email('Invalid email').optional(),
});

const timeSlotSchema = z.object({
  start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
});

const dayScheduleSchema = z.object({
  closed: z.boolean(),
  slots: z.array(timeSlotSchema),
});

const updateOpeningHoursSchema = z.object({
  monday: dayScheduleSchema.optional(),
  tuesday: dayScheduleSchema.optional(),
  wednesday: dayScheduleSchema.optional(),
  thursday: dayScheduleSchema.optional(),
  friday: dayScheduleSchema.optional(),
  saturday: dayScheduleSchema.optional(),
  sunday: dayScheduleSchema.optional(),
});

const createClosureSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  reason: z.string().optional(),
});

const switchMenuModeSchema = z.object({
  displayMode: z.enum(['pdf', 'detailed', 'both'], { errorMap: () => ({ message: 'Display mode must be pdf, detailed, or both' }) }),
});

const tableTypeSchema = z.object({
  type: z.string().min(1, 'Table type name is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
});

const updateTablesConfigSchema = z.object({
  mode: z.enum(['simple', 'detailed']).optional(),
  totalTables: z.number().int().min(1, 'At least 1 table is required').optional(),
  averageCapacity: z.number().int().min(1, 'Average capacity must be at least 1').optional(),
  tables: z.array(tableTypeSchema).optional(),
});

const updateReservationConfigSchema = z.object({
  defaultDuration: z.number().int().min(30, 'Duration must be at least 30 minutes').max(300, 'Duration cannot exceed 300 minutes').optional(),
  useOpeningHours: z.boolean().optional(),
  averagePrice: z.number().min(0, 'Average price must be non-negative').optional(),
});

// Get restaurant (for restaurant user)
export const getMyRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId).select('-__v');

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    res.status(200).json({ restaurant });
  } catch (error) {
    logger.error('Error fetching restaurant:', error);
    res.status(500).json({ error: { message: 'Failed to fetch restaurant' } });
  }
};

// Update basic information
export const updateBasicInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = updateBasicInfoSchema.parse(req.body);

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurantId,
      { $set: validatedData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    logger.info(`Restaurant basic info updated: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(200).json({ restaurant });
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

    logger.error('Error updating basic info:', error);
    res.status(500).json({ error: { message: 'Failed to update basic information' } });
  }
};

// Update opening hours
export const updateOpeningHours = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = updateOpeningHoursSchema.parse(req.body);

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurantId,
      { $set: { openingHours: validatedData } },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    logger.info(`Opening hours updated: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(200).json({ openingHours: restaurant.openingHours });
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

    logger.error('Error updating opening hours:', error);
    res.status(500).json({ error: { message: 'Failed to update opening hours' } });
  }
};

// Upload menu PDF
export const uploadMenuPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: { message: 'No file provided' } });
      return;
    }

    // Get current restaurant to check for existing PDF
    const restaurant = await Restaurant.findById(req.user.restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Delete old PDF from GCS if exists
    if (restaurant.menu.pdfUrl) {
      try {
        await deleteFromGCS(restaurant.menu.pdfUrl);
      } catch (error) {
        logger.warn('Failed to delete old PDF from GCS:', error);
        // Continue anyway - old file will remain but won't be referenced
      }
    }

    // Upload new PDF to GCS
    const pdfUrl = await uploadToGCS(req.file, 'menus');

    // Update restaurant with new PDF URL
    // Only switch to 'pdf' mode if currently in 'detailed' mode
    const updateData: any = {
      'menu.pdfUrl': pdfUrl,
    };

    if (restaurant.menu.displayMode === 'detailed') {
      updateData['menu.displayMode'] = 'pdf';
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurantId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updatedRestaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    logger.info(`Menu PDF uploaded for restaurant: ${updatedRestaurant.name} (ID: ${updatedRestaurant._id})`);

    res.status(200).json({
      message: 'Menu PDF uploaded successfully',
      menu: updatedRestaurant.menu,
    });
  } catch (error) {
    logger.error('Error uploading menu PDF:', error);
    res.status(500).json({ error: { message: 'Failed to upload menu PDF' } });
  }
};

// Switch menu display mode
export const switchMenuMode = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = switchMenuModeSchema.parse(req.body);

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurantId,
      {
        $set: { 'menu.displayMode': validatedData.displayMode },
      },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    logger.info(`Menu mode switched to ${validatedData.displayMode} for restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(200).json({
      message: 'Menu mode updated successfully',
      menu: restaurant.menu,
    });
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

    logger.error('Error switching menu mode:', error);
    res.status(500).json({ error: { message: 'Failed to switch menu mode' } });
  }
};

// Update tables configuration
export const updateTablesConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = updateTablesConfigSchema.parse(req.body);

    const updateData: any = {};

    if (validatedData.mode !== undefined) {
      updateData['tablesConfig.mode'] = validatedData.mode;
    }

    if (validatedData.totalTables !== undefined) {
      updateData['tablesConfig.totalTables'] = validatedData.totalTables;
    }

    if (validatedData.averageCapacity !== undefined) {
      updateData['tablesConfig.averageCapacity'] = validatedData.averageCapacity;
    }

    if (validatedData.tables !== undefined) {
      updateData['tablesConfig.tables'] = validatedData.tables;
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurantId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    logger.info(`Tables config updated for restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(200).json({
      message: 'Tables configuration updated successfully',
      tablesConfig: restaurant.tablesConfig,
    });
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

    logger.error('Error updating tables config:', error);
    res.status(500).json({ error: { message: 'Failed to update tables configuration' } });
  }
};

// Update reservation configuration
export const updateReservationConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = updateReservationConfigSchema.parse(req.body);

    const updateData: any = {};
    if (validatedData.defaultDuration !== undefined) {
      updateData['reservationConfig.defaultDuration'] = validatedData.defaultDuration;
    }
    if (validatedData.useOpeningHours !== undefined) {
      updateData['reservationConfig.useOpeningHours'] = validatedData.useOpeningHours;
    }
    if (validatedData.averagePrice !== undefined) {
      updateData['reservationConfig.averagePrice'] = validatedData.averagePrice;
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurantId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    logger.info(`Reservation config updated for restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(200).json({
      message: 'Reservation configuration updated successfully',
      reservationConfig: restaurant.reservationConfig,
    });
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

    logger.error('Error updating reservation config:', error);
    res.status(500).json({ error: { message: 'Failed to update reservation configuration' } });
  }
};

// Get all closures for restaurant
export const getClosures = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const closures = await Closure.find({ restaurantId: req.user.restaurantId })
      .sort({ startDate: 1 })
      .select('-__v');

    res.status(200).json({ closures });
  } catch (error) {
    logger.error('Error fetching closures:', error);
    res.status(500).json({ error: { message: 'Failed to fetch closures' } });
  }
};

// Create closure
export const createClosure = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = createClosureSchema.parse(req.body);

    const closure = new Closure({
      restaurantId: req.user.restaurantId,
      startDate: new Date(validatedData.startDate),
      endDate: validatedData.endDate
        ? new Date(validatedData.endDate)
        : new Date(validatedData.startDate),
      reason: validatedData.reason,
    });

    await closure.save();

    logger.info(`Closure created for restaurant ID: ${req.user.restaurantId}`);

    res.status(201).json({ closure });
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

    logger.error('Error creating closure:', error);
    res.status(500).json({ error: { message: 'Failed to create closure' } });
  }
};

// Delete closure
export const deleteClosure = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    const closure = await Closure.findOneAndDelete({
      _id: id,
      restaurantId: req.user.restaurantId, // Ensure user can only delete their own closures
    });

    if (!closure) {
      res.status(404).json({ error: { message: 'Closure not found' } });
      return;
    }

    logger.info(`Closure deleted: ID ${id}`);

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting closure:', error);
    res.status(500).json({ error: { message: 'Failed to delete closure' } });
  }
};

// Get dashboard stats
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const restaurantId = req.user.restaurantId;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this week's date range
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Today's reservations
    const todayReservations = await Reservation.find({
      restaurantId,
      date: { $gte: today, $lt: tomorrow },
      status: { $nin: ['cancelled'] },
    }).sort({ time: 1 });

    const todayGuests = todayReservations.reduce((sum, res) => sum + res.numberOfGuests, 0);

    // This week's reservations
    const weekReservationsData = await Reservation.find({
      restaurantId,
      date: { $gte: startOfWeek, $lt: endOfWeek },
      status: { $nin: ['cancelled'] },
    });

    const weekGuests = weekReservationsData.reduce((sum, res) => sum + res.numberOfGuests, 0);

    // Get restaurant for capacity calculation and average price
    const restaurant = await Restaurant.findById(restaurantId);

    let totalCapacity = 0;
    if (restaurant) {
      if (restaurant.tablesConfig.mode === 'detailed' && restaurant.tablesConfig.tables) {
        // Mode detailed: sum of (quantity * capacity) for each table type
        totalCapacity = restaurant.tablesConfig.tables.reduce(
          (sum, table) => sum + (table.quantity * table.capacity),
          0
        );
      } else if (restaurant.tablesConfig.totalTables && restaurant.tablesConfig.averageCapacity) {
        // Mode simple: totalTables * averageCapacity
        totalCapacity = restaurant.tablesConfig.totalTables * restaurant.tablesConfig.averageCapacity;
      }
    }

    const avgOccupation = totalCapacity > 0 && todayGuests > 0
      ? Math.round((todayGuests / totalCapacity) * 100)
      : 0;

    // Calculate estimated revenue
    const averagePrice = restaurant?.reservationConfig?.averagePrice || 0;
    const todayRevenue = todayGuests * averagePrice;
    const weekRevenue = weekGuests * averagePrice;

    // Menu stats
    const categoriesCount = await MenuCategory.countDocuments({ restaurantId });
    const dishesCount = await Dish.countDocuments({ restaurantId });

    res.json({
      today: {
        reservations: todayReservations.length,
        guests: todayGuests,
        estimatedRevenue: todayRevenue,
        upcomingReservations: todayReservations.slice(0, 5).map(r => ({
          _id: r._id,
          customerName: r.customerName,
          time: r.time,
          numberOfGuests: r.numberOfGuests,
          status: r.status,
        })),
      },
      thisWeek: {
        reservations: weekReservationsData.length,
        guests: weekGuests,
        estimatedRevenue: weekRevenue,
        avgOccupation,
      },
      menu: {
        categories: categoriesCount,
        dishes: dishesCount,
      },
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: { message: 'Failed to fetch dashboard stats' } });
  }
};

// Upload restaurant logo
export const uploadLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: { message: 'No image file provided' } });
      return;
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Delete old logo if exists
    if (restaurant.logoUrl) {
      try {
        await deleteFromGCS(restaurant.logoUrl);
      } catch (error) {
        logger.warn(`Failed to delete old logo: ${error}`);
      }
    }

    // Upload new logo to GCS
    const logoUrl = await uploadToGCS(req.file, 'uploads/logos');

    // Update restaurant with new logo URL
    restaurant.logoUrl = logoUrl;
    await restaurant.save();

    logger.info(`Restaurant logo uploaded: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(200).json({ restaurant });
  } catch (error) {
    logger.error('Error uploading restaurant logo:', error);
    res.status(500).json({ error: { message: 'Failed to upload restaurant logo' } });
  }
};

// Delete restaurant logo
export const deleteLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    if (!restaurant.logoUrl) {
      res.status(400).json({ error: { message: 'Restaurant has no logo to delete' } });
      return;
    }

    // Delete logo from GCS
    try {
      await deleteFromGCS(restaurant.logoUrl);
    } catch (error) {
      logger.error('Error deleting logo from GCS:', error);
      // Continue even if GCS delete fails
    }

    // Remove logo URL from restaurant
    restaurant.logoUrl = undefined;
    await restaurant.save();

    logger.info(`Restaurant logo deleted: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(200).json({ restaurant });
  } catch (error) {
    logger.error('Error deleting restaurant logo:', error);
    res.status(500).json({ error: { message: 'Failed to delete restaurant logo' } });
  }
};
