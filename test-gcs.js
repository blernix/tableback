/**
 * Test script to verify GCS configuration
 * Run: node test-gcs.js
 */

require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

async function testGCSConnection() {
  console.log('🔍 Testing GCS Configuration...\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('  GCS_PROJECT_ID:', process.env.GCS_PROJECT_ID ? '✓ Set' : '✗ Missing');
  console.log('  GCS_BUCKET_NAME:', process.env.GCS_BUCKET_NAME ? '✓ Set' : '✗ Missing');
  console.log('  GCS_CREDENTIALS:', process.env.GCS_CREDENTIALS ? '✓ Set (JSON)' : '✗ Missing');
  console.log('  GCS_KEY_FILENAME:', process.env.GCS_KEY_FILENAME ? `✓ Set (${process.env.GCS_KEY_FILENAME})` : '✗ Missing');
  console.log('');

  // Validate credentials
  let storage;
  try {
    if (process.env.GCS_CREDENTIALS) {
      console.log('📝 Using GCS_CREDENTIALS (JSON)...');
      const credentials = JSON.parse(process.env.GCS_CREDENTIALS);

      // Validate required fields
      const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !credentials[field]);

      if (missingFields.length > 0) {
        console.error('❌ Invalid credentials format. Missing fields:', missingFields.join(', '));
        process.exit(1);
      }

      storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID,
        credentials: credentials,
      });
      console.log('✓ Credentials parsed successfully');
    } else if (process.env.GCS_KEY_FILENAME) {
      console.log(`📝 Using GCS_KEY_FILENAME (${process.env.GCS_KEY_FILENAME})...`);
      storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID,
        keyFilename: process.env.GCS_KEY_FILENAME,
      });
      console.log('✓ Key file loaded successfully');
    } else {
      console.error('❌ Neither GCS_CREDENTIALS nor GCS_KEY_FILENAME is set');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to initialize GCS client:', error.message);
    process.exit(1);
  }

  // Test bucket access
  try {
    console.log('\n🪣 Testing bucket access...');
    const bucketName = process.env.GCS_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);

    const [exists] = await bucket.exists();
    if (exists) {
      console.log(`✓ Bucket "${bucketName}" exists and is accessible`);

      // Try to list files (limited to 5)
      const [files] = await bucket.getFiles({ maxResults: 5 });
      console.log(`✓ Found ${files.length} file(s) in bucket (showing max 5)`);

      if (files.length > 0) {
        console.log('  Files:');
        files.forEach(file => console.log(`    - ${file.name}`));
      }
    } else {
      console.error(`❌ Bucket "${bucketName}" does not exist or is not accessible`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to access bucket:', error.message);
    if (error.code === 403) {
      console.error('   → Permission denied. Check service account permissions.');
    }
    process.exit(1);
  }

  console.log('\n✅ GCS Configuration is working correctly!');
  console.log('');
}

testGCSConnection().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
