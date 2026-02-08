# Configuration Stripe pour TableMaster

Guide complet pour configurer Stripe et activer les abonnements self-service.

---

## 📋 Prérequis

1. **Compte Stripe** : https://dashboard.stripe.com/register
2. **Mode Test** activé pour les tests
3. **Accès au backend TableMaster**

---

## 🔧 Étape 1 : Créer les produits dans Stripe

### 1.1 Se connecter au Dashboard Stripe

1. Aller sur https://dashboard.stripe.com/
2. S'assurer d'être en **mode Test** (toggle en haut à droite)

### 1.2 Créer le produit Starter

1. Aller dans **Produits** → **Ajouter un produit**
2. Remplir :
   - **Nom** : TableMaster Starter
    - **Description** : 50 réservations/mois - Widget standard
    - **Prix** : 39 EUR
   - **Facturation** : Récurrente
   - **Période** : Mensuelle
3. Cliquer sur **Enregistrer le produit**
4. **Noter le Product ID** (commence par `prod_...`)
5. **Noter le Price ID** (commence par `price_...`)

### 1.3 Créer le produit Pro

1. **Produits** → **Ajouter un produit**
2. Remplir :
   - **Nom** : TableMaster Pro
   - **Description** : Réservations illimitées - Widget personnalisable
    - **Prix** : 69 EUR
   - **Facturation** : Récurrente
   - **Période** : Mensuelle
3. Cliquer sur **Enregistrer le produit**
4. **Noter le Product ID** (commence par `prod_...`)
5. **Noter le Price ID** (commence par `price_...`)

---

## 🔑 Étape 2 : Récupérer les clés API

### 2.1 Clé secrète API

1. Aller dans **Développeurs** → **Clés API**
2. En mode Test, copier la **Clé secrète** (commence par `sk_test_...`)
3. **Ne JAMAIS partager cette clé !**

### 2.2 Webhook Secret (à faire après étape 3)

Voir section "Étape 3" ci-dessous.

---

## 🌐 Étape 3 : Configurer les Webhooks

Les webhooks permettent à Stripe de notifier TableMaster des événements (paiements, annulations, etc.).

### 3.1 Créer un endpoint webhook

1. Aller dans **Développeurs** → **Webhooks**
2. Cliquer sur **Ajouter un endpoint**

### 3.2 Configuration de l'endpoint

**En développement** (avec tunneling) :

```
URL : https://your-tunnel-url.ngrok.io/api/billing/webhook
Exemple : https://abc123.ngrok.io/api/billing/webhook
```

**En production** :

```
URL : https://api.tablemaster.com/api/billing/webhook
```

### 3.3 Sélectionner les événements

Cocher les événements suivants :

- [x] `checkout.session.completed`
- [x] `customer.subscription.created`
- [x] `customer.subscription.updated`
- [x] `customer.subscription.deleted`
- [x] `invoice.payment_succeeded`
- [x] `invoice.payment_failed`

### 3.4 Récupérer le Webhook Secret

1. Cliquer sur **Ajouter un endpoint**
2. Copier le **Signing secret** (commence par `whsec_...`)
3. Ce secret sera utilisé dans `.env`

---

## ⚙️ Étape 4 : Configurer les variables d'environnement

### 4.1 Fichier .env

Éditer `/tablemaster-api/.env` et ajouter :

```env
# Stripe Payment (Self-Service Subscriptions)
STRIPE_SECRET_KEY=sk_test_VOTRE_CLE_SECRETE
STRIPE_WEBHOOK_SECRET=whsec_VOTRE_WEBHOOK_SECRET

# Stripe Product IDs (remplacer par vos IDs)
STRIPE_PRODUCT_STARTER_ID=prod_VOTRE_PRODUCT_STARTER
STRIPE_PRICE_STARTER_ID=price_VOTRE_PRICE_STARTER
STRIPE_PRODUCT_PRO_ID=prod_VOTRE_PRODUCT_PRO
STRIPE_PRICE_PRO_ID=price_VOTRE_PRICE_PRO
```

### 4.2 Exemple avec de vraies valeurs

```env
STRIPE_SECRET_KEY=sk_test_51AbC123xYz...
STRIPE_WEBHOOK_SECRET=whsec_AbC123xYz...

STRIPE_PRODUCT_STARTER_ID=prod_PqRsTuVwXy
STRIPE_PRICE_STARTER_ID=price_1AbC123xYz
STRIPE_PRODUCT_PRO_ID=prod_QwErTyUiOp
STRIPE_PRICE_PRO_ID=price_1DeF456xYz
```

---

## 🧪 Étape 5 : Tester en développement

### 5.1 Installer Stripe CLI (optionnel mais recommandé)

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Autres OS : https://stripe.com/docs/stripe-cli
```

### 5.2 Login Stripe CLI

```bash
stripe login
```

### 5.3 Forward webhooks en local

```bash
stripe listen --forward-to localhost:4000/api/billing/webhook
```

Cela va :
- Créer un tunnel local
- Afficher un **webhook signing secret** temporaire
- Forward tous les événements Stripe vers ton API locale

**Copier ce webhook secret dans `.env`** pour les tests locaux.

### 5.4 Tester un paiement

```bash
# Trigger manuellement un événement
stripe trigger checkout.session.completed
```

Ou tester avec l'interface frontend en utilisant une carte de test :
- **Carte réussie** : 4242 4242 4242 4242
- **Carte échouée** : 4000 0000 0000 0002
- **3D Secure** : 4000 0027 6000 3184

Date expiration : N'importe quelle date future
CVC : N'importe quel 3 chiffres

---

## 📡 Étape 6 : Tester les endpoints

### 6.1 Obtenir les plans disponibles

```bash
curl http://localhost:4000/api/billing/plans
```

**Réponse attendue** :

```json
{
  "plans": [
    {
      "id": "starter",
      "name": "Starter",
      "price": 39,
      "currency": "eur",
      "interval": "month",
      "features": [...]
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": 69,
      "currency": "eur",
      "interval": "month",
      "features": [...]
    }
  ]
}
```

### 6.2 Créer une session de checkout

```bash
curl -X POST http://localhost:4000/api/billing/create-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "plan": "starter",
    "restaurantId": "RESTAURANT_ID"
  }'
