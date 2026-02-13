import mongoose from 'mongoose';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Collections and their recommended indexes
const RECOMMENDED_INDEXES: Record<string, string[]> = {
  notificationanalytics: [
    'userId_1',
    'restaurantId_1',
    'restaurantId_1_createdAt_-1',
    'userId_1_notificationType_1_status_1',
    'notificationType_1_eventType_1_status_1',
    'sentAt_1_status_1',
    'restaurantId_1_notificationType_1_eventType_1',
  ],
  users: [
    'email_1',
    'restaurantId_1',
  ],
  restaurants: [
    'apiKey_1',
    'status_1',
    'accountType_1',
    'subscription.status_1',
    'subscription.stripeCustomerId_1',
    'publicSlug_1',
  ],
  reservations: [
    'restaurantId_1',
    'date_1',
    'status_1',
    'restaurantId_1_date_1',
    'restaurantId_1_status_1',
    'restaurantId_1_date_1_status_1',
  ],
  subscriptionhistories: [
    'restaurantId_1',
    'restaurantId_1_createdAt_-1',
    'eventType_1',
    'stripeEventId_1',
  ],
  pushsubscriptions: [
    'endpoint_1',
    'userId_1_endpoint_1',
  ],
  menucategories: [
    'restaurantId_1',
    'restaurantId_1_displayOrder_1',
    'restaurantId_1_name_1',
  ],
  dayblocks: [
    'restaurantId_1',
    'restaurantId_1_date_1',
  ],
  dishes: [
    'restaurantId_1',
    'categoryId_1',
    'restaurantId_1_categoryId_1',
    'restaurantId_1_available_1',
  ],
  closures: [
    'restaurantId_1',
    'startDate_1',
    'restaurantId_1_startDate_1',
  ],
  notificationpreferences: [
    'userId_1',
  ],
};

async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri as string);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function listAllIndexes(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();
  if (!collections) {
    console.log('No collections found');
    return;
  }

  console.log('\n📊 CURRENT INDEXES IN DATABASE:\n');
  
  for (const collection of collections) {
    const collectionName = collection.collectionName;
    const indexes = await collection.indexes();
    
    console.log(`\n📁 ${collectionName} (${indexes.length} indexes):`);
    
    for (const index of indexes) {
      const isDefault = index.name === '_id_' ? ' [DEFAULT _id]' : '';
      const keyStr = JSON.stringify(index.key);
      console.log(`  • ${index.name}: ${keyStr}${isDefault}`);
      
      const recommended = RECOMMENDED_INDEXES[collectionName];
      if (recommended && 
          !recommended.includes(index.name!) && 
          index.name !== '_id_') {
        console.log(`    ⚠️  POTENTIALLY REDUNDANT`);
      }
    }
  }
}

async function cleanupNotificationAnalytics(): Promise<void> {
  const collection = mongoose.connection.db?.collection('notificationanalytics');
  if (!collection) {
    console.log('Collection notificationanalytics not found');
    return;
  }

  const redundantIndexes = [
    'pushEndpoint_1',
    'pushMessageId_1', 
    'emailTo_1',
    'emailMessageId_1',
    'sseClientId_1',
    'notificationType_1',
    'eventType_1',
    'status_1',
  ];

  console.log('\n🧹 CLEANING UP NOTIFICATION ANALYTICS INDEXES:\n');

  for (const indexName of redundantIndexes) {
    try {
      await collection.dropIndex(indexName);
      console.log(`✅ Dropped index: ${indexName}`);
    } catch (error: any) {
      if (error.codeName === 'IndexNotFound') {
        console.log(`ℹ️  Index not found (already removed): ${indexName}`);
      } else {
        console.log(`⚠️  Could not drop index ${indexName}: ${error.message}`);
      }
    }
  }
}



async function main(): Promise<void> {
  console.log('🔍 MongoDB Index Cleanup Tool');
  console.log('==============================\n');

  await connectDB();

  // List current indexes
  await listAllIndexes();

  // Auto-cleanup without confirmation
  console.log('\n🔄 Starting automatic cleanup of notificationanalytics indexes...');
  await cleanupNotificationAnalytics();
  console.log('\n✅ Cleanup completed!');
  
  // Show remaining indexes
  const collection = mongoose.connection.db?.collection('notificationanalytics');
  if (collection) {
    const indexes = await collection.indexes();
    console.log('\n📊 REMAINING INDEXES IN notificationanalytics:');
    for (const index of indexes) {
      console.log(`  • ${index.name}: ${JSON.stringify(index.key)}`);
    }
  }

  rl.close();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  rl.close();
  process.exit(1);
});