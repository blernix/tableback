import { Router } from 'express';
import * as slugManagementController from '../controllers/slug-management.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Vérification de disponibilité du slug (publique)
router.get('/check-slug-availability/:slug', slugManagementController.checkSlugAvailability);

// Mise à jour du slug (authentification requise, Pro uniquement)
router.put('/slug', authenticateToken, slugManagementController.updateRestaurantSlug);

export default router;