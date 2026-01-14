import { sendPasswordResetEmail, sendPendingReservationEmail } from '../services/emailService';
import logger from '../utils/logger';

/**
 * Test script for email templates
 *
 * Usage: npx ts-node src/scripts/test-email-templates.ts
 */

async function testEmailTemplates() {
  logger.info('🧪 Testing email templates...');

  try {
    // Test 1: Password Reset Email
    logger.info('📧 Test 1: Password Reset Email');
    const resetResult = await sendPasswordResetEmail({
      _id: 'user-123',
      email: 'killian.lecrut@gmail.com',
      name: 'Killian Test',
    });
    logger.info('Result:', resetResult);

    // Test 2: Pending Reservation Email
    logger.info('📧 Test 2: Pending Reservation Email');
    const pendingResult = await sendPendingReservationEmail(
      {
        _id: 'res-123',
        customerName: 'John Doe',
        customerEmail: 'killian.lecrut@gmail.com',
        date: new Date('2026-06-15'),
        time: '19:30',
        partySize: 4,
        restaurantId: 'rest-123',
      },
      {
        _id: 'rest-123',
        name: 'Le Gourmet',
        email: 'contact@legourmet.fr',
        phone: '0123456789',
      }
    );
    logger.info('Result:', pendingResult);

    logger.info('✅ All tests completed!');
  } catch (error: any) {
    logger.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testEmailTemplates();
