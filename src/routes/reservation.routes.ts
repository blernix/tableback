import { Router } from 'express';
import * as reservationController from '../controllers/reservation.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createReservationSchema,
  updateReservationSchema,
  getReservationsQuery,
  reservationIdParam,
} from '../validations/reservation.schemas';
import { checkReservationQuota } from '../middleware/quota.middleware';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole(['restaurant', 'server']));

router.get(
  '/',
  validate({ query: getReservationsQuery }),
  reservationController.getReservations
);
router.get(
  '/:id',
  validate({ params: reservationIdParam }),
  reservationController.getReservation
);
router.post(
  '/',
  checkReservationQuota,
  validate({ body: createReservationSchema }),
  reservationController.createReservation
);
router.put(
  '/:id',
  validate({ body: updateReservationSchema, params: reservationIdParam }),
  reservationController.updateReservation
);
router.delete(
  '/:id',
  validate({ params: reservationIdParam }),
  reservationController.deleteReservation
);

export default router;
