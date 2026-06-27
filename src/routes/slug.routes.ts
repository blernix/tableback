import { Router } from 'express';
import * as slugManagementController from '../controllers/slug-management.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { checkSlugAvailabilityParam, updateRestaurantSlugSchema } from '../validations/slug.schemas';

const router = Router();

router.get(
  '/check-slug-availability/:slug',
  validate({ params: checkSlugAvailabilityParam }),
  slugManagementController.checkSlugAvailability
);

router.put(
  '/slug',
  authenticateToken,
  validate({ body: updateRestaurantSlugSchema }),
  slugManagementController.updateRestaurantSlug
);

export default router;
