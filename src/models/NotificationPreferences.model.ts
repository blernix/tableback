import mongoose, { Document, Model, Schema, HydratedDocument } from 'mongoose';

export interface INotificationPreferences extends Document {
  userId: mongoose.Types.ObjectId;
  // Global toggles
  pushEnabled: boolean;
  emailEnabled: boolean;
  // Event-specific preferences
  reservationCreated: boolean;    // New reservation from website
  reservationConfirmed: boolean;  // Reservation confirmed by restaurant
  reservationCancelled: boolean;  // Reservation cancelled
  reservationUpdated: boolean;    // Reservation updated (date/time/guests)
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  shouldSendPush(eventType: string): boolean;
  shouldSendEmail(eventType: string): boolean;
}

export interface INotificationPreferencesModel extends Model<INotificationPreferences> {
  createDefault(userId: mongoose.Types.ObjectId): Promise<HydratedDocument<INotificationPreferences>>;
}

const notificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    // Global toggles
    pushEnabled: {
      type: Boolean,
      default: true,
    },
    emailEnabled: {
      type: Boolean,
      default: true,
    },
    // Event-specific preferences
    reservationCreated: {
      type: Boolean,
      default: true,
    },
    reservationConfirmed: {
      type: Boolean,
      default: true,
    },
    reservationCancelled: {
      type: Boolean,
      default: true,
    },
    reservationUpdated: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create default preferences when a user is created (via middleware or service)
notificationPreferencesSchema.statics.createDefault = function(userId: mongoose.Types.ObjectId) {
  return this.create({
    userId,
    pushEnabled: true,
    emailEnabled: true,
    reservationCreated: true,
    reservationConfirmed: true,
    reservationCancelled: true,
    reservationUpdated: true,
  });
};

// Method to check if user wants to receive push for a specific event
notificationPreferencesSchema.methods.shouldSendPush = function(eventType: string): boolean {
  if (!this.pushEnabled) return false;
  
  switch (eventType) {
    case 'reservation_created':
      return this.reservationCreated;
    case 'reservation_confirmed':
      return this.reservationConfirmed;
    case 'reservation_cancelled':
      return this.reservationCancelled;
    case 'reservation_updated':
      return this.reservationUpdated;
    default:
      return false;
  }
};

// Method to check if user wants to receive email for a specific event
notificationPreferencesSchema.methods.shouldSendEmail = function(eventType: string): boolean {
  if (!this.emailEnabled) return false;
  
  switch (eventType) {
    case 'reservation_created':
      return this.reservationCreated;
    case 'reservation_confirmed':
      return this.reservationConfirmed;
    case 'reservation_cancelled':
      return this.reservationCancelled;
    case 'reservation_updated':
      return this.reservationUpdated;
    default:
      return false;
  }
};

const NotificationPreferences = mongoose.model<INotificationPreferences, INotificationPreferencesModel>(
  'NotificationPreferences',
  notificationPreferencesSchema
);

export default NotificationPreferences;