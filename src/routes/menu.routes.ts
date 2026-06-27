import { Router } from 'express';
import * as menuController from '../controllers/menu.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  createDishSchema,
  updateDishSchema,
  getDishesQuery,
  categoryIdParam,
  dishIdParam,
} from '../validations/menu.schemas';
import { upload } from '../config/storage.config';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole(['restaurant']));

router.get('/categories', menuController.getCategories);
router.post(
  '/categories',
  validate({ body: createCategorySchema }),
  menuController.createCategory
);
router.put(
  '/categories/reorder',
  validate({ body: reorderCategoriesSchema }),
  menuController.reorderCategories
);
router.put(
  '/categories/:id',
  validate({ body: updateCategorySchema, params: categoryIdParam }),
  menuController.updateCategory
);
router.delete(
  '/categories/:id',
  validate({ params: categoryIdParam }),
  menuController.deleteCategory
);

router.get(
  '/dishes',
  validate({ query: getDishesQuery }),
  menuController.getDishes
);
router.post(
  '/dishes',
  validate({ body: createDishSchema }),
  menuController.createDish
);
router.put(
  '/dishes/:id',
  validate({ body: updateDishSchema, params: dishIdParam }),
  menuController.updateDish
);
router.delete(
  '/dishes/:id',
  validate({ params: dishIdParam }),
  menuController.deleteDish
);
router.patch(
  '/dishes/:id/toggle-availability',
  validate({ params: dishIdParam }),
  menuController.toggleDishAvailability
);
router.post(
  '/dishes/:id/photo',
  validate({ params: dishIdParam }),
  upload.single('photo'),
  menuController.uploadDishPhoto
);
router.delete(
  '/dishes/:id/photo',
  validate({ params: dishIdParam }),
  menuController.deleteDishPhoto
);

export default router;
