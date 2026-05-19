import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  restaurantId: mongoose.Types.ObjectId;
  email: string;
  name: string;
  phone: string;
  totalReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  noShowCount: number;
  lastVisit: Date | null;
  firstVisit: Date;
  averageGuests: number;
  tags: string[];
  notes: string;
  marketingConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
    },
    email: {
      type: String,
      required: [true, 'Customer email is required'],
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Customer phone is required'],
      trim: true,
    },
    totalReservations: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedReservations: {
      type: Number,
      default: 0,
      min: 0,
    },
    cancelledReservations: {
      type: Number,
      default: 0,
      min: 0,
    },
    noShowCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastVisit: {
      type: Date,
      default: null,
    },
    firstVisit: {
      type: Date,
      required: true,
    },
    averageGuests: {
      type: Number,
      default: 0,
      min: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    marketingConsent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ restaurantId: 1, email: 1 }, { unique: true });
customerSchema.index({ restaurantId: 1, totalReservations: -1 });
customerSchema.index({ restaurantId: 1, lastVisit: -1 });
customerSchema.index({ restaurantId: 1, tags: 1 });

customerSchema.virtual('cancellationRate').get(function (this: ICustomer) {
  if (this.totalReservations === 0) return 0;
  return Math.round((this.cancelledReservations / this.totalReservations) * 100);
});

customerSchema.virtual('isVip').get(function (this: ICustomer) {
  return this.tags.includes('VIP');
});

customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
