import * as brevo from '@getbrevo/brevo';
import brevoConfig from '../config/brevo';
import logger from '../utils/logger';

async function testBrevoConnection(): Promise<void> {
  try {
    logger.info('Testing Brevo API connection...');

    if (!brevoConfig.apiKey) {
      throw new Error('BREVO_API_KEY not found in environment variables');
    }

    // Initialize Brevo API with API key
    const apiInstance = new brevo.AccountApi();
    apiInstance.setApiKey(brevo.AccountApiApiKeys.apiKey, brevoConfig.apiKey);

    // Test: Get account info
    const response = await apiInstance.getAccount();
    const accountInfo = response.body;

    logger.info('✅ Brevo API connection successful!');
    logger.info(`Account email: ${accountInfo.email}`);

    // List available senders
    if (accountInfo.email) {
      logger.info('\n📧 Available sender emails on your Brevo account:');
      logger.info(`   - ${accountInfo.email} (Account email)`);
    }

    logger.info(`\nPlan: ${accountInfo.plan?.[0]?.type || 'Free'}`);
    logger.info(`Credits remaining: ${accountInfo.plan?.[0]?.credits || 'N/A'}`);

    logger.info('\n💡 To set sender email, add to .env:');
    logger.info(`   EMAIL_SENDER=${accountInfo.email || 'your-email@example.com'}`);

    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Brevo API connection failed:', error.message);
    if (error.response) {
      logger.error('API Response:', error.response.text);
    }
    if (error.stack) {
      logger.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testBrevoConnection();
