import { Router } from 'express';
import * as dayBlockController from '../controllers/dayblock.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createDayBlockSchema,
  bulkCreateDayBlocksSchema,
  checkDayBlockParam,
  dayBlockIdParam,
} from '../validations/dayblock.schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole(['restaurant']));

router.get('/', dayBlockController.getDayBlocks);
router.get(
  '/check/:date',
  validate({ params: checkDayBlockParam }),
  dayBlockController.checkDayBlock
);
router.post(
  '/',
  validate({ body: createDayBlockSchema }),
  dayBlockController.createDayBlock
);
router.post(
  '/bulk',
  validate({ body: bulkCreateDayBlocksSchema }),
  dayBlockController.bulkCreateDayBlocks
);
router.delete(
  '/:id',
  validate({ params: dayBlockIdParam }),
  dayBlockController.deleteDayBlock
);

export default router;
