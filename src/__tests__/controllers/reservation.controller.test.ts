import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { createTestRestaurant, createTestUser, createTestReservation } from '../helpers/fixtures';
import jwt from 'jsonwebtoken';

describe('Reservation Controller', () => {
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

  describe('GET /api/reservations', () => {
    it('should return all reservations for restaurant', async () => {
      await createTestReservation(restaurantId, { customerName: 'John Doe' });
      await createTestReservation(restaurantId, { customerName: 'Jane Smith' });

      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.reservations).toHaveLength(2);
    });

    it('should filter reservations by date range', async () => {
      await createTestReservation(restaurantId, {
        date: new Date('2026-01-10'),
      });
      await createTestReservation(restaurantId, {
        date: new Date('2026-01-20'),
      });
      await createTestReservation(restaurantId, {
        date: new Date('2026-01-30'),
      });

      const response = await request(app)
        .get('/api/reservations?startDate=2026-01-15&endDate=2026-01-25')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.reservations).toHaveLength(1);
    });

    it('should filter reservations by status', async () => {
      await createTestReservation(restaurantId, { status: 'pending' });
      await createTestReservation(restaurantId, { status: 'confirmed' });
      await createTestReservation(restaurantId, { status: 'cancelled' });

      const response = await request(app)
        .get('/api/reservations?status=confirmed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.reservations).toHaveLength(1);
      expect(response.body.reservations[0].status).toBe('confirmed');
    });

    it('should fail without authentication', async () => {
      await request(app)
        .get('/api/reservations')
        .expect(401);
    });
  });

  describe('GET /api/reservations/:id', () => {
    it('should return a single reservation', async () => {
      const reservation = await createTestReservation(restaurantId, {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      const response = await request(app)
        .get(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.reservation.customerName).toBe('John Doe');
      expect(response.body.reservation.customerEmail).toBe('john@example.com');
    });

    it('should fail for non-existent reservation', async () => {
      await request(app)
        .get('/api/reservations/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /api/reservations', () => {
    it('should create a new reservation', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0612345678',
          date: '2026-02-15',
          time: '19:30',
          numberOfGuests: 4,
          notes: 'Window seat preferred',
        })
        .expect(201);

      expect(response.body.reservation.customerName).toBe('John Doe');
      expect(response.body.reservation.numberOfGuests).toBe(4);
      expect(response.body.reservation.status).toBe('pending');
    });

    it('should fail with invalid email', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'John Doe',
          customerEmail: 'invalid-email',
          customerPhone: '0612345678',
          date: '2026-02-15',
          time: '19:30',
          numberOfGuests: 4,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should fail with invalid date format', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0612345678',
          date: '15/02/2026',
          time: '19:30',
          numberOfGuests: 4,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should fail with zero guests', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0612345678',
          date: '2026-02-15',
          time: '19:30',
          numberOfGuests: 0,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'John Doe',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/reservations/:id', () => {
    it('should update reservation status', async () => {
      const reservation = await createTestReservation(restaurantId, {
        status: 'pending',
      });

      const response = await request(app)
        .put(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(response.body.reservation.status).toBe('confirmed');
    });

    it('should update reservation details', async () => {
      const reservation = await createTestReservation(restaurantId, {
        numberOfGuests: 2,
        time: '19:00',
      });

      const response = await request(app)
        .put(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          numberOfGuests: 6,
          time: '20:00',
        })
        .expect(200);

      expect(response.body.reservation.numberOfGuests).toBe(6);
      expect(response.body.reservation.time).toBe('20:00');
    });

    it('should fail to update non-existent reservation', async () => {
      await request(app)
        .put('/api/reservations/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'confirmed' })
        .expect(404);
    });
  });

  describe('DELETE /api/reservations/:id', () => {
    it('should delete a reservation', async () => {
      const reservation = await createTestReservation(restaurantId);

      await request(app)
        .delete(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should fail to delete non-existent reservation', async () => {
      await request(app)
        .delete('/api/reservations/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Reservation validation', () => {
    it('should accept valid time formats', async () => {
      const validTimes = ['09:00', '12:30', '19:45', '23:59'];

      for (const time of validTimes) {
        const response = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            customerPhone: '0612345678',
            date: '2026-02-15',
            time,
            numberOfGuests: 2,
          })
          .expect(201);

        expect(response.body.reservation.time).toBe(time);
      }
    });

    it('should reject invalid time formats', async () => {
      const invalidTimes = ['9:00', '12:5', '25:00', '12:60', 'abc'];

      for (const time of invalidTimes) {
        await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            customerPhone: '0612345678',
            date: '2026-02-15',
            time,
            numberOfGuests: 2,
          })
          .expect(400);
      }
    });
  });
});
