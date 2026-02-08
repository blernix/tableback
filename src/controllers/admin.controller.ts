import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import Reservation from '../models/Reservation.model';
import NotificationAnalytics from '../models/NotificationAnalytics.model';
import MenuCategory from '../models/MenuCategory.model';
import Dish from '../models/Dish.model';
import DayBlock from '../models/DayBlock.model';
import Closure from '../models/Closure.model';
import PushSubscription from '../models/PushSubscription.model';
import NotificationPreferences from '../models/NotificationPreferences.model';
import SubscriptionHistory from '../models/SubscriptionHistory.model';
import logger from '../utils/logger';
import { z } from 'zod';
import { getRestaurantNotificationAnalytics, getNotificationDeliveryRate } from '../services/notificationAnalyticsService';

// Validation schemas
const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email'),
  tablesConfig: z.object({
    totalTables: z.number().min(1).optional(),
    averageCapacity: z.number().min(1).optional(),
  }).optional(),
});

const updateRestaurantSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  tablesConfig: z.object({
    totalTables: z.number().min(1).optional(),
    averageCapacity: z.number().min(1).optional(),
  }).optional(),
});

const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Get all restaurants with pagination
export const getRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const requestedLimit = parseInt(req.query.limit as string) || 20;
    // Enforce maximum limit to prevent DoS attacks
    const MAX_LIMIT = 100;
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const restaurants = await Restaurant.find()
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Restaurant.countDocuments();
    const pages = Math.ceil(total / limit);

    res.status(200).json({
      restaurants,
      pagination: {
        total,
        page,
        pages,
        limit,
      },
    });
  } catch (error) {
    logger.error('Error fetching restaurants:', error);
    res.status(500).json({ error: { message: 'Failed to fetch restaurants' } });
  }
};

// Create new restaurant
export const createRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createRestaurantSchema.parse(req.body);

    const restaurant = new Restaurant(validatedData);
    await restaurant.save();

    logger.info(`Restaurant created: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(201).json({
      restaurant,
      apiKey: restaurant.apiKey,
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

    logger.error('Error creating restaurant:', error);
    res.status(500).json({ error: { message: 'Failed to create restaurant' } });
  }
};

// Get restaurant by ID
export const getRestaurantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id).select('-__v');

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

// Update restaurant
export const updateRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateRestaurantSchema.parse(req.body);

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: validatedData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    logger.info(`Restaurant updated: ${restaurant.name} (ID: ${restaurant._id})`);

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

    logger.error('Error updating restaurant:', error);
    res.status(500).json({ error: { message: 'Failed to update restaurant' } });
  }
};

// Delete restaurant
export const deleteRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if restaurant exists first
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    const restaurantName = restaurant.name;
    const restaurantId = restaurant._id;

    logger.info(`Starting deletion of restaurant: ${restaurantName} (ID: ${restaurantId})`);

    // Delete all associated data in parallel for better performance
    const deletionPromises = [
      // Delete all users associated with this restaurant
      User.deleteMany({ restaurantId: restaurantId }),

      // Delete all reservations
      Reservation.deleteMany({ restaurantId: restaurantId }),

      // Delete all menu categories and dishes
      MenuCategory.deleteMany({ restaurantId: restaurantId }),
      Dish.deleteMany({ restaurantId: restaurantId }),

      // Delete all day blocks and closures
      DayBlock.deleteMany({ restaurantId: restaurantId }),
      Closure.deleteMany({ restaurantId: restaurantId }),

      // Delete all push subscriptions
      PushSubscription.deleteMany({ restaurantId: restaurantId }),

      // Delete notification preferences and analytics
      NotificationPreferences.deleteMany({ restaurantId: restaurantId }),
      NotificationAnalytics.deleteMany({ restaurantId: restaurantId }),

      // Delete subscription history
      SubscriptionHistory.deleteMany({ restaurantId: restaurantId }),
    ];

    // Execute all deletions in parallel
    const results = await Promise.all(deletionPromises);

    // Log deletion counts
    logger.info(`Deleted associated data for restaurant ${restaurantName}:`, {
      users: results[0].deletedCount,
      reservations: results[1].deletedCount,
      menuCategories: results[2].deletedCount,
      dishes: results[3].deletedCount,
      dayBlocks: results[4].deletedCount,
      closures: results[5].deletedCount,
      pushSubscriptions: results[6].deletedCount,
      notificationPreferences: results[7].deletedCount,
      notificationAnalytics: results[8].deletedCount,
      subscriptionHistory: results[9].deletedCount,
    });

    // Finally, delete the restaurant itself
    await Restaurant.findByIdAndDelete(id);

    logger.info(`Restaurant and all associated data deleted successfully: ${restaurantName} (ID: ${restaurantId})`);

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting restaurant:', error);
    res.status(500).json({ error: { message: 'Failed to delete restaurant' } });
  }
};

// Regenerate API key
export const regenerateApiKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    const newApiKey = restaurant.generateApiKey();
    await restaurant.save();

    logger.info(`API key regenerated for restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    res.status(200).json({ apiKey: newApiKey });
  } catch (error) {
    logger.error('Error regenerating API key:', error);
    res.status(500).json({ error: { message: 'Failed to regenerate API key' } });
  }
};

