import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { createTestRestaurant, createTestUser, createTestAdmin } from '../helpers/fixtures';
import jwt from 'jsonwebtoken';

describe('Auth Controller', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const restaurant = await createTestRestaurant();
      await createTestUser(restaurant._id.toString(), {
        email: 'user@test.com',
        password: '$2b$10$8K1p/a0dL3.F4K5K5K5K5u5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5' // bcrypt hash of 'password123'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('user@test.com');
      expect(response.body.user.role).toBe('restaurant');
      expect(response.body.user).not.toHaveProperty('password');

      // Verify JWT token
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET || 'test-secret') as any;
      expect(decoded.userId).toBeDefined();
      expect(decoded.email).toBe('user@test.com');
    });

    it('should fail login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    it('should fail login with invalid password', async () => {
      const restaurant = await createTestRestaurant();
      await createTestUser(restaurant._id.toString(), {
        email: 'user@test.com',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    it('should fail login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should fail login with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const restaurant = await createTestRestaurant();
      const user = await createTestUser(restaurant._id.toString());

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          restaurantId: user.restaurantId?.toString(),
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Logout successful');
    });

    it('should handle logout without token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Role-based access', () => {
    it('should allow admin to access admin routes', async () => {
      const admin = await createTestAdmin();

      const token = jwt.sign(
        {
          userId: admin._id.toString(),
          email: admin.email,
          role: admin.role,
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .get('/api/admin/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('restaurants');
    });

    it('should prevent restaurant user from accessing admin routes', async () => {
      const restaurant = await createTestRestaurant();
      const user = await createTestUser(restaurant._id.toString());

      const token = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          restaurantId: user.restaurantId?.toString(),
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      await request(app)
        .get('/api/admin/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
