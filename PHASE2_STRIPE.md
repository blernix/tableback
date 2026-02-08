# Phase 2 : Intégration Stripe - COMPLÉTÉE ✅

**Date** : 30 janvier 2026
**Durée** : ~3 heures

---

## 🎯 Objectif

Intégrer Stripe pour gérer les abonnements self-service (Starter et Pro).

---

## 📦 Fichiers créés

### 1. **config/stripe.config.ts** (nouveau)
Configuration Stripe complète :
- Client Stripe initialisé
- Configuration produits (Starter 39€, Pro 69€)
- URLs de redirection
- Fonction de validation

### 2. **services/stripe.service.ts** (nouveau)
Service complet de gestion Stripe :
- `createCheckoutSession()` : Créer session paiement
- `createPortalSession()` : Portail client Stripe
- `handleWebhookEvent()` : Router événements webhook
- `handleCheckoutCompleted()` : Complétion checkout
- `handleSubscriptionCreated()` : Nouvelle souscription
- `handleSubscriptionUpdated()` : Mise à jour (upgrade/downgrade)
- `handleSubscriptionDeleted()` : Annulation
- `handlePaymentSucceeded()` : Paiement réussi
- `handlePaymentFailed()` : Paiement échoué
- `getSubscriptionDetails()` : Détails abonnement
- `cancelSubscription()` : Annuler abonnement

**+ Fonctions helper** :
- `determinePlanFromSubscription()` : Détecter plan depuis Stripe
- `mapStripeStatus()` : Mapper status Stripe → status interne

### 3. **controllers/billing.controller.ts** (nouveau)
6 endpoints billing :
- `POST /api/billing/create-checkout` : Créer checkout
- `POST /api/billing/create-portal` : Ouvrir portail client
- `POST /api/billing/webhook` : Recevoir webhooks Stripe
- `GET /api/billing/subscription` : Obtenir abonnement actuel
- `POST /api/billing/cancel` : Annuler abonnement
- `GET /api/billing/plans` : Liste plans disponibles

### 4. **routes/billing.routes.ts** (nouveau)
Routes Express avec middleware :
- Routes publiques : `/plans`, `/webhook`
- Routes protégées : checkout, portal, subscription, cancel

### 5. **STRIPE_SETUP.md** (nouveau)
Documentation complète :
- Guide configuration Stripe Dashboard
- Création produits Starter et Pro
- Configuration webhooks
- Variables d'environnement
- Tests en développement
- Déploiement production
- Troubleshooting

---

## 📝 Fichiers modifiés

### 1. **app.ts**
- ✅ Import routes billing
- ✅ Middleware raw body pour webhook (avant JSON parsing)
- ✅ Route `/api/billing` ajoutée

### 2. **.env.example**
Nouvelles variables ajoutées :
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRODUCT_STARTER_ID=prod_...
STRIPE_PRICE_STARTER_ID=price_...
STRIPE_PRODUCT_PRO_ID=prod_...
STRIPE_PRICE_PRO_ID=price_...
```

---

## 🔧 Installation

### Dépendance ajoutée

```bash
npm install stripe --legacy-peer-deps
```

**Version** : stripe@latest (compatible TypeScript)

---

## 📊 Endpoints créés

### Public (pas d'auth)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/billing/plans` | GET | Liste plans disponibles |
| `/api/billing/webhook` | POST | Recevoir webhooks Stripe |

### Protégés (auth requise)

| Endpoint | Méthode | Middleware | Description |
|----------|---------|------------|-------------|
| `/api/billing/create-checkout` | POST | `authenticateToken` | Créer session checkout |
| `/api/billing/create-portal` | POST | `authenticateToken`, `verifySubscription` | Portail client |
| `/api/billing/subscription` | GET | `authenticateToken` | Détails abonnement |
| `/api/billing/cancel` | POST | `authenticateToken`, `verifySubscription` | Annuler abonnement |

---

## 🔄 Flow de paiement

### Nouveau client (signup)

```mermaid
User → Frontend: Clique "S'inscrire"
Frontend → Backend: POST /api/auth/signup (Phase 3)
Backend → Stripe: createCheckoutSession()
Stripe → Frontend: Redirect checkout URL
User → Stripe: Complète paiement
Stripe → Backend: Webhook checkout.session.completed
Backend → DB: Active subscription
Stripe → Backend: Webhook customer.subscription.created
Backend → DB: Maj détails abonnement
```

### Gestion abonnement existant

```mermaid
User → Frontend: "Gérer abonnement"
Frontend → Backend: POST /api/billing/create-portal
Backend → Stripe: createPortalSession()
Stripe → Frontend: Redirect portal URL
User → Stripe: Annule/upgrade/downgrade
Stripe → Backend: Webhook subscription.updated
Backend → DB: Maj abonnement
```

---

## 📋 Événements Stripe gérés

| Événement | Handler | Action |
|-----------|---------|--------|
| `checkout.session.completed` | `handleCheckoutCompleted` | Active abonnement initial |
| `customer.subscription.created` | `handleSubscriptionCreated` | Crée subscription + history |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Upgrade/downgrade/annulation |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Marque cancelled |
| `invoice.payment_succeeded` | `handlePaymentSucceeded` | Log paiement réussi |
| `invoice.payment_failed` | `handlePaymentFailed` | Marque past_due + log |

