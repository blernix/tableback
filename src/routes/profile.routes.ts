import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateProfileSchema, changePasswordSchema } from '../validations/profile.schemas';
import * as commercialController from '../controllers/commercial.controller';
import { upload } from '../config/storage.config';

const router = Router();

router.use(authenticateToken);

router.get('/', commercialController.getProfile);
router.put(
  '/',
  validate({ body: updateProfileSchema }),
  commercialController.updateProfile
);
router.put(
  '/password',
  validate({ body: changePasswordSchema }),
  commercialController.changePassword
);
router.post('/photo', upload.single('photo'), commercialController.uploadPhoto);

export default router;
