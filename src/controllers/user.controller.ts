import { Request, Response } from 'express';
import User from '../models/User.model';
import logger from '../utils/logger';
import { z } from 'zod';

// Validation schemas
const createServerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateServerSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// Get all server users for the authenticated restaurant
export const getServerUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(403).json({ error: { message: 'User not associated with any restaurant' } });
      return;
    }

    const servers = await User.find({
      restaurantId: req.user.restaurantId,
      role: 'server',
    })
      .select('email status createdAt updatedAt')
      .sort({ createdAt: -1 });

    res.status(200).json({ servers });
  } catch (error) {
    logger.error('Error fetching server users:', error);
    res.status(500).json({ error: { message: 'Failed to fetch server users' } });
  }
};

// Create a new server user
export const createServerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(403).json({ error: { message: 'User not associated with any restaurant' } });
      return;
    }

    const validatedData = createServerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      res.status(409).json({ error: { message: 'User already exists with this email' } });
      return;
    }

    // Create server user
    const server = new User({
      email: validatedData.email,
      password: validatedData.password,
      role: 'server',
      restaurantId: req.user.restaurantId,
    });

    await server.save();

    logger.info(`Server user created: ${server.email} for restaurant ID: ${req.user.restaurantId}`);

    res.status(201).json({
      server: {
        id: server._id,
        email: server.email,
        role: server.role,
        status: server.status,
        restaurantId: server.restaurantId,
        createdAt: server.createdAt,
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

    logger.error('Error creating server user:', error);
    res.status(500).json({ error: { message: 'Failed to create server user' } });
  }
};

// Update a server user
export const updateServerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user?.restaurantId) {
      res.status(403).json({ error: { message: 'User not associated with any restaurant' } });
      return;
    }

    const validatedData = updateServerSchema.parse(req.body);

    // Find server and verify it belongs to the restaurant
    const server = await User.findOne({
      _id: id,
      restaurantId: req.user.restaurantId,
      role: 'server',
    });

    if (!server) {
      res.status(404).json({ error: { message: 'Server user not found' } });
      return;
    }

    // Update fields
    if (validatedData.email) server.email = validatedData.email;
    if (validatedData.password) server.password = validatedData.password;
    if (validatedData.status) server.status = validatedData.status;

    await server.save();

    logger.info(`Server user updated: ${server.email} (ID: ${server._id})`);

    res.status(200).json({
      server: {
        id: server._id,
        email: server.email,
        role: server.role,
        status: server.status,
        restaurantId: server.restaurantId,
        updatedAt: server.updatedAt,
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

    logger.error('Error updating server user:', error);
    res.status(500).json({ error: { message: 'Failed to update server user' } });
  }
};

// Delete a server user
export const deleteServerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user?.restaurantId) {
      res.status(403).json({ error: { message: 'User not associated with any restaurant' } });
      return;
    }

    // Find and delete server, verify it belongs to the restaurant
    const server = await User.findOneAndDelete({
      _id: id,
      restaurantId: req.user.restaurantId,
      role: 'server',
    });

    if (!server) {
      res.status(404).json({ error: { message: 'Server user not found' } });
      return;
    }

    logger.info(`Server user deleted: ${server.email} (ID: ${server._id})`);

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting server user:', error);
    res.status(500).json({ error: { message: 'Failed to delete server user' } });
  }
};
