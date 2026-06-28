import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const db = mongoose.connection.db!;
  const result = await db.collection('users').updateMany(
    { emailVerified: { $exists: false } },
    { $set: { emailVerified: false } }
  );

  console.log(`Mis à jour : ${result.modifiedCount} utilisateur(s)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
