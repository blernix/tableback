import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { upload } from '../config/storage.config';
import * as commercialController from '../controllers/commercial.controller';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole(['commercial']));

router.get('/restaurants', commercialController.getMyRestaurants);
router.post('/restaurants', commercialController.createRestaurant);
router.get('/restaurants/:id', commercialController.getRestaurantDetail);
router.get('/stats', commercialController.getMyStats);
router.get('/objectives', commercialController.getMyObjectives);
router.put('/objectives', commercialController.updateMyObjectives);
router.get('/profile', commercialController.getProfile);
router.put('/profile', commercialController.updateProfile);
router.put('/profile/password', commercialController.changePassword);
router.post('/profile/photo', upload.single('photo'), commercialController.uploadPhoto);
router.get('/restaurants/:id/notes', commercialController.getRestaurantNote);
router.put('/restaurants/:id/notes', commercialController.updateRestaurantNote);

export default router;
