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
import twoFactorRoutes from './routes/twoFactor.routes';
import billingRoutes from './routes/billing.routes';
import { sanitizeRequest } from './middleware/sanitize.middleware';
import { handleWebhook } from './controllers/billing.controller';

// Load environment variables
dotenv.config();

const app: Application = express();

// Configuration trust proxy pour détection correcte d'IP derrière Nginx
app.set('trust proxy', true);
// Stripe webhook endpoint needs raw body (before JSON parsing)
// This must come BEFORE express.json() middleware
// Handle webhook directly here to preserve raw body
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  handleWebhook
);

// Security middleware
// CSP is disabled because this is an API server, not a web page server
// CSP headers only make sense for HTML pages that execute scripts
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false, // Disable for API usage
  })
);

// Request size limits to prevent DoS attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware
app.use(cookieParser());

// Rate limiting - increased for intensive dashboard usage
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (increased from 100 for legitimate usage)
  message: {
    error: {
      message: 'Too many requests from this IP, please try again after 15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Add handler to log rate limit blocks
  handler: (req, res) => {
    logger.warn(`⚠️ Rate limit exceeded for ${req.ip}: ${req.method} ${req.path}`);
    res.status(429).json({
      error: {
        message: 'Too many requests from this IP, please try again after 15 minutes'
      }
    });
  },
});

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
// Allow all origins since public endpoints are protected by API key
// This is necessary for the embeddable widget to work on any domain
app.use(
  cors({
    origin: true, // Accept all origins
    credentials: true,
  })
);

// Request timeout middleware (except for SSE)
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip timeout for SSE connections
  if (req.path === '/api/notifications/stream') {
    return next();
  }

  // Set timeout for regular requests (30 seconds)
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      logger.error(`⏱️ Request timeout (30s): ${req.method} ${req.path}`, {
        headers: req.headers,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined
      });
      res.status(408).json({
        error: { message: 'Request timeout - operation took too long' }
      });
    } else {
      logger.warn(`⏱️ Request timeout (30s) but headers already sent: ${req.method} ${req.path}`);
    }
  }, 30000);

  // Clear timeout when response finishes or closes
  const clearTimeoutHandler = () => {
    clearTimeout(timeoutId);
  };

  res.on('finish', clearTimeoutHandler);
  res.on('close', clearTimeoutHandler);

  next();
});

// Request logging middleware with response completion tracking
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  logger.info(`[${requestId}] → ${req.method} ${req.originalUrl || req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')?.substring(0, 50)
  });

  // Track when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] ← ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${duration}ms)`, {
      duration,
      status: res.statusCode
    });
  });

  // Track if response closes without finishing (connection error)
  res.on('close', () => {
    if (!res.writableEnded) {
      const duration = Date.now() - startTime;
      logger.warn(`[${requestId}] ✖ ${req.method} ${req.originalUrl || req.url} - Connection closed before response finished (${duration}ms)`);
    }
  });

  next();
});

// Input sanitization middleware
app.use(sanitizeRequest);

// Apply rate limiting to all API routes (after logging to see blocked requests)
app.use('/api/', limiter);

// Serve widget.js dynamically with correct frontend URL
// This must come BEFORE express.static to override the static file
import { readFileSync } from 'fs';
import { join } from 'path';

app.get('/widget.js', (_req: Request, res: Response) => {
  try {
    // Read the widget template
    const widgetPath = join(__dirname, '../public/widget.js');
    let widgetContent = readFileSync(widgetPath, 'utf-8');

    // Get frontend URL from environment variable
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Replace the default URL with the actual frontend URL
    widgetContent = widgetContent.replace(
      /frontendUrl: currentScript\.getAttribute\('data-frontend-url'\) \|\| '[^']*'/,
      `frontendUrl: currentScript.getAttribute('data-frontend-url') || '${frontendUrl}'`
    );

    // Set proper headers for JavaScript
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(widgetContent);
  } catch (error) {
    logger.error('Error loading widget.js:', error);
    res.status(500).send('// Error loading widget');
  }
});

// Serve static files (other than widget.js) with CORS headers
app.use(express.static('public', {
  setHeaders: (res, path) => {
    // Allow JS files to be loaded from any origin (including file://)
    if (path.endsWith('.js')) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

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
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/billing', billingRoutes);
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
