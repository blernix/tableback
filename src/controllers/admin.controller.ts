import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
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

const createCommercialSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe de 6 caractères minimum'),
  name: z.string().min(1, 'Nom requis').trim().optional(),
});

export const createCommercialUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createCommercialSchema.parse(req.body);

    const existing = await User.findOne({ email: validatedData.email });
    if (existing) {
      res.status(409).json({ error: { message: 'Un utilisateur avec cet email existe déjà' } });
      return;
    }

    const referralCode = `TM-COMM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const user = new User({
      email: validatedData.email,
      password: validatedData.password,
      role: 'commercial',
      status: 'active',
      mustChangePassword: false,
      referralCode,
    });
    await user.save();

    logger.info(`Commercial user created: ${user.email} (ref: ${referralCode})`);

    res.status(201).json({
      user: { id: user._id, email: user.email, role: user.role, referralCode },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
      return;
    }
    logger.error('Error creating commercial user:', error);
    res.status(500).json({ error: { message: 'Failed to create commercial user' } });
  }
};

export const getCommercialUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ role: 'commercial' }).select('email status createdAt referralCode').sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (error) {
    logger.error('Error fetching commercial users:', error);
    res.status(500).json({ error: { message: 'Failed to fetch commercial users' } });
  }
};

export const getCommercialDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'commercial' })
      .select('email referralCode firstName lastName phone photoUrl status createdAt');

    if (!user) {
      res.status(404).json({ error: { message: 'Commercial non trouvé' } });
      return;
    }

    const filter = { createdBy: user._id };
    const [
      total, active, inactive, cancelled,
      byPlan, mrrAgg, recent,
    ] = await Promise.all([
      Restaurant.countDocuments(filter),
      Restaurant.countDocuments({ ...filter, status: 'active' }),
      Restaurant.countDocuments({ ...filter, status: 'inactive' }),
      Restaurant.countDocuments({ ...filter, 'subscription.status': 'cancelled' }),
      Restaurant.aggregate([{ $match: { createdBy: user._id } }, { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }]),
      Restaurant.aggregate([
        { $match: { createdBy: user._id, status: 'active', 'subscription.plan': { $in: ['starter', 'pro'] } } },
        { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
      ]),
      Restaurant.find(filter).select('name email status createdAt subscription.plan').sort({ createdAt: -1 }).limit(20),
    ]);

    const starter = byPlan.find((s: any) => s._id === 'starter')?.count || 0;
    const pro = byPlan.find((s: any) => s._id === 'pro')?.count || 0;
    const activeStarter = mrrAgg.find((s: any) => s._id === 'starter')?.count || 0;
    const activePro = mrrAgg.find((s: any) => s._id === 'pro')?.count || 0;
    const mrr = activeStarter * 39 + activePro * 69;
    const conversionRate = total > 0 ? Math.round((active / total) * 100) : 0;

    res.status(200).json({
      user,
      stats: { total, active, inactive, cancelled, conversionRate, mrr, byPlan: { starter, pro }, activeStarter, activePro },
      restaurants: recent,
    });
  } catch (error) {
    logger.error('Error fetching commercial detail:', error);
    res.status(500).json({ error: { message: 'Failed to fetch commercial detail' } });
  }
};

export const deleteCommercialUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'commercial' });

    if (!user) {
      res.status(404).json({ error: { message: 'Commercial non trouvé' } });
      return;
    }

    const email = user.email;
    const referralCode = user.referralCode;

    // Unlink restaurants from this commercial (keep createdBy for history but null it)
    const unlinked = await Restaurant.updateMany({ createdBy: user._id }, { $set: { createdBy: null } });

    // Delete the user
    await User.findByIdAndDelete(user._id);

    logger.info(`Commercial user deleted: ${email} (ref: ${referralCode}) — ${unlinked.modifiedCount} restaurants unlinked`);

    res.status(200).json({ message: 'Commercial supprimé' });
  } catch (error) {
    logger.error('Error deleting commercial user:', error);
    res.status(500).json({ error: { message: 'Failed to delete commercial user' } });
  }
};

import {
  getRestaurantNotificationAnalytics,
  getNotificationDeliveryRate,
} from '../services/notificationAnalyticsService';
import {
  updateSubscription,
  cancelSubscription,
  getSubscriptionDetails,
} from '../services/stripe.service';
import { STRIPE_CONFIG } from '../config/stripe.config';

// Validation schemas
const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email'),
  tablesConfig: z
    .object({
      totalTables: z.number().min(1).optional(),
      averageCapacity: z.number().min(1).optional(),
    })
    .optional(),
});

const updateRestaurantSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  tablesConfig: z
    .object({
      totalTables: z.number().min(1).optional(),
      averageCapacity: z.number().min(1).optional(),
    })
    .optional(),
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
          details: error.errors,
        },
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
          details: error.errors,
        },
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

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    const restaurantName = restaurant.name;
    const restaurantId = restaurant._id;

    logger.info(`Starting deletion of restaurant: ${restaurantName} (ID: ${restaurantId})`);

    // Delete the restaurant FIRST to prevent orphaned associated data
    await Restaurant.findByIdAndDelete(id);

    // Then delete associated data — use allSettled so one failure doesn't block others
    const results = await Promise.allSettled([
      User.deleteMany({ restaurantId }),
      Reservation.deleteMany({ restaurantId }),
      MenuCategory.deleteMany({ restaurantId }),
      Dish.deleteMany({ restaurantId }),
      DayBlock.deleteMany({ restaurantId }),
      Closure.deleteMany({ restaurantId }),
      PushSubscription.deleteMany({ restaurantId }),
      NotificationPreferences.deleteMany({ restaurantId }),
      NotificationAnalytics.deleteMany({ restaurantId }),
      SubscriptionHistory.deleteMany({ restaurantId }),
    ]);

    results.forEach((r, i) => {
      const labels = ['users', 'reservations', 'menuCategories', 'dishes', 'dayBlocks', 'closures', 'pushSubscriptions', 'notificationPreferences', 'notificationAnalytics', 'subscriptionHistory'];
      if (r.status === 'fulfilled') {
        logger.info(`Deleted ${r.value.deletedCount} ${labels[i]} for restaurant ${restaurantName}`);
      } else {
        logger.error(`Failed to delete ${labels[i]} for restaurant ${restaurantName}:`, r.reason);
      }
    });

    logger.info(`Restaurant and associated data deleted: ${restaurantName} (ID: ${restaurantId})`);

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
          details: error.errors,
        },
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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 200);

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    const filter = { restaurantId: restaurant._id, role: { $in: ['restaurant', 'server'] } };
    const [users, total] = await Promise.all([
      User.find(filter).select('-password -__v').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      users: users.map((u) => ({ id: u._id, email: u.email, role: u.role, status: u.status, restaurantId: u.restaurantId, createdAt: u.createdAt, updatedAt: u.updatedAt })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
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
          details: error.errors,
        },
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
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // All queries are independent — run in parallel
    const [
      restaurantStatusStats,
      accountTypeStats,
      subscriptionStats,
      userStats,
      recentReservations,
      totalReservations,
      monthlyReservations,
      recentRestaurants,
      abandonedSignups,
      topRestaurants,
      starterRestaurants,
    ] = await Promise.all([
      Restaurant.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

      Restaurant.aggregate([{ $group: { _id: '$accountType', count: { $sum: 1 } } }]),

      Restaurant.aggregate([
        { $match: { accountType: 'self-service' } },
        {
          $group: {
            _id: { plan: '$subscription.plan', status: '$subscription.status' },
            count: { $sum: 1 },
          },
        },
      ]),

      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),

      Reservation.countDocuments({ createdAt: { $gte: oneWeekAgo }, status: { $nin: ['cancelled'] } }),

      Reservation.countDocuments({ status: { $nin: ['cancelled'] } }),

      Reservation.countDocuments({ createdAt: { $gte: startOfMonth, $lte: endOfMonth }, status: { $nin: ['cancelled'] } }),

      Restaurant.countDocuments({ createdAt: { $gte: oneMonthAgo } }),

      Restaurant.aggregate([
        { $match: { status: 'inactive', accountType: 'self-service', $or: [{ 'subscription.stripeSubscriptionId': { $exists: false } }, { 'subscription.stripeSubscriptionId': null }] } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, restaurants: { $push: { id: '$_id', name: '$name', email: '$email', createdAt: '$createdAt' } } } },
        { $sort: { _id: -1 } },
        { $limit: 30 },
      ]),

      Reservation.aggregate([
        { $match: { createdAt: { $gte: oneMonthAgo }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: '$restaurantId', reservationCount: { $sum: 1 } } },
        { $sort: { reservationCount: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'restaurants', localField: '_id', foreignField: '_id', as: 'restaurant' } },
        { $unwind: '$restaurant' },
        { $project: { restaurantId: '$_id', restaurantName: '$restaurant.name', reservationCount: 1, accountType: '$restaurant.accountType', subscriptionPlan: '$restaurant.subscription.plan', _id: 0 } },
      ]),

      Restaurant.find({ accountType: 'self-service', 'subscription.plan': 'starter', 'subscription.status': 'active' }).select('name reservationQuota'),
    ]);

    // Extract restaurant stats
    const activeRestaurants = restaurantStatusStats.find((s) => s._id === 'active')?.count || 0;
    const inactiveRestaurants = restaurantStatusStats.find((s) => s._id === 'inactive')?.count || 0;

    const managedRestaurants = accountTypeStats.find((s) => s._id === 'managed')?.count || 0;
    const selfServiceRestaurants = accountTypeStats.find((s) => s._id === 'self-service')?.count || 0;

    // Subscription stats from combined aggregation
    const starterPlanCount = subscriptionStats
      .filter((s) => s._id.plan === 'starter')
      .reduce((sum, s) => sum + s.count, 0);
    const proPlanCount = subscriptionStats
      .filter((s) => s._id.plan === 'pro')
      .reduce((sum, s) => sum + s.count, 0);

    const activeStarterRestaurants = subscriptionStats.find((s) => s._id.plan === 'starter' && s._id.status === 'active')?.count || 0;
    const activeProRestaurants = subscriptionStats.find((s) => s._id.plan === 'pro' && s._id.status === 'active')?.count || 0;
    const activeSubscriptions = activeStarterRestaurants + activeProRestaurants;
    const trialSubscriptions = subscriptionStats.find((s) => s._id.status === 'trial')?.count || 0;
    const pastDueSubscriptions = subscriptionStats.find((s) => s._id.status === 'past_due')?.count || 0;
    const cancelledSubscriptions = subscriptionStats.find((s) => s._id.status === 'cancelled')?.count || 0;

    // MRR
    const mrr = activeStarterRestaurants * 39 + activeProRestaurants * 69;

    // User stats
    const adminUsers = userStats.find((s) => s._id === 'admin')?.count || 0;
    const restaurantUsers = userStats.find((s) => s._id === 'restaurant')?.count || 0;
    const serverUsers = userStats.find((s) => s._id === 'server')?.count || 0;

    // Abandoned signups
    const totalAbandonedSignups = abandonedSignups.reduce((sum, day) => sum + day.count, 0);

    // Quota usage
    const quotaUsage = starterRestaurants.map((r) => ({
      restaurantName: r.name,
      current: r.reservationQuota?.monthlyCount || 0,
      limit: r.reservationQuota?.limit || 400,
      percentage: r.getReservationQuotaInfo().percentage,
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
          byAccountType: { managed: managedRestaurants, selfService: selfServiceRestaurants },
        },
        subscriptions: {
          byPlan: { starter: starterPlanCount, pro: proPlanCount },
          byStatus: { active: activeSubscriptions, trial: trialSubscriptions, pastDue: pastDueSubscriptions, cancelled: cancelledSubscriptions },
          activeSubscriptions: activeStarterRestaurants + activeProRestaurants,
        },
        revenue: {
          mrr,
          breakdown: { starter: activeStarterRestaurants * 39, pro: activeProRestaurants * 69 },
          activeStarterCount: activeStarterRestaurants,
          activeProCount: activeProRestaurants,
        },
        users: { total: adminUsers + restaurantUsers + serverUsers, admin: adminUsers, restaurant: restaurantUsers, server: serverUsers },
        reservations: { total: totalReservations, thisMonth: monthlyReservations, recent: recentReservations, averageQuotaUsage },
        topRestaurants,
        abandonedSignups: { total: totalAbandonedSignups, byDay: abandonedSignups },
      },
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
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    // Filter non-cancelled reservations for main stats
    const reservations = allReservations.filter((r) => r.status !== 'cancelled');

    // Calculate daily stats
    const dailyStatsMap = new Map<
      string,
      { date: string; reservations: number; guests: number; revenue: number }
    >();

    reservations.forEach((reservation) => {
      const dateStr = reservation.date.toISOString().split('T')[0];
      const existing = dailyStatsMap.get(dateStr) || {
        date: dateStr,
        reservations: 0,
        guests: 0,
        revenue: 0,
      };

      existing.reservations += 1;
      existing.guests += reservation.numberOfGuests;

      // Calculate estimated revenue if averagePrice is set
      const averagePrice = restaurant.reservationConfig.averagePrice || 0;
      existing.revenue += averagePrice * reservation.numberOfGuests;

      dailyStatsMap.set(dateStr, existing);
    });

    // Convert to array and fill missing dates
    const dailyStats = Array.from(dailyStatsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Calculate summary stats
    const totalReservations = reservations.length;
    const totalGuests = reservations.reduce((sum, r) => sum + r.numberOfGuests, 0);
    const averageGuestsPerReservation = totalReservations > 0 ? totalGuests / totalReservations : 0;

    // Calculate occupation rate (simplified: based on total tables capacity)
    const totalTables = restaurant.tablesConfig.totalTables || 10;
    const averageCapacity = restaurant.tablesConfig.averageCapacity || 4;
    const totalPotentialCovers = totalTables * averageCapacity * dailyStats.length;
    const occupationRate =
      totalPotentialCovers > 0 ? (totalGuests / totalPotentialCovers) * 100 : 0;

    // Calculate estimated revenue
    const averagePrice = restaurant.reservationConfig.averagePrice || 0;
    const estimatedRevenue = averagePrice * totalGuests;

    // Calculate status distribution from already fetched reservations (no additional query)
    const statusDistribution = allReservations.reduce(
      (acc, reservation) => {
        acc[reservation.status] = (acc[reservation.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get top time slots (by hour)
    const timeSlotCounts = await Reservation.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(id),
          date: { $gte: startDate, $lte: endDate },
          status: { $nin: ['cancelled'] },
        },
      },
      {
        $group: {
          _id: { $substr: ['$time', 0, 2] }, // Extract hour
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    res.status(200).json({
      analytics: {
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        summary: {
          totalReservations,
          totalGuests,
          averageGuestsPerReservation: parseFloat(averageGuestsPerReservation.toFixed(1)),
          occupationRate: parseFloat(occupationRate.toFixed(1)),
          estimatedRevenue: parseFloat(estimatedRevenue.toFixed(2)),
        },
        dailyStats,
        statusDistribution,
        topTimeSlots: timeSlotCounts.map((slot) => ({
          hour: slot._id,
          count: slot.count,
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching restaurant analytics:', error);
    res.status(500).json({ error: { message: 'Failed to fetch restaurant analytics' } });
  }
};

// Export restaurants as CSV
export const exportRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 2000), 10000);
    const skip = (page - 1) * limit;

    const [restaurants, total] = await Promise.all([
      Restaurant.find().select('-__v -apiKey').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Restaurant.countDocuments(),
    ]);

    const header = ['ID', 'Name', 'Address', 'Phone', 'Email', 'Status', 'Created At', 'Updated At'];
    const rows = restaurants.map((r) => [r._id.toString(), `"${r.name.replace(/"/g, '""')}"`, `"${r.address.replace(/"/g, '""')}"`, `"${r.phone.replace(/"/g, '""')}"`, `"${r.email.replace(/"/g, '""')}"`, r.status, r.createdAt.toISOString(), r.updatedAt.toISOString()]);

    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=restaurants_p${page}.csv`);
    res.json({ data: csv, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('Error exporting restaurants:', error);
    res.status(500).json({ error: { message: 'Failed to export restaurants' } });
  }
};

// Export users as CSV
export const exportUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 2000), 10000);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select('-password -__v').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);

    const header = ['ID', 'Email', 'Role', 'Restaurant ID', 'Status', 'Created At', 'Updated At'];
    const rows = users.map((u) => [u._id.toString(), `"${u.email.replace(/"/g, '""')}"`, u.role, u.restaurantId ? u.restaurantId.toString() : '', u.status, u.createdAt.toISOString(), u.updatedAt.toISOString()]);

    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.status(200).json({ data: csv, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('Error exporting users:', error);
    res.status(500).json({ error: { message: 'Failed to export users' } });
  }
};

