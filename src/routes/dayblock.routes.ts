import { Router } from 'express';
import * as dayBlockController from '../controllers/dayblock.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

// All day block routes require authentication and restaurant role
router.use(authenticateToken);
router.use(authorizeRole(['restaurant']));

// Day blocks
router.get('/', dayBlockController.getDayBlocks);
router.get('/check/:date', dayBlockController.checkDayBlock);
router.post('/', dayBlockController.createDayBlock);
router.post('/bulk', dayBlockController.bulkCreateDayBlocks);
router.delete('/:id', dayBlockController.deleteDayBlock);

export default router;
