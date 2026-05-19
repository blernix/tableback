import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import logger from '../utils/logger';

const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').trim(),
  address: z.string().min(1, "L'adresse est requise").trim(),
  phone: z.string().min(1, 'Le téléphone est requis').trim(),
  email: z.string().email('Email invalide').trim().toLowerCase(),
  plan: z.enum(['starter', 'pro', 'trial']),
  tablesConfig: z
    .object({
      totalTables: z.number().int().min(1).default(10),
      averageCapacity: z.number().int().min(1).default(20),
    })
    .optional()
    .default({ totalTables: 10, averageCapacity: 20 }),
});

export const createRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createRestaurantSchema.parse(req.body);

    const restaurant = new Restaurant({
      name: validatedData.name,
      address: validatedData.address,
      phone: validatedData.phone,
      email: validatedData.email,
      tablesConfig: validatedData.tablesConfig,
      accountType: 'managed',
      status: 'active',
      createdBy: req.user!.userId,
    });

    if (validatedData.plan !== 'trial') {
      restaurant.subscription = {
        plan: validatedData.plan,
        status: 'active',
        stripeCustomerId: undefined,
        stripeSubscriptionId: undefined,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };
      restaurant.reservationQuota = {
        monthlyCount: 0,
        limit: validatedData.plan === 'pro' ? -1 : 400,
        lastResetDate: new Date(),
        emailsSent: { at80: false, at90: false, at100: false },
      };
    } else {
      restaurant.reservationQuota = {
        monthlyCount: 0,
        limit: 400,
        lastResetDate: new Date(),
        emailsSent: { at80: false, at90: false, at100: false },
      };
    }

    const savedRestaurant = await restaurant.save();
    const apiKey = savedRestaurant.apiKey;
    const publicSlug = savedRestaurant.publicSlug;

    const plainPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
    const user = new User({
      email: validatedData.email,
      password: plainPassword,
      role: 'restaurant',
      restaurantId: savedRestaurant._id,
      status: 'active',
      mustChangePassword: true,
      acceptedTerms: true,
      acceptedTermsAt: new Date(),
    });
    await user.save();

    logger.info(`Commercial ${req.user!.email} created restaurant "${restaurant.name}"`);

    res.status(201).json({
      restaurant: {
        _id: savedRestaurant._id,
        name: savedRestaurant.name,
        email: savedRestaurant.email,
        apiKey,
        publicSlug,
        plan: validatedData.plan,
      },
      credentials: {
        email: validatedData.email,
        password: plainPassword,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
      return;
    }
    logger.error('Error creating restaurant by commercial:', error);
    res.status(500).json({ error: { message: 'Failed to create restaurant' } });
  }
};

export const getMyRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);

    const filter = { createdBy: req.user!.userId };
    const [restaurants, total] = await Promise.all([
      Restaurant.find(filter).select('name email address phone status createdAt subscription.plan').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Restaurant.countDocuments(filter),
    ]);

    res.status(200).json({
      restaurants,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Error fetching commercial restaurants:', error);
    res.status(500).json({ error: { message: 'Failed to fetch restaurants' } });
  }
};

export const getMyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = { createdBy: req.user!.userId };

    const [total, byPlan, recent] = await Promise.all([
      Restaurant.countDocuments(filter),
      Restaurant.aggregate([
        { $match: { createdBy: new mongoose.Types.ObjectId(req.user!.userId) } },
        { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
      ]),
      Restaurant.find(filter).select('name createdAt subscription.plan').sort({ createdAt: -1 }).limit(5),
    ]);

    const starter = byPlan.find((s: any) => s._id === 'starter')?.count || 0;
    const pro = byPlan.find((s: any) => s._id === 'pro')?.count || 0;
    const trial = total - starter - pro;

    res.status(200).json({
      stats: {
        total,
        byPlan: { starter, pro, trial },
        recent,
      },
    });
  } catch (error) {
    logger.error('Error fetching commercial stats:', error);
    res.status(500).json({ error: { message: 'Failed to fetch stats' } });
  }
};