// Export reservations as CSV
export const exportReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 2000), 10000);
    const skip = (page - 1) * limit;

    const [reservations, total] = await Promise.all([
      Reservation.find().populate('restaurantId', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Reservation.countDocuments(),
    ]);

    const header = ['ID', 'Restaurant Name', 'Restaurant ID', 'Customer Name', 'Customer Email', 'Customer Phone', 'Date', 'Time', 'Number of Guests', 'Status', 'Notes', 'Created At', 'Updated At'];
    const rows = reservations.map((r) => [r._id.toString(), `"${(r.restaurantId as any)?.name?.replace(/"/g, '""') || ''}"`, r.restaurantId ? r.restaurantId.toString() : '', `"${r.customerName.replace(/"/g, '""')}"`, `"${r.customerEmail.replace(/"/g, '""')}"`, `"${r.customerPhone.replace(/"/g, '""')}"`, r.date.toISOString().split('T')[0], r.time, r.numberOfGuests, r.status, `"${(r.notes || '').replace(/"/g, '""')}"`, r.createdAt.toISOString(), r.updatedAt.toISOString()]);

    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.status(200).json({ data: csv, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
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
              $cond: [{ $in: ['$status', ['delivered', 'opened', 'clicked']] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          delivered: 1,
          failed: 1,
          deliveryRate: {
            $cond: [{ $eq: ['$count', 0] }, 0, { $divide: ['$delivered', '$count'] }],
          },
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Group by event type
    const byEvent = await NotificationAnalytics.aggregate([
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          event: '$_id',
          count: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get recent notifications (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentStats = await NotificationAnalytics.aggregate([
      {
        $match: {
          sentAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
            type: '$notificationType',
          },
          count: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [{ $in: ['$status', ['delivered', 'opened', 'clicked']] }, 1, 0],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          byType: {
            $push: {
              type: '$_id.type',
              count: '$count',
              delivered: '$delivered',
            },
          },
          total: { $sum: '$count' },
          delivered: { $sum: '$delivered' },
        },
      },
      {
        $project: {
          date: '$_id',
          byType: 1,
          total: 1,
          delivered: 1,
          deliveryRate: {
            $cond: [{ $eq: ['$total', 0] }, 0, { $divide: ['$delivered', '$total'] }],
          },
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
      { $limit: 30 },
    ]);

    // Get top restaurants by notification volume
    const topRestaurants = await NotificationAnalytics.aggregate([
      {
        $group: {
          _id: '$restaurantId',
          count: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [{ $in: ['$status', ['delivered', 'opened', 'clicked']] }, 1, 0],
            },
          },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant',
        },
      },
      {
        $unwind: {
          path: '$restaurant',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          restaurantId: '$_id',
          restaurantName: '$restaurant.name',
          count: 1,
          delivered: 1,
          deliveryRate: {
            $cond: [{ $eq: ['$count', 0] }, 0, { $divide: ['$delivered', '$count'] }],
          },
          _id: 0,
        },
      },
    ]);

    res.status(200).json({
      analytics: {
        total: totalNotifications,
        byType,
        byEvent,
        recentStats,
        topRestaurants,
        summary: {
          push: byType.find((item) => item.type === 'push') || {
            type: 'push',
            count: 0,
            delivered: 0,
            failed: 0,
            deliveryRate: 0,
          },
          email: byType.find((item) => item.type === 'email') || {
            type: 'email',
            count: 0,
            delivered: 0,
            failed: 0,
            deliveryRate: 0,
          },
          sse: byType.find((item) => item.type === 'sse') || {
            type: 'sse',
            count: 0,
            delivered: 0,
            failed: 0,
            deliveryRate: 0,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching notification analytics:', error);
    res.status(500).json({ error: { message: 'Failed to fetch notification analytics' } });
  }
};

// Get notification analytics for a specific restaurant
export const getRestaurantNotificationAnalyticsController = async (
  req: Request,
  res: Response
): Promise<void> => {
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
        totalNotifications: analytics.reduce((sum, item) => sum + item.total, 0),
      },
    });
  } catch (error) {
    logger.error('Error fetching restaurant notification analytics:', error);
    res
      .status(500)
      .json({ error: { message: 'Failed to fetch restaurant notification analytics' } });
  }
};

// Export notification analytics as CSV
export const exportNotificationAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 2000), 10000);
    const skip = (page - 1) * limit;

    const [analytics, total] = await Promise.all([
      NotificationAnalytics.find().populate('restaurantId', 'name').populate('userId', 'email').sort({ sentAt: -1 }).skip(skip).limit(limit),
      NotificationAnalytics.countDocuments(),
    ]);

    const header = ['ID', 'Restaurant Name', 'User Email', 'Notification Type', 'Event Type', 'Status', 'Sent At', 'Delivered At', 'Opened At', 'Clicked At', 'Failed At', 'Error Code', 'Error Message', 'Push Endpoint', 'Push Message ID', 'Email To', 'Email Message ID', 'SSE Client ID', 'Created At', 'Updated At'];
    const rows = analytics.map((item) => [item._id.toString(), `"${(item.restaurantId as any)?.name?.replace(/"/g, '""') || ''}"`, `"${(item.userId as any)?.email?.replace(/"/g, '""') || ''}"`, item.notificationType, item.eventType, item.status, item.sentAt.toISOString(), item.deliveredAt ? item.deliveredAt.toISOString() : '', item.openedAt ? item.openedAt.toISOString() : '', item.clickedAt ? item.clickedAt.toISOString() : '', item.failedAt ? item.failedAt.toISOString() : '', item.errorCode || '', `"${(item.errorMessage || '').replace(/"/g, '""')}"`, item.pushEndpoint || '', item.pushMessageId || '', item.emailTo || '', item.emailMessageId || '', item.sseClientId || '', item.createdAt.toISOString(), item.updatedAt.toISOString()]);

    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.status(200).json({ data: csv, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('Error exporting notification analytics:', error);
    res.status(500).json({ error: { message: 'Failed to export notification analytics' } });
  }
};

// Get restaurant monitoring data
export const getRestaurantMonitoring = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get all restaurants
    const restaurants = await Restaurant.find().select(
      '_id name status createdAt tablesConfig reservationConfig'
    );

    // Get date range for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Aggregate reservations for current month grouped by restaurant
    const reservationStats = await Reservation.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$restaurantId',
          totalReservations: { $sum: 1 },
          totalGuests: { $sum: '$numberOfGuests' },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          confirmedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
    ]);

    // Get last activity (last reservation) for each restaurant
    const lastActivityResults = await Reservation.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$restaurantId',
          lastActivity: { $first: '$createdAt' },
        },
      },
    ]);

    // Get notification analytics for each restaurant (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const notificationStats = await NotificationAnalytics.aggregate([
      {
        $match: {
          sentAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$restaurantId',
          totalSent: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $in: ['$status', ['delivered', 'opened', 'clicked']] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
        },
      },
    ]);

    // Create lookup maps for efficient access
    const reservationMap = new Map(reservationStats.map((stat) => [stat._id?.toString(), stat]));
    const lastActivityMap = new Map(
      lastActivityResults.map((result) => [result._id?.toString(), result.lastActivity])
    );
    const notificationMap = new Map(notificationStats.map((stat) => [stat._id?.toString(), stat]));

    // Build monitoring data for each restaurant
    const monitoringData = restaurants.map((restaurant) => {
      const restaurantId = restaurant._id.toString();
      const reservationStat = reservationMap.get(restaurantId) || {
        totalReservations: 0,
        totalGuests: 0,
        cancelledCount: 0,
        confirmedCount: 0,
        completedCount: 0,
      };
      const lastActivity = lastActivityMap.get(restaurantId);
      const notificationStat = notificationMap.get(restaurantId) || {
        totalSent: 0,
        delivered: 0,
        failed: 0,
      };

      // Calculate notification delivery rate
      const deliveryRate =
        notificationStat.totalSent > 0
          ? Math.round((notificationStat.delivered / notificationStat.totalSent) * 100)
          : 100; // 100% if no notifications sent yet

      // Calculate cancellation rate
      const cancellationRate =
        reservationStat.totalReservations > 0
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
      if (
        !lastActivity ||
        now.getTime() - new Date(lastActivity).getTime() > 30 * 24 * 60 * 60 * 1000
      ) {
        problems.push('Aucune activité depuis 30 jours');
      }

      // Problem 3: High cancellation rate
      if (reservationStat.totalReservations > 5 && cancellationRate > 30) {
        problems.push("Taux d'annulation élevé");
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
        },
      };
    });

    res.status(200).json({
      restaurants: monitoringData,
      summary: {
        total: restaurants.length,
        healthy: monitoringData.filter((r) => r.healthStatus === 'healthy').length,
        warning: monitoringData.filter((r) => r.healthStatus === 'warning').length,
        critical: monitoringData.filter((r) => r.healthStatus === 'critical').length,
      },
    });
  } catch (error) {
    logger.error('Error fetching restaurant monitoring data:', error);
    res.status(500).json({ error: { message: 'Failed to fetch monitoring data' } });
  }
};

