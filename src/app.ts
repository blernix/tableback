import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import logger from './utils/logger';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import restaurantRoutes from './routes/restaurant.routes';
import menuRoutes from './routes/menu.routes';
import publicRoutes from './routes/public.routes';
import reservationRoutes from './routes/reservation.routes';
import dayBlockRoutes from './routes/dayblock.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';
import { sanitizeRequest } from './middleware/sanitize.middleware';

// Load environment variables
dotenv.config();

const app: Application = express();

// Security middleware with Content Security Policy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for API usage
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      message: 'Too many requests from this IP, please try again after 15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Request size limits to prevent DoS attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware
app.use(cookieParser());

// Error handler for malformed JSON
app.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof SyntaxError && 'body' in error) {
    logger.error('Malformed JSON in request', { path: req.path, error: error.message });
    res.status(400).json({ error: { message: 'Invalid JSON in request body' } });
    return;
  }
  next(error);
});

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
const isDevelopment = process.env.NODE_ENV === 'development';

app.use(
  cors({
    origin: isDevelopment ? (_origin, callback) => {
      // Allow all origins in development for easier testing
      callback(null, true);
    } : corsOrigins,
    credentials: true,
  })
);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Input sanitization middleware
app.use(sanitizeRequest);

// Routes
app.use('/', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/day-blocks', dayBlockRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/public', publicRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
    },
  });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Handle Multer errors specifically
  if (err instanceof multer.MulterError) {
    logger.error('Multer error:', err);

    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large. Maximum size is 10MB';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected field name';
    }

    res.status(400).json({
      error: {
        message,
        code: err.code,
      },
    });
    return;
  }

  // Handle file filter errors
  if (err.message && err.message.includes('Only PDF and image files')) {
    logger.error('File type error:', err);
    res.status(400).json({
      error: {
        message: err.message,
      },
    });
    return;
  }

  // Generic error handling
  logger.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
});

export default app;
