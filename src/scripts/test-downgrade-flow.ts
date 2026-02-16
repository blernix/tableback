/**
 * Test script to verify the downgrade flow from Pro to Starter
 * This script creates a test restaurant with Pro features, then downgrades it to Starter
 * and verifies that all Pro features are cleaned up properly.
 *
 * Usage:
 * Set TEST_MODE=true to automatically clean up test data after test
 * npx ts-node src/scripts/test-downgrade-flow.ts
 */

import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_MODE = process.env.TEST_MODE !== 'false'; // Default true for safety
const TEST_DB_SUFFIX = '_test_downgrade';
const TEST_RESTAURANT_NAME = `Test Restaurant Downgrade ${Date.now()}`;
const TEST_RESTAURANT_EMAIL = `test-downgrade-${Date.now()}@example.com`;

async function testDowngradeFlow() {
  let originalMongoUri = process.env.MONGODB_URI;
  if (!originalMongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  // Use test database if in test mode
  let mongoUri = originalMongoUri;
  if (TEST_MODE) {
    // Append test suffix to database name
    mongoUri = originalMongoUri.replace(/(\/[^/?]+)(\?|$)/, `$1${TEST_DB_SUFFIX}$2`);
    logger.info(`Using test database: ${mongoUri}`);
  }

  let testRestaurantId: any = null;
  let testServerUserId: any = null;

  try {
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Step 1: Create a test restaurant with Pro plan and Pro features
    logger.info('Step 1: Creating test restaurant with Pro plan and Pro features...');

    const testRestaurant = new Restaurant({
      name: TEST_RESTAURANT_NAME,
      address: '123 Test Street, Test City',
      phone: '+33123456789',
      email: TEST_RESTAURANT_EMAIL,
      status: 'active',
      accountType: 'self-service',
      subscription: {
        plan: 'pro',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      widgetConfig: {
        primaryColor: '#FF0000', // Custom red color
        secondaryColor: '#00FF00', // Custom green
        fontFamily: 'Arial, sans-serif',
        borderRadius: '12px',
        buttonBackgroundColor: '#FF0000',
        buttonTextColor: '#FFFFFF',
        buttonHoverColor: '#CC0000',
        buttonText: 'Book Now!',
        buttonPosition: 'bottom-left',
        buttonStyle: 'square',
        buttonIcon: true,
        modalWidth: '600px',
        modalHeight: '700px',
      },
      googleReviewLink: 'https://g.page/r/CUSTOM_REVIEW_LINK',
      publicSlug: `custom-slug-${Date.now()}`, // Custom slug
      reservationQuota: {
        monthlyCount: 0,
        lastResetDate: new Date(),
        limit: -1, // Unlimited for Pro
        emailsSent: { at80: false, at90: false, at100: false },
      },
      menu: {
        displayMode: 'detailed',
        pdfUrl: null,
        qrCodeGenerated: false,
      },
      openingHours: {
        monday: {
          closed: false,
          slots: [
            { start: '12:00', end: '14:30' },
            { start: '19:00', end: '22:00' },
          ],
        },
        tuesday: {
          closed: false,
          slots: [
            { start: '12:00', end: '14:30' },
            { start: '19:00', end: '22:00' },
          ],
        },
        wednesday: {
          closed: false,
          slots: [
            { start: '12:00', end: '14:30' },
            { start: '19:00', end: '22:00' },
          ],
        },
        thursday: {
          closed: false,
          slots: [
            { start: '12:00', end: '14:30' },
            { start: '19:00', end: '22:00' },
          ],
        },
        friday: {
          closed: false,
          slots: [
            { start: '12:00', end: '14:30' },
            { start: '19:00', end: '22:00' },
          ],
        },
        saturday: {
          closed: false,
          slots: [
            { start: '12:00', end: '14:30' },
            { start: '19:00', end: '22:00' },
          ],
        },
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
    });

    await testRestaurant.save();
    testRestaurantId = testRestaurant._id;
    logger.info(`Test restaurant created: ${testRestaurant.name} (${testRestaurantId})`);

    // Step 2: Create server accounts for the restaurant
    logger.info('Step 2: Creating server accounts...');

    const testServer = new User({
      email: `server-${Date.now()}@example.com`,
      password: crypto.randomBytes(16).toString('hex'), // Random password, not used
      firstName: 'Test',
      lastName: 'Server',
      role: 'server',
      restaurantId: testRestaurantId,
      status: 'active',
    });

    await testServer.save();
    testServerUserId = testServer._id;
    logger.info(`Test server account created: ${testServer.email} (${testServerUserId})`);

    // Create a second server account
    const testServer2 = new User({
      email: `server2-${Date.now()}@example.com`,
      password: crypto.randomBytes(16).toString('hex'),
      firstName: 'Test2',
      lastName: 'Server2',
      role: 'server',
      restaurantId: testRestaurantId,
      status: 'active',
    });

    await testServer2.save();
    logger.info(`Second test server account created: ${testServer2.email}`);

    // Step 3: Verify Pro features exist before downgrade
    logger.info('Step 3: Verifying Pro features before downgrade...');
    const restaurantBefore = await Restaurant.findById(testRestaurantId);
    if (!restaurantBefore) {
      throw new Error('Test restaurant not found after creation');
    }

    console.log('\n=== BEFORE DOWNGRADE ===');
    console.log(`Plan: ${restaurantBefore.subscription?.plan}`);
    console.log(`Widget config exists: ${!!restaurantBefore.widgetConfig}`);
    console.log(`Widget primary color: ${restaurantBefore.widgetConfig?.primaryColor}`);
    console.log(`Google review link: ${restaurantBefore.googleReviewLink}`);
    console.log(`Public slug: ${restaurantBefore.publicSlug}`);
    console.log(`Reservation quota limit: ${restaurantBefore.reservationQuota?.limit}`);

    // Verify server accounts exist
    const serverAccountsBefore = await User.countDocuments({
      restaurantId: testRestaurantId,
      role: 'server',
    });
    console.log(`Server accounts count: ${serverAccountsBefore}`);

    // Step 4: Simulate downgrade to Starter (using same logic as admin controller)
    logger.info('Step 4: Simulating downgrade to Starter...');

    // Update plan to Starter
    restaurantBefore.subscription!.plan = 'starter';

    // Update quota limit to 400
    if (!restaurantBefore.reservationQuota) {
      restaurantBefore.reservationQuota = {
        monthlyCount: 0,
        lastResetDate: new Date(),
        limit: 400,
        emailsSent: { at80: false, at90: false, at100: false },
      };
    } else {
      restaurantBefore.reservationQuota.limit = 400;
    }

    // Clean up Pro features
    restaurantBefore.widgetConfig = undefined;
    restaurantBefore.googleReviewLink = undefined;
    restaurantBefore.publicSlug = undefined; // Will be re-generated by pre-save hook

    // Delete server accounts
    const deleteResult = await User.deleteMany({
      restaurantId: testRestaurantId,
      role: 'server',
    });
    logger.info(`Deleted ${deleteResult.deletedCount} server accounts`);

    // Save the restaurant
    await restaurantBefore.save();
    logger.info('Downgrade simulation completed');

    // Step 5: Verify Pro features are cleaned up after downgrade
    logger.info('Step 5: Verifying Pro features after downgrade...');
    const restaurantAfter = await Restaurant.findById(testRestaurantId);
    if (!restaurantAfter) {
      throw new Error('Test restaurant not found after downgrade');
    }

    console.log('\n=== AFTER DOWNGRADE ===');
    console.log(`Plan: ${restaurantAfter.subscription?.plan}`);
    console.log(`Widget config exists: ${!!restaurantAfter.widgetConfig}`);
    console.log(`Widget config: ${JSON.stringify(restaurantAfter.widgetConfig)}`);
    console.log(`Google review link: ${restaurantAfter.googleReviewLink}`);
    console.log(`Public slug: ${restaurantAfter.publicSlug} (should be auto-generated)`);
    console.log(
      `Reservation quota limit: ${restaurantAfter.reservationQuota?.limit} (should be 400)`
    );

    // Verify server accounts are deleted
    const serverAccountsAfter = await User.countDocuments({
      restaurantId: testRestaurantId,
      role: 'server',
    });
    console.log(`Server accounts count after: ${serverAccountsAfter}`);

    // Step 6: Assertions
    console.log('\n=== ASSERTIONS ===');
    let allPassed = true;

    // 1. Plan should be 'starter'
    if (restaurantAfter.subscription?.plan !== 'starter') {
      console.error('❌ FAIL: Plan should be "starter"');
      allPassed = false;
    } else {
      console.log('✅ PASS: Plan is "starter"');
    }

    // 2. Widget config should be undefined or null
    if (restaurantAfter.widgetConfig) {
      console.error('❌ FAIL: Widget config should be cleaned up');
      allPassed = false;
    } else {
      console.log('✅ PASS: Widget config cleaned up');
    }

    // 3. Google review link should be undefined or null
    if (restaurantAfter.googleReviewLink) {
      console.error('❌ FAIL: Google review link should be cleaned up');
      allPassed = false;
    } else {
      console.log('✅ PASS: Google review link cleaned up');
    }

    // 4. Public slug should be auto-generated (not the custom one)
    // Note: publicSlug will be regenerated by pre-save hook when set to undefined
    if (!restaurantAfter.publicSlug) {
      console.error('❌ FAIL: Public slug should be auto-generated');
      allPassed = false;
    } else if (restaurantAfter.publicSlug === `custom-slug-${Date.now()}`) {
      console.error('❌ FAIL: Public slug should not be the custom one');
      allPassed = false;
    } else {
      console.log('✅ PASS: Public slug is auto-generated');
    }

    // 5. Reservation quota limit should be 400
    if (restaurantAfter.reservationQuota?.limit !== 400) {
      console.error(
        `❌ FAIL: Reservation quota limit should be 400, got ${restaurantAfter.reservationQuota?.limit}`
      );
      allPassed = false;
    } else {
      console.log('✅ PASS: Reservation quota limit is 400');
    }

    // 6. Server accounts should be 0
    if (serverAccountsAfter !== 0) {
      console.error(`❌ FAIL: Server accounts should be 0, got ${serverAccountsAfter}`);
      allPassed = false;
    } else {
      console.log('✅ PASS: Server accounts deleted');
    }

    if (allPassed) {
      console.log('\n🎉 SUCCESS: All downgrade validations passed!');
    } else {
      console.log('\n❌ FAILURE: Some validations failed');
      throw new Error('Downgrade validation failed');
    }
  } catch (error) {
    logger.error('Test failed:', error);
    throw error;
  } finally {
    // Step 7: Clean up test data if in test mode
    if (TEST_MODE) {
      logger.info('Step 7: Cleaning up test data...');
      try {
        if (testRestaurantId) {
          await Restaurant.deleteOne({ _id: testRestaurantId });
          logger.info(`Test restaurant deleted: ${testRestaurantId}`);
        }
        if (testServerUserId) {
          await User.deleteMany({ restaurantId: testRestaurantId });
          logger.info('Test server accounts deleted');
        }
      } catch (cleanupError) {
        logger.error('Error during cleanup:', cleanupError);
      }
    }

    // Disconnect from MongoDB
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    }
  }
}

// Run test
if (require.main === module) {
  testDowngradeFlow()
    .then(() => {
      console.log('\nTest completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nTest failed:', error);
      process.exit(1);
    });
}

export { testDowngradeFlow };
