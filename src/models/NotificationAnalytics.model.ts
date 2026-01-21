import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType = 'push' | 'email' | 'sse';
export type NotificationStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
export type NotificationEventType = 
  | 'reservation_created'
  | 'reservation_confirmed'
  | 'reservation_cancelled'
  | 'reservation_updated'
  | 'reservation_completed'
  | 'general'
  | 'system';

export interface INotificationAnalytics extends Document {
  userId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  notificationType: NotificationType;
  eventType: NotificationEventType;
  status: NotificationStatus;
  
  // Push notification specific fields
  pushEndpoint?: string;
  pushMessageId?: string;
  
  // Email specific fields
  emailTo?: string;
  emailMessageId?: string;
  
  // SSE specific fields
  sseClientId?: string;
  
  // Error tracking
  errorCode?: string;
  errorMessage?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  
  // Timestamps
  sentAt: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationAnalyticsSchema = new Schema<INotificationAnalytics>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    notificationType: {
      type: String,
      enum: ['push', 'email', 'sse'],
      required: [true, 'Notification type is required'],
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'reservation_created',
        'reservation_confirmed',
        'reservation_cancelled',
        'reservation_updated',
        'reservation_completed',
        'general',
        'system'
      ],
      required: [true, 'Event type is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'opened', 'clicked', 'failed'],
      required: [true, 'Status is required'],
      index: true,
    },
    
    // Push notification specific fields
    pushEndpoint: {
      type: String,
      trim: true,
      sparse: true,
    },
    pushMessageId: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    // Email specific fields
    emailTo: {
      type: String,
      trim: true,
      sparse: true,
    },
    emailMessageId: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    // SSE specific fields
    sseClientId: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    // Error tracking
    errorCode: {
      type: String,
      trim: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    
    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    
    // Status timestamps
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    deliveredAt: {
      type: Date,
    },
    openedAt: {
      type: Date,
    },
    clickedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
notificationAnalyticsSchema.index({ restaurantId: 1, createdAt: -1 });
notificationAnalyticsSchema.index({ userId: 1, notificationType: 1, status: 1 });
notificationAnalyticsSchema.index({ notificationType: 1, eventType: 1, status: 1 });
notificationAnalyticsSchema.index({ sentAt: 1, status: 1 });
notificationAnalyticsSchema.index({ restaurantId: 1, notificationType: 1, eventType: 1 });

// Virtual for notification age
notificationAnalyticsSchema.virtual('ageInHours').get(function() {
  return (Date.now() - this.sentAt.getTime()) / (1000 * 60 * 60);
});

// Virtual for time to deliver (if delivered)
notificationAnalyticsSchema.virtual('timeToDeliverInSeconds').get(function() {
  if (!this.deliveredAt) return null;
  return (this.deliveredAt.getTime() - this.sentAt.getTime()) / 1000;
});

const NotificationAnalytics = mongoose.model<INotificationAnalytics>(
  'NotificationAnalytics',
  notificationAnalyticsSchema
);

export default NotificationAnalytics;