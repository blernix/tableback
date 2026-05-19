import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import Reservation from '../src/models/Reservation.model';
import { syncCustomer } from '../src/controllers/customer.controller';

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI not set in .env');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGO_URI!, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 25000,
  });
  console.log('✅ Connected to MongoDB\n');

  const pairs = await Reservation.aggregate([
    {
      $group: {
        _id: { restaurantId: '$restaurantId', email: { $toLower: '$customerEmail' } },
      },
    },
    {
      $project: {
        restaurantId: '$_id.restaurantId',
        email: '$_id.email',
        _id: 0,
      },
    },
  ]);

  console.log(`📋 Found ${pairs.length} distinct (restaurant, email) pairs\n`);

  let success = 0;
  let errors = 0;

  for (const { restaurantId, email } of pairs) {
    try {
      await syncCustomer(restaurantId, email);
      success++;
      if (success % 10 === 0) {
        console.log(`   ... ${success}/${pairs.length} customers synced`);
      }
    } catch (err) {
      errors++;
      console.error(`❌ Failed for restaurant ${restaurantId} / ${email}:`, err);
    }
  }

  console.log(`\n✅ Done: ${success} synced, ${errors} errors`);
  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

migrate().catch((err) => {
  console.error('💥 Migration failed:', err);
  process.exit(1);
});