// Create user for restaurant
export const createRestaurantUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const validatedData = createUserSchema.parse(req.body);

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      res.status(409).json({ error: { message: 'User already exists with this email' } });
      return;
    }

    // Create user
    const user = new User({
      email: validatedData.email,
      password: validatedData.password,
      role: 'restaurant',
      restaurantId: restaurant._id,
    });

    await user.save();

    logger.info(`User created for restaurant ${restaurant.name}: ${user.email}`);

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
      },
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

    logger.error('Error creating restaurant user:', error);
    res.status(500).json({ error: { message: 'Failed to create user' } });
  }
};

// Get all users for a restaurant
export const getRestaurantUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Get all users associated with this restaurant
    const users = await User.find({
      restaurantId: restaurant._id,
      role: { $in: ['restaurant', 'server'] }
    })
      .select('-password -__v')
      .sort({ createdAt: -1 });

    res.status(200).json({
      users: users.map(user => ({
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        restaurantId: user.restaurantId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }))
    });
  } catch (error) {
    logger.error('Error fetching restaurant users:', error);
    res.status(500).json({ error: { message: 'Failed to fetch restaurant users' } });
  }
};

// Update a user (restaurant or server)
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const validatedData = createUserSchema.partial().parse(req.body); // Use partial schema for updates

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    // Check if user belongs to a restaurant (not admin)
    if (!user.restaurantId) {
      res.status(400).json({ error: { message: 'Cannot update admin user' } });
      return;
    }

    // Update fields
    if (validatedData.email) user.email = validatedData.email;
    if (validatedData.password) user.password = validatedData.password;

    await user.save();

    logger.info(`User updated: ${user.email} (ID: ${user._id})`);

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        restaurantId: user.restaurantId,
        updatedAt: user.updatedAt,
      },
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

    logger.error('Error updating user:', error);
    res.status(500).json({ error: { message: 'Failed to update user' } });
  }
};

// Delete a user (restaurant or server)
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found' } });
      return;
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      res.status(400).json({ error: { message: 'Cannot delete admin user' } });
      return;
    }

    await User.findByIdAndDelete(userId);

    logger.info(`User deleted: ${user.email} (ID: ${user._id})`);

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: { message: 'Failed to delete user' } });
  }
};

