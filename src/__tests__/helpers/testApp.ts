import express, { Express } from 'express';
import cors from 'cors';
import authRoutes from '../../routes/auth.routes';
import adminRoutes from '../../routes/admin.routes';
import restaurantRoutes from '../../routes/restaurant.routes';
import menuRoutes from '../../routes/menu.routes';
import reservationRoutes from '../../routes/reservation.routes';
import dayBlockRoutes from '../../routes/dayblock.routes';
import publicRoutes from '../../routes/public.routes';

/**
 * Create a test Express app with all routes configured
 */
export function createTestApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/restaurant', restaurantRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/day-blocks', dayBlockRoutes);
  app.use('/api/public', publicRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
