import { Request, Response } from 'express';
import { Types } from 'mongoose';
import MenuCategory from '../models/MenuCategory.model';
import Dish from '../models/Dish.model';
import logger from '../utils/logger';
import { z } from 'zod';
import { uploadToGCS, deleteFromGCS } from '../config/storage.config';

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string()).min(1, 'At least one category ID is required'),
});

const dishVariationSchema = z.object({
  name: z.string().min(1, 'Variation name is required'),
  price: z.number().min(0, 'Variation price must be non-negative'),
});

const createDishSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  name: z.string().min(1, 'Dish name is required').trim(),
  description: z.string().trim().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  hasVariations: z.boolean().optional(),
  variations: z.array(dishVariationSchema).optional(),
  allergens: z.array(z.string()).optional(),
  available: z.boolean().optional(),
});

const updateDishSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1, 'Dish name is required').trim().optional(),
  description: z.string().trim().optional(),
  price: z.number().min(0, 'Price must be non-negative').optional(),
  hasVariations: z.boolean().optional(),
  variations: z.array(dishVariationSchema).optional(),
  allergens: z.array(z.string()).optional(),
  available: z.boolean().optional(),
});

// Get all categories for restaurant
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const categories = await MenuCategory.find({ restaurantId: req.user.restaurantId })
      .sort({ displayOrder: 1 })
      .select('-__v');

    res.status(200).json({ categories });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: { message: 'Failed to fetch categories' } });
  }
};

// Create category
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = createCategorySchema.parse(req.body);

    // Get the highest display order
    const lastCategory = await MenuCategory.findOne({ restaurantId: req.user.restaurantId })
      .sort({ displayOrder: -1 })
      .select('displayOrder');

    const displayOrder = lastCategory ? lastCategory.displayOrder + 1 : 0;

    const category = new MenuCategory({
      restaurantId: req.user.restaurantId,
      name: validatedData.name,
      displayOrder,
    });

    await category.save();

    logger.info(`Category created: ${category.name} (ID: ${category._id})`);

    res.status(201).json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors
        }
      });
      return;
    }

    // Handle duplicate category name
    if ((error as any).code === 11000) {
      res.status(400).json({
        error: { message: 'A category with this name already exists' }
      });
      return;
    }

    logger.error('Error creating category:', error);
    res.status(500).json({ error: { message: 'Failed to create category' } });
  }
};

// Update category
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;
    const validatedData = updateCategorySchema.parse(req.body);

    const category = await MenuCategory.findOneAndUpdate(
      {
        _id: id,
        restaurantId: req.user.restaurantId, // Ensure user can only update their own categories
      },
      { $set: validatedData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!category) {
      res.status(404).json({ error: { message: 'Category not found' } });
      return;
    }

    logger.info(`Category updated: ${category.name} (ID: ${category._id})`);

    res.status(200).json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors
        }
      });
      return;
    }

    // Handle duplicate category name
    if ((error as any).code === 11000) {
      res.status(400).json({
        error: { message: 'A category with this name already exists' }
      });
      return;
    }

    logger.error('Error updating category:', error);
    res.status(500).json({ error: { message: 'Failed to update category' } });
  }
};

// Delete category
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    const category = await MenuCategory.findOneAndDelete({
      _id: id,
      restaurantId: req.user.restaurantId, // Ensure user can only delete their own categories
    });

    if (!category) {
      res.status(404).json({ error: { message: 'Category not found' } });
      return;
    }

    logger.info(`Category deleted: ${category.name} (ID: ${id})`);

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting category:', error);
    res.status(500).json({ error: { message: 'Failed to delete category' } });
  }
};