// Get admin dashboard statistics
export const getAdminDashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Optimize: Count restaurants by status in a single aggregation
    const restaurantStats = await Restaurant.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const activeRestaurants = restaurantStats.find(s => s._id === 'active')?.count || 0;
    const inactiveRestaurants = restaurantStats.find(s => s._id === 'inactive')?.count || 0;

    // Count restaurants by account type (manual vs self-service)
    const accountTypeStats = await Restaurant.aggregate([
      {
        $group: {
          _id: '$accountType',
          count: { $sum: 1 }
        }
      }
    ]);

    const managedRestaurants = accountTypeStats.find(s => s._id === 'managed')?.count || 0;
    const selfServiceRestaurants = accountTypeStats.find(s => s._id === 'self-service')?.count || 0;

    // Count self-service restaurants by subscription plan
    const subscriptionPlanStats = await Restaurant.aggregate([
      {
        $match: {
          accountType: 'self-service'
        }
      },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      }
    ]);

    const starterPlanCount = subscriptionPlanStats.find(s => s._id === 'starter')?.count || 0;
    const proPlanCount = subscriptionPlanStats.find(s => s._id === 'pro')?.count || 0;

    // Count by subscription status
    const subscriptionStatusStats = await Restaurant.aggregate([
      {
        $match: {
          accountType: 'self-service'
        }
      },
      {
        $group: {
          _id: '$subscription.status',
          count: { $sum: 1 }
        }
      }
    ]);

    const activeSubscriptions = subscriptionStatusStats.find(s => s._id === 'active')?.count || 0;
    const trialSubscriptions = subscriptionStatusStats.find(s => s._id === 'trial')?.count || 0;
    const pastDueSubscriptions = subscriptionStatusStats.find(s => s._id === 'past_due')?.count || 0;
    const cancelledSubscriptions = subscriptionStatusStats.find(s => s._id === 'cancelled')?.count || 0;

    // Calculate MRR (Monthly Recurring Revenue)
    // Only count active subscriptions
    const activeStarterRestaurants = await Restaurant.countDocuments({
      accountType: 'self-service',
      'subscription.plan': 'starter',
      'subscription.status': 'active'
    });

    const activeProRestaurants = await Restaurant.countDocuments({
      accountType: 'self-service',
      'subscription.plan': 'pro',
      'subscription.status': 'active'
    });

    const mrr = (activeStarterRestaurants * 39) + (activeProRestaurants * 69);

    // Optimize: Count users by role in a single aggregation
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const adminUsers = userStats.find(s => s._id === 'admin')?.count || 0;
    const restaurantUsers = userStats.find(s => s._id === 'restaurant')?.count || 0;
    const serverUsers = userStats.find(s => s._id === 'server')?.count || 0;

    // Recent reservations (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentReservations = await Reservation.countDocuments({
      createdAt: { $gte: oneWeekAgo },
      status: { $nin: ['cancelled'] }
    });

    // Total reservations (all time, excluding cancelled)
    const totalReservations = await Reservation.countDocuments({
      status: { $nin: ['cancelled'] }
    });

    // Reservations this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthlyReservations = await Reservation.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      status: { $nin: ['cancelled'] }
    });

    // Recent restaurants (last 30 days)
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const recentRestaurants = await Restaurant.countDocuments({
      createdAt: { $gte: oneMonthAgo }
    });

    // Top 5 restaurants by reservation count (last 30 days)
    const topRestaurants = await Reservation.aggregate([
      {
        $match: {
          createdAt: { $gte: oneMonthAgo },
          status: { $nin: ['cancelled'] }
        }
      },
      {
        $group: {
          _id: '$restaurantId',
          reservationCount: { $sum: 1 }
        }
      },
      {
        $sort: { reservationCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: '$restaurant'
      },
      {
        $project: {
          restaurantId: '$_id',
          restaurantName: '$restaurant.name',
          reservationCount: 1,
          accountType: '$restaurant.accountType',
          subscriptionPlan: '$restaurant.subscription.plan',
          _id: 0
        }
      }
    ]);

    // Get quota usage for Starter plan restaurants
    const starterRestaurants = await Restaurant.find({
      accountType: 'self-service',
      'subscription.plan': 'starter',
      'subscription.status': 'active'
    }).select('name reservationQuota');

    const quotaUsage = starterRestaurants.map(r => ({
      restaurantName: r.name,
      current: r.reservationQuota?.monthlyCount || 0,
      limit: r.reservationQuota?.limit || 50,
      percentage: r.getReservationQuotaInfo().percentage
    }));

    const averageQuotaUsage = quotaUsage.length > 0
      ? Math.round(quotaUsage.reduce((sum, q) => sum + q.percentage, 0) / quotaUsage.length)
      : 0;

    res.status(200).json({
      stats: {
        restaurants: {
          total: activeRestaurants + inactiveRestaurants,
          active: activeRestaurants,
          inactive: inactiveRestaurants,
          recent: recentRestaurants,
          byAccountType: {
            managed: managedRestaurants,
            selfService: selfServiceRestaurants
          }
        },
        subscriptions: {
          byPlan: {
            starter: starterPlanCount,
            pro: proPlanCount
          },
          byStatus: {
            active: activeSubscriptions,
            trial: trialSubscriptions,
            pastDue: pastDueSubscriptions,
            cancelled: cancelledSubscriptions
          },
          activeSubscriptions: activeStarterRestaurants + activeProRestaurants
        },
        revenue: {
          mrr: mrr,
          breakdown: {
            starter: activeStarterRestaurants * 39,
            pro: activeProRestaurants * 69
          },
          activeStarterCount: activeStarterRestaurants,
          activeProCount: activeProRestaurants
        },
        users: {
          total: adminUsers + restaurantUsers + serverUsers,
          admin: adminUsers,
          restaurant: restaurantUsers,
          server: serverUsers
        },
        reservations: {
          total: totalReservations,
          thisMonth: monthlyReservations,
          recent: recentReservations,
          averageQuotaUsage: averageQuotaUsage
        },
        topRestaurants
      }
    });
  } catch (error) {
    logger.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ error: { message: 'Failed to fetch dashboard statistics' } });
  }
};

