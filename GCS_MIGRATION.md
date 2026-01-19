# Migration GCS Credentials - Guide

## 🎯 Pourquoi cette migration ?

**Avant** : Les credentials GCS étaient stockées dans un fichier physique `gcs-service-account.json` avec des valeurs par défaut hardcodées dans le code.

**Problèmes** :
- Risque de fuite de credentials si le fichier est accidentellement commité
- Valeurs par défaut hardcodées (`generique-450417`, `stock_clients`) exposées dans le code
- Moins flexible pour les déploiements en production (Docker, cloud, etc.)

**Maintenant** : Les credentials sont stockées dans une variable d'environnement `GCS_CREDENTIALS` (JSON).

**Avantages** :
- ✅ Pas de fichier sensible à gérer
- ✅ Plus de valeurs hardcodées dans le code
- ✅ Compatible avec tous les environnements (Docker, Heroku, AWS, etc.)
- ✅ Meilleure sécurité (credentials jamais dans le code)

---

## 🔄 Ce qui a changé

### Fichier `src/config/storage.config.ts`

**Avant** :
```typescript
const keyFilename = path.join(process.cwd(), 'gcs-service-account.json');

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID || 'generique-450417',  // ❌ Hardcodé
  keyFilename: keyFilename,
});

const bucketName = process.env.GCS_BUCKET_NAME || 'stock_clients';  // ❌ Hardcodé
```

**Après** :
```typescript
let storage: Storage;

if (process.env.GCS_CREDENTIALS) {
  // Option 1 : Credentials depuis variable d'environnement (RECOMMANDÉ)
  const credentials = JSON.parse(process.env.GCS_CREDENTIALS);
  storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: credentials,
  });
} else if (process.env.GCS_KEY_FILENAME) {
  // Option 2 : Fichier de clé (dev local uniquement)
  storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: process.env.GCS_KEY_FILENAME,
  });
} else {
  throw new Error('GCS_CREDENTIALS or GCS_KEY_FILENAME required');
}

const bucketName = process.env.GCS_BUCKET_NAME;  // ✅ Pas de fallback
```

### Fichier `.env`

**Nouvelles variables** :
```env
# Option 1 (RECOMMANDÉ pour production)
GCS_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"..."}

# Option 2 (pour développement local)
# GCS_KEY_FILENAME=gcs-service-account.json
```

### Validation d'environnement

Le fichier `src/config/env.validation.ts` valide maintenant :
- Format JSON de `GCS_CREDENTIALS`
- Présence des champs requis (`type`, `project_id`, `private_key`)
- Cohérence de la configuration GCS

---

## 📋 Migration Step-by-Step

### Pour les développeurs locaux

**Option A : Utiliser GCS_CREDENTIALS (recommandé)**

1. Ouvrir le fichier `gcs-service-account.json`
2. Minifier le JSON en une seule ligne (supprimer les retours à la ligne)
3. Copier dans `.env` :
   ```env
   GCS_CREDENTIALS={"type":"service_account",...}
   ```

**Option B : Utiliser GCS_KEY_FILENAME (plus simple pour le dev)**

1. Dans `.env`, ajouter :
   ```env
   GCS_KEY_FILENAME=gcs-service-account.json
   ```

### Pour la production (Docker, Heroku, AWS, etc.)

1. Récupérer le contenu de `gcs-service-account.json`
2. Le minifier en une seule ligne
3. L'ajouter comme variable d'environnement :
   ```bash
   # Heroku
   heroku config:set GCS_CREDENTIALS='{"type":"service_account",...}'

   # Docker
   docker run -e GCS_CREDENTIALS='{"type":"service_account",...}' ...

   # AWS / Cloud
   # Ajouter via l'interface de gestion des variables d'environnement
   ```

---

## 🧪 Tester la configuration

Un script de test est fourni : `test-gcs.js`

```bash
node test-gcs.js
```

**Résultat attendu** :
```
✓ Credentials parsed successfully
✓ Bucket "stock_clients" exists and is accessible
✅ GCS Configuration is working correctly!
```

---

## ⚠️ Points d'attention

### 1. Ne jamais commiter les credentials

Le `.gitignore` contient déjà :
```
gcs-service-account.json
*-service-account.json
.env
```

**Vérifier avant de commit** :
```bash
git status
# S'assurer que .env et gcs-service-account.json ne sont PAS listés
```

### 2. Format JSON strict

La variable `GCS_CREDENTIALS` doit être du JSON valide **sans retours à la ligne**.

❌ **Mauvais** :
```env
GCS_CREDENTIALS={
  "type": "service_account",
  ...
}
```

✅ **Bon** :
```env
GCS_CREDENTIALS={"type":"service_account",...}
```

### 3. Échappement des caractères

Dans certains cas (Docker Compose, shell), il faut échapper les guillemets :
```yaml
# docker-compose.yml
environment:
  - GCS_CREDENTIALS={"type":"service_account",...}
```

---

## 🔐 Sécurité

### Bonnes pratiques

1. **Ne jamais hardcoder** de credentials dans le code
2. **Utiliser des secrets managers** en production (AWS Secrets Manager, Google Secret Manager, etc.)
3. **Rotation des clés** : Régénérer les service accounts régulièrement
4. **Principe du moindre privilège** : Service account avec permissions minimales nécessaires

### Permissions minimales requises

Le service account GCS doit avoir :
- `Storage Object Creator` (pour uploader)
- `Storage Object Viewer` (pour lire)
- `Storage Object Admin` (pour supprimer)

Sur le bucket uniquement (pas sur tout le projet).

---

## 🆘 Troubleshooting

### Erreur : "Invalid GCS_CREDENTIALS format"

**Cause** : JSON mal formé ou caractères spéciaux non échappés

**Solution** :
1. Vérifier que le JSON est valide avec : https://jsonlint.com/
2. S'assurer qu'il n'y a pas de retours à la ligne
3. Vérifier l'échappement des caractères spéciaux

### Erreur : "Bucket does not exist or is not accessible"

**Cause** : Permissions insuffisantes ou mauvais bucket name

**Solution** :
1. Vérifier `GCS_BUCKET_NAME` dans `.env`
2. Vérifier les permissions du service account sur GCS
3. Lancer `node test-gcs.js` pour diagnostiquer

### Erreur : "Missing required fields"

**Cause** : Credentials incomplètes

**Solution** :
Vérifier que le JSON contient au minimum :
- `type`
- `project_id`
- `private_key`
- `client_email`

---

## 📚 Ressources

- [Google Cloud Storage Node.js Client](https://cloud.google.com/nodejs/docs/reference/storage/latest)
- [Service Account Keys Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Environment Variables Best Practices](https://12factor.net/config)

---

## ✅ Checklist de migration

- [ ] Copier le contenu de `gcs-service-account.json`
- [ ] Minifier le JSON en une seule ligne
- [ ] Ajouter `GCS_CREDENTIALS` dans `.env`
- [ ] Supprimer l'ancienne variable `GCS_SERVICE_ACCOUNT_KEY`
- [ ] Tester avec `node test-gcs.js`
- [ ] Vérifier que le serveur démarre : `npm run dev`
- [ ] Tester un upload de fichier (logo, menu PDF, photo plat)
- [ ] En production : Configurer `GCS_CREDENTIALS` dans les variables d'environnement
- [ ] Vérifier que `.env` et `gcs-service-account.json` sont dans `.gitignore`

---

## 🎉 Résultat

Après cette migration :
- ✅ Plus de credentials hardcodées
- ✅ Plus de fichier sensible à gérer
- ✅ Configuration flexible et sécurisée
- ✅ Prêt pour tous les environnements de déploiement
