import mongoose, { Document, Schema } from 'mongoose';

export interface IMenuCategory extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const menuCategorySchema = new Schema<IMenuCategory>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    displayOrder: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for restaurant and display order
menuCategorySchema.index({ restaurantId: 1, displayOrder: 1 });

// Unique category name per restaurant
menuCategorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });

const MenuCategory = mongoose.model<IMenuCategory>('MenuCategory', menuCategorySchema);

export default MenuCategory;
