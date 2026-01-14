import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { createTestRestaurant, createTestUser, createTestReservation } from '../helpers/fixtures';
import jwt from 'jsonwebtoken';
import Restaurant from '../../models/Restaurant.model';

describe('Restaurant Controller', () => {
  let app: Express;
  let token: string;
  let restaurantId: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    const restaurant = await createTestRestaurant();
    restaurantId = restaurant._id.toString();

    const user = await createTestUser(restaurantId);

    token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        restaurantId,
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
  });

  describe('PUT /api/restaurant/reservation-config', () => {
    it('should update reservation config with averagePrice', async () => {
      const response = await request(app)
        .put('/api/restaurant/reservation-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          defaultDuration: 120,
          useOpeningHours: true,
          averagePrice: 35.50,
        })
        .expect(200);

      expect(response.body.reservationConfig.defaultDuration).toBe(120);
      expect(response.body.reservationConfig.useOpeningHours).toBe(true);
      expect(response.body.reservationConfig.averagePrice).toBe(35.50);

      // Verify in database
      const restaurant = await Restaurant.findById(restaurantId);
      expect(restaurant?.reservationConfig.averagePrice).toBe(35.50);
    });

    it('should update only averagePrice', async () => {
      const response = await request(app)
        .put('/api/restaurant/reservation-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          averagePrice: 25.00,
        })
        .expect(200);

      expect(response.body.reservationConfig.averagePrice).toBe(25.00);
      // Other fields should remain unchanged
      expect(response.body.reservationConfig.defaultDuration).toBe(90);
      expect(response.body.reservationConfig.useOpeningHours).toBe(true);
    });

    it('should reject negative averagePrice', async () => {
      const response = await request(app)
        .put('/api/restaurant/reservation-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          averagePrice: -10,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should accept zero averagePrice', async () => {
      const response = await request(app)
        .put('/api/restaurant/reservation-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          averagePrice: 0,
        })
        .expect(200);

      expect(response.body.reservationConfig.averagePrice).toBe(0);
    });

    it('should work without averagePrice (optional field)', async () => {
      const response = await request(app)
        .put('/api/restaurant/reservation-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          defaultDuration: 60,
        })
        .expect(200);

      expect(response.body.reservationConfig.defaultDuration).toBe(60);
    });

    it('should fail without authentication', async () => {
      await request(app)
        .put('/api/restaurant/reservation-config')
        .send({
          averagePrice: 30,
        })
        .expect(401);
    });
  });

  describe('GET /api/restaurant/dashboard-stats', () => {
    beforeEach(async () => {
      // Set averagePrice for revenue calculations
      await Restaurant.findByIdAndUpdate(restaurantId, {
        $set: { 'reservationConfig.averagePrice': 25 },
      });
    });

    it('should calculate revenue for today with averagePrice configured', async () => {
      // Create reservations for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await createTestReservation(restaurantId, {
        date: today,
        numberOfGuests: 4,
        status: 'confirmed',
      });
      await createTestReservation(restaurantId, {
        date: today,
        numberOfGuests: 2,
        status: 'confirmed',
      });

      const response = await request(app)
        .get('/api/restaurant/dashboard-stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.today.guests).toBe(6);
      expect(response.body.today.estimatedRevenue).toBe(150); // 6 guests * 25€
    });

    it('should calculate revenue for this week', async () => {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      // Create reservations for this week
      await createTestReservation(restaurantId, {
        date: new Date(startOfWeek.getTime() + 1 * 24 * 60 * 60 * 1000),
        numberOfGuests: 4,
        status: 'confirmed',
      });
      await createTestReservation(restaurantId, {
        date: new Date(startOfWeek.getTime() + 2 * 24 * 60 * 60 * 1000),
        numberOfGuests: 3,
        status: 'pending',
      });
      await createTestReservation(restaurantId, {
        date: new Date(startOfWeek.getTime() + 3 * 24 * 60 * 60 * 1000),
        numberOfGuests: 5,
        status: 'confirmed',
      });

      const response = await request(app)
        .get('/api/restaurant/dashboard-stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.thisWeek.guests).toBe(12);
      expect(response.body.thisWeek.estimatedRevenue).toBe(300); // 12 guests * 25€
      expect(response.body.thisWeek.reservations).toBe(3);
    });

    it('should exclude cancelled reservations from revenue calculation', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await createTestReservation(restaurantId, {
        date: today,
        numberOfGuests: 4,
        status: 'confirmed',
      });
      await createTestReservation(restaurantId, {
        date: today,
        numberOfGuests: 10,
        status: 'cancelled', // Should be excluded
      });

      const response = await request(app)
        .get('/api/restaurant/dashboard-stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.today.guests).toBe(4);
      expect(response.body.today.estimatedRevenue).toBe(100); // 4 guests * 25€, not 14
    });

    it('should return zero revenue when averagePrice is not configured', async () => {
      // Remove averagePrice
      await Restaurant.findByIdAndUpdate(restaurantId, {
        $unset: { 'reservationConfig.averagePrice': '' },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await createTestReservation(restaurantId, {
        date: today,
        numberOfGuests: 4,
        status: 'confirmed',
      });

      const response = await request(app)
        .get('/api/restaurant/dashboard-stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.today.guests).toBe(4);
      expect(response.body.today.estimatedRevenue).toBe(0); // No averagePrice configured
    });

    it('should return zero revenue when no reservations exist', async () => {
      const response = await request(app)
        .get('/api/restaurant/dashboard-stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.today.guests).toBe(0);
      expect(response.body.today.estimatedRevenue).toBe(0);
      expect(response.body.thisWeek.guests).toBe(0);
      expect(response.body.thisWeek.estimatedRevenue).toBe(0);
    });

    it('should calculate revenue with decimal averagePrice', async () => {
      // Set decimal averagePrice
      await Restaurant.findByIdAndUpdate(restaurantId, {
        $set: { 'reservationConfig.averagePrice': 27.50 },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await createTestReservation(restaurantId, {
        date: today,
        numberOfGuests: 3,
        status: 'confirmed',
      });

      const response = await request(app)
        .get('/api/restaurant/dashboard-stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.today.guests).toBe(3);
      expect(response.body.today.estimatedRevenue).toBe(82.50); // 3 * 27.50
    });

    it('should fail without authentication', async () => {
      await request(app)
        .get('/api/restaurant/dashboard-stats')
        .expect(401);
    });

    it('should return correct structure with all new fields', async () => {
      const response = await request(app)
        .get('/api/restaurant/dashboard-stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Check structure
      expect(response.body.today).toBeDefined();
      expect(response.body.today.reservations).toBeDefined();
      expect(response.body.today.guests).toBeDefined();
      expect(response.body.today.estimatedRevenue).toBeDefined();
      expect(response.body.today.upcomingReservations).toBeDefined();

      expect(response.body.thisWeek).toBeDefined();
      expect(response.body.thisWeek.reservations).toBeDefined();
      expect(response.body.thisWeek.guests).toBeDefined();
      expect(response.body.thisWeek.estimatedRevenue).toBeDefined();
      expect(response.body.thisWeek.avgOccupation).toBeDefined();

      expect(response.body.menu).toBeDefined();
      expect(response.body.menu.categories).toBeDefined();
      expect(response.body.menu.dishes).toBeDefined();
    });
  });
});
