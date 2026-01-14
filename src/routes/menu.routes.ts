import { Router } from 'express';
import * as menuController from '../controllers/menu.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { upload } from '../config/storage.config';

const router = Router();

// All menu routes require authentication and restaurant role
router.use(authenticateToken);
router.use(authorizeRole(['restaurant']));

// Categories
router.get('/categories', menuController.getCategories);
router.post('/categories', menuController.createCategory);
router.put('/categories/reorder', menuController.reorderCategories); // IMPORTANT: Must be before /:id routes
router.put('/categories/:id', menuController.updateCategory);
router.delete('/categories/:id', menuController.deleteCategory);

// Dishes
router.get('/dishes', menuController.getDishes);
router.post('/dishes', menuController.createDish);
router.put('/dishes/:id', menuController.updateDish);
router.delete('/dishes/:id', menuController.deleteDish);
router.patch('/dishes/:id/toggle-availability', menuController.toggleDishAvailability);
router.post('/dishes/:id/photo', upload.single('photo'), menuController.uploadDishPhoto);
router.delete('/dishes/:id/photo', menuController.deleteDishPhoto);

export default router;
