import mongoose, { Document, Schema } from 'mongoose';

export interface IClosure extends Document {
  restaurantId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  reason?: string;
  createdAt: Date;
}

const closureSchema = new Schema<IClosure>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
closureSchema.index({ restaurantId: 1 });
closureSchema.index({ startDate: 1 });
closureSchema.index({ restaurantId: 1, startDate: 1 });

const Closure = mongoose.model<IClosure>('Closure', closureSchema);

export default Closure;
