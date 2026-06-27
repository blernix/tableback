import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string()).min(1, 'At least one category ID is required'),
});

export const createDishSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(1, 'Dish name is required').trim(),
  description: z.string().trim().optional(),
  price: z.number().min(0, 'Price must be 0 or greater'),
  hasVariations: z.boolean().optional(),
  variations: z.array(z.object({
    name: z.string().min(1),
    price: z.number().min(0),
  })).optional(),
  allergens: z.array(z.string()).optional(),
  available: z.boolean().optional(),
});

export const updateDishSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).trim().optional(),
  description: z.string().trim().optional(),
  price: z.number().min(0).optional(),
  hasVariations: z.boolean().optional(),
  variations: z.array(z.object({
    name: z.string().min(1),
    price: z.number().min(0),
  })).optional(),
  allergens: z.array(z.string()).optional(),
  available: z.boolean().optional(),
});

export const getDishesQuery = z.object({
  categoryId: z.string().optional(),
});

export const categoryIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
});

export const dishIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid dish ID'),
});
