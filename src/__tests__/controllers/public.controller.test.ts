import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { createTestRestaurant, createTestCategory, createTestDish } from '../helpers/fixtures';
import DayBlock from '../../models/DayBlock.model';
import Closure from '../../models/Closure.model';

describe('Public API Controller', () => {
  let app: Express;
  let restaurant: any;
  let apiKey: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    restaurant = await createTestRestaurant();
    apiKey = restaurant.apiKey;
  });

  describe('GET /api/public/menu/:apiKey', () => {
    it('should return menu in PDF mode', async () => {
      await restaurant.updateOne({
        menu: {
          displayMode: 'pdf',
          pdfUrl: 'https://example.com/menu.pdf',
        },
      });

      const response = await request(app)
        .get(`/api/public/menu/${apiKey}`)
        .expect(200);

      expect(response.body.restaurantName).toBe(restaurant.name);
      expect(response.body.displayMode).toBe('pdf');
      expect(response.body.pdfUrl).toBe('https://example.com/menu.pdf');
    });

    it('should return menu in detailed mode with categories and dishes', async () => {
      const category1 = await createTestCategory(restaurant._id.toString(), {
        name: 'Entrées',
        displayOrder: 0,
      });
      const category2 = await createTestCategory(restaurant._id.toString(), {
        name: 'Plats',
        displayOrder: 1,
      });

      await createTestDish(restaurant._id.toString(), category1._id.toString(), {
        name: 'Salade César',
        description: 'Salade verte avec poulet',
        price: 12.50,
        allergens: ['gluten'],
        available: true,
      });

      await createTestDish(restaurant._id.toString(), category1._id.toString(), {
        name: 'Soupe du jour',
        description: 'Soupe maison',
        price: 8,
        available: true,
      });

      await createTestDish(restaurant._id.toString(), category2._id.toString(), {
        name: 'Steak frites',
        price: 18,
        available: true,
      });

      // Create unavailable dish (should not appear)
      await createTestDish(restaurant._id.toString(), category2._id.toString(), {
        name: 'Plat indisponible',
        available: false,
      });

      const response = await request(app)
        .get(`/api/public/menu/${apiKey}`)
        .expect(200);

      expect(response.body.restaurantName).toBe(restaurant.name);
      expect(response.body.displayMode).toBe('detailed');
      expect(response.body.categories).toHaveLength(2);

      const entrees = response.body.categories[0];
      expect(entrees.name).toBe('Entrées');
      expect(entrees.dishes).toHaveLength(2);
      expect(entrees.dishes[0].name).toBe('Salade César');
      expect(entrees.dishes[0].allergens).toContain('gluten');

      const plats = response.body.categories[1];
      expect(plats.dishes).toHaveLength(1); // Only available dishes
    });

    it('should fail with invalid API key', async () => {
      await request(app)
        .get('/api/public/menu/invalid-api-key')
        .expect(404);
    });

    it('should filter out empty categories', async () => {
      await createTestCategory(restaurant._id.toString(), {
        name: 'Empty Category',
      });

      const response = await request(app)
        .get(`/api/public/menu/${apiKey}`)
        .expect(200);

      expect(response.body.categories).toHaveLength(0);
    });
  });

  describe('POST /api/public/reservations', () => {
    it('should create a public reservation', async () => {
      const response = await request(app)
        .post('/api/public/reservations')
        .set('X-API-Key', apiKey)
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0612345678',
          date: '2026-02-15',
          time: '19:30',
          numberOfGuests: 4,
          notes: 'Allergie aux noix',
        })
        .expect(201);

      expect(response.body.reservation.customerName).toBe('John Doe');
      expect(response.body.reservation.status).toBe('pending');
    });

    it('should fail without API key', async () => {
      await request(app)
        .post('/api/public/reservations')
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0612345678',
          date: '2026-02-15',
          time: '19:30',
          numberOfGuests: 4,
        })
        .expect(401);
    });

    it('should fail on blocked date', async () => {
      const blockedDate = new Date('2026-02-20');

      await DayBlock.create({
        restaurantId: restaurant._id,
        date: blockedDate,
        reason: 'Événement privé',
      });

      const response = await request(app)
        .post('/api/public/reservations')
        .set('X-API-Key', apiKey)
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0612345678',
          date: '2026-02-20',
          time: '19:30',
          numberOfGuests: 4,
        })
        .expect(400);

      expect(response.body.error.message).toContain('not available');
    });

    it('should fail on closure period', async () => {
      await Closure.create({
        restaurantId: restaurant._id,
        startDate: new Date('2026-02-10'),
        endDate: new Date('2026-02-20'),
        reason: 'Vacances',
      });

      const response = await request(app)
        .post('/api/public/reservations')
        .set('X-API-Key', apiKey)
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0612345678',
          date: '2026-02-15',
          time: '19:30',
          numberOfGuests: 4,
        })
        .expect(400);

      expect(response.body.error.message).toContain('closed');
    });

    it('should fail when restaurant is closed on that day', async () => {
      const response = await request(app)
        .post('/api/public/reservations')
        .set('X-API-Key', apiKey)
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0612345678',
          date: '2026-02-16', // Sunday - closed in default config
          time: '19:30',
          numberOfGuests: 4,
        })
        .expect(400);

      expect(response.body.error.message).toContain('closed');
    });
  });

  describe('GET /api/public/availability/:date', () => {
    it('should return availability for valid date', async () => {
      const response = await request(app)
        .get('/api/public/availability/2026-02-15')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.available).toBe(true);
      expect(response.body.openingHours).toBeDefined();
      expect(response.body.defaultDuration).toBe(90);
    });

    it('should return blocked status for blocked date', async () => {
      await DayBlock.create({
        restaurantId: restaurant._id,
        date: new Date('2026-02-20'),
        reason: 'Événement privé',
      });

      const response = await request(app)
        .get('/api/public/availability/2026-02-20')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.available).toBe(false);
      expect(response.body.reason).toBe('blocked');
    });

    it('should return closed status for Sunday', async () => {
      const response = await request(app)
        .get('/api/public/availability/2026-02-22') // Sunday
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.available).toBe(false);
      expect(response.body.reason).toBe('closed');
    });

    it('should fail with invalid date format', async () => {
      await request(app)
        .get('/api/public/availability/15-02-2026')
        .set('X-API-Key', apiKey)
        .expect(400);
    });
  });

  describe('GET /api/public/time-slots/:date', () => {
    it('should return available time slots', async () => {
      const response = await request(app)
        .get('/api/public/time-slots/2026-02-15')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.available).toBe(true);
      expect(response.body.slots).toBeDefined();
      expect(Array.isArray(response.body.slots)).toBe(true);
      expect(response.body.slots.length).toBeGreaterThan(0);

      // Check slots format (HH:MM)
      expect(response.body.slots[0]).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should return empty slots for blocked date', async () => {
      await DayBlock.create({
        restaurantId: restaurant._id,
        date: new Date('2026-02-20'),
        reason: 'Blocked',
      });

      const response = await request(app)
        .get('/api/public/time-slots/2026-02-20')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.available).toBe(false);
      expect(response.body.slots).toEqual([]);
    });
  });

  describe('GET /api/public/restaurant-info', () => {
    it('should return restaurant information', async () => {
      const response = await request(app)
        .get('/api/public/restaurant-info')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.restaurant.name).toBe(restaurant.name);
      expect(response.body.restaurant.address).toBe(restaurant.address);
      expect(response.body.restaurant.phone).toBe(restaurant.phone);
      expect(response.body.restaurant.email).toBe(restaurant.email);
      expect(response.body.restaurant.openingHours).toBeDefined();
      expect(response.body.restaurant.reservationConfig).toBeDefined();
    });

    it('should fail without API key', async () => {
      await request(app)
        .get('/api/public/restaurant-info')
        .expect(401);
    });
  });
});
