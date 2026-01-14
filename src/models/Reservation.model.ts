import mongoose, { Document, Schema } from 'mongoose';

export interface IReservation extends Document {
  restaurantId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: Date;
  time: string;
  numberOfGuests: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<IReservation>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      trim: true,
      lowercase: true,
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Reservation date is required'],
      index: true,
    },
    time: {
      type: String,
      required: [true, 'Reservation time is required'],
    },
    numberOfGuests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'At least 1 guest is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
reservationSchema.index({ restaurantId: 1, date: 1 });
reservationSchema.index({ restaurantId: 1, status: 1 });
reservationSchema.index({ restaurantId: 1, date: 1, status: 1 });

const Reservation = mongoose.model<IReservation>('Reservation', reservationSchema);

export default Reservation;