// Reset monthly reservation quotas for all restaurants
export const resetMonthlyQuotas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const restaurants = await Restaurant.find({
      accountType: 'self-service',
      'subscription.plan': 'starter',
    });

    if (restaurants.length === 0) {
      res.status(200).json({ message: 'No Starter plan restaurants to reset', count: 0 });
      return;
    }

    const now = new Date();
    const bulkOps = restaurants.map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: {
          $set: {
            'reservationQuota.monthlyCount': 0,
            'reservationQuota.lastResetDate': now,
            'reservationQuota.emailsSent.at80': false,
            'reservationQuota.emailsSent.at90': false,
            'reservationQuota.emailsSent.at100': false,
          },
        },
      },
    }));

    const result = await Restaurant.bulkWrite(bulkOps);

    logger.info(`Monthly quotas reset for ${result.modifiedCount} Starter plan restaurants`);

    res.status(200).json({
      message: 'Monthly quotas reset successfully',
      count: result.modifiedCount,
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
        error: { message: `Action must be one of: ${validActions.join(', ')}` },
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
        error: {
          message:
            'Can only manage self-service accounts. Managed accounts do not have subscriptions.',
        },
      });
      return;
    }

    let message = '';
    const hasStripeSubscription = !!restaurant.subscription?.stripeSubscriptionId;

    // Log synchronization intent
    logger.info(`Admin ${action} for restaurant ${restaurant.name}`, {
      restaurantId: id,
      action,
      plan,
      days,
      hasStripeSubscription,
      syncStatus: 'pending',
    });

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

        // Sync with Stripe if subscription exists
        if (hasStripeSubscription) {
          try {
            await updateSubscription({
              restaurantId: id,
              action: 'change_plan',
              plan,
            });
            logger.info(`Stripe subscription updated for restaurant ${restaurant.name}`, {
              restaurantId: id,
              fromPlan: restaurant.subscription?.plan,
              toPlan: plan,
              syncStatus: 'success',
            });
          } catch (stripeError) {
            logger.error(`Failed to sync with Stripe for restaurant ${restaurant.name}:`, {
              restaurantId: id,
              error: (stripeError as any).message,
              syncStatus: 'failed',
            });
            // Don't fail the request for now, but log warning
            // In future, we might want to fail the request
          }
        } else {
          logger.warn(`No Stripe subscription ID for restaurant ${restaurant.name}`, {
            restaurantId: id,
            note: 'Changing plan in MongoDB only',
          });
        }

        // Initialize subscription if it doesn't exist
        if (!restaurant.subscription) {
          restaurant.subscription = {
            plan: plan as 'starter' | 'pro',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            stripeCustomerId: undefined,
            stripeSubscriptionId: undefined,
            cancelAtPeriodEnd: false,
          };
        } else {
          restaurant.subscription.plan = plan as 'starter' | 'pro';
          restaurant.subscription.status = 'active';
          restaurant.subscription.cancelAtPeriodEnd = false;

          // Only reset dates if not synced with Stripe
          if (!hasStripeSubscription) {
            restaurant.subscription.currentPeriodStart = new Date();
            restaurant.subscription.currentPeriodEnd = new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ); // 30 days
          }
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
          // Starter plan: 400 reservations/month
          if (!restaurant.reservationQuota) {
            restaurant.reservationQuota = {
              monthlyCount: 0,
              lastResetDate: new Date(),
              limit: 400,
              emailsSent: { at80: false, at90: false, at100: false },
            };
          } else {
            restaurant.reservationQuota.limit = 400;
          }

          // Clean up Pro features when downgrading to Starter
          // Remove widget customization
          restaurant.widgetConfig = undefined;

          // Remove Google review link
          restaurant.googleReviewLink = undefined;

          // Delete server accounts
          await User.deleteMany({
            restaurantId: restaurant._id,
            role: 'server',
          });

          logger.info(
            `Cleaned up Pro features for restaurant ${restaurant.name} (${id}) after downgrade to Starter`,
            {
              restaurantId: id,
              featuresCleaned: ['widgetConfig', 'googleReviewLink', 'serverAccounts'],
            }
          );

          // Send email notification about plan downgrade (async, don't block)
          setImmediate(async () => {
            try {
              const { sendPlanDowngradeEmail } = await import('../services/emailService');
              await sendPlanDowngradeEmail(
                { name: restaurant.name, email: restaurant.email },
                {
                  fromPlan: 'pro',
                  toPlan: 'starter',
                  quotaLimit: '400 réservations/mois',
                  monthlyPrice: '29€',
                }
              );
              logger.info(`Plan downgrade email sent to ${restaurant.email}`);
            } catch (emailError) {
              logger.error('Failed to send plan downgrade email:', emailError);
              // Don't fail the request if email fails
            }
          });

          message = `Plan changed to Starter (400 reservations/month). Pro features have been removed.`;
        }

        logger.info(`Admin changed plan for restaurant ${restaurant.name} (${id}) to ${plan}`, {
          syncStatus: hasStripeSubscription ? 'partial' : 'mongodb_only',
        });
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
            error: {
              message: 'Restaurant has no subscription to extend. Use "activate" action first.',
            },
          });
          return;
        }

        // Sync with Stripe if subscription exists (to remove cancellation flag)
        if (hasStripeSubscription) {
          try {
            await updateSubscription({
              restaurantId: id,
              action: 'extend_subscription',
              days,
            });
            logger.info(`Stripe subscription updated for extension ${restaurant.name}`, {
              restaurantId: id,
              days,
              syncStatus: 'success',
            });
          } catch (stripeError) {
            logger.warn(`Failed to sync extension with Stripe for restaurant ${restaurant.name}:`, {
              restaurantId: id,
              error: (stripeError as any).message,
              syncStatus: 'failed',
              note: 'Extension will be applied in MongoDB only',
            });
            // Continue with MongoDB update even if Stripe fails
          }
        }

        // Extend from current end date or now (whichever is later)
        const baseDate = restaurant.subscription.currentPeriodEnd
          ? new Date(
              Math.max(new Date(restaurant.subscription.currentPeriodEnd).getTime(), Date.now())
            )
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
        logger.info(
          `Admin extended subscription for restaurant ${restaurant.name} (${id}) by ${days} days`,
          {
            syncStatus: hasStripeSubscription ? 'partial' : 'mongodb_only',
            note: 'Date extension handled in MongoDB',
          }
        );

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
        const previousPlan = restaurant.subscription?.plan;
        if (!['starter', 'pro'].includes(activatePlan)) {
          res.status(400).json({ error: { message: 'Plan must be "starter" or "pro"' } });
          return;
        }

        // Sync with Stripe if subscription exists
        if (hasStripeSubscription) {
          try {
            await updateSubscription({
              restaurantId: id,
              action: 'activate',
              plan: activatePlan,
            });
            logger.info(`Stripe subscription activated for restaurant ${restaurant.name}`, {
              restaurantId: id,
              plan: activatePlan,
              syncStatus: 'success',
            });
          } catch (stripeError) {
            logger.error(
              `Failed to sync activation with Stripe for restaurant ${restaurant.name}:`,
              {
                restaurantId: id,
                error: (stripeError as any).message,
                syncStatus: 'failed',
              }
            );
            // Continue with MongoDB activation even if Stripe fails
          }
        }

        // Initialize or reactivate subscription
        const startDate = new Date();
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        restaurant.status = 'active';
        restaurant.subscription = {
          plan: activatePlan as 'starter' | 'pro',
          status: 'active',
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
          stripeCustomerId: restaurant.subscription?.stripeCustomerId,
          stripeSubscriptionId: restaurant.subscription?.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        };

        await User.updateMany(
          { restaurantId: restaurant._id },
          { status: 'active' }
        );

        // Set quota based on plan
        const limit = activatePlan === 'pro' ? -1 : 400;
        restaurant.reservationQuota = {
          monthlyCount: 0,
          lastResetDate: new Date(),
          limit,
          emailsSent: { at80: false, at90: false, at100: false },
        };

        // Clean up Pro features if activating with Starter plan
        if (activatePlan === 'starter') {
          restaurant.widgetConfig = undefined;
          restaurant.googleReviewLink = undefined;
          await User.deleteMany({
            restaurantId: restaurant._id,
            role: 'server',
          });
          logger.info(
            `Cleaned up Pro features for restaurant ${restaurant.name} (${id}) after activation with Starter plan`,
            {
              restaurantId: id,
              featuresCleaned: ['widgetConfig', 'googleReviewLink', 'publicSlug', 'serverAccounts'],
            }
          );

          // Send downgrade email if previously on Pro plan
          if (previousPlan === 'pro') {
            setImmediate(async () => {
              try {
                const { sendPlanDowngradeEmail } = await import('../services/emailService');
                await sendPlanDowngradeEmail(
                  { name: restaurant.name, email: restaurant.email },
                  {
                    fromPlan: 'pro',
                    toPlan: 'starter',
                    quotaLimit: '400 réservations/mois',
                    monthlyPrice: '29€',
                  }
                );
                logger.info(`Plan downgrade email sent to ${restaurant.email} after activation`);
              } catch (emailError) {
                logger.error('Failed to send plan downgrade email after activation:', emailError);
                // Don't fail the request if email fails
              }
            });
          }
        }

        message = `Subscription activated with ${activatePlan} plan until ${endDate.toLocaleDateString('fr-FR')}`;
        logger.info(
          `Admin activated subscription for restaurant ${restaurant.name} (${id}) on ${activatePlan} plan`,
          {
            syncStatus: hasStripeSubscription ? 'partial' : 'mongodb_only',
          }
        );
        break;
      }

      case 'cancel': {
        if (!restaurant.subscription) {
          res.status(400).json({ error: { message: 'Restaurant has no subscription to cancel' } });
          return;
        }

        // Sync with Stripe if subscription exists
        if (hasStripeSubscription) {
          try {
            await cancelSubscription({
              restaurantId: id,
              immediately: false,
            });
            logger.info(`Stripe subscription cancelled for restaurant ${restaurant.name}`, {
              restaurantId: id,
              syncStatus: 'success',
            });
          } catch (stripeError) {
            logger.error(
              `Failed to sync cancellation with Stripe for restaurant ${restaurant.name}:`,
              {
                restaurantId: id,
                error: (stripeError as any).message,
                syncStatus: 'failed',
              }
            );
            // Don't fail the request for now, but log warning
          }
        } else {
          logger.warn(`No Stripe subscription ID for restaurant ${restaurant.name}`, {
            restaurantId: id,
            note: 'Cancelling subscription in MongoDB only',
          });
        }

        restaurant.subscription.status = 'cancelled';
        restaurant.subscription.cancelAtPeriodEnd = true;
        restaurant.status = 'inactive';

        await User.updateMany(
          { restaurantId: restaurant._id },
          { status: 'inactive' }
        );

        message = `Subscription cancelled. Restaurant and users have been deactivated.`;
        logger.info(`Admin cancelled subscription for restaurant ${restaurant.name} (${id})`, {
          syncStatus: hasStripeSubscription ? 'partial' : 'mongodb_only',
        });
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
        stripeCustomerId: restaurant.subscription?.stripeCustomerId,
        stripeSubscriptionId: restaurant.subscription?.stripeSubscriptionId,
      },
      quota: restaurant.reservationQuota
        ? {
            monthlyCount: restaurant.reservationQuota.monthlyCount,
            limit: restaurant.reservationQuota.limit,
            remaining: restaurant.getReservationQuotaInfo().remaining,
          }
        : null,
      syncInfo: {
        hasStripeSubscription,
        note: hasStripeSubscription
          ? 'Changes synchronized with Stripe'
          : 'No Stripe subscription ID found - changes applied to MongoDB only',
      },
    });
  } catch (error) {
    logger.error('Error managing subscription:', error);
    res.status(500).json({ error: { message: 'Failed to manage subscription' } });
  }
};

