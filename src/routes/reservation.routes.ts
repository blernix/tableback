import { Router } from 'express';
import * as reservationController from '../controllers/reservation.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { checkReservationQuota } from '../middleware/quota.middleware';

const router = Router();

// All reservation routes require authentication and restaurant or server role
router.use(authenticateToken);
router.use(authorizeRole(['restaurant', 'server']));

// Reservations
router.get('/', reservationController.getReservations);
router.get('/:id', reservationController.getReservation);
router.post('/', checkReservationQuota, reservationController.createReservation);
router.put('/:id', reservationController.updateReservation);
router.delete('/:id', reservationController.deleteReservation);

export default router;
