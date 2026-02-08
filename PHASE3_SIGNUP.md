# Phase 3 : Auto-inscription publique - COMPLÉTÉE ✅

**Date** : 30 janvier 2026
**Durée** : ~1 heure

---

## 🎯 Objectif

Créer l'endpoint public permettant aux restaurateurs de s'inscrire eux-mêmes et de souscrire à un abonnement.

---

## 📦 Fichiers modifiés

### 1. **controllers/auth.controller.ts**

**Ajouts** :
- Import `Restaurant` model
- Import `createCheckoutSession` service
- Nouveau schema Zod `signupSchema`
- Nouvelle fonction `signup()`

**Fonction signup** :
1. Valide les données (restaurant + owner + plan)
2. Vérifie que email owner n'existe pas
3. Vérifie que email restaurant n'existe pas
4. Crée restaurant en mode `self-service` avec status `inactive`
5. Crée user owner avec rôle `restaurant`
6. Génère session Stripe Checkout
7. Retourne URL de paiement

### 2. **routes/auth.routes.ts**

**Ajouts** :
- Rate limiter `signupLimiter` (3 tentatives/heure par IP)
- Route publique `POST /api/auth/signup`

---

## 🔌 Endpoint créé

### POST /api/auth/signup

**Type** : Public (pas d'auth requise)
**Rate limit** : 3 tentatives/heure par IP

#### Request Body

```json
{
  "restaurantName": "Le Petit Gourmet",
  "restaurantAddress": "123 Rue de la Paix, 75001 Paris",
  "restaurantPhone": "+33142345678",
  "restaurantEmail": "contact@petitgourmet.fr",
  "ownerEmail": "jean.dupont@gmail.com",
  "ownerPassword": "SecurePass123!",
  "plan": "starter"
}
```

#### Validation (Zod)

```typescript
{
  restaurantName: min 2 chars
  restaurantAddress: min 5 chars
  restaurantPhone: min 10 chars
  restaurantEmail: valid email format
  ownerEmail: valid email format
  ownerPassword: min 6 chars
  plan: 'starter' | 'pro'
}
```

#### Response Success (201)

```json
{
  "message": "Account created successfully. Please complete payment to activate.",
  "restaurant": {
    "id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "name": "Le Petit Gourmet",
    "email": "contact@petitgourmet.fr",
    "accountType": "self-service"
  },
  "owner": {
    "id": "65f1a2b3c4d5e6f7g8h9i0j2",
    "email": "jean.dupont@gmail.com"
  },
  "checkout": {
    "sessionId": "cs_test_a1b2c3...",
    "url": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3..."
  }
}
```

**Frontend doit rediriger vers `checkout.url`** pour le paiement.

#### Response Errors

**409 - Email owner déjà utilisé** :
```json
{
  "error": {
    "message": "An account already exists with this email"
  }
}
```

**409 - Email restaurant déjà utilisé** :
```json
{
  "error": {
    "message": "A restaurant already exists with this email"
  }
}
```

**400 - Validation échouée** :
```json
{
  "error": {
    "message": "Validation error",
    "details": [
      {
        "path": ["ownerPassword"],
        "message": "Password must be at least 6 characters"
      }
    ]
  }
}
```

**429 - Rate limit dépassé** :
```json
{
  "error": {
    "message": "Too many signup attempts. Please try again later."
  }
}
```

---

## 🔄 Flow complet d'inscription

### 1. User remplit formulaire signup

Frontend : `/signup`

Champs :
- Nom restaurant
- Adresse
- Téléphone
- Email restaurant
- Email propriétaire (login)
- Mot de passe
- Choix du plan (Starter ou Pro)

### 2. Frontend envoie POST /api/auth/signup

```javascript
const response = await fetch('http://localhost:4000/api/auth/signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    restaurantName: 'Mon Restaurant',
    restaurantAddress: '123 Rue Example',
    restaurantPhone: '+33123456789',
    restaurantEmail: 'contact@restaurant.fr',
    ownerEmail: 'owner@gmail.com',
    ownerPassword: 'password123',
    plan: 'starter',
  }),
});

const data = await response.json();

if (response.ok) {
  // Redirect to Stripe Checkout
  window.location.href = data.checkout.url;
}
```

### 3. Backend crée restaurant + user

État après création :
- Restaurant : `accountType: 'self-service'`, `status: 'inactive'`
- User : `role: 'restaurant'`, `status: 'active'`
- Subscription : `status: 'trial'`, `plan: 'starter'|'pro'`

**Note** : Le restaurant reste `inactive` jusqu'au paiement réussi.

### 4. Redirection vers Stripe Checkout

User complète le paiement sur Stripe.

### 5. Webhook `checkout.session.completed`

Stripe envoie webhook → Backend reçoit → Active le restaurant :

```typescript
// Dans stripe.service.ts > handleCheckoutCompleted()
restaurant.status = 'active';
restaurant.subscription.status = 'active';
restaurant.subscription.stripeCustomerId = session.customer;
restaurant.subscription.stripeSubscriptionId = session.subscription;
```

### 6. Redirection vers success page

Stripe redirige vers :
```
http://localhost:3000/signup/success?session_id={CHECKOUT_SESSION_ID}
```

Frontend affiche message de succès et lien vers login.

---

## 🧪 Tests à effectuer

### Test 1 : Inscription réussie Starter

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Test Restaurant",
    "restaurantAddress": "123 Test Street, 75001 Paris",
    "restaurantPhone": "+33142345678",
    "restaurantEmail": "test@restaurant.com",
    "ownerEmail": "owner@test.com",
    "ownerPassword": "password123",
    "plan": "starter"
  }'
