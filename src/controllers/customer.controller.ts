import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer.model';
import Reservation from '../models/Reservation.model';
import logger from '../utils/logger';
import { z } from 'zod';

const updateCustomerSchema = z.object({
  name: z.string().min(1).trim().optional(),
  phone: z.string().min(1).trim().optional(),
  tags: z.array(z.string().min(1).trim()).optional(),
  notes: z.string().max(2000).trim().optional(),
});

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').trim(),
  email: z.string().email('Email invalide').trim().toLowerCase(),
  phone: z.string().min(1, 'Le téléphone est requis').trim(),
  tags: z.array(z.string().min(1).trim()).optional().default([]),
  notes: z.string().max(2000).trim().optional().default(''),
  marketingConsent: z.boolean().optional().default(false),
});

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const { search, sort, tag } = req.query;

    const filter: Record<string, unknown> = { restaurantId: req.user.restaurantId };

    if (tag && typeof tag === 'string') {
      filter.tags = tag;
    }

    if (search && typeof search === 'string') {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }

    let sortOption: Record<string, 1 | -1> = { totalReservations: -1 };
    if (sort === 'name') sortOption = { name: 1 };
    else if (sort === 'recent') sortOption = { lastVisit: -1 };
    else if (sort === 'oldest') sortOption = { lastVisit: 1 };
    else if (sort === 'first') sortOption = { firstVisit: 1 };

    const [customers, total] = await Promise.all([
      Customer.find(filter).select('-__v').sort(sortOption).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limit);

    res.status(200).json({
      customers,
      pagination: { total, page, pages, limit },
    });
  } catch (error) {
    logger.error('Error fetching customers:', error);
    res.status(500).json({ error: { message: 'Failed to fetch customers' } });
  }
};

export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    const customer = await Customer.findOne({
      _id: id,
      restaurantId: req.user.restaurantId,
    }).select('-__v');

    if (!customer) {
      res.status(404).json({ error: { message: 'Customer not found' } });
      return;
    }

    const reservations = await Reservation.find({
      restaurantId: req.user.restaurantId,
      customerEmail: customer.email,
    })
      .sort({ date: -1 })
      .limit(50)
      .select('-__v')
      .lean();

    res.status(200).json({ customer, reservations });
  } catch (error) {
    logger.error('Error fetching customer:', error);
    res.status(500).json({ error: { message: 'Failed to fetch customer' } });
  }
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;
    const validatedData = updateCustomerSchema.parse(req.body);

    const customer = await Customer.findOneAndUpdate(
      { _id: id, restaurantId: req.user.restaurantId },
      { $set: validatedData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!customer) {
      res.status(404).json({ error: { message: 'Customer not found' } });
      return;
    }

    logger.info(`Customer updated: ${customer.email} (ID: ${customer._id})`);

    res.status(200).json({ customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
      return;
    }
    logger.error('Error updating customer:', error);
    res.status(500).json({ error: { message: 'Failed to update customer' } });
  }
};

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = createCustomerSchema.parse(req.body);

    const existing = await Customer.findOne({
      restaurantId: req.user.restaurantId,
      email: validatedData.email,
    });

    if (existing) {
      res.status(409).json({ error: { message: 'Un client avec cet email existe déjà' } });
      return;
    }

    const customer = await Customer.create({
      restaurantId: req.user.restaurantId,
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone,
      tags: validatedData.tags,
      notes: validatedData.notes,
      marketingConsent: validatedData.marketingConsent,
      firstVisit: new Date(),
      totalReservations: 0,
    });

    logger.info(`Customer created: ${customer.email} (ID: ${customer._id})`);

    res.status(201).json({ customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
      return;
    }
    logger.error('Error creating customer:', error);
    res.status(500).json({ error: { message: 'Failed to create customer' } });
  }
};