// Reorder categories
export const reorderCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = reorderCategoriesSchema.parse(req.body);

    // Update display order for each category
    const updatePromises = validatedData.categoryIds.map((categoryId, index) =>
      MenuCategory.findOneAndUpdate(
        {
          _id: categoryId,
          restaurantId: req.user!.restaurantId, // Ensure user can only reorder their own categories
        },
        { displayOrder: index },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    // Fetch updated categories
    const categories = await MenuCategory.find({ restaurantId: req.user.restaurantId })
      .sort({ displayOrder: 1 })
      .select('-__v');

    logger.info(`Categories reordered for restaurant ID: ${req.user.restaurantId}`);

    res.status(200).json({ categories });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors
        }
      });
      return;
    }

    logger.error('Error reordering categories:', error);
    res.status(500).json({ error: { message: 'Failed to reorder categories' } });
  }
};

// ==================== DISHES ====================

// Get all dishes for restaurant (optionally filtered by category)
export const getDishes = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { categoryId } = req.query;

    interface DishFilter {
      restaurantId: Types.ObjectId;
      categoryId?: string;
    }

    const filter: DishFilter = { restaurantId: req.user.restaurantId };
    if (categoryId) {
      filter.categoryId = categoryId as string;
    }

    const dishes = await Dish.find(filter)
      .populate('categoryId', 'name')
      .select('-__v');

    res.status(200).json({ dishes });
  } catch (error) {
    logger.error('Error fetching dishes:', error);
    res.status(500).json({ error: { message: 'Failed to fetch dishes' } });
  }
};

// Create dish
export const createDish = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const validatedData = createDishSchema.parse(req.body);

    // Verify category belongs to restaurant
    const category = await MenuCategory.findOne({
      _id: validatedData.categoryId,
      restaurantId: req.user.restaurantId,
    });

    if (!category) {
      res.status(404).json({ error: { message: 'Category not found' } });
      return;
    }

    const dish = new Dish({
      restaurantId: req.user.restaurantId,
      categoryId: validatedData.categoryId,
      name: validatedData.name,
      description: validatedData.description || '',
      price: validatedData.price,
      hasVariations: validatedData.hasVariations || false,
      variations: validatedData.variations || [],
      allergens: validatedData.allergens || [],
      available: validatedData.available !== undefined ? validatedData.available : true,
    });

    await dish.save();

    const populatedDish = await Dish.findById(dish._id).populate('categoryId', 'name');

    logger.info(`Dish created: ${dish.name} (ID: ${dish._id})`);

    res.status(201).json({ dish: populatedDish });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors
        }
      });
      return;
    }

    logger.error('Error creating dish:', error);
    res.status(500).json({ error: { message: 'Failed to create dish' } });
  }
};

// Update dish
export const updateDish = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;
    const validatedData = updateDishSchema.parse(req.body);

    // If categoryId is being updated, verify it belongs to restaurant
    if (validatedData.categoryId) {
      const category = await MenuCategory.findOne({
        _id: validatedData.categoryId,
        restaurantId: req.user.restaurantId,
      });

      if (!category) {
        res.status(404).json({ error: { message: 'Category not found' } });
        return;
      }
    }

    const dish = await Dish.findOneAndUpdate(
      {
        _id: id,
        restaurantId: req.user.restaurantId, // Ensure user can only update their own dishes
      },
      { $set: validatedData },
      { new: true, runValidators: true }
    ).populate('categoryId', 'name');

    if (!dish) {
      res.status(404).json({ error: { message: 'Dish not found' } });
      return;
    }

    logger.info(`Dish updated: ${dish.name} (ID: ${dish._id})`);

    res.status(200).json({ dish });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors
        }
      });
      return;
    }

    logger.error('Error updating dish:', error);
    res.status(500).json({ error: { message: 'Failed to update dish' } });
  }
};

// Delete dish
export const deleteDish = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    const dish = await Dish.findOneAndDelete({
      _id: id,
      restaurantId: req.user.restaurantId, // Ensure user can only delete their own dishes
    });

    if (!dish) {
      res.status(404).json({ error: { message: 'Dish not found' } });
      return;
    }

    logger.info(`Dish deleted: ${dish.name} (ID: ${id})`);

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting dish:', error);
    res.status(500).json({ error: { message: 'Failed to delete dish' } });
  }
};

