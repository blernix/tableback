import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as commercialController from '../controllers/commercial.controller';
import { upload } from '../config/storage.config';

const router = Router();

router.use(authenticateToken);

router.get('/', commercialController.getProfile);
router.put('/', commercialController.updateProfile);
router.put('/password', commercialController.changePassword);
router.post('/photo', upload.single('photo'), commercialController.uploadPhoto);

export default router;