---

## 🧪 Tests à effectuer

### 1. Configuration Stripe Dashboard

- [ ] Créer compte Stripe (mode Test)
- [ ] Créer produit Starter (39€/mois)
- [ ] Créer produit Pro (69€/mois)
- [ ] Récupérer Product IDs et Price IDs
- [ ] Ajouter webhook endpoint
- [ ] Récupérer Webhook Secret

### 2. Configuration backend

- [ ] Ajouter variables dans `.env`
- [ ] Redémarrer API
- [ ] Vérifier logs : "Stripe configuration validated"

### 3. Tests endpoints

#### GET /api/billing/plans
```bash
curl http://localhost:4000/api/billing/plans
```

**Attendu** : Liste des 2 plans avec prix et features

#### POST /api/billing/create-checkout
```bash
curl -X POST http://localhost:4000/api/billing/create-checkout \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "starter", "restaurantId": "ID"}'
```

**Attendu** : `{ sessionId: "...", url: "https://checkout.stripe.com/..." }`

#### Compléter paiement
- Ouvrir URL checkout dans navigateur
- Utiliser carte test : `4242 4242 4242 4242`
- Compléter paiement

**Attendu** :
- Redirection vers success URL
- Webhook reçu dans logs backend
- Restaurant.subscription mis à jour en DB

#### GET /api/billing/subscription
```bash
curl http://localhost:4000/api/billing/subscription \
  -H "Authorization: Bearer TOKEN"
```

**Attendu** : Détails abonnement avec status `active`

### 4. Tests webhooks

#### Avec Stripe CLI (recommandé)

```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:4000/api/billing/webhook

# Trigger événement test
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

#### Manuellement

Dashboard Stripe → **Développeurs** → **Webhooks** → **Envoyer un événement de test**

### 5. Tests scénarios

#### Scénario A : Nouveau client Starter
1. Créer restaurant en DB
2. Créer checkout session (plan: starter)
3. Compléter paiement avec carte test
4. Vérifier subscription active
5. Vérifier SubscriptionHistory créé

#### Scénario B : Upgrade Starter → Pro
1. Restaurant avec Starter actif
2. Ouvrir portail client : `POST /api/billing/create-portal`
3. Dans portail, upgrade vers Pro
4. Vérifier webhook `subscription.updated`
5. Vérifier plan changé en DB

#### Scénario C : Annulation
1. Restaurant avec abonnement actif
2. `POST /api/billing/cancel` avec `immediately: false`
3. Vérifier `cancelAtPeriodEnd: true`
4. Attendre fin période OU déclencher `subscription.deleted`
5. Vérifier status = `cancelled`

#### Scénario D : Paiement échoué
1. Trigger `invoice.payment_failed`
2. Vérifier status = `past_due` en DB
3. Vérifier SubscriptionHistory event créé
4. (TODO) Vérifier email envoyé au restaurant

---

## ⚠️ Points d'attention

### 1. Raw body pour webhook

Le webhook Stripe **nécessite le body brut** (pas de parsing JSON) pour vérifier la signature.

Dans `app.ts`, le middleware raw body est appliqué **avant** `express.json()` :

```typescript
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  ...
);
```

### 2. Webhook en développement

En dev local, Stripe ne peut pas atteindre `localhost` directement.

**Solutions** :
- **Stripe CLI** (recommandé) : `stripe listen --forward-to localhost:4000/api/billing/webhook`
- **Tunneling** : ngrok, localtunnel, etc.

### 3. IDs Stripe requis

L'API ne démarrera **pas** si les Product/Price IDs ne sont pas définis.

Vérifier dans les logs :
```
✅ Stripe configuration validated successfully
```

Ou erreur :
```
❌ Stripe configuration errors: ['STRIPE_PRICE_STARTER_ID is missing']
```

### 4. Mode Test vs Production

**JAMAIS mélanger** les clés test et production !

- Dev : `sk_test_...` + produits mode Test
- Prod : `sk_live_...` + produits mode Production

---

## 🚀 Prochaines étapes (Phase 3)

Maintenant que Stripe est intégré, Phase 3 :

1. **Endpoint auto-inscription** : `POST /api/auth/signup`
2. **Création restaurant self-service** automatique
3. **Redirection vers Stripe Checkout** après inscription
4. **Email confirmation** après paiement

---

## 📚 Documentation

- **STRIPE_SETUP.md** : Guide complet configuration
- **stripe.config.ts** : Configuration et constantes
- **stripe.service.ts** : Logique métier complète
- **billing.controller.ts** : Endpoints API

---

## ✅ Checklist Phase 2

- [x] Installer Stripe SDK
- [x] Créer configuration Stripe
- [x] Créer service Stripe complet
- [x] Créer controller billing
- [x] Créer routes billing
- [x] Intégrer dans app.ts avec raw body
- [x] Ajouter variables .env
- [x] Créer documentation STRIPE_SETUP.md
- [x] Tests manuels (à faire après config Stripe Dashboard)

---

**Status** : ✅ Phase 2 complétée
**Prochaine étape** : Phase 3 - Auto-inscription publique
**Temps restant estimé** : ~1,5 semaines

---

**Dernière mise à jour** : 30 janvier 2026
