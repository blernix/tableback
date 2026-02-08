import request from 'supertest';
import mongoose from 'mongoose';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { createTestRestaurant, createTestUser } from '../helpers/fixtures';
import Restaurant from '../../models/Restaurant.model';
import User from '../../models/User.model';
import jwt from 'jsonwebtoken';

describe('User Controller (Server Management)', () => {
  let app: Express;
  let restaurantId: string;
  let restaurantToken: string;
  let serverUserId: string;

  beforeAll(async () => {
    app = createTestApp();
    
    // Create test restaurant
    const restaurant = await createTestRestaurant({
      name: 'Test Restaurant',
      address: '123 Test St',
      phone: '1234567890',
      email: 'test@restaurant.com',
    });
    restaurantId = restaurant._id.toString();

    // Create restaurant user
    const restaurantUser = await createTestUser(restaurantId, {
      email: 'restaurant@test.com',
      password: 'password123',
      role: 'restaurant',
    });

    // Generate token for restaurant user
    restaurantToken = jwt.sign(
      {
        userId: restaurantUser._id.toString(),
        email: restaurantUser.email,
        role: restaurantUser.role,
        restaurantId: restaurant._id.toString(),
      },
      process.env.JWT_SECRET!
    );
  });

  afterEach(async () => {
    // Clean up server users after each test
    await User.deleteMany({ role: 'server' });
  });

  describe('POST /api/users/servers', () => {
    it('should create a new server user', async () => {
      const response = await request(app)
        .post('/api/users/servers')
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          email: 'server1@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.server).toBeDefined();
      expect(response.body.server.email).toBe('server1@test.com');
      expect(response.body.server.role).toBe('server');
      expect(response.body.server.status).toBe('active');
      expect(response.body.server.restaurantId).toBe(restaurantId);

      serverUserId = response.body.server.id;
    });

    it('should not create server with duplicate email', async () => {
      // Create first server
      await request(app)
        .post('/api/users/servers')
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          email: 'duplicate@test.com',
          password: 'password123',
        });

      // Try to create second server with same email
      const response = await request(app)
        .post('/api/users/servers')
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          email: 'duplicate@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('already exists');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/users/servers')
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
    });

    it('should validate password length', async () => {
      const response = await request(app)
        .post('/api/users/servers')
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          email: 'server@test.com',
          password: '12345', // Too short
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/users/servers')
        .send({
          email: 'server@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/users/servers', () => {
    beforeEach(async () => {
      // Create some test servers
      await User.create([
        {
          email: 'server1@test.com',
          password: 'password123',
          role: 'server',
          restaurantId,
        },
        {
          email: 'server2@test.com',
          password: 'password123',
          role: 'server',
          restaurantId,
        },
      ]);
    });

    it('should get all server users for the restaurant', async () => {
      const response = await request(app)
        .get('/api/users/servers')
        .set('Authorization', `Bearer ${restaurantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.servers).toBeDefined();
      expect(response.body.servers).toHaveLength(2);
      expect(response.body.servers[0].email).toBeDefined();
      expect(response.body.servers[0].role).toBe('server');
    });

    it('should not return servers from other restaurants', async () => {
      // Create another restaurant with a server
      const otherRestaurant = await createTestRestaurant({
        name: 'Other Restaurant',
        address: '456 Other St',
        phone: '0987654321',
        email: 'other@restaurant.com',
      });

      await User.create({
        email: 'other-server@test.com',
        password: 'password123',
        role: 'server',
        restaurantId: otherRestaurant._id,
      });
      });

      await User.create({
        email: 'other-server@test.com',
        password: 'password123',
        role: 'server',
        restaurantId: otherRestaurant._id,
      });

      const response = await request(app)
        .get('/api/users/servers')
        .set('Authorization', `Bearer ${restaurantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.servers).toHaveLength(2); // Only servers from first restaurant
      expect(response.body.servers.every((s: any) => s.email !== 'other-server@test.com')).toBe(true);
    });
  });

  describe('PUT /api/users/servers/:id', () => {
    beforeEach(async () => {
      // Create a test server
      const server = await User.create({
        email: 'server@test.com',
        password: 'password123',
        role: 'server',
        restaurantId,
      });
      serverUserId = server._id.toString();
    });

    it('should update server email', async () => {
      const response = await request(app)
        .put(`/api/users/servers/${serverUserId}`)
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          email: 'updated@test.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.server.email).toBe('updated@test.com');
    });

    it('should update server password', async () => {
      const response = await request(app)
        .put(`/api/users/servers/${serverUserId}`)
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          password: 'newpassword123',
        });

      expect(response.status).toBe(200);

      // Verify password was actually updated by checking it in the database
      const updatedServer = await User.findById(serverUserId);
      expect(updatedServer).toBeDefined();
      // Password should be hashed, not plain text
      expect(updatedServer?.password).not.toBe('newpassword123');
    });

    it('should update server status', async () => {
      const response = await request(app)
        .put(`/api/users/servers/${serverUserId}`)
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          status: 'inactive',
        });

      expect(response.status).toBe(200);
      expect(response.body.server.status).toBe('inactive');
    });

    it('should not update non-existent server', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .put(`/api/users/servers/${fakeId}`)
        .set('Authorization', `Bearer ${restaurantToken}`)
        .send({
          email: 'updated@test.com',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/users/servers/:id', () => {
    beforeEach(async () => {
      // Create a test server
      const server = await User.create({
        email: 'server@test.com',
        password: 'password123',
        role: 'server',
        restaurantId,
      });
      serverUserId = server._id.toString();
    });

    it('should delete a server user', async () => {
      const response = await request(app)
        .delete(`/api/users/servers/${serverUserId}`)
        .set('Authorization', `Bearer ${restaurantToken}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const deletedServer = await User.findById(serverUserId);
      expect(deletedServer).toBeNull();
    });

    it('should not delete non-existent server', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/users/servers/${fakeId}`)
        .set('Authorization', `Bearer ${restaurantToken}`);

      expect(response.status).toBe(404);
    });

    it('should not delete server from another restaurant', async () => {
      // Create another restaurant with a server
      const otherRestaurant = await createTestRestaurant({
        name: 'Other Restaurant',
        address: '456 Other St',
        phone: '0987654321',
        email: 'other@restaurant.com',
      });

      const otherServer = await User.create({
        email: 'other-server@test.com',
        password: 'password123',
        role: 'server',
        restaurantId: otherRestaurant._id,
      });

      const response = await request(app)
        .delete(`/api/users/servers/${otherServer._id.toString()}`)
        .set('Authorization', `Bearer ${restaurantToken}`);

      expect(response.status).toBe(404);

      // Verify server still exists
      const stillExists = await User.findById(otherServer._id);
      expect(stillExists).not.toBeNull();
    });
  });
});

