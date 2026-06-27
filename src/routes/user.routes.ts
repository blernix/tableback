import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createServerUserSchema,
  updateServerUserSchema,
  serverUserIdParam,
} from '../validations/user.schemas';
import { verifyProPlan } from '../middleware/subscription.middleware';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole(['restaurant']));
router.use(verifyProPlan);

router.get('/servers', userController.getServerUsers);
router.post(
  '/servers',
  validate({ body: createServerUserSchema }),
  userController.createServerUser
);
router.put(
  '/servers/:id',
  validate({ body: updateServerUserSchema, params: serverUserIdParam }),
  userController.updateServerUser
);
router.delete(
  '/servers/:id',
  validate({ params: serverUserIdParam }),
  userController.deleteServerUser
);

export default router;
