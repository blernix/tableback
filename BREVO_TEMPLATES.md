# Templates Brevo - TableMaster

Ce fichier contient le code HTML complet des **5 templates** à créer dans Brevo Dashboard.

**Instructions:**
1. Connecte-toi à ton compte Brevo
2. Va dans "Transactional" → "Templates"
3. Clique sur "New Template"
4. Copie-colle le sujet + le code HTML de chaque template ci-dessous
5. Note le Template ID généré par Brevo
6. Configure les variables d'environnement dans `.env` avec ces IDs

---

## 📧 Template 1 - Password Reset (Mot de passe oublié)

**Template ID dans .env:** `BREVO_TEMPLATE_PASSWORD_RESET=X`

**Sujet de l'email:**
```
Réinitialisation de votre mot de passe - TableMaster
```

**Code HTML:**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialisation mot de passe</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background-color: #2563eb; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">TableMaster</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Bonjour {{ params.userName }},</h2>

                            <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Vous avez demandé à réinitialiser votre mot de passe pour votre compte TableMaster.
                            </p>

                            <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
                            </p>

                            <!-- Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding: 0 0 30px;">
                                        <a href="{{ params.resetLink }}" style="display: inline-block; padding: 16px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Réinitialiser mon mot de passe</a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                <strong>Ce lien expire dans 24 heures.</strong>
                            </p>

                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
                            </p>

                            <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                                Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
                                <span style="color: #2563eb; word-break: break-all;">{{ params.resetLink }}</span>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                                © 2026 TableMaster - Gestion de réservations
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

**Variables utilisées:**
- `{{ params.userName }}` - Nom de l'utilisateur
- `{{ params.resetLink }}` - Lien de réinitialisation avec token JWT

---

## 📧 Template 2 - Pending Reservation (Réservation en attente)

**Template ID dans .env:** `BREVO_TEMPLATE_PENDING=X`

**Sujet de l'email:**
```
Demande de réservation reçue - {{ params.restaurantName }}
```

