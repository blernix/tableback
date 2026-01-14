import mongoose, { Document, Schema } from 'mongoose';

export interface IDayBlock extends Document {
  restaurantId: mongoose.Types.ObjectId;
  date: Date;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dayBlockSchema = new Schema<IDayBlock>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
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

// Compound indexes
dayBlockSchema.index({ restaurantId: 1, date: 1 }, { unique: true });

const DayBlock = mongoose.model<IDayBlock>('DayBlock', dayBlockSchema);

export default DayBlock;
