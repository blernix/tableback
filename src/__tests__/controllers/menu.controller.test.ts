import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { createTestRestaurant, createTestUser, createTestCategory, createTestDish } from '../helpers/fixtures';
import jwt from 'jsonwebtoken';

describe('Menu Controller', () => {
  let app: Express;
  let token: string;
  let restaurantId: string;
  let userId: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    const restaurant = await createTestRestaurant();
    restaurantId = restaurant._id.toString();

    const user = await createTestUser(restaurantId);
    userId = user._id.toString();

    token = jwt.sign(
      {
        userId,
        email: user.email,
        role: user.role,
        restaurantId,
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
  });

  describe('Categories', () => {
    describe('GET /api/menu/categories', () => {
      it('should return all categories for restaurant', async () => {
        await createTestCategory(restaurantId, { name: 'Entrées', displayOrder: 0 });
        await createTestCategory(restaurantId, { name: 'Plats', displayOrder: 1 });
        await createTestCategory(restaurantId, { name: 'Desserts', displayOrder: 2 });

        const response = await request(app)
          .get('/api/menu/categories')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.categories).toHaveLength(3);
        expect(response.body.categories[0].name).toBe('Entrées');
        expect(response.body.categories[1].name).toBe('Plats');
        expect(response.body.categories[2].name).toBe('Desserts');
      });

      it('should return empty array when no categories exist', async () => {
        const response = await request(app)
          .get('/api/menu/categories')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.categories).toHaveLength(0);
      });

      it('should fail without authentication', async () => {
        await request(app)
          .get('/api/menu/categories')
          .expect(401);
      });
    });

    describe('POST /api/menu/categories', () => {
      it('should create a new category', async () => {
        const response = await request(app)
          .post('/api/menu/categories')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Entrées' })
          .expect(201);

        expect(response.body.category).toHaveProperty('_id');
        expect(response.body.category.name).toBe('Entrées');
        expect(response.body.category.displayOrder).toBe(0);
      });

      it('should auto-increment displayOrder', async () => {
        await createTestCategory(restaurantId, { displayOrder: 0 });
        await createTestCategory(restaurantId, { displayOrder: 1 });

        const response = await request(app)
          .post('/api/menu/categories')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Desserts' })
          .expect(201);

        expect(response.body.category.displayOrder).toBe(2);
      });

      it('should fail with missing name', async () => {
        const response = await request(app)
          .post('/api/menu/categories')
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .expect(400);

        expect(response.body.error).toBeDefined();
      });

      it('should fail without authentication', async () => {
        await request(app)
          .post('/api/menu/categories')
          .send({ name: 'Entrées' })
          .expect(401);
      });
    });

    describe('PUT /api/menu/categories/:id', () => {
      it('should update category name', async () => {
        const category = await createTestCategory(restaurantId, { name: 'Entrées' });

        const response = await request(app)
          .put(`/api/menu/categories/${category._id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Starters' })
          .expect(200);

        expect(response.body.category.name).toBe('Starters');
      });

      it('should fail to update non-existent category', async () => {
        await request(app)
          .put('/api/menu/categories/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Updated' })
          .expect(404);
      });

      it('should fail without authentication', async () => {
        const category = await createTestCategory(restaurantId);

        await request(app)
          .put(`/api/menu/categories/${category._id}`)
          .send({ name: 'Updated' })
          .expect(401);
      });
    });

    describe('DELETE /api/menu/categories/:id', () => {
      it('should delete a category', async () => {
        const category = await createTestCategory(restaurantId);

        await request(app)
          .delete(`/api/menu/categories/${category._id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(204);

        // Verify category is deleted
        const response = await request(app)
          .get('/api/menu/categories')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.categories).toHaveLength(0);
      });

      it('should fail to delete non-existent category', async () => {
        await request(app)
          .delete('/api/menu/categories/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${token}`)
          .expect(404);
      });
    });

    describe('PUT /api/menu/categories/reorder', () => {
      it('should reorder categories', async () => {
        const cat1 = await createTestCategory(restaurantId, { name: 'Cat1', displayOrder: 0 });
        const cat2 = await createTestCategory(restaurantId, { name: 'Cat2', displayOrder: 1 });
        const cat3 = await createTestCategory(restaurantId, { name: 'Cat3', displayOrder: 2 });

        const response = await request(app)
          .put('/api/menu/categories/reorder')
          .set('Authorization', `Bearer ${token}`)
          .send({ categoryIds: [cat3._id.toString(), cat1._id.toString(), cat2._id.toString()] })
          .expect(200);

        expect(response.body.categories).toHaveLength(3);
        expect(response.body.categories[0].name).toBe('Cat3');
        expect(response.body.categories[1].name).toBe('Cat1');
        expect(response.body.categories[2].name).toBe('Cat2');
      });
    });
  });

  describe('Dishes', () => {
    let categoryId: string;

    beforeEach(async () => {
      const category = await createTestCategory(restaurantId);
      categoryId = category._id.toString();
    });

    describe('GET /api/menu/dishes', () => {
      it('should return all dishes for restaurant', async () => {
        await createTestDish(restaurantId, categoryId, { name: 'Dish 1' });
        await createTestDish(restaurantId, categoryId, { name: 'Dish 2' });

        const response = await request(app)
          .get('/api/menu/dishes')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.dishes).toHaveLength(2);
      });

      it('should filter dishes by category', async () => {
        const category2 = await createTestCategory(restaurantId);

        await createTestDish(restaurantId, categoryId, { name: 'Dish 1' });
        await createTestDish(restaurantId, category2._id.toString(), { name: 'Dish 2' });

        const response = await request(app)
          .get(`/api/menu/dishes?categoryId=${categoryId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.dishes).toHaveLength(1);
        expect(response.body.dishes[0].name).toBe('Dish 1');
      });
    });

    describe('POST /api/menu/dishes', () => {
      it('should create a new dish', async () => {
        const response = await request(app)
          .post('/api/menu/dishes')
          .set('Authorization', `Bearer ${token}`)
          .send({
            categoryId,
            name: 'Salade César',
            description: 'Une délicieuse salade',
            price: 12.50,
            allergens: ['gluten'],
          })
          .expect(201);

        expect(response.body.dish.name).toBe('Salade César');
        expect(response.body.dish.price).toBe(12.50);
        expect(response.body.dish.allergens).toContain('gluten');
      });

      it('should create a dish with variations', async () => {
        const response = await request(app)
          .post('/api/menu/dishes')
          .set('Authorization', `Bearer ${token}`)
          .send({
            categoryId,
            name: 'Pizza',
            description: 'Pizza maison',
            price: 10,
            hasVariations: true,
            variations: [
              { name: 'Petite', price: 8 },
              { name: 'Grande', price: 12 },
            ],
          })
          .expect(201);

        expect(response.body.dish.hasVariations).toBe(true);
        expect(response.body.dish.variations).toHaveLength(2);
        expect(response.body.dish.variations[0].name).toBe('Petite');
      });

      it('should fail with invalid category', async () => {
        await request(app)
          .post('/api/menu/dishes')
          .set('Authorization', `Bearer ${token}`)
          .send({
            categoryId: '507f1f77bcf86cd799439011',
            name: 'Dish',
            price: 10,
          })
          .expect(404);
      });

      it('should fail with negative price', async () => {
        const response = await request(app)
          .post('/api/menu/dishes')
          .set('Authorization', `Bearer ${token}`)
          .send({
            categoryId,
            name: 'Dish',
            price: -5,
          })
          .expect(400);

        expect(response.body.error).toBeDefined();
      });
    });

    describe('PUT /api/menu/dishes/:id', () => {
      it('should update a dish', async () => {
        const dish = await createTestDish(restaurantId, categoryId, {
          name: 'Old Name',
          price: 10,
        });

        const response = await request(app)
          .put(`/api/menu/dishes/${dish._id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'New Name',
            price: 15,
          })
          .expect(200);

        expect(response.body.dish.name).toBe('New Name');
        expect(response.body.dish.price).toBe(15);
      });
    });

    describe('DELETE /api/menu/dishes/:id', () => {
      it('should delete a dish', async () => {
        const dish = await createTestDish(restaurantId, categoryId);

        await request(app)
          .delete(`/api/menu/dishes/${dish._id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(204);
      });
    });

    describe('PATCH /api/menu/dishes/:id/toggle-availability', () => {
      it('should toggle dish availability', async () => {
        const dish = await createTestDish(restaurantId, categoryId, { available: true });

        const response = await request(app)
          .patch(`/api/menu/dishes/${dish._id}/toggle-availability`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.dish.available).toBe(false);

        // Toggle again
        const response2 = await request(app)
          .patch(`/api/menu/dishes/${dish._id}/toggle-availability`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response2.body.dish.available).toBe(true);
      });
    });
  });
});