**Code HTML:**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réservation en attente</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background-color: #f59e0b; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">⏳ Demande reçue</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Bonjour {{ params.customerName }},</h2>

                            <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Nous avons bien reçu votre demande de réservation. Le restaurant va l'examiner et vous enverra une confirmation sous peu.
                            </p>

                            <!-- Reservation Details Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #92400e; font-size: 18px;">Détails de votre réservation</h3>

                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: bold; width: 40%;">Restaurant :</td>
                                                <td style="padding: 8px 0; color: #92400e; font-size: 14px;">{{ params.restaurantName }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: bold;">Date :</td>
                                                <td style="padding: 8px 0; color: #92400e; font-size: 14px;">{{ params.reservationDate }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: bold;">Heure :</td>
                                                <td style="padding: 8px 0; color: #92400e; font-size: 14px;">{{ params.reservationTime }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: bold;">Personnes :</td>
                                                <td style="padding: 8px 0; color: #92400e; font-size: 14px;">{{ params.partySize }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Vous recevrez un email de confirmation dès que le restaurant aura validé votre réservation.
                            </p>

                            <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Merci de votre patience ! ⏰
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                                © 2026 TableMaster - Gestion de réservations
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

**Variables utilisées:**
- `{{ params.customerName }}` - Nom du client
- `{{ params.restaurantName }}` - Nom du restaurant
- `{{ params.reservationDate }}` - Date (format français automatique)
- `{{ params.reservationTime }}` - Heure (ex: 19:30)
- `{{ params.partySize }}` - Nombre de personnes

---

## 📧 Template 3 - Confirmation (Réservation confirmée)

**Template ID dans .env:** `BREVO_TEMPLATE_CONFIRMATION=X`

**Sujet de l'email:**
```
✅ Réservation confirmée - {{ params.restaurantName }}
```

**Code HTML:**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réservation confirmée</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background-color: #10b981; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">✅ Réservation confirmée !</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Bonjour {{ params.customerName }},</h2>

                            <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Bonne nouvelle ! Votre réservation a été confirmée par le restaurant. Nous vous attendons avec plaisir ! 🎉
                            </p>

                            <!-- Reservation Details Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #d1fae5; border-left: 4px solid #10b981; border-radius: 4px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #065f46; font-size: 18px;">Détails de votre réservation</h3>

                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; color: #047857; font-size: 14px; font-weight: bold; width: 40%;">Restaurant :</td>
                                                <td style="padding: 8px 0; color: #065f46; font-size: 14px;">{{ params.restaurantName }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #047857; font-size: 14px; font-weight: bold;">Date :</td>
                                                <td style="padding: 8px 0; color: #065f46; font-size: 14px;">{{ params.reservationDate }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #047857; font-size: 14px; font-weight: bold;">Heure :</td>
                                                <td style="padding: 8px 0; color: #065f46; font-size: 14px;">{{ params.reservationTime }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #047857; font-size: 14px; font-weight: bold;">Personnes :</td>
                                                <td style="padding: 8px 0; color: #065f46; font-size: 14px;">{{ params.partySize }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Restaurant Contact -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; border-radius: 4px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px;">📞 Contact du restaurant</h3>

                                        <p style="margin: 0 0 8px; color: #4b5563; font-size: 14px;">
                                            <strong>Téléphone :</strong> {{ params.restaurantPhone }}
                                        </p>
                                        <p style="margin: 0; color: #4b5563; font-size: 14px;">
                                            <strong>Email :</strong> {{ params.restaurantEmail }}
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 30px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Pour toute question, vous pouvez répondre directement à cet email ou contacter le restaurant aux coordonnées ci-dessus.
                            </p>

                            <!-- Cancellation Section -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e5e7eb; padding-top: 30px; margin-top: 30px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                            <strong>Besoin d'annuler ?</strong><br>
                                            Si vous devez annuler votre réservation, cliquez sur le bouton ci-dessous :
                                        </p>

                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="text-align: center;">
                                                    <a href="{{ params.cancellationLink }}" style="display: inline-block; padding: 12px 30px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">Annuler ma réservation</a>
                                                </td>
                                            </tr>
                                        </table>

                                        <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                            Ce lien expire dans 24 heures avant votre réservation
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0 0 10px; color: #4b5563; font-size: 14px;">
                                À bientôt au restaurant ! 🍽️
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                                © 2026 TableMaster - Gestion de réservations
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

**Variables utilisées:**
- `{{ params.customerName }}` - Nom du client
- `{{ params.restaurantName }}` - Nom du restaurant
- `{{ params.restaurantPhone }}` - Téléphone du restaurant
- `{{ params.restaurantEmail }}` - Email du restaurant
- `{{ params.reservationDate }}` - Date (format français)
- `{{ params.reservationTime }}` - Heure
- `{{ params.partySize }}` - Nombre de personnes
- `{{ params.cancellationLink }}` - Lien d'annulation sécurisé

**Note:** Le reply-to sera automatiquement configuré avec l'email du restaurant par le code.

---

## 📧 Template 4 - Direct Confirmation (Réservation téléphonique)

**Template ID dans .env:** `BREVO_TEMPLATE_DIRECT=X`

**Sujet de l'email:**
```
✅ Confirmation de réservation - {{ params.restaurantName }}
```

**Code HTML:**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmation réservation téléphonique</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background-color: #8b5cf6; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">✅ Réservation confirmée</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Bonjour {{ params.customerName }},</h2>

                            <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Nous vous confirmons votre réservation effectuée par téléphone. Nous sommes impatients de vous accueillir ! 📞
                            </p>

                            <!-- Reservation Details Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ede9fe; border-left: 4px solid #8b5cf6; border-radius: 4px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #5b21b6; font-size: 18px;">Détails de votre réservation</h3>

                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; color: #6d28d9; font-size: 14px; font-weight: bold; width: 40%;">Restaurant :</td>
                                                <td style="padding: 8px 0; color: #5b21b6; font-size: 14px;">{{ params.restaurantName }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6d28d9; font-size: 14px; font-weight: bold;">Date :</td>
                                                <td style="padding: 8px 0; color: #5b21b6; font-size: 14px;">{{ params.reservationDate }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6d28d9; font-size: 14px; font-weight: bold;">Heure :</td>
                                                <td style="padding: 8px 0; color: #5b21b6; font-size: 14px;">{{ params.reservationTime }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6d28d9; font-size: 14px; font-weight: bold;">Personnes :</td>
                                                <td style="padding: 8px 0; color: #5b21b6; font-size: 14px;">{{ params.partySize }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Restaurant Contact -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; border-radius: 4px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px;">📞 Contact du restaurant</h3>

                                        <p style="margin: 0 0 8px; color: #4b5563; font-size: 14px;">
                                            <strong>Téléphone :</strong> {{ params.restaurantPhone }}
                                        </p>
                                        <p style="margin: 0; color: #4b5563; font-size: 14px;">
                                            <strong>Email :</strong> {{ params.restaurantEmail }}
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 30px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Pour toute modification ou question, n'hésitez pas à nous contacter directement aux coordonnées ci-dessus.
                            </p>

                            <!-- Cancellation Section -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e5e7eb; padding-top: 30px; margin-top: 30px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                            <strong>Besoin d'annuler ?</strong><br>
                                            Si vous devez annuler votre réservation, cliquez sur le bouton ci-dessous ou contactez-nous par téléphone :
                                        </p>

                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="text-align: center;">
                                                    <a href="{{ params.cancellationLink }}" style="display: inline-block; padding: 12px 30px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">Annuler ma réservation</a>
                                                </td>
                                            </tr>
                                        </table>

                                        <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                            Ce lien expire dans 24 heures avant votre réservation
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0 0 10px; color: #4b5563; font-size: 14px;">
                                À très bientôt ! 🍽️
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                                © 2026 TableMaster - Gestion de réservations
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

**Variables utilisées:** (identiques au Template 3)
- `{{ params.customerName }}`
- `{{ params.restaurantName }}`
- `{{ params.restaurantPhone }}`
- `{{ params.restaurantEmail }}`
- `{{ params.reservationDate }}`
- `{{ params.reservationTime }}`
- `{{ params.partySize }}`
- `{{ params.cancellationLink }}`

**Différence avec Template 3:** Message adapté pour une réservation prise par téléphone (couleur violette au lieu de verte).

---

## 📧 Template 5 - Cancellation Confirmation (Confirmation d'annulation)

**Template ID dans .env:** `BREVO_TEMPLATE_CANCELLATION=X`

**Sujet de l'email:**
```
Annulation confirmée - {{ params.restaurantName }}
```

**Code HTML:**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Annulation confirmée</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background-color: #6b7280; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Annulation confirmée</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Bonjour {{ params.customerName }},</h2>

                            <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Votre réservation a bien été annulée. Nous avons prévenu le restaurant.
                            </p>

                            <!-- Canceled Reservation Details Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; border-left: 4px solid #6b7280; border-radius: 4px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #374151; font-size: 18px;">Réservation annulée</h3>

                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; color: #4b5563; font-size: 14px; font-weight: bold; width: 40%;">Restaurant :</td>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; text-decoration: line-through;">{{ params.restaurantName }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #4b5563; font-size: 14px; font-weight: bold;">Date :</td>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; text-decoration: line-through;">{{ params.reservationDate }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #4b5563; font-size: 14px; font-weight: bold;">Heure :</td>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; text-decoration: line-through;">{{ params.reservationTime }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Nous espérons avoir le plaisir de vous accueillir une prochaine fois ! 🙏
                            </p>

                            <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Vous pouvez faire une nouvelle réservation à tout moment sur notre plateforme.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0 0 10px; color: #4b5563; font-size: 14px;">
                                À bientôt sur TableMaster ! 👋
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                                © 2026 TableMaster - Gestion de réservations
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

**Variables utilisées:**
- `{{ params.customerName }}` - Nom du client
- `{{ params.restaurantName }}` - Nom du restaurant
- `{{ params.reservationDate }}` - Date (format français)
- `{{ params.reservationTime }}` - Heure

**Note:** Pas de lien d'annulation ni de coordonnées restaurant (déjà annulée).

---

## 📋 Checklist après création des templates

Une fois tous les templates créés dans Brevo Dashboard :

1. ✅ Noter les Template IDs générés par Brevo
2. ✅ Mettre à jour `.env` avec ces IDs :
```env
BREVO_TEMPLATE_PASSWORD_RESET=1
BREVO_TEMPLATE_PENDING=2
BREVO_TEMPLATE_CONFIRMATION=3
BREVO_TEMPLATE_DIRECT=4
BREVO_TEMPLATE_CANCELLATION=5
```

3. ✅ Tester chaque template dans Brevo avec des données fictives
4. ✅ Vérifier le rendu mobile dans Brevo
5. ✅ Activer les templates en production

---

## 🎨 Palette de couleurs utilisée

- **Template 1 (Password Reset)** : Bleu `#2563eb`
- **Template 2 (Pending)** : Orange/Ambre `#f59e0b`
- **Template 3 (Confirmation)** : Vert `#10b981`
- **Template 4 (Direct)** : Violet `#8b5cf6`
- **Template 5 (Cancellation)** : Gris `#6b7280`

Chaque template a une couleur distinctive pour faciliter l'identification visuelle par les clients.

---

**Prêt pour l'implémentation !** 🚀
