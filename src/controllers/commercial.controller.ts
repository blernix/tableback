import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import Reservation from '../models/Reservation.model';
import logger from '../utils/logger';
import { createCheckoutSession } from '../services/stripe.service';
import { sendCommercialInvitationEmail } from '../services/emailService';
import { generatePasswordResetToken } from '../services/tokenService';
import { uploadToGCS, deleteFromGCS } from '../config/storage.config';
import { stripe } from '../config/stripe.config';
import CommercialNote from '../models/CommercialNote.model';

const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').trim(),
  address: z.string().min(1, "L'adresse est requise").trim(),
  phone: z.string().min(1, 'Le téléphone est requis').trim(),
  email: z.string().email('Email invalide').trim().toLowerCase(),
  plan: z.enum(['starter', 'pro']),
  trialDays: z.number().int().min(0).max(30).default(14),
  discountPercent: z.number().int().min(0).max(70).default(0),
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

    // Check for duplicate email before creating anything
    const [existingUser, existingRestaurant] = await Promise.all([
      User.findOne({ email: validatedData.email }),
      Restaurant.findOne({ email: validatedData.email }),
    ]);

    if (existingUser) {
      res.status(409).json({ error: { message: 'Un utilisateur avec cet email existe déjà' } });
      return;
    }
    if (existingRestaurant) {
      res.status(409).json({ error: { message: 'Un restaurant avec cet email existe déjà' } });
      return;
    }

    const restaurant = new Restaurant({
      name: validatedData.name,
      address: validatedData.address,
      phone: validatedData.phone,
      email: validatedData.email,
      tablesConfig: validatedData.tablesConfig,
      accountType: 'self-service',
      status: 'inactive',
      createdBy: req.user!.userId,
      subscription: { plan: validatedData.plan },
    });

    const savedRestaurant = await restaurant.save();

    const tempPassword = crypto.randomBytes(32).toString('hex');
    const user = new User({
      email: validatedData.email,
      password: tempPassword,
      role: 'restaurant',
      restaurantId: savedRestaurant._id,
      status: 'inactive',
      mustChangePassword: true,
      acceptedTerms: true,
      acceptedTermsAt: new Date(),
    });
    await user.save();

    const trialDays = validatedData.trialDays;
    const discountPercent = validatedData.discountPercent;

    // Create Stripe coupon if discount is active
    let couponId: string | undefined;
    if (discountPercent > 0) {
      try {
        const coupon = await stripe.coupons.create({
          percent_off: discountPercent,
          duration: 'once',
          max_redemptions: 1,
          redeem_by: Math.floor(Date.now() / 1000) + 24 * 3600,
          metadata: { restaurantId: savedRestaurant._id.toString(), createdBy: 'commercial' },
        });
        couponId = coupon.id;
        logger.info(`Coupon created for restaurant ${savedRestaurant._id}: ${discountPercent}% off`);
      } catch (err) {
        logger.error('Failed to create Stripe coupon:', err);
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const setupToken = await generatePasswordResetToken(user._id.toString());
    const setupLink = `${frontendUrl}/reset-password?token=${setupToken}`;

    const commercialUser = await User.findById(req.user!.userId).select('referralCode');

    const checkoutSession = await createCheckoutSession({
      restaurantId: savedRestaurant._id.toString(),
      plan: validatedData.plan,
      email: validatedData.email,
      acceptedTerms: true,
      trialDays: trialDays > 0 ? trialDays : undefined,
      couponId,
      referralCode: commercialUser?.referralCode,
      successUrl: `${frontendUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/signup/cancel`,
    });

    logger.info(`Commercial ${req.user!.email} created restaurant "${restaurant.name}" — checkout: ${checkoutSession.id}${couponId ? `, coupon: ${discountPercent}%` : ''}`);

    sendCommercialInvitationEmail(
      { name: validatedData.name, email: validatedData.email },
      {
        restaurantName: validatedData.name,
        plan: validatedData.plan,
        checkoutUrl: checkoutSession.url!,
        setupLink,
        trialDays,
        discountPercent,
      }
    ).catch((err) => logger.error('Failed to send commercial invitation email:', err));

    res.status(201).json({
      restaurant: {
        _id: savedRestaurant._id,
        name: savedRestaurant.name,
        email: savedRestaurant.email,
        publicSlug: savedRestaurant.publicSlug,
        plan: validatedData.plan,
      },
      checkout: {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
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
    const search = (req.query.search as string)?.trim() || '';

    const filter: Record<string, any> = { createdBy: req.user!.userId };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

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

export const getRestaurantDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = await Restaurant.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    }).select('-apiKey -__v');

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant non trouvé' } });
      return;
    }

    const activeReservations = await Reservation.countDocuments({
      restaurantId: restaurant._id,
      status: { $in: ['pending', 'confirmed'] },
    });

    const totalReservations = await Reservation.countDocuments({
      restaurantId: restaurant._id,
    });

    res.status(200).json({
      restaurant,
      stats: {
        activeReservations,
        totalReservations,
      },
    });
  } catch (error) {
    logger.error('Error fetching restaurant detail:', error);
    res.status(500).json({ error: { message: 'Failed to fetch restaurant detail' } });
  }
};

