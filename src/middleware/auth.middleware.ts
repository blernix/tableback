import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import logger from '../utils/logger';

interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'restaurant' | 'server';
  restaurantId?: string;
}

// Authenticate JWT token from Authorization header
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: { message: 'Access token required' } });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not defined');
      res.status(500).json({ error: { message: 'Server configuration error' } });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    req.user = {
      userId: new Types.ObjectId(decoded.userId),
      email: decoded.email,
      role: decoded.role,
      restaurantId: decoded.restaurantId ? new Types.ObjectId(decoded.restaurantId) : undefined,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: { message: 'Token expired' } });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: { message: 'Invalid token' } });
      return;
    }
    logger.error('Authentication error:', error);
    res.status(500).json({ error: { message: 'Authentication failed' } });
  }
};

// Flexible authentication: accepts token from cookie OR Authorization header
// Primarily used for SSE connections where EventSource cannot send custom headers
export const authenticateFlexible = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Try to get token from Authorization header first
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // If no header token, try cookie
    if (!token && req.cookies) {
      token = req.cookies.auth_token;
    }

    // If still no token, try query parameter (fallback for compatibility)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      res.status(401).json({ error: { message: 'Access token required' } });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not defined');
      res.status(500).json({ error: { message: 'Server configuration error' } });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    req.user = {
      userId: new Types.ObjectId(decoded.userId),
      email: decoded.email,
      role: decoded.role,
      restaurantId: decoded.restaurantId ? new Types.ObjectId(decoded.restaurantId) : undefined,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: { message: 'Token expired' } });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: { message: 'Invalid token' } });
      return;
    }
    logger.error('Flexible authentication error:', error);
    res.status(500).json({ error: { message: 'Authentication failed' } });
  }
};

// Authorize by role
export const authorizeRole = (allowedRoles: Array<'admin' | 'restaurant' | 'server'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { message: 'User not authenticated' } });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: { message: 'Forbidden: Insufficient permissions' }
      });
      return;
    }

    next();
  };
};

// Authorize restaurant access (ensure user can only access their own restaurant)
export const authorizeRestaurant = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: { message: 'User not authenticated' } });
    return;
  }

  // Admin can access any restaurant
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Restaurant and server users can only access their own restaurant
  const restaurantId = req.params.id || req.params.restaurantId;

  if (!req.user.restaurantId) {
    res.status(403).json({ error: { message: 'User not associated with any restaurant' } });
    return;
  }

  if (restaurantId !== req.user.restaurantId.toString()) {
    res.status(403).json({
      error: { message: 'Forbidden: Cannot access other restaurants' }
    });
    return;
  }

  next();
};