export const syncCustomer = async (restaurantId: mongoose.Types.ObjectId, email: string): Promise<void> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    logger.info(`[syncCustomer] Syncing customer: ${normalizedEmail} for restaurant ${restaurantId}`);

    const objectId = new mongoose.Types.ObjectId(restaurantId);

    const stats = await Reservation.aggregate([
      {
        $match: {
          restaurantId: objectId,
          customerEmail: normalizedEmail,
        },
      },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: null,
          totalReservations: { $sum: 1 },
          completedReservations: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          cancelledReservations: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          lastVisit: { $first: '$date' },
          firstVisit: { $last: '$date' },
          totalGuests: { $sum: '$numberOfGuests' },
          customerName: { $first: '$customerName' },
          customerPhone: { $first: '$customerPhone' },
          consentMarketing: { $first: '$consentMarketing' },
        },
      },
    ]);

    if (!stats.length) {
      await Customer.deleteOne({ restaurantId, email: normalizedEmail });
      logger.info(`[syncCustomer] No reservations found for ${normalizedEmail}, customer deleted if existed`);
      return;
    }

    const s = stats[0];
    const customerName = s.customerName || 'Inconnu';
    const customerPhone = s.customerPhone || '';
    const avgGuests = s.totalReservations > 0 ? Math.round((s.totalGuests / s.totalReservations) * 10) / 10 : 0;

    const update: Record<string, unknown> = {
      name: customerName,
      phone: customerPhone,
      totalReservations: s.totalReservations,
      completedReservations: s.completedReservations,
      cancelledReservations: s.cancelledReservations,
      noShowCount: s.totalReservations - s.completedReservations - s.cancelledReservations,
      lastVisit: s.lastVisit,
      firstVisit: s.firstVisit,
      averageGuests: avgGuests,
      marketingConsent: s.consentMarketing || false,
    };

    const result = await Customer.findOneAndUpdate(
      { restaurantId, email: normalizedEmail },
      {
        $set: update,
        $setOnInsert: {
          restaurantId,
          email: normalizedEmail,
        },
      },
      { upsert: true, new: true }
    );

    logger.info(`[syncCustomer] ✅ Customer synced: ${normalizedEmail}, reservations: ${s.totalReservations}, upserted: ${result.isNew ? 'yes' : 'no'}`);
  } catch (error) {
    logger.error('❌ [syncCustomer] Error syncing customer:', error);
  }
};

export const searchCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 1) {
      res.status(200).json({ customers: [] });
      return;
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const customers = await Customer.find({
      restaurantId: req.user.restaurantId,
      $or: [{ name: regex }, { email: regex }],
    })
      .select('name email phone totalReservations lastVisit')
      .sort({ totalReservations: -1 })
      .limit(10)
      .lean();

    res.status(200).json({ customers });
  } catch (error) {
    logger.error('Error searching customers:', error);
    res.status(500).json({ error: { message: 'Failed to search customers' } });
  }
};

export const exportCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { tag, format } = req.query;
    const filter: Record<string, unknown> = { restaurantId: req.user.restaurantId };

    if (tag && typeof tag === 'string') {
      filter.tags = tag;
    }

    const customers = await Customer.find(filter)
      .select('name email phone totalReservations lastVisit tags marketingConsent')
      .sort({ totalReservations: -1 })
      .lean();

    const restaurantName = (req as any).restaurantName || 'Restaurant';

    // Only export customers who consented to marketing (RGPD guard)
    const exportableCustomers = customers.filter((c) => c.marketingConsent === true);

    if (format === 'json') {
      const data = exportableCustomers.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        totalReservations: c.totalReservations,
        lastVisit: c.lastVisit,
        tags: c.tags,
        marketingConsent: c.marketingConsent,
      }));

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="clients-marketing-${restaurantName}-${new Date().toISOString().split('T')[0]}.json"`);
      res.status(200).json(data);
      return;
    }

    // CSV format (default) — only marketing-consented customers
    const header = ['Nom', 'Email', 'Téléphone', 'Réservations', 'Dernière visite', 'Tags', 'Consentement marketing'];
    const rows = exportableCustomers.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.email}"`,
      `"${c.phone.replace(/"/g, '""')}"`,
      c.totalReservations,
      c.lastVisit ? new Date(c.lastVisit).toISOString().split('T')[0] : '',
      `"${(c.tags || []).join(', ')}"`,
      c.marketingConsent ? 'Oui' : 'Non',
    ]);

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

    // BOM for Excel UTF-8
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clients-marketing-${restaurantName}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(bom + csv);
  } catch (error) {
    logger.error('Error exporting customers:', error);
    res.status(500).json({ error: { message: 'Failed to export customers' } });
  }
};
