import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

// Set environment variables for tests
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.NODE_ENV = 'test';
process.env.EMAIL_ENABLED = 'true'; // Changed to true for EmailService tests
process.env.BREVO_API_KEY = 'test-api-key';
process.env.EMAIL_SENDER = 'test@tablemaster.fr';
process.env.BREVO_TEMPLATE_PASSWORD_RESET = '1';
process.env.BREVO_TEMPLATE_PENDING = '2';
process.env.BREVO_TEMPLATE_CONFIRMATION = '3';
process.env.BREVO_TEMPLATE_DIRECT = '4';
process.env.BREVO_TEMPLATE_CANCELLATION = '5';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.BACKEND_URL = 'http://localhost:4000';

// Setup MongoDB in-memory before all tests
beforeAll(async () => {
  // Close any existing connections
  await mongoose.disconnect();

  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect to in-memory database
  await mongoose.connect(mongoUri);
});

// Clear all collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Close database connection and stop MongoDB server after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Increase timeout for database operations
jest.setTimeout(10000);
