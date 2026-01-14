# Variables Brevo pour les Templates

Ce document liste TOUTES les variables dynamiques utilisées dans chaque template email Brevo.

## 📧 Template 1: Password Reset (Mot de passe oublié)

**Template ID:** `BREVO_TEMPLATE_PASSWORD_RESET` (défaut: 1)

**Variables disponibles:**
- `{{ params.userName }}` - Nom de l'utilisateur (string)
- `{{ params.resetLink }}` - Lien de réinitialisation avec token JWT (URL)

**Exemple de contenu:**
```html
Bonjour {{ params.userName }},

Vous avez demandé à réinitialiser votre mot de passe.

Cliquez sur le bouton ci-dessous :
<a href="{{ params.resetLink }}">Réinitialiser mon mot de passe</a>

Ce lien expire dans 24 heures.
```

---

## 📧 Template 2: Pending Reservation (Réservation en attente)

**Template ID:** `BREVO_TEMPLATE_PENDING` (défaut: 2)

**Quand:** Client crée réservation depuis site web → En attente de validation restaurant

**Variables disponibles:**
- `{{ params.customerName }}` - Nom du client (string)
- `{{ params.restaurantName }}` - Nom du restaurant (string)
- `{{ params.reservationDate }}` - Date en français (ex: "12 janvier 2026")
- `{{ params.reservationTime }}` - Heure (ex: "19:30")
- `{{ params.partySize }}` - Nombre de personnes (number)

**Exemple de contenu:**
```html
Bonjour {{ params.customerName }},

Nous avons bien reçu votre demande de réservation :

Restaurant : {{ params.restaurantName }}
Date : {{ params.reservationDate }}
Heure : {{ params.reservationTime }}
Personnes : {{ params.partySize }}

Le restaurant va examiner votre demande et vous enverra une confirmation.
```

---

## 📧 Template 3: Confirmation (Réservation confirmée)

**Template ID:** `BREVO_TEMPLATE_CONFIRMATION` (défaut: 3)

**Quand:** Restaurant confirme la réservation

**Variables disponibles:**
- `{{ params.customerName }}` - Nom du client (string)
- `{{ params.restaurantName }}` - Nom du restaurant (string)
- `{{ params.restaurantPhone }}` - Téléphone du restaurant (string)
- `{{ params.restaurantEmail }}` - Email du restaurant (string)
- `{{ params.reservationDate }}` - Date en français (ex: "12 janvier 2026")
- `{{ params.reservationTime }}` - Heure (ex: "19:30")
- `{{ params.partySize }}` - Nombre de personnes (number)
- `{{ params.cancellationLink }}` - Lien d'annulation sécurisé (URL)

**Exemple de contenu:**
```html
Bonjour {{ params.customerName }},

✅ Bonne nouvelle ! Votre réservation est confirmée.

Restaurant : {{ params.restaurantName }}
Date : {{ params.reservationDate }}
Heure : {{ params.reservationTime }}
Personnes : {{ params.partySize }}

📞 Contact du restaurant :
Téléphone : {{ params.restaurantPhone }}
Email : {{ params.restaurantEmail }}

Si vous devez annuler :
<a href="{{ params.cancellationLink }}">Annuler ma réservation</a>

Ce lien expire dans 24 heures.
```

**IMPORTANT:** Email reply-to sera automatiquement configuré avec l'email du restaurant.

---

## 📧 Template 4: Direct Confirmation (Réservation téléphonique)

**Template ID:** `BREVO_TEMPLATE_DIRECT` (défaut: 4)

**Quand:** Restaurant crée réservation par téléphone → Confirmation directe

**Variables disponibles:**
- `{{ params.customerName }}` - Nom du client (string)
- `{{ params.restaurantName }}` - Nom du restaurant (string)
- `{{ params.restaurantPhone }}` - Téléphone du restaurant (string)
- `{{ params.restaurantEmail }}` - Email du restaurant (string)
- `{{ params.reservationDate }}` - Date en français (ex: "12 janvier 2026")
- `{{ params.reservationTime }}` - Heure (ex: "19:30")
- `{{ params.partySize }}` - Nombre de personnes (number)
- `{{ params.cancellationLink }}` - Lien d'annulation sécurisé (URL)

