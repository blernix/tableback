# Templates Brevo SIMPLES - TableMaster

**Version ultra-simplifiée pour compatibilité maximale avec Brevo.**

---

## 📧 Template 1 - Password Reset

**Sujet:** `Réinitialisation de votre mot de passe - TableMaster`

**Code HTML:**
```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1>TableMaster</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
    <h2>Bonjour {{ params.userName }},</h2>

    <p>Vous avez demandé à réinitialiser votre mot de passe.</p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="{{ params.resetLink }}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Réinitialiser mon mot de passe
      </a>
    </p>

    <p style="color: #6b7280; font-size: 14px;">
      <strong>Ce lien expire dans 24 heures.</strong>
    </p>

    <p style="color: #9ca3af; font-size: 12px;">
      Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
    </p>
  </div>

  <div style="background-color: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 14px;">
    © 2026 TableMaster
  </div>

</body>
</html>
```

**Variables:**
- `{{ params.userName }}`
- `{{ params.resetLink }}`

---

## 📧 Template 2 - Pending Reservation

**Sujet:** `Demande de réservation reçue - {{ params.restaurantName }}`

**Code HTML:**
```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1>⏳ Demande reçue</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
    <h2>Bonjour {{ params.customerName }},</h2>

    <p>Nous avons bien reçu votre demande de réservation. Le restaurant va l'examiner et vous enverra une confirmation sous peu.</p>

    <div style="background-color: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; margin: 20px 0;">
      <h3>Détails de votre réservation</h3>
      <p><strong>Restaurant :</strong> {{ params.restaurantName }}</p>
      <p><strong>Date :</strong> {{ params.reservationDate }}</p>
      <p><strong>Heure :</strong> {{ params.reservationTime }}</p>
      <p><strong>Personnes :</strong> {{ params.partySize }}</p>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Vous recevrez un email de confirmation dès validation.
    </p>
  </div>

  <div style="background-color: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 14px;">
    © 2026 TableMaster
  </div>

</body>
</html>
```

**Variables:**
- `{{ params.customerName }}`
- `{{ params.restaurantName }}`
- `{{ params.reservationDate }}`
- `{{ params.reservationTime }}`
- `{{ params.partySize }}`

---

## 📧 Template 3 - Confirmation

**Sujet:** `✅ Réservation confirmée - {{ params.restaurantName }}`

**Code HTML:**
```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1>✅ Réservation confirmée !</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
    <h2>Bonjour {{ params.customerName }},</h2>

    <p>Bonne nouvelle ! Votre réservation a été confirmée. Nous vous attendons avec plaisir ! 🎉</p>

    <div style="background-color: #d1fae5; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0;">
      <h3>Détails de votre réservation</h3>
      <p><strong>Restaurant :</strong> {{ params.restaurantName }}</p>
      <p><strong>Date :</strong> {{ params.reservationDate }}</p>
      <p><strong>Heure :</strong> {{ params.reservationTime }}</p>
      <p><strong>Personnes :</strong> {{ params.partySize }}</p>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0;">
      <h3>📞 Contact du restaurant</h3>
      <p><strong>Téléphone :</strong> {{ params.restaurantPhone }}</p>
      <p><strong>Email :</strong> {{ params.restaurantEmail }}</p>
    </div>

    <hr style="border: 1px solid #e5e7eb; margin: 30px 0;">

    <p><strong>Besoin d'annuler ?</strong></p>
    <p style="text-align: center; margin: 20px 0;">
      <a href="{{ params.cancellationLink }}" style="background-color: #ef4444; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Annuler ma réservation
      </a>
    </p>
  </div>

  <div style="background-color: #f9fafb; padding: 20px; text-align: center;">
    <p style="color: #4b5563;">À bientôt au restaurant ! 🍽️</p>
    <p style="color: #9ca3af; font-size: 14px;">© 2026 TableMaster</p>
  </div>

</body>
</html>
```

**Variables:**
- `{{ params.customerName }}`
- `{{ params.restaurantName }}`
- `{{ params.restaurantPhone }}`
- `{{ params.restaurantEmail }}`
- `{{ params.reservationDate }}`
- `{{ params.reservationTime }}`
- `{{ params.partySize }}`
- `{{ params.cancellationLink }}`

---

## 📧 Template 4 - Direct Confirmation (Téléphone)

**Sujet:** `✅ Confirmation de réservation - {{ params.restaurantName }}`