```

**Attendu** :
- Status 201
- Restaurant créé en DB (accountType: self-service, status: inactive)
- User créé en DB (role: restaurant)
- checkout.url retourné

### Test 2 : Inscription avec email existant

Réutiliser le même email owner :

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Test Restaurant 2",
    "restaurantAddress": "456 Test Avenue",
    "restaurantPhone": "+33987654321",
    "restaurantEmail": "test2@restaurant.com",
    "ownerEmail": "owner@test.com",
    "ownerPassword": "password123",
    "plan": "pro"
  }'
```

**Attendu** :
- Status 409
- Message "An account already exists with this email"

### Test 3 : Validation échouée

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "A",
    "restaurantAddress": "123",
    "restaurantPhone": "123",
    "restaurantEmail": "invalid-email",
    "ownerEmail": "invalid",
    "ownerPassword": "123",
    "plan": "invalid"
  }'
```

**Attendu** :
- Status 400
- Details des erreurs de validation

### Test 4 : Rate limiting

Envoyer 4 requêtes en moins d'une heure depuis la même IP :

```bash
for i in {1..4}; do
  curl -X POST http://localhost:4000/api/auth/signup \
    -H "Content-Type: application/json" \
    -d "{...}"
done
```

**Attendu** :
- 3 premières requêtes : OK ou validation errors
- 4ème requête : Status 429, "Too many signup attempts"

### Test 5 : Flow complet avec paiement

1. Envoyer requête signup
2. Récupérer checkout.url
3. Ouvrir l'URL dans navigateur
4. Utiliser carte test : `4242 4242 4242 4242`
5. Compléter paiement
6. Vérifier webhook reçu dans logs backend
7. Vérifier restaurant.status = 'active' en DB

---

## 📊 État des données après signup

### Restaurant créé

```javascript
{
  _id: ObjectId('...'),
  name: 'Le Petit Gourmet',
  address: '123 Rue de la Paix, 75001 Paris',
  phone: '+33142345678',
  email: 'contact@petitgourmet.fr',
  apiKey: 'abc123...', // Auto-généré
  accountType: 'self-service',
  status: 'inactive', // Sera 'active' après paiement
  subscription: {
    plan: 'starter',
    status: 'trial', // Sera 'active' après paiement
    // stripeCustomerId, stripeSubscriptionId ajoutés par webhook
  },
  openingHours: {
    monday: { closed: false, slots: [] },
    // ... (jours par défaut, vides)
  },
  tablesConfig: {
    mode: 'simple',
    totalTables: 10,
    averageCapacity: 4,
  },
  reservationConfig: {
    defaultDuration: 90,
    useOpeningHours: true,
  },
  widgetConfig: {
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '8px',
  },
  createdAt: '2026-01-30T18:00:00.000Z',
  updatedAt: '2026-01-30T18:00:00.000Z',
}
```

### User owner créé

```javascript
{
  _id: ObjectId('...'),
  email: 'jean.dupont@gmail.com',
  password: '$2b$10$...', // Hashé
  role: 'restaurant',
  restaurantId: ObjectId('...'), // Lié au restaurant ci-dessus
  status: 'active',
  twoFactorEnabled: false,
  mustChangePassword: false,
  createdAt: '2026-01-30T18:00:00.000Z',
  updatedAt: '2026-01-30T18:00:00.000Z',
}
```

---

## 🔐 Sécurité

### Rate limiting

- **3 tentatives/heure par IP** pour éviter le spam
- Plus strict que le register admin (5/heure)

### Validation stricte

- Tous les champs validés avec Zod
- Emails vérifiés uniques
- Password minimum 6 caractères

### Restaurant inactif par défaut

Le restaurant est créé avec `status: 'inactive'` et ne peut pas être utilisé tant que le paiement n'est pas complété.

**Vérification** :
- Le middleware `verifySubscription` bloquera l'accès si status = inactive
- L'utilisateur ne pourra pas accéder au dashboard

### Pas de token JWT retourné

L'endpoint signup ne retourne **pas** de JWT token. Le user devra se login après avoir complété le paiement.

**Pourquoi ?** :
- Empêche l'accès au dashboard avant paiement
- Force la validation du paiement
- Meilleure UX (redirection claire après paiement)

---

## ⚠️ Points d'attention

### 1. Restaurant inactif bloque l'accès

Après signup mais avant paiement, le restaurant existe mais est `inactive`.

Si l'utilisateur essaie de se login **avant** de payer :
- Login réussit ✅
- Mais toutes les requêtes API sont bloquées par `verifySubscription` ❌
- Message : "Your subscription has expired" (pas idéal)

**TODO** : Améliorer le message d'erreur pour distinguer "jamais payé" de "abonnement expiré".

### 2. Abandon du paiement

Si user abandonne sur Stripe Checkout :
- Restaurant reste en DB (inactive)
- User reste en DB
- Pas de nettoyage automatique

**Solutions possibles** :
- Webhook `checkout.session.expired` pour nettoyer
- Cron job pour supprimer comptes inactifs > 24h
- Laisser tel quel (user peut retry plus tard)

### 3. Email de bienvenue

**Actuellement** : Aucun email envoyé après signup.

**TODO Phase future** :
- Email de confirmation après signup (avec lien checkout)
- Email de bienvenue après paiement réussi
- Email si paiement échoué

---

## 🚀 Prochaines étapes (Phase 4)

Maintenant que l'endpoint backend est prêt, Phase 4 :

1. **Page frontend `/signup`**
2. **Formulaire d'inscription** avec tous les champs
3. **Choix du plan** (Starter vs Pro)
4. **Redirection Stripe Checkout**
5. **Page success** après paiement
6. **Page cancel** si abandon

---

## ✅ Checklist Phase 3

- [x] Créer schema Zod `signupSchema`
- [x] Créer fonction `signup()` dans auth.controller
- [x] Validation email unique (owner + restaurant)
- [x] Création restaurant self-service
- [x] Création user owner
- [x] Génération session Stripe Checkout
- [x] Rate limiter spécifique signup
- [x] Route publique `/api/auth/signup`
- [x] Documentation PHASE3_SIGNUP.md
- [ ] Tests manuels (après avoir ajouté Product IDs Stripe)

---

**Status** : ✅ Phase 3 complétée
**Prochaine étape** : Phase 4 - Frontend page signup
**Temps restant estimé** : ~1 semaine

---

**Dernière mise à jour** : 30 janvier 2026