**Exemple de contenu:**
```html
Bonjour {{ params.customerName }},

Nous confirmons votre réservation effectuée par téléphone.

Restaurant : {{ params.restaurantName }}
Date : {{ params.reservationDate }}
Heure : {{ params.reservationTime }}
Personnes : {{ params.partySize }}

📞 Contact du restaurant :
Téléphone : {{ params.restaurantPhone }}
Email : {{ params.restaurantEmail }}

Si vous devez annuler :
<a href="{{ params.cancellationLink }}">Annuler ma réservation</a>
```

**IMPORTANT:** Email reply-to sera automatiquement configuré avec l'email du restaurant.

---

## 📧 Template 5: Cancellation Confirmation (Confirmation annulation)

**Template ID:** `BREVO_TEMPLATE_CANCELLATION` (défaut: 5)

**Quand:** Client annule depuis le lien dans l'email

**Variables disponibles:**
- `{{ params.customerName }}` - Nom du client (string)
- `{{ params.restaurantName }}` - Nom du restaurant (string)
- `{{ params.reservationDate }}` - Date en français (ex: "12 janvier 2026")
- `{{ params.reservationTime }}` - Heure (ex: "19:30")

**Exemple de contenu:**
```html
Bonjour {{ params.customerName }},

Votre réservation a bien été annulée :

Restaurant : {{ params.restaurantName }}
Date : {{ params.reservationDate }}
Heure : {{ params.reservationTime }}

Nous espérons vous revoir bientôt !
```

---

## 🎯 Récapitulatif des Variables Uniques

### Variables Communes (tous templates sauf Password Reset):
- `customerName` - Nom du client
- `restaurantName` - Nom du restaurant
- `reservationDate` - Date formatée en français
- `reservationTime` - Heure de réservation

### Variables Spécifiques:
- `userName` - Template 1 uniquement (Password Reset)
- `resetLink` - Template 1 uniquement (Password Reset)
- `partySize` - Templates 2, 3, 4 (réservations)
- `restaurantPhone` - Templates 3, 4 (confirmations)
- `restaurantEmail` - Templates 3, 4 (confirmations)
- `cancellationLink` - Templates 3, 4 (confirmations avec annulation)

---

## 🔧 Configuration Reply-To Automatique

**Templates 3 et 4** configurent automatiquement le reply-to avec l'email du restaurant.
Cela signifie que si le client répond à l'email, ça ira directement au restaurant concerné.

**Sender (tous les emails):**
- From: killian.lecrut@gmail.com (TableMaster)
- Reply-To: email du restaurant (templates 3 et 4 uniquement)

---

## 📝 Notes pour la Création des Templates

1. **Langue:** Français uniquement
2. **Design:** Simple, mobile-friendly
3. **Boutons:** Utiliser des liens cliquables pour `resetLink` et `cancellationLink`
4. **Format Date:** Automatiquement en français (ex: "12 janvier 2026")
5. **Variables:** Toujours utiliser la syntaxe `{{ params.nomVariable }}`

---

## ✅ Checklist de Création

Pour chaque template dans Brevo Dashboard:

1. [ ] Créer nouveau template transactionnel
2. [ ] Définir le sujet (subject)
3. [ ] Insérer toutes les variables listées ci-dessus
4. [ ] Tester le preview avec données fictives
5. [ ] Copier le Template ID depuis Brevo
6. [ ] Ajouter l'ID dans `.env` (`BREVO_TEMPLATE_XXX=ID`)
7. [ ] Vérifier le rendu mobile

---

**Fichier Code Source:** `src/services/emailService.ts`
**Architecture:** `docs/architecture/email-system-brevo.md`
