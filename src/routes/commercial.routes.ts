import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import * as commercialController from '../controllers/commercial.controller';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole(['commercial']));

router.get('/restaurants', commercialController.getMyRestaurants);
router.post('/restaurants', commercialController.createRestaurant);
router.get('/stats', commercialController.getMyStats);

export default router;
