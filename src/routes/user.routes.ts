import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

// All user routes require authentication and restaurant role
router.use(authenticateToken);
router.use(authorizeRole(['restaurant']));

// Server user management
router.get('/servers', userController.getServerUsers);
router.post('/servers', userController.createServerUser);
router.put('/servers/:id', userController.updateServerUser);
router.delete('/servers/:id', userController.deleteServerUser);

export default router;