```

**Réponse** :

```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

Ouvrir l'URL dans le navigateur pour compléter le paiement.

### 6.3 Vérifier l'abonnement

```bash
curl http://localhost:4000/api/billing/subscription \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🚀 Étape 7 : Déploiement en production

### 7.1 Passer en mode Production dans Stripe

1. Dashboard Stripe → Toggle **Mode Production**
2. Recréer les produits Starter et Pro en production
3. Récupérer les nouveaux IDs de production
4. Récupérer la nouvelle clé API de production (`sk_live_...`)

### 7.2 Configurer le webhook en production

1. Créer un nouveau webhook avec l'URL de production
2. Récupérer le nouveau webhook secret

### 7.3 Variables d'environnement production

```env
# .env (production)
STRIPE_SECRET_KEY=sk_live_VOTRE_CLE_PRODUCTION
STRIPE_WEBHOOK_SECRET=whsec_VOTRE_SECRET_PRODUCTION

STRIPE_PRODUCT_STARTER_ID=prod_PRODUCTION_STARTER
STRIPE_PRICE_STARTER_ID=price_PRODUCTION_STARTER
STRIPE_PRODUCT_PRO_ID=prod_PRODUCTION_PRO
STRIPE_PRICE_PRO_ID=price_PRODUCTION_PRO
```

### 7.4 Redémarrer l'API

```bash
cd tablemaster-api
npm run build
pm2 restart tablemaster-api
```

---

## 🧪 Cartes de test Stripe

| Numéro de carte | Résultat |
|-----------------|----------|
| 4242 4242 4242 4242 | Paiement réussi |
| 4000 0000 0000 9995 | Paiement échoué (carte insuffisante) |
| 4000 0000 0000 0002 | Paiement refusé |
| 4000 0027 6000 3184 | Authentification 3D Secure |

**Toutes les cartes** :
- Date expiration : N'importe quelle date future (ex: 12/34)
- CVC : N'importe quel 3 chiffres (ex: 123)
- Code postal : N'importe quel code (ex: 12345)

Plus de cartes : https://stripe.com/docs/testing

---

## 📊 Monitoring et logs

### Vérifier que Stripe est bien configuré

```bash
cd tablemaster-api
npm run dev
```

Dans les logs, vous devriez voir :

```
✅ Stripe configuration validated successfully
```

Si erreur :

```
❌ Stripe configuration errors: [...]
```

Vérifier que toutes les variables d'environnement sont bien définies.

### Dashboard Stripe

Suivre les événements en temps réel :
1. **Développeurs** → **Événements**
2. Voir tous les webhooks envoyés et leur statut

### Logs backend

Tous les événements Stripe sont loggés :

```
[INFO] Processing Stripe webhook: customer.subscription.created
[INFO] Subscription created for restaurant 123abc
```

---

## 🔒 Sécurité

### Bonnes pratiques

1. **Ne JAMAIS commit les clés API** dans Git
2. Utiliser des variables d'environnement
3. En production, utiliser des secrets managers (AWS Secrets, etc.)
4. Vérifier toujours la signature des webhooks
5. Logs détaillés mais sans données sensibles

### Webhook security

Le code vérifie automatiquement la signature :

```typescript
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  STRIPE_WEBHOOK_SECRET
);
```

Si signature invalide → erreur 400.

---

## ❓ Troubleshooting

### Problème : "Stripe configuration errors"

**Solution** : Vérifier que toutes les variables sont dans `.env` :
- STRIPE_SECRET_KEY
- STRIPE_PRODUCT_STARTER_ID
- STRIPE_PRICE_STARTER_ID
- STRIPE_PRODUCT_PRO_ID
- STRIPE_PRICE_PRO_ID

### Problème : Webhook non reçu

**Causes possibles** :
1. URL webhook incorrecte
2. Webhook secret incorrect
3. Événements non sélectionnés
4. Firewall bloquant Stripe

**Solution** :
- Vérifier les logs Stripe Dashboard
- Tester avec Stripe CLI : `stripe listen --forward-to localhost:4000/api/billing/webhook`

### Problème : "Invalid API key"

**Solution** : Vérifier que la clé commence par :
- `sk_test_...` en développement
- `sk_live_...` en production

### Problème : Checkout session redirige vers page vide

**Solution** : Vérifier les URLs de succès/annulation dans `.env` :

```env
FRONTEND_URL=http://localhost:3000
```

---

## 📚 Ressources

- **Dashboard Stripe** : https://dashboard.stripe.com/
- **Documentation API** : https://stripe.com/docs/api
- **Webhooks** : https://stripe.com/docs/webhooks
- **Cartes de test** : https://stripe.com/docs/testing
- **Stripe CLI** : https://stripe.com/docs/stripe-cli

---

## ✅ Checklist finale

Avant de déployer en production :

- [ ] Produits Starter et Pro créés en mode Production
- [ ] Clés API production récupérées
- [ ] Webhook production configuré avec bonne URL
- [ ] Variables d'environnement production définies
- [ ] Tests effectués en mode Test
- [ ] Webhook reçu et traité correctement
- [ ] Emails de confirmation fonctionnels
- [ ] Monitoring activé

---

**Dernière mise à jour** : 30 janvier 2026
