# Cron Jobs pour TableMaster

Pour maintenir la plateforme propre et envoyer des rappels automatiques, configurez les cron jobs suivants sur votre serveur de production.

## Prérequis

- Node.js et npm installés
- Le projet backend déployé (`tablemaster-api`)
- Variables d'environnement configurées (notamment `MONGODB_URI`, `FRONTEND_URL`, etc.)

## Scripts disponibles

| Script                         | Commande npm               | Description                                                                         |
| ------------------------------ | -------------------------- | ----------------------------------------------------------------------------------- |
| Nettoyage des comptes inactifs | `npm run cleanup:inactive` | Supprime les restaurants self-service inactifs sans abonnement Stripe après 7 jours |
| Envoi des rappels de paiement  | `npm run reminders:send`   | Envoie un email de rappel 24h après une inscription abandonnée                      |

## Configuration recommandée

### 1. Nettoyage quotidien (à 3h du matin)

```
0 3 * * * cd /chemin/vers/tablemaster-api && npm run cleanup:inactive >> /var/log/tablemaster-cleanup.log 2>&1
```

### 2. Rappels de paiement (toutes les 6 heures)

```
0 */6 * * * cd /chemin/vers/tablemaster-api && npm run reminders:send >> /var/log/tablemaster-reminders.log 2>&1
```

### 3. Combinaison des deux (script unique)

Créez un script `daily-maintenance.sh` :

```bash
#!/bin/bash
cd /chemin/vers/tablemaster-api
npm run cleanup:inactive
npm run reminders:send
```

Puis planifiez-le quotidiennement :

```
0 4 * * * /chemin/vers/tablemaster-api/scripts/daily-maintenance.sh >> /var/log/tablemaster-maintenance.log 2>&1
```

## Variables d'environnement supplémentaires

Pour les rappels de paiement, définissez :

```bash
PAYMENT_REMINDER_HOURS=24  # Nombre d'heures après l'inscription pour envoyer le rappel
FRONTEND_URL=https://votre-domaine.com  # URL du frontend pour les liens de reprise
```

## Monitoring

- Vérifiez les logs régulièrement : `/var/log/tablemaster-*.log`
- Surveillez les emails envoyés via le tableau de bord admin (section "Inscriptions abandonnées")
- Alertes en cas d'erreurs répétées

## Dépannage

### Le cron ne s'exécute pas

- Vérifiez les permissions d'exécution du script
- Vérifiez que le chemin Node.js est correct dans le cron
- Testez manuellement avec `npm run cleanup:inactive`

### Emails non envoyés

- Vérifiez la configuration Brevo/Sendinblue
- Vérifiez les logs du service d'email
- Assurez-vous que le template `payment-reminder.html` existe

### Comptes non supprimés

- Vérifiez que `INACTIVE_CLEANUP_DAYS` est défini (défaut: 7)
- Vérifiez les logs MongoDB pour les erreurs de connexion
