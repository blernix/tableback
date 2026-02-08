// Test simple pour vérifier l'import
const slugManagementController = require('../controllers/slug-management.controller');

console.log('slugManagementController:', slugManagementController);
console.log('updateRestaurantSlug:', slugManagementController.updateRestaurantSlug);
console.log('checkSlugAvailability:', slugManagementController.checkSlugAvailability);