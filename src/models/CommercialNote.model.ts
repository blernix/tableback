import mongoose, { Document, Schema } from 'mongoose';

export interface ICommercialNote extends Document {
  restaurantId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const commercialNoteSchema = new Schema<ICommercialNote>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
  },
  { timestamps: true }
);

commercialNoteSchema.index({ restaurantId: 1, userId: 1 }, { unique: true });

export default mongoose.model<ICommercialNote>('CommercialNote', commercialNoteSchema);