// Toggle dish availability
export const toggleDishAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    const dish = await Dish.findOne({
      _id: id,
      restaurantId: req.user.restaurantId,
    });

    if (!dish) {
      res.status(404).json({ error: { message: 'Dish not found' } });
      return;
    }

    dish.available = !dish.available;
    await dish.save();

    const populatedDish = await Dish.findById(dish._id).populate('categoryId', 'name');

    logger.info(`Dish availability toggled: ${dish.name} (ID: ${dish._id}) - Available: ${dish.available}`);

    res.status(200).json({ dish: populatedDish });
  } catch (error) {
    logger.error('Error toggling dish availability:', error);
    res.status(500).json({ error: { message: 'Failed to toggle dish availability' } });
  }
};

// Upload dish photo
export const uploadDishPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      logger.warn('Upload attempt without restaurant association');
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    if (!req.file) {
      logger.warn(`No file provided for dish ${id}`);
      res.status(400).json({ error: { message: 'No image file provided' } });
      return;
    }

    logger.info(`Uploading photo for dish ${id}, file: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

    // Verify dish belongs to restaurant
    const dish = await Dish.findOne({
      _id: id,
      restaurantId: req.user.restaurantId,
    });

    if (!dish) {
      logger.warn(`Dish ${id} not found for restaurant ${req.user.restaurantId}`);
      res.status(404).json({ error: { message: 'Dish not found' } });
      return;
    }

    // Delete old photo if exists
    if (dish.photoUrl) {
      try {
        logger.info(`Deleting old photo: ${dish.photoUrl}`);
        await deleteFromGCS(dish.photoUrl);
      } catch (error) {
        logger.warn(`Failed to delete old dish photo: ${error}`);
      }
    }

    // Upload new photo to GCS
    logger.info('Starting GCS upload...');
    const photoUrl = await uploadToGCS(req.file, 'uploads/dishes');
    logger.info(`GCS upload successful: ${photoUrl}`);

    // Update dish with new photo URL
    dish.photoUrl = photoUrl;
    await dish.save();

    const populatedDish = await Dish.findById(dish._id).populate('categoryId', 'name');

    logger.info(`Dish photo uploaded successfully: ${dish.name} (ID: ${dish._id})`);

    res.status(200).json({ dish: populatedDish });
  } catch (error) {
    logger.error('Error uploading dish photo:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      dishId: req.params.id,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    });
    res.status(500).json({ error: { message: 'Failed to upload dish photo' } });
  }
};

// Delete dish photo
export const deleteDishPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.restaurantId) {
      res.status(400).json({ error: { message: 'User not associated with a restaurant' } });
      return;
    }

    const { id } = req.params;

    // Verify dish belongs to restaurant
    const dish = await Dish.findOne({
      _id: id,
      restaurantId: req.user.restaurantId,
    });

    if (!dish) {
      res.status(404).json({ error: { message: 'Dish not found' } });
      return;
    }

    if (!dish.photoUrl) {
      res.status(400).json({ error: { message: 'Dish has no photo to delete' } });
      return;
    }

    // Delete photo from GCS
    try {
      await deleteFromGCS(dish.photoUrl);
    } catch (error) {
      logger.error('Error deleting photo from GCS:', error);
      // Continue even if GCS delete fails
    }

    // Remove photo URL from dish
    dish.photoUrl = undefined;
    await dish.save();

    const populatedDish = await Dish.findById(dish._id).populate('categoryId', 'name');

    logger.info(`Dish photo deleted: ${dish.name} (ID: ${dish._id})`);

    res.status(200).json({ dish: populatedDish });
  } catch (error) {
    logger.error('Error deleting dish photo:', error);
    res.status(500).json({ error: { message: 'Failed to delete dish photo' } });
  }
};
