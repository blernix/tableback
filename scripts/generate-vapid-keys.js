#!/usr/bin/env node

/**
 * Script to generate VAPID keys for Web Push notifications
 * Usage: node scripts/generate-vapid-keys.js
 */

const webPush = require('web-push');

console.log('Generating VAPID keys for Web Push notifications...\n');

try {
  const vapidKeys = webPush.generateVAPIDKeys();
  
  console.log('=== COPY THESE KEYS TO YOUR .env FILE ===\n');
  console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
  console.log(`VAPID_SUBJECT=mailto:notifications@tablemaster.fr`);
  console.log(`PUSH_ENABLED=true\n`);
  console.log('==========================================\n');
  console.log('Note: The VAPID subject should be a "mailto:" URL or a regular URL');
  console.log('that identifies your application. Change the email address as needed.');
} catch (error) {
  console.error('Error generating VAPID keys:', error);
  process.exit(1);
}