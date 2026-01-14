import logger from '../utils/logger';

// Test logger functionality
logger.info('Testing logger.info() - This is an informational message');
logger.warn('Testing logger.warn() - This is a warning message');
logger.error('Testing logger.error() - This is an error message');

// Test with metadata
logger.info('Testing logger with metadata', {
  userId: '12345',
  action: 'test',
  timestamp: new Date().toISOString(),
});

// Test error with stack trace
try {
  throw new Error('Test error with stack trace');
} catch (error: any) {
  logger.error('Caught error:', error);
}

console.log('\n✅ Logger test complete. Check console output above.');
