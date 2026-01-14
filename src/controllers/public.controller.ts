import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant.model';
import MenuCategory from '../models/MenuCategory.model';
import Dish from '../models/Dish.model';
import logger from '../utils/logger';

// Get menu by API key (public endpoint)
export const getMenuByApiKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiKey } = req.params;

    if (!apiKey) {
      res.status(400).json({ error: { message: 'API key is required' } });
      return;
    }

    // Find restaurant by API key
    const restaurant = await Restaurant.findOne({ apiKey, status: 'active' }).select(
      'name address phone email menu'
    );

    if (!restaurant) {
      res.status(404).json({ error: { message: 'Restaurant not found or inactive' } });
      return;
    }

    // Return response based on menu display mode
    if (restaurant.menu.displayMode === 'pdf') {
      // PDF mode: return PDF URL only
      res.status(200).json({
        restaurantName: restaurant.name,
        displayMode: 'pdf',
        pdfUrl: restaurant.menu.pdfUrl || null,
      });
    } else if (restaurant.menu.displayMode === 'both') {
      // Both mode: return PDF URL AND detailed categories
      const categories = await MenuCategory.find({ restaurantId: restaurant._id })
        .sort({ displayOrder: 1 })
        .select('name displayOrder');

      const categoriesWithDishes = await Promise.all(
        categories.map(async (category) => {
          const dishes = await Dish.find({
            restaurantId: restaurant._id,
            categoryId: category._id,
            available: true, // Only return available dishes
          })
            .select('name description price allergens photoUrl')
            .lean();

          return {
            id: category._id,
            name: category.name,
            displayOrder: category.displayOrder,
            dishes: dishes.map(dish => ({
              id: dish._id,
              name: dish.name,
              description: dish.description,
              price: dish.price,
              allergens: dish.allergens,
              photoUrl: dish.photoUrl,
            })),
          };
        })
      );

      // Filter out empty categories
      const filteredCategories = categoriesWithDishes.filter(cat => cat.dishes.length > 0);

      res.status(200).json({
        restaurantName: restaurant.name,
        displayMode: 'both',
        pdfUrl: restaurant.menu.pdfUrl || null,
        categories: filteredCategories,
      });
    } else {
      // Detailed mode: return categories with available dishes
      const categories = await MenuCategory.find({ restaurantId: restaurant._id })
        .sort({ displayOrder: 1 })
        .select('name displayOrder');

      const categoriesWithDishes = await Promise.all(
        categories.map(async (category) => {
          const dishes = await Dish.find({
            restaurantId: restaurant._id,
            categoryId: category._id,
            available: true, // Only return available dishes
          })
            .select('name description price allergens photoUrl')
            .lean();

          return {
            id: category._id,
            name: category.name,
            displayOrder: category.displayOrder,
            dishes: dishes.map(dish => ({
              id: dish._id,
              name: dish.name,
              description: dish.description,
              price: dish.price,
              allergens: dish.allergens,
              photoUrl: dish.photoUrl,
            })),
          };
        })
      );

      // Filter out empty categories
      const filteredCategories = categoriesWithDishes.filter(cat => cat.dishes.length > 0);

      res.status(200).json({
        restaurantName: restaurant.name,
        displayMode: 'detailed',
        categories: filteredCategories,
      });
    }

    logger.info(`Menu accessed via API key for restaurant: ${restaurant.name}`);
  } catch (error) {
    logger.error('Error fetching menu by API key:', error);
    res.status(500).json({ error: { message: 'Failed to fetch menu' } });
  }
};
