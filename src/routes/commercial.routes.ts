import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createRestaurantSchema,
  getMyRestaurantsQuery,
  updateMyObjectivesSchema,
  updateRestaurantNoteSchema,
  restaurantIdParam,
} from '../validations/commercial.schemas';
import {
  updateProfileSchema,
  changePasswordSchema,
} from '../validations/profile.schemas';
import { upload } from '../config/storage.config';
import * as commercialController from '../controllers/commercial.controller';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole(['commercial']));

router.get(
  '/restaurants',
  validate({ query: getMyRestaurantsQuery }),
  commercialController.getMyRestaurants
);
router.post(
  '/restaurants',
  validate({ body: createRestaurantSchema }),
  commercialController.createRestaurant
);
router.get(
  '/restaurants/:id',
  validate({ params: restaurantIdParam }),
  commercialController.getRestaurantDetail
);
router.get('/stats', commercialController.getMyStats);
router.get('/objectives', commercialController.getMyObjectives);
router.put(
  '/objectives',
  validate({ body: updateMyObjectivesSchema }),
  commercialController.updateMyObjectives
);
router.get('/profile', commercialController.getProfile);
router.put(
  '/profile',
  validate({ body: updateProfileSchema }),
  commercialController.updateProfile
);
router.put(
  '/profile/password',
  validate({ body: changePasswordSchema }),
  commercialController.changePassword
);
router.post('/profile/photo', upload.single('photo'), commercialController.uploadPhoto);
router.get(
  '/restaurants/:id/notes',
  validate({ params: restaurantIdParam }),
  commercialController.getRestaurantNote
);
router.put(
  '/restaurants/:id/notes',
  validate({ body: updateRestaurantNoteSchema, params: restaurantIdParam }),
  commercialController.updateRestaurantNote
);

export default router;
