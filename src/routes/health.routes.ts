import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { getConnectedClientsCount } from '../services/sseService';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    connections: {
      sse: getConnectedClientsCount(),
      mongodb: {
        poolSize: mongoose.connection.db?.admin ? 'connected' : 'n/a',
      },
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    },
  };

  res.status(200).json(health);
});

// Debug endpoint for testing password reset in development only
router.get('/debug/password-reset-token/:userId', (req: Request, res: Response) => {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).json({ error: { message: 'Not found' } });
    return;
  }

  const { userId } = req.params;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    res.status(500).json({ error: { message: 'JWT_SECRET not configured' } });
    return;
  }

  // Generate a password reset token
  const payload = {
    type: 'password-reset',
    userId,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
  });

  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  res.status(200).json({
    userId,
    token,
    resetLink,
    expiresIn: '24h',
    note: 'This endpoint is for development testing only. Do not expose in production.',
  });
});

export default router;