export const getMyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const filter = { createdBy: userId };
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, active, cancelled, byPlan, byStatus, recent, thisMonth, mrrAgg, user] = await Promise.all([
      Restaurant.countDocuments(filter),
      Restaurant.countDocuments({ ...filter, status: 'active' }),
      Restaurant.countDocuments({ ...filter, 'subscription.status': 'cancelled' }),
      Restaurant.aggregate([{ $match: { createdBy: userId } }, { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }]),
      Restaurant.aggregate([{ $match: { createdBy: userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Restaurant.find(filter).select('name status createdAt subscription.plan').sort({ createdAt: -1 }).limit(8),
      Restaurant.countDocuments({ ...filter, createdAt: { $gte: startOfMonth } }),
      Restaurant.aggregate([
        { $match: { createdBy: userId, status: 'active', 'subscription.plan': { $in: ['starter', 'pro'] } } },
        { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
      ]),
      User.findById(req.user!.userId).select('objectives'),
    ]);

    const starter = byPlan.find((s: any) => s._id === 'starter')?.count || 0;
    const pro = byPlan.find((s: any) => s._id === 'pro')?.count || 0;
    const pending = (byStatus.find((s: any) => s._id === 'inactive')?.count || 0);
    const activeStarter = mrrAgg.find((s: any) => s._id === 'starter')?.count || 0;
    const activePro = mrrAgg.find((s: any) => s._id === 'pro')?.count || 0;
    const mrr = activeStarter * 39 + activePro * 69;
    const conversionRate = total > 0 ? Math.round((active / total) * 100) : 0;
    const churnRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    // Average time to activation (in days) for restaurants that became active
    const activationAgg = await Restaurant.aggregate([
      { $match: { createdBy: userId, status: 'active', updatedAt: { $exists: true } } },
      { $project: { daysToActivate: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60 * 24] } } },
      { $group: { _id: null, avgDays: { $avg: '$daysToActivate' } } },
    ]);
    const avgActivationDays = Math.round((activationAgg[0]?.avgDays || 0) * 10) / 10;

    res.status(200).json({
      stats: {
        total,
        active,
        pending,
        cancelled,
        thisMonth,
        conversionRate,
        churnRate,
        avgActivationDays,
        byPlan: { starter, pro },
        revenue: { mrr, activeStarter, activePro },
        recent,
      },
      objectives: user?.objectives || { monthlySignups: 10 },
    });
  } catch (error) {
    logger.error('Error fetching commercial stats:', error);
    res.status(500).json({ error: { message: 'Failed to fetch stats' } });
  }
};

export const getMyObjectives = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('objectives');
    res.status(200).json({ objectives: user?.objectives || { monthlySignups: 10 } });
  } catch (error) {
    logger.error('Error fetching commercial objectives:', error);
    res.status(500).json({ error: { message: 'Failed to fetch objectives' } });
  }
};

