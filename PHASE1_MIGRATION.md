# Phase 1 : Migration vers système d'abonnement - COMPLÉTÉE ✅

## Changements apportés

### 1. Modèle Restaurant modifié (`src/models/Restaurant.model.ts`)

**Nouveaux champs ajoutés** :

```typescript
// Type de compte
accountType: 'managed' | 'self-service'  // Default: 'managed'

// Informations d'abonnement (pour self-service uniquement)
subscription: {
  plan: 'starter' | 'pro'
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'
  stripeCustomerId: string
  stripeSubscriptionId: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEndsAt: Date
}

// Configuration widget (Pro uniquement)
widgetConfig: {
  primaryColor: string      // Default: '#3B82F6'
  secondaryColor: string    // Default: '#10B981'
  fontFamily: string        // Default: 'Inter, system-ui, sans-serif'
  borderRadius: string      // Default: '8px'
}
```

**Nouvelles méthodes** :
- `isSubscriptionActive()`: Vérifie si l'abonnement est actif
- `canCustomizeWidget()`: Vérifie si le restaurant peut personnaliser le widget (Pro uniquement)

### 2. Nouveau modèle SubscriptionHistory créé

**Fichier** : `src/models/SubscriptionHistory.model.ts`

Permet de tracker tous les événements liés aux abonnements :
- Création/mise à jour/annulation
- Changements de plan (upgrade/downgrade)
- Paiements réussis/échoués
- Début/fin de période d'essai

### 3. Nouveau middleware de vérification

**Fichier** : `src/middleware/subscription.middleware.ts`

**Deux middleware créés** :

#### `verifySubscription`
- Vérifie que le restaurant a un abonnement actif
- Les comptes `managed` bypasse cette vérification (toujours actifs)
- Les comptes `self-service` doivent avoir un abonnement valide
- Retourne erreur 402 si abonnement expiré

#### `verifyProPlan`
- Vérifie que le restaurant a un plan Pro
- Utilisé pour les fonctionnalités Pro uniquement (widget personnalisable)
- Les comptes `managed` ont accès (traités comme Pro)

### 4. Script de migration créé

**Fichier** : `src/scripts/migrate-to-account-types.ts`

Permet de migrer les restaurants existants vers le nouveau système.

---

## Migration des données existantes

### ⚠️ IMPORTANT : À exécuter AVANT de déployer en production

```bash
# 1. S'assurer que la DB est accessible
cd tablemaster-api

# 2. Installer les dépendances si nécessaire
npm install

# 3. Exécuter le script de migration
npx ts-node src/scripts/migrate-to-account-types.ts
```

**Ce que fait le script** :
- Trouve tous les restaurants sans `accountType`
- Les marque automatiquement comme `accountType: 'managed'`
- Affiche un rapport de la migration
- Vérifie que tout s'est bien passé

**Résultat attendu** :
```
✅ Tous les restaurants existants = 'managed'
✅ Aucun changement de comportement pour tes clients actuels
✅ Prêt pour ajouter des comptes 'self-service'
```

---

## Impact sur l'application existante

### ✅ Aucun changement breaking

1. **Restaurants existants** :
   - Automatiquement marqués comme `managed`
   - Fonctionnement identique à avant
   - Pas de vérification d'abonnement (bypass)

2. **Middleware d'authentification** :
   - Reste inchangé
   - Les routes existantes continuent de fonctionner

3. **API publique** :
   - Aucun changement
   - Continue de fonctionner normalement

---

## Prochaines étapes (Phase 2)

Une fois la migration effectuée, on pourra passer à :

1. **Intégration Stripe** :
   - Installation SDK Stripe
   - Configuration des webhooks
   - Création des produits et prix

2. **Endpoints de billing** :
   - `/api/billing/create-checkout` - Créer session de paiement
   - `/api/billing/webhook` - Recevoir événements Stripe
   - `/api/billing/portal` - Portail client Stripe

3. **Auto-inscription** :
   - Route publique `/api/auth/signup`
   - Création de restaurant `self-service`
   - Redirection vers Stripe Checkout

---

## Comment utiliser les nouveaux middleware

### Pour protéger une route avec vérification d'abonnement :

```typescript
import { verifySubscription } from '../middleware/subscription.middleware';

router.get(
  '/api/reservations',
  authenticateToken,
  verifySubscription,  // ← Nouveau
  getReservations
);
```

### Pour les fonctionnalités Pro uniquement :

```typescript
import { verifyProPlan } from '../middleware/subscription.middleware';

router.put(
  '/api/restaurant/widget-config',
  authenticateToken,
  verifyProPlan,  // ← Pro uniquement
  updateWidgetConfig
);
```

---

## Tests à effectuer après migration

### 1. Tester l'accès des restaurants existants
```bash
# Login avec un compte restaurant existant
# Vérifier qu'il peut accéder à toutes les fonctionnalités
```

### 2. Vérifier la base de données
```bash
# Se connecter à MongoDB
mongo <your_connection_string>

# Vérifier les accountType
db.restaurants.find({ accountType: 'managed' }).count()
# Devrait retourner le nombre total de restaurants existants
```

### 3. Tester les nouvelles méthodes
```javascript
const restaurant = await Restaurant.findById(restaurantId);
console.log(restaurant.isSubscriptionActive());  // true pour managed
console.log(restaurant.canCustomizeWidget());    // false pour managed
```

---

## Rollback en cas de problème

Si besoin de revenir en arrière :

```bash
# Supprimer le champ accountType
db.restaurants.updateMany(
  {},
  { $unset: { accountType: "", subscription: "", widgetConfig: "" } }
)
```

**Note** : Le rollback n'est normalement pas nécessaire car le champ `accountType` a une valeur par défaut de `'managed'` dans le schéma.

---

## Questions / Support

En cas de problème lors de la migration, vérifier :
1. Connexion MongoDB active
2. Variable d'environnement `MONGODB_URI` correcte
3. Permissions en écriture sur la base de données

---

**Status** : ✅ Phase 1 complétée
**Prochaine étape** : Phase 2 - Intégration Stripe
