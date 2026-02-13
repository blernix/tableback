import mongoose, { Document, Schema } from 'mongoose';

export interface DishVariation {
  id?: string;
  name: string;
  price: number;
}

export interface IDish extends Document {
  restaurantId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  hasVariations: boolean;
  variations: DishVariation[];
  allergens: string[];
  available: boolean;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dishVariationSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });

const dishSchema = new Schema<IDish>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuCategory',
      required: [true, 'Category ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Dish name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be non-negative'],
    },
    hasVariations: {
      type: Boolean,
      default: false,
    },
    variations: {
      type: [dishVariationSchema],
      default: [],
    },
    allergens: {
      type: [String],
      default: [],
    },
    available: {
      type: Boolean,
      default: true,
    },
    photoUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for restaurant and category
dishSchema.index({ restaurantId: 1, categoryId: 1 });

// Index for available dishes
dishSchema.index({ restaurantId: 1, available: 1 });

const Dish = mongoose.model<IDish>('Dish', dishSchema);

export default Dish;