export const updateMyObjectives = async (req: Request, res: Response): Promise<void> => {
  try {
    const { monthlySignups } = req.body;
    if (!monthlySignups || monthlySignups < 1 || monthlySignups > 100) {
      res.status(400).json({ error: { message: 'Objectif entre 1 et 100' } });
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { $set: { 'objectives.monthlySignups': monthlySignups, 'objectives.lastUpdated': new Date() } },
      { new: true }
    ).select('objectives');
    res.status(200).json({ objectives: user?.objectives });
  } catch (error) {
    logger.error('Error updating commercial objectives:', error);
    res.status(500).json({ error: { message: 'Failed to update objectives' } });
  }
};

const updateProfileSchema = z.object({
  firstName: z.string().max(50).trim().optional().or(z.literal('')),
  lastName: z.string().max(50).trim().optional().or(z.literal('')),
  phone: z.string().max(20).trim().optional().or(z.literal('')),
  photoUrl: z.string().max(500).optional().or(z.literal('')),
});

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('email firstName lastName phone photoUrl role trackingId');
    res.status(200).json({ user });
  } catch (error) {
    logger.error('Error fetching commercial profile:', error);
    res.status(500).json({ error: { message: 'Failed to fetch profile' } });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const updates: Record<string, any> = {};
    if (validated.firstName !== undefined) updates.firstName = validated.firstName;
    if (validated.lastName !== undefined) updates.lastName = validated.lastName;
    if (validated.phone !== undefined) updates.phone = validated.phone;
    if (validated.photoUrl !== undefined) updates.photoUrl = validated.photoUrl || null;

    const user = await User.findByIdAndUpdate(req.user!.userId, { $set: updates }, { new: true }).select('email firstName lastName phone photoUrl role');

    res.status(200).json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
      return;
    }
    logger.error('Error updating commercial profile:', error);
    res.status(500).json({ error: { message: 'Failed to update profile' } });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: { message: 'Mot de passe actuel requis et nouveau de 6 caractères min' } });
      return;
    }

    const user = await User.findById(req.user!.userId).select('password');
    if (!user) { res.status(404).json({ error: { message: 'User not found' } }); return; }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) { res.status(400).json({ error: { message: 'Mot de passe actuel incorrect' } }); return; }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Mot de passe changé' });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({ error: { message: 'Failed to change password' } });
  }
};

export const uploadPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: { message: 'Aucun fichier envoyé' } });
      return;
    }

    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ error: { message: 'User not found' } }); return; }

    if (user.photoUrl) {
      try { await deleteFromGCS(user.photoUrl); } catch { /* old file may not exist */ }
    }

    const photoUrl = await uploadToGCS(req.file, 'uploads/commercial-profiles');
    user.photoUrl = photoUrl;
    await user.save();

    res.status(200).json({ user: { photoUrl: user.photoUrl } });
  } catch (error) {
    logger.error('Error uploading commercial photo:', error);
    res.status(500).json({ error: { message: 'Failed to upload photo' } });
  }
};

export const getRestaurantNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const note = await CommercialNote.findOne({
      restaurantId: req.params.id,
      userId: req.user!.userId,
    });

    res.status(200).json({ note: note?.text || '' });
  } catch (error) {
    logger.error('Error fetching commercial note:', error);
    res.status(500).json({ error: { message: 'Failed to fetch note' } });
  }
};

export const updateRestaurantNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || text.length > 2000) {
      res.status(400).json({ error: { message: 'Note entre 0 et 2000 caractères' } });
      return;
    }

    const note = await CommercialNote.findOneAndUpdate(
      { restaurantId: req.params.id, userId: req.user!.userId },
      { text },
      { upsert: true, new: true }
    );

    res.status(200).json({ note: note.text });
  } catch (error) {
    logger.error('Error updating commercial note:', error);
    res.status(500).json({ error: { message: 'Failed to update note' } });
  }
};
