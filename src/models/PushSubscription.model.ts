import mongoose, { Document, Schema } from 'mongoose';

export interface IPushSubscription extends Document {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    endpoint: {
      type: String,
      required: [true, 'Endpoint is required'],
      unique: true,
      trim: true,
    },
    keys: {
      auth: {
        type: String,
        required: [true, 'Auth key is required'],
        trim: true,
      },
      p256dh: {
        type: String,
        required: [true, 'P256dh key is required'],
        trim: true,
      },
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for faster queries by userId
pushSubscriptionSchema.index({ userId: 1, endpoint: 1 });

// Ensure endpoint is unique per user
pushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });

const PushSubscription = mongoose.model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);

export default PushSubscription;