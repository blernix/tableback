import bcrypt from 'bcrypt';
import User from '../../models/User.model';
import Restaurant from '../../models/Restaurant.model';
import MenuCategory from '../../models/MenuCategory.model';
import Dish from '../../models/Dish.model';
import Reservation from '../../models/Reservation.model';

/**
 * Test fixtures for creating database records
 */

export const createTestRestaurant = async (overrides = {}) => {
  const defaultData = {
    name: 'Test Restaurant',
    address: '123 Test Street',
    phone: '0123456789',
    email: 'test@restaurant.com',
    apiKey: 'test-api-key-' + Date.now(),
    status: 'active',
    openingHours: {
      monday: { closed: false, slots: [{ start: '12:00', end: '14:00' }, { start: '19:00', end: '22:00' }] },
      tuesday: { closed: false, slots: [{ start: '12:00', end: '14:00' }, { start: '19:00', end: '22:00' }] },
      wednesday: { closed: false, slots: [{ start: '12:00', end: '14:00' }, { start: '19:00', end: '22:00' }] },
      thursday: { closed: false, slots: [{ start: '12:00', end: '14:00' }, { start: '19:00', end: '22:00' }] },
      friday: { closed: false, slots: [{ start: '12:00', end: '14:00' }, { start: '19:00', end: '22:00' }] },
      saturday: { closed: false, slots: [{ start: '12:00', end: '14:00' }, { start: '19:00', end: '22:00' }] },
      sunday: { closed: true, slots: [] },
    },
    tablesConfig: {
      mode: 'simple',
      totalTables: 10,
      averageCapacity: 4,
    },
    reservationConfig: {
      defaultDuration: 90,
      useOpeningHours: true,
    },
    menu: {
      displayMode: 'detailed',
    },
  };

  const restaurant = new Restaurant({ ...defaultData, ...overrides });
  await restaurant.save();
  return restaurant;
};

export const createTestUser = async (restaurantId: string, overrides = {}) => {
  const defaultData = {
    email: 'test@user.com',
    password: await bcrypt.hash('password123', 10),
    role: 'restaurant',
    restaurantId,
  };

  const user = new User({ ...defaultData, ...overrides });
  await user.save();
  return user;
};

export const createTestAdmin = async (overrides = {}) => {
  const defaultData = {
    email: 'admin@test.com',
    password: await bcrypt.hash('admin123', 10),
    role: 'admin',
  };

  const admin = new User({ ...defaultData, ...overrides });
  await admin.save();
  return admin;
};

export const createTestCategory = async (restaurantId: string, overrides = {}) => {
  const defaultData = {
    restaurantId,
    name: 'Test Category',
    displayOrder: 0,
  };

  const category = new MenuCategory({ ...defaultData, ...overrides });
  await category.save();
  return category;
};

export const createTestDish = async (restaurantId: string, categoryId: string, overrides = {}) => {
  const defaultData = {
    restaurantId,
    categoryId,
    name: 'Test Dish',
    description: 'A delicious test dish',
    price: 12.50,
    allergens: [],
    available: true,
    hasVariations: false,
    variations: [],
  };

  const dish = new Dish({ ...defaultData, ...overrides });
  await dish.save();
  return dish;
};

export const createTestReservation = async (restaurantId: string, overrides = {}) => {
  const defaultData = {
    restaurantId,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerPhone: '0612345678',
    date: new Date('2026-01-15'),
    time: '19:30',
    numberOfGuests: 4,
    status: 'pending',
    notes: '',
  };

  const reservation = new Reservation({ ...defaultData, ...overrides });
  await reservation.save();
  return reservation;
};