/**
 * Get subscription synchronization status between MongoDB and Stripe
 */
export const getSubscriptionSyncStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Find restaurant
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found' } });
      return;
    }

    // Only check self-service accounts
    if (restaurant.accountType !== 'self-service') {
      res.status(400).json({
        error: { message: 'Managed accounts do not have Stripe subscriptions' },
      });
      return;
    }

    const hasStripeSubscription = !!restaurant.subscription?.stripeSubscriptionId;

    if (!hasStripeSubscription) {
      res.status(200).json({
        inSync: true,
        hasStripeSubscription: false,
        note: 'No Stripe subscription ID found - MongoDB is source of truth',
        lastSync: restaurant.updatedAt,
      });
      return;
    }

    // Get Stripe subscription details
    let stripeSubscription = null;
    let stripeError = null;

    try {
      const subscriptionDetails = await getSubscriptionDetails(id);
      stripeSubscription = subscriptionDetails.subscription;
    } catch (error) {
      stripeError = (error as any).message;
      logger.warn(`Failed to fetch Stripe subscription for restaurant ${restaurant.name}:`, {
        restaurantId: id,
        error: stripeError,
      });
    }

    // Compare MongoDB with Stripe
    const mongoSubscription = restaurant.subscription;
    const differences: Record<string, any> = {};

    if (stripeSubscription) {
      // Compare plan
      const mongoPlan = mongoSubscription?.plan;
      const stripePlan = determinePlanFromStripeSubscription(stripeSubscription);
      if (mongoPlan !== stripePlan) {
        differences.plan = { mongo: mongoPlan, stripe: stripePlan };
      }

      // Compare status
      const mongoStatus = mongoSubscription?.status;
      const stripeStatus = mapStripeStatus(stripeSubscription.status);
      if (mongoStatus !== stripeStatus) {
        differences.status = { mongo: mongoStatus, stripe: stripeStatus };
      }

      // Compare current period end (approx)
      const mongoPeriodEnd = mongoSubscription?.currentPeriodEnd;
      const stripePeriodEnd = (stripeSubscription as any).current_period_end
        ? new Date((stripeSubscription as any).current_period_end * 1000)
        : null;

      if (mongoPeriodEnd && stripePeriodEnd) {
        const mongoDate = new Date(mongoPeriodEnd);
        const stripeDate = new Date(stripePeriodEnd);
        // Allow 1 day difference due to timezone/time rounding
        const diffDays = Math.abs(
          (mongoDate.getTime() - stripeDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays > 1) {
          differences.currentPeriodEnd = {
            mongo: mongoPeriodEnd,
            stripe: stripePeriodEnd.toISOString(),
            diffDays: Math.round(diffDays * 100) / 100,
          };
        }
      }

      // Compare cancellation flag
      const mongoCancelAtPeriodEnd = mongoSubscription?.cancelAtPeriodEnd;
      const stripeCancelAtPeriodEnd = (stripeSubscription as any).cancel_at_period_end;
      if (mongoCancelAtPeriodEnd !== stripeCancelAtPeriodEnd) {
        differences.cancelAtPeriodEnd = {
          mongo: mongoCancelAtPeriodEnd,
          stripe: stripeCancelAtPeriodEnd,
        };
      }
    }

    const inSync = Object.keys(differences).length === 0;

    res.status(200).json({
      inSync,
      hasStripeSubscription: true,
      differences: inSync ? undefined : differences,
      stripeError,
      lastSync: restaurant.updatedAt,
      subscriptionIds: {
        mongo: mongoSubscription?.stripeSubscriptionId,
        stripe: stripeSubscription?.id,
      },
    });
  } catch (error) {
    logger.error('Error checking subscription sync status:', error);
    res.status(500).json({ error: { message: 'Failed to check sync status' } });
  }
};

// Helper functions (copied from stripe.service.ts to avoid circular dependencies)
function determinePlanFromStripeSubscription(subscription: any): 'starter' | 'pro' {
  const priceId = subscription.items.data[0]?.price.id;

  if (priceId === STRIPE_CONFIG.products.pro.priceId) {
    return 'pro';
  }
  return 'starter';
}

function mapStripeStatus(
  stripeStatus: string
): 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired' {
  switch (stripeStatus) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'cancelled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'expired';
  }
}