**Code HTML:**
```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #8b5cf6; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1>✅ Réservation confirmée</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
    <h2>Bonjour {{ params.customerName }},</h2>

    <p>Nous vous confirmons votre réservation effectuée par téléphone. Nous sommes impatients de vous accueillir ! 📞</p>

    <div style="background-color: #ede9fe; padding: 20px; border-left: 4px solid #8b5cf6; margin: 20px 0;">
      <h3>Détails de votre réservation</h3>
      <p><strong>Restaurant :</strong> {{ params.restaurantName }}</p>
      <p><strong>Date :</strong> {{ params.reservationDate }}</p>
      <p><strong>Heure :</strong> {{ params.reservationTime }}</p>
      <p><strong>Personnes :</strong> {{ params.partySize }}</p>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0;">
      <h3>📞 Contact du restaurant</h3>
      <p><strong>Téléphone :</strong> {{ params.restaurantPhone }}</p>
      <p><strong>Email :</strong> {{ params.restaurantEmail }}</p>
    </div>

    <hr style="border: 1px solid #e5e7eb; margin: 30px 0;">

    <p><strong>Besoin d'annuler ?</strong></p>
    <p style="text-align: center; margin: 20px 0;">
      <a href="{{ params.cancellationLink }}" style="background-color: #ef4444; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Annuler ma réservation
      </a>
    </p>
  </div>

  <div style="background-color: #f9fafb; padding: 20px; text-align: center;">
    <p style="color: #4b5563;">À très bientôt ! 🍽️</p>
    <p style="color: #9ca3af; font-size: 14px;">© 2026 TableMaster</p>
  </div>

</body>
</html>
```

**Variables:** (identiques au Template 3)
- `{{ params.customerName }}`
- `{{ params.restaurantName }}`
- `{{ params.restaurantPhone }}`
- `{{ params.restaurantEmail }}`
- `{{ params.reservationDate }}`
- `{{ params.reservationTime }}`
- `{{ params.partySize }}`
- `{{ params.cancellationLink }}`

---

## 📧 Template 5 - Cancellation Confirmation

**Sujet:** `Annulation confirmée - {{ params.restaurantName }}`

**Code HTML:**
```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #6b7280; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1>Annulation confirmée</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
    <h2>Bonjour {{ params.customerName }},</h2>

    <p>Votre réservation a bien été annulée. Nous avons prévenu le restaurant.</p>

    <div style="background-color: #f3f4f6; padding: 20px; border-left: 4px solid #6b7280; margin: 20px 0;">
      <h3>Réservation annulée</h3>
      <p style="text-decoration: line-through; color: #6b7280;">
        <strong>Restaurant :</strong> {{ params.restaurantName }}
      </p>
      <p style="text-decoration: line-through; color: #6b7280;">
        <strong>Date :</strong> {{ params.reservationDate }}
      </p>
      <p style="text-decoration: line-through; color: #6b7280;">
        <strong>Heure :</strong> {{ params.reservationTime }}
      </p>
    </div>

    <p>Nous espérons avoir le plaisir de vous accueillir une prochaine fois ! 🙏</p>

    <p style="color: #6b7280; font-size: 14px;">
      Vous pouvez faire une nouvelle réservation à tout moment.
    </p>
  </div>

  <div style="background-color: #f9fafb; padding: 20px; text-align: center;">
    <p style="color: #4b5563;">À bientôt ! 👋</p>
    <p style="color: #9ca3af; font-size: 14px;">© 2026 TableMaster</p>
  </div>

</body>
</html>
```

**Variables:**
- `{{ params.customerName }}`
- `{{ params.restaurantName }}`
- `{{ params.reservationDate }}`
- `{{ params.reservationTime }}`

---

## 🚀 Comment créer les templates dans Brevo

### Méthode 1 : Éditeur HTML (Recommandé)

1. **Va sur Brevo** → Transactional → Templates
2. **Clique** "Create a new template"
3. **Cherche l'option "Edit in HTML"** ou "Code HTML"
4. **Colle** le code HTML ci-dessus
5. **Enregistre** et note le Template ID

### Méthode 2 : Si pas d'éditeur HTML

Si Brevo force l'éditeur visuel :

1. Crée un template vide
2. Utilise des **blocs de texte** pour le contenu
3. **Tape manuellement** les variables comme `{{ params.userName }}`
4. Utilise des **blocs bouton** pour les liens
5. Configure la **couleur de fond** pour chaque section

---

## ✅ Checklist après création

1. ✅ Créer les 5 templates dans Brevo
2. ✅ Noter les Template IDs
3. ✅ Mettre à jour `.env` :
```env
BREVO_TEMPLATE_PASSWORD_RESET=1
BREVO_TEMPLATE_PENDING=2
BREVO_TEMPLATE_CONFIRMATION=3
BREVO_TEMPLATE_DIRECT=4
BREVO_TEMPLATE_CANCELLATION=5
```

4. ✅ **Tester avec Brevo** en envoyant un email test avec données fictives
5. ✅ Vérifier le rendu sur mobile

---

**Versions ultra-simplifiées pour compatibilité maximale !** 🎯