// Get restaurant analytics
export const getRestaurantAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { period = '30d', startDate: startDateParam, endDate: endDateParam } = req.query;

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Calculate date range based on period or custom dates
    let startDate: Date;
    let endDate: Date;
    
    if (startDateParam && endDateParam) {
      // Use custom dates
      startDate = new Date(startDateParam as string);
      endDate = new Date(endDateParam as string);
      
      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({ error: { message: 'Invalid date format' } });
        return;
      }
      
      // Ensure endDate is after startDate
      if (endDate < startDate) {
        res.status(400).json({ error: { message: 'End date must be after start date' } });
        return;
      }
    } else {
      // Use period-based date range
      endDate = new Date();
      startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }
    }

    // Get all reservations for the period (including cancelled for status distribution)
    const allReservations = await Reservation.find({
      restaurantId: id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Filter non-cancelled reservations for main stats
    const reservations = allReservations.filter(r => r.status !== 'cancelled');

    // Calculate daily stats
    const dailyStatsMap = new Map<string, { date: string; reservations: number; guests: number; revenue: number }>();
    
    reservations.forEach(reservation => {
      const dateStr = reservation.date.toISOString().split('T')[0];
      const existing = dailyStatsMap.get(dateStr) || { date: dateStr, reservations: 0, guests: 0, revenue: 0 };
      
      existing.reservations += 1;
      existing.guests += reservation.numberOfGuests;
      
      // Calculate estimated revenue if averagePrice is set
      const averagePrice = restaurant.reservationConfig.averagePrice || 0;
      existing.revenue += averagePrice * reservation.numberOfGuests;
      
      dailyStatsMap.set(dateStr, existing);
    });

    // Convert to array and fill missing dates
    const dailyStats = Array.from(dailyStatsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate summary stats
    const totalReservations = reservations.length;
    const totalGuests = reservations.reduce((sum, r) => sum + r.numberOfGuests, 0);
    const averageGuestsPerReservation = totalReservations > 0 ? totalGuests / totalReservations : 0;
    
    // Calculate occupation rate (simplified: based on total tables capacity)
    const totalTables = restaurant.tablesConfig.totalTables || 10;
    const averageCapacity = restaurant.tablesConfig.averageCapacity || 4;
    const totalPotentialCovers = totalTables * averageCapacity * dailyStats.length;
    const occupationRate = totalPotentialCovers > 0 ? (totalGuests / totalPotentialCovers) * 100 : 0;

    // Calculate estimated revenue
    const averagePrice = restaurant.reservationConfig.averagePrice || 0;
    const estimatedRevenue = averagePrice * totalGuests;

    // Calculate status distribution from already fetched reservations (no additional query)
    const statusDistribution = allReservations.reduce((acc, reservation) => {
      acc[reservation.status] = (acc[reservation.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get top time slots (by hour)
    const timeSlotCounts = await Reservation.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(id),
          date: { $gte: startDate, $lte: endDate },
          status: { $nin: ['cancelled'] }
        }
      },
      {
        $group: {
          _id: { $substr: ['$time', 0, 2] }, // Extract hour
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.status(200).json({
      analytics: {
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          totalReservations,
          totalGuests,
          averageGuestsPerReservation: parseFloat(averageGuestsPerReservation.toFixed(1)),
          occupationRate: parseFloat(occupationRate.toFixed(1)),
          estimatedRevenue: parseFloat(estimatedRevenue.toFixed(2))
        },
        dailyStats,
        statusDistribution,
        topTimeSlots: timeSlotCounts.map(slot => ({
          hour: slot._id,
          count: slot.count
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching restaurant analytics:', error);
    res.status(500).json({ error: { message: 'Failed to fetch restaurant analytics' } });
  }
};

// Export restaurants as CSV
export const exportRestaurants = async (_req: Request, res: Response): Promise<void> => {
  try {
    const restaurants = await Restaurant.find()
      .select('-__v -apiKey')
      .sort({ createdAt: -1 });

    // CSV header
    const header = ['ID', 'Name', 'Address', 'Phone', 'Email', 'Status', 'Created At', 'Updated At'];
    
    // CSV rows
    const rows = restaurants.map(restaurant => [
      restaurant._id.toString(),
      `"${restaurant.name.replace(/"/g, '""')}"`,
      `"${restaurant.address.replace(/"/g, '""')}"`,
      `"${restaurant.phone.replace(/"/g, '""')}"`,
      `"${restaurant.email.replace(/"/g, '""')}"`,
      restaurant.status,
      restaurant.createdAt.toISOString(),
      restaurant.updatedAt.toISOString()
    ]);

    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=restaurants.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting restaurants:', error);
    res.status(500).json({ error: { message: 'Failed to export restaurants' } });
  }
};

// Export users as CSV
export const exportUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find()
      .select('-password -__v')
      .sort({ createdAt: -1 });

    const header = ['ID', 'Email', 'Role', 'Restaurant ID', 'Status', 'Created At', 'Updated At'];
    
    const rows = users.map(user => [
      user._id.toString(),
      `"${user.email.replace(/"/g, '""')}"`,
      user.role,
      user.restaurantId ? user.restaurantId.toString() : '',
      user.status,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    ]);

    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting users:', error);
    res.status(500).json({ error: { message: 'Failed to export users' } });
  }
};

// Export reservations as CSV
export const exportReservations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const reservations = await Reservation.find()
      .populate('restaurantId', 'name')
      .sort({ createdAt: -1 });

    const header = ['ID', 'Restaurant Name', 'Restaurant ID', 'Customer Name', 'Customer Email', 'Customer Phone', 'Date', 'Time', 'Number of Guests', 'Status', 'Notes', 'Created At', 'Updated At'];
    
    const rows = reservations.map(reservation => [
      reservation._id.toString(),
      `"${(reservation.restaurantId as any)?.name?.replace(/"/g, '""') || ''}"`,
      reservation.restaurantId ? reservation.restaurantId.toString() : '',
      `"${reservation.customerName.replace(/"/g, '""')}"`,
      `"${reservation.customerEmail.replace(/"/g, '""')}"`,
      `"${reservation.customerPhone.replace(/"/g, '""')}"`,
      reservation.date.toISOString().split('T')[0],
      reservation.time,
      reservation.numberOfGuests,
      reservation.status,
      `"${(reservation.notes || '').replace(/"/g, '""')}"`,
      reservation.createdAt.toISOString(),
      reservation.updatedAt.toISOString()
    ]);

    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reservations.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting reservations:', error);
    res.status(500).json({ error: { message: 'Failed to export reservations' } });
  }
};

// Get notification analytics for admin dashboard
export const getNotificationAnalytics = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get overall statistics
    const totalNotifications = await NotificationAnalytics.countDocuments();
    
    // Group by notification type
    const byType = await NotificationAnalytics.aggregate([
      {
        $group: {
          _id: '$notificationType',
          count: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'opened', 'clicked']] },
                1,
                0
              ]
            }
          },
          failed: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'failed'] },
                1,
                0
              ]
            }
          },
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          delivered: 1,
          failed: 1,
          deliveryRate: {
            $cond: [
              { $eq: ['$count', 0] },
              0,
              { $divide: ['$delivered', '$count'] }
            ]
          },
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Group by event type
    const byEvent = await NotificationAnalytics.aggregate([
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        }
      },
      {
        $project: {
          event: '$_id',
          count: 1,
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get recent notifications (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentStats = await NotificationAnalytics.aggregate([
      {
        $match: {
          sentAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
            type: '$notificationType'
          },
          count: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'opened', 'clicked']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          byType: {
            $push: {
              type: '$_id.type',
              count: '$count',
              delivered: '$delivered'
            }
          },
          total: { $sum: '$count' },
          delivered: { $sum: '$delivered' }
        }
      },
      {
        $project: {
          date: '$_id',
          byType: 1,
          total: 1,
          delivered: 1,
          deliveryRate: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $divide: ['$delivered', '$total'] }
            ]
          },
          _id: 0
        }
      },
      { $sort: { date: 1 } },
      { $limit: 30 }
    ]);

    // Get top restaurants by notification volume
    const topRestaurants = await NotificationAnalytics.aggregate([
      {
        $group: {
          _id: '$restaurantId',
          count: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'opened', 'clicked']] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: {
          path: '$restaurant',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          restaurantId: '$_id',
          restaurantName: '$restaurant.name',
          count: 1,
          delivered: 1,
          deliveryRate: {
            $cond: [
              { $eq: ['$count', 0] },
              0,
              { $divide: ['$delivered', '$count'] }
            ]
          },
          _id: 0
        }
      }
    ]);

    res.status(200).json({
      analytics: {
        total: totalNotifications,
        byType,
        byEvent,
        recentStats,
        topRestaurants,
        summary: {
          push: byType.find(item => item.type === 'push') || { type: 'push', count: 0, delivered: 0, failed: 0, deliveryRate: 0 },
          email: byType.find(item => item.type === 'email') || { type: 'email', count: 0, delivered: 0, failed: 0, deliveryRate: 0 },
          sse: byType.find(item => item.type === 'sse') || { type: 'sse', count: 0, delivered: 0, failed: 0, deliveryRate: 0 },
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching notification analytics:', error);
    res.status(500).json({ error: { message: 'Failed to fetch notification analytics' } });
  }
};

// Get notification analytics for a specific restaurant
export const getRestaurantNotificationAnalyticsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      res.status(400).json({ error: { message: 'Invalid restaurant ID' } });
      return;
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Get analytics using the service
    const analytics = await getRestaurantNotificationAnalytics(
      new mongoose.Types.ObjectId(restaurantId)
    );

    // Get delivery rate
    const deliveryRate = await getNotificationDeliveryRate(
      new mongoose.Types.ObjectId(restaurantId),
      30
    );

    res.status(200).json({
      analytics: {
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          email: restaurant.email,
        },
        analytics,
        deliveryRate,
        totalNotifications: analytics.reduce((sum, item) => sum + item.total, 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching restaurant notification analytics:', error);
    res.status(500).json({ error: { message: 'Failed to fetch restaurant notification analytics' } });
  }
};

// Export notification analytics as CSV
export const exportNotificationAnalytics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const analytics = await NotificationAnalytics.find()
      .populate('restaurantId', 'name')
      .populate('userId', 'email')
      .sort({ sentAt: -1 });

    // CSV header
    const header = [
      'ID',
      'Restaurant Name',
      'User Email',
      'Notification Type',
      'Event Type',
      'Status',
      'Sent At',
      'Delivered At',
      'Opened At',
      'Clicked At',
      'Failed At',
      'Error Code',
      'Error Message',
      'Push Endpoint',
      'Push Message ID',
      'Email To',
      'Email Message ID',
      'SSE Client ID',
      'Created At',
      'Updated At'
    ];
    
    // CSV rows
    const rows = analytics.map(item => [
      item._id.toString(),
      `"${(item.restaurantId as any)?.name?.replace(/"/g, '""') || ''}"`,
      `"${(item.userId as any)?.email?.replace(/"/g, '""') || ''}"`,
      item.notificationType,
      item.eventType,
      item.status,
      item.sentAt.toISOString(),
      item.deliveredAt ? item.deliveredAt.toISOString() : '',
      item.openedAt ? item.openedAt.toISOString() : '',
      item.clickedAt ? item.clickedAt.toISOString() : '',
      item.failedAt ? item.failedAt.toISOString() : '',
      item.errorCode || '',
      `"${(item.errorMessage || '').replace(/"/g, '""')}"`,
      item.pushEndpoint || '',
      item.pushMessageId || '',
      item.emailTo || '',
      item.emailMessageId || '',
      item.sseClientId || '',
      item.createdAt.toISOString(),
      item.updatedAt.toISOString()
    ]);

    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=notification_analytics.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting notification analytics:', error);
    res.status(500).json({ error: { message: 'Failed to export notification analytics' } });
  }
};

// Get restaurant monitoring data
export const getRestaurantMonitoring = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get all restaurants
    const restaurants = await Restaurant.find().select('_id name status createdAt tablesConfig reservationConfig');

    // Get date range for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Aggregate reservations for current month grouped by restaurant
    const reservationStats = await Reservation.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$restaurantId',
          totalReservations: { $sum: 1 },
          totalGuests: { $sum: '$numberOfGuests' },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          confirmedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get last activity (last reservation) for each restaurant
    const lastActivityResults = await Reservation.aggregate([
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$restaurantId',
          lastActivity: { $first: '$createdAt' }
        }
      }
    ]);

    // Get notification analytics for each restaurant (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const notificationStats = await NotificationAnalytics.aggregate([
      {
        $match: {
          sentAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$restaurantId',
          totalSent: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $in: ['$status', ['delivered', 'opened', 'clicked']] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Create lookup maps for efficient access
    const reservationMap = new Map(
      reservationStats.map(stat => [stat._id?.toString(), stat])
    );
    const lastActivityMap = new Map(
      lastActivityResults.map(result => [result._id?.toString(), result.lastActivity])
    );
    const notificationMap = new Map(
      notificationStats.map(stat => [stat._id?.toString(), stat])
    );

    // Build monitoring data for each restaurant
    const monitoringData = restaurants.map(restaurant => {
      const restaurantId = restaurant._id.toString();
      const reservationStat = reservationMap.get(restaurantId) || { totalReservations: 0, totalGuests: 0, cancelledCount: 0, confirmedCount: 0, completedCount: 0 };
      const lastActivity = lastActivityMap.get(restaurantId);
      const notificationStat = notificationMap.get(restaurantId) || { totalSent: 0, delivered: 0, failed: 0 };

      // Calculate notification delivery rate
      const deliveryRate = notificationStat.totalSent > 0
        ? Math.round((notificationStat.delivered / notificationStat.totalSent) * 100)
        : 100; // 100% if no notifications sent yet

      // Calculate cancellation rate
      const cancellationRate = reservationStat.totalReservations > 0
        ? Math.round((reservationStat.cancelledCount / reservationStat.totalReservations) * 100)
        : 0;

      // Calculate estimated revenue (optional metric)
      const averagePricePerCover = restaurant.reservationConfig?.averagePrice || 0;
      const estimatedRevenue = reservationStat.totalGuests * averagePricePerCover;

      // Detect problems
      const problems: string[] = [];

      // Problem 1: Low notification delivery rate
      if (notificationStat.totalSent > 10 && deliveryRate < 75) {
        problems.push('Taux de livraison des notifications faible');
      }

      // Problem 2: No activity in last 30 days
      if (!lastActivity || (now.getTime() - new Date(lastActivity).getTime()) > 30 * 24 * 60 * 60 * 1000) {
        problems.push('Aucune activité depuis 30 jours');
      }

      // Problem 3: High cancellation rate
      if (reservationStat.totalReservations > 5 && cancellationRate > 30) {
        problems.push('Taux d\'annulation élevé');
      }

      // Problem 4: Restaurant inactive
      if (restaurant.status === 'inactive') {
        problems.push('Restaurant inactif');
      }

      // Health status based on problems
      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (problems.length >= 2) {
        healthStatus = 'critical';
      } else if (problems.length === 1) {
        healthStatus = 'warning';
      }

      return {
        id: restaurant._id,
        name: restaurant.name,
        status: restaurant.status,
        healthStatus,
        metrics: {
          reservationsThisMonth: reservationStat.totalReservations,
          notificationDeliveryRate: deliveryRate,
          lastActivity: lastActivity || null,
          problems,
        },
        optionalMetrics: {
          estimatedRevenue,
          cancellationRate,
          confirmedReservations: reservationStat.confirmedCount,
          completedReservations: reservationStat.completedCount,
          totalGuests: reservationStat.totalGuests,
        }
      };
    });

    res.status(200).json({
      restaurants: monitoringData,
      summary: {
        total: restaurants.length,
        healthy: monitoringData.filter(r => r.healthStatus === 'healthy').length,
        warning: monitoringData.filter(r => r.healthStatus === 'warning').length,
        critical: monitoringData.filter(r => r.healthStatus === 'critical').length,
      }
    });
  } catch (error) {
    logger.error('Error fetching restaurant monitoring data:', error);
    res.status(500).json({ error: { message: 'Failed to fetch monitoring data' } });
  }
};

// Reset monthly reservation quotas for all restaurants
export const resetMonthlyQuotas = async (_req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Starting monthly quota reset for all restaurants');

    // Find all self-service Starter plan restaurants
    const restaurants = await Restaurant.find({
      accountType: 'self-service',
      'subscription.plan': 'starter',
    });

    let resetCount = 0;
    const errors: string[] = [];

    for (const restaurant of restaurants) {
      try {
        await restaurant.resetMonthlyReservationCount();
        resetCount++;
        logger.info(`Reset quota for restaurant: ${restaurant.name} (ID: ${restaurant._id})`);
      } catch (error) {
        const errorMsg = `Failed to reset quota for ${restaurant.name}: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    logger.info(`Monthly quota reset completed. Success: ${resetCount}, Errors: ${errors.length}`);

    res.status(200).json({
      message: 'Monthly quota reset completed',
      summary: {
        totalRestaurants: restaurants.length,
        successfulResets: resetCount,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Error resetting monthly quotas:', error);
    res.status(500).json({ error: { message: 'Failed to reset monthly quotas' } });
  }
};

// Manage restaurant subscription manually (admin only)
export const manageSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, plan, days } = req.body;

    // Validate action
    const validActions = ['change_plan', 'extend_subscription', 'activate', 'cancel'];
    if (!action || !validActions.includes(action)) {
      res.status(400).json({
        error: { message: `Action must be one of: ${validActions.join(', ')}` }
      });
      return;
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Only allow managing self-service accounts
    if (restaurant.accountType !== 'self-service') {
      res.status(400).json({
        error: { message: 'Can only manage self-service accounts. Managed accounts do not have subscriptions.' }
      });
      return;
    }

    let message = '';

    switch (action) {
      case 'change_plan': {
        // Validate plan
        if (!plan || !['starter', 'pro'].includes(plan)) {
          res.status(400).json({ error: { message: 'Plan must be "starter" or "pro"' } });
          return;
        }

        // Don't allow changing to same plan
        if (restaurant.subscription?.plan === plan) {
          res.status(400).json({ error: { message: `Restaurant is already on ${plan} plan` } });
          return;
        }

        // Initialize subscription if it doesn't exist
        if (!restaurant.subscription) {
          restaurant.subscription = {
            plan: plan as 'starter' | 'pro',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          };
        } else {
          restaurant.subscription.plan = plan as 'starter' | 'pro';
        }

        // Update quota based on plan
        if (plan === 'pro') {
          // Pro plan: unlimited reservations
          if (!restaurant.reservationQuota) {
            restaurant.reservationQuota = {
              monthlyCount: 0,
              lastResetDate: new Date(),
              limit: -1, // unlimited
              emailsSent: { at80: false, at90: false, at100: false },
            };
          } else {
            restaurant.reservationQuota.limit = -1;
          }
          message = `Plan upgraded to Pro (unlimited reservations)`;
        } else {
          // Starter plan: 50 reservations/month
          if (!restaurant.reservationQuota) {
            restaurant.reservationQuota = {
              monthlyCount: 0,
              lastResetDate: new Date(),
              limit: 50,
              emailsSent: { at80: false, at90: false, at100: false },
            };
          } else {
            restaurant.reservationQuota.limit = 50;
          }
          message = `Plan changed to Starter (50 reservations/month)`;
        }

        logger.info(`Admin changed plan for restaurant ${restaurant.name} (${id}) to ${plan}`);
        break;
      }

      case 'extend_subscription': {
        // Validate days
        if (!days || typeof days !== 'number' || days < 1 || days > 365) {
          res.status(400).json({ error: { message: 'Days must be a number between 1 and 365' } });
          return;
        }

        // Initialize subscription if it doesn't exist
        if (!restaurant.subscription) {
          res.status(400).json({
            error: { message: 'Restaurant has no subscription to extend. Use "activate" action first.' }
          });
          return;
        }

        // Extend from current end date or now (whichever is later)
        const baseDate = restaurant.subscription.currentPeriodEnd
          ? new Date(Math.max(new Date(restaurant.subscription.currentPeriodEnd).getTime(), Date.now()))
          : new Date();

        // Save previous end date for email
        const previousEndDate = baseDate.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        const newEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
        restaurant.subscription.currentPeriodEnd = newEndDate;
        restaurant.subscription.status = 'active';

        const newEndDateFormatted = newEndDate.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        message = `Subscription extended by ${days} day(s). New end date: ${newEndDateFormatted}`;
        logger.info(`Admin extended subscription for restaurant ${restaurant.name} (${id}) by ${days} days`);

        // Send email notification to restaurant (async, don't block)
        setImmediate(async () => {
          try {
            const { sendSubscriptionExtendedEmail } = await import('../services/emailService');
            await sendSubscriptionExtendedEmail(
              { name: restaurant.name, email: restaurant.email },
              {
                daysOffered: days,
                previousEndDate,
                newEndDate: newEndDateFormatted,
              }
            );
            logger.info(`Subscription extended email sent to ${restaurant.email}`);
          } catch (emailError) {
            logger.error('Failed to send subscription extended email:', emailError);
            // Don't fail the request if email fails
          }
        });

        break;
      }

      case 'activate': {
        // Validate plan if provided
        const activatePlan = plan || restaurant.subscription?.plan || 'starter';
        if (!['starter', 'pro'].includes(activatePlan)) {
          res.status(400).json({ error: { message: 'Plan must be "starter" or "pro"' } });
          return;
        }

        // Initialize or reactivate subscription
        const startDate = new Date();
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        restaurant.subscription = {
          plan: activatePlan as 'starter' | 'pro',
          status: 'active',
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
        };

        // Set quota based on plan
        const limit = activatePlan === 'pro' ? -1 : 50;
        restaurant.reservationQuota = {
          monthlyCount: 0,
          lastResetDate: new Date(),
          limit,
          emailsSent: { at80: false, at90: false, at100: false },
        };

        message = `Subscription activated with ${activatePlan} plan until ${endDate.toLocaleDateString('fr-FR')}`;
        logger.info(`Admin activated subscription for restaurant ${restaurant.name} (${id}) on ${activatePlan} plan`);
        break;
      }

      case 'cancel': {
        if (!restaurant.subscription) {
          res.status(400).json({ error: { message: 'Restaurant has no subscription to cancel' } });
          return;
        }

        restaurant.subscription.status = 'cancelled';
        restaurant.subscription.cancelAtPeriodEnd = true;

        message = `Subscription cancelled. Will remain active until ${restaurant.subscription.currentPeriodEnd?.toLocaleDateString('fr-FR') || 'end of period'}`;
        logger.info(`Admin cancelled subscription for restaurant ${restaurant.name} (${id})`);
        break;
      }
    }

    await restaurant.save();

    res.status(200).json({
      message,
      subscription: {
        plan: restaurant.subscription?.plan,
        status: restaurant.subscription?.status,
        currentPeriodStart: restaurant.subscription?.currentPeriodStart,
        currentPeriodEnd: restaurant.subscription?.currentPeriodEnd,
        cancelAtPeriodEnd: restaurant.subscription?.cancelAtPeriodEnd,
      },
      quota: restaurant.reservationQuota ? {
        monthlyCount: restaurant.reservationQuota.monthlyCount,
        limit: restaurant.reservationQuota.limit,
        remaining: restaurant.getReservationQuotaInfo().remaining,
      } : null
    });
  } catch (error) {
    logger.error('Error managing subscription:', error);
    res.status(500).json({ error: { message: 'Failed to manage subscription' } });
  }
};
