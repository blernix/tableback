#!/usr/bin/env node
/**
 * Script pour générer des slugs pour les restaurants existants
 * Usage: npx ts-node --transpile-only scripts/generate-slugs.js
 */

require('ts-node').register({ transpileOnly: true });
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const { generateShortCode } = require('../src/utils/slugGenerator');
const Restaurant = require('../src/models/Restaurant.model').default;

async function generateSlugs() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tablemaster', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connecté à MongoDB');

    // Trouver tous les restaurants sans slug
    const restaurants = await Restaurant.find({ publicSlug: { $exists: false } });
    console.log(`📊 ${restaurants.length} restaurants sans slug trouvés`);

    let updatedCount = 0;
    let errorCount = 0;

    // Générer un slug unique pour chaque restaurant
    for (const restaurant of restaurants) {
      try {
        let slug;
        let attempts = 0;
        let isUnique = false;

        // Essayer jusqu'à trouver un slug unique (max 5 tentatives)
        while (!isUnique && attempts < 5) {
          slug = generateShortCode(8);
          const existing = await Restaurant.findOne({ publicSlug: slug });
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }

        if (!isUnique) {
          // Utiliser un suffixe avec l'ID si toujours pas unique
          slug = `${generateShortCode(6)}-${restaurant._id.toString().slice(-4)}`;
        }

        restaurant.publicSlug = slug;
        await restaurant.save();
        updatedCount++;
        console.log(`   ✅ ${restaurant.name}: ${slug}`);
      } catch (err) {
        console.error(`   ❌ Erreur pour ${restaurant.name}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n📈 Résumé:');
    console.log(`   Restaurants mis à jour: ${updatedCount}`);
    console.log(`   Erreurs: ${errorCount}`);
    console.log(`   Total restaurants traités: ${restaurants.length}`);

    // Vérifier les doublons
    const duplicates = await Restaurant.aggregate([
      { $group: { _id: '$publicSlug', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
    ]);

    if (duplicates.length > 0) {
      console.log('\n⚠️  Attention: Doublons de slugs détectés:');
      duplicates.forEach(dup => {
        console.log(`   Slug "${dup._id}": ${dup.count} restaurants`);
      });
    } else {
      console.log('\n✅ Aucun doublon de slug détecté');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la génération des slugs:', error);
    process.exit(1);
  }
}

generateSlugs();