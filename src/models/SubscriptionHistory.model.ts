import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionHistory extends Document {
  restaurantId: mongoose.Types.ObjectId;
  eventType:
    | 'subscription_created'
    | 'subscription_updated'
    | 'subscription_cancelled'
    | 'subscription_renewed'
    | 'plan_upgraded'
    | 'plan_downgraded'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'trial_started'
    | 'trial_ended';
  plan: 'starter' | 'pro';
  previousPlan?: 'starter' | 'pro';
  stripeEventId?: string;
  stripeInvoiceId?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const subscriptionHistorySchema = new Schema<ISubscriptionHistory>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'subscription_created',
        'subscription_updated',
        'subscription_cancelled',
        'subscription_renewed',
        'plan_upgraded',
        'plan_downgraded',
        'payment_succeeded',
        'payment_failed',
        'trial_started',
        'trial_ended',
      ],
      required: [true, 'Event type is required'],
    },
    plan: {
      type: String,
      enum: ['starter', 'pro'],
      required: [true, 'Plan is required'],
    },
    previousPlan: {
      type: String,
      enum: ['starter', 'pro'],
      default: undefined,
    },
    stripeEventId: {
      type: String,
      index: true,
    },
    stripeInvoiceId: {
      type: String,
    },
    amount: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'eur',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
subscriptionHistorySchema.index({ restaurantId: 1, createdAt: -1 });
subscriptionHistorySchema.index({ eventType: 1 });
subscriptionHistorySchema.index({ stripeEventId: 1 }, { unique: true, sparse: true });

const SubscriptionHistory = mongoose.model<ISubscriptionHistory>(
  'SubscriptionHistory',
  subscriptionHistorySchema
);

export default SubscriptionHistory;
