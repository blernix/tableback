# TableMaster - Documentation API Publique

Cette documentation explique comment intégrer l'API TableMaster sur votre site web de restaurant pour afficher votre menu et permettre aux clients de faire des réservations en ligne.

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Authentification](#authentification)
3. [Endpoints disponibles](#endpoints-disponibles)
4. [Guide d'intégration](#guide-dintégration)
5. [Gestion des erreurs](#gestion-des-erreurs)

---

## Vue d'ensemble

L'API publique TableMaster permet aux sites web de restaurants de :
- **Afficher le menu** (en mode PDF ou détaillé avec catégories/plats)
- **Créer des réservations** en ligne
- **Vérifier la disponibilité** pour une date donnée
- **Obtenir les créneaux horaires disponibles**
- **Récupérer les informations du restaurant** (adresse, horaires, etc.)

**URL de base:** `http://localhost:4000/api/public` (ou votre URL de production)

---

## Authentification

L'API utilise deux méthodes d'authentification selon l'endpoint :

### 1. API Key dans l'URL (Menu uniquement)
Pour récupérer le menu, l'API key est passée directement dans l'URL.

```
GET /api/public/menu/:apiKey
```

### 2. Header X-API-Key (Réservations et autres)
Pour tous les autres endpoints, l'API key doit être envoyée dans le header HTTP `X-API-Key`.

```javascript
fetch('http://localhost:4000/api/public/restaurant-info', {
  headers: {
    'X-API-Key': 'VOTRE_CLE_API_ICI'
  }
})
```

**Comment obtenir votre API Key ?**
- Connectez-vous à votre interface d'administration TableMaster
- Votre clé API est disponible dans les paramètres du restaurant
- Elle peut être régénérée si nécessaire

---

## Endpoints disponibles

### 1. Récupérer le menu

**Endpoint:** `GET /api/public/menu/:apiKey`

**Description:** Récupère le menu du restaurant (format PDF ou détaillé selon la configuration)

**Paramètres:**
- `apiKey` (dans l'URL) - Votre clé API

**Réponse en mode PDF:**
```json
{
  "restaurantName": "Le Bistrot Parisien",
  "displayMode": "pdf",
  "pdfUrl": "https://exemple.com/uploads/menu.pdf"
}
```

**Réponse en mode détaillé:**
```json
{
  "restaurantName": "Le Bistrot Parisien",
  "displayMode": "detailed",
  "categories": [
    {
      "id": "cat123",
      "name": "Entrées",
      "displayOrder": 0,
      "dishes": [
        {
          "id": "dish456",
          "name": "Salade César",
          "description": "Salade verte, poulet, parmesan, croûtons",
          "price": 12.50,
          "allergens": ["gluten", "lactose"]
        }
      ]
    }
  ]
}
```

**Exemple JavaScript:**
```javascript
async function fetchMenu() {
  const apiKey = 'VOTRE_CLE_API';
  const response = await fetch(`http://localhost:4000/api/public/menu/${apiKey}`);
  const data = await response.json();

  if (data.displayMode === 'pdf') {
    // Afficher un lien vers le PDF
    window.open(data.pdfUrl, '_blank');
  } else {
    // Afficher les catégories et plats
    data.categories.forEach(category => {
      console.log(category.name);
      category.dishes.forEach(dish => {
        console.log(`  - ${dish.name}: ${dish.price}€`);
      });
    });
  }
}
```

---

### 2. Créer une réservation

**Endpoint:** `POST /api/public/reservations`

**Headers requis:**
- `X-API-Key: VOTRE_CLE_API`
- `Content-Type: application/json`

**Corps de la requête:**
```json
{
  "customerName": "Jean Dupont",
  "customerEmail": "jean.dupont@email.com",
  "customerPhone": "06 12 34 56 78",
  "date": "2026-01-15",
  "time": "19:30",
  "numberOfGuests": 4,
  "notes": "Allergie aux noix"
}
```

**Validation:**
- `customerName`: Obligatoire, string non vide
- `customerEmail`: Obligatoire, format email valide
- `customerPhone`: Obligatoire, string non vide
- `date`: Obligatoire, format `YYYY-MM-DD`
- `time`: Obligatoire, format `HH:MM` (24h)
- `numberOfGuests`: Obligatoire, nombre entier ≥ 1
- `notes`: Optionnel, string

**Réponse (201 Created):**
```json
{
  "reservation": {
    "_id": "res789",
    "customerName": "Jean Dupont",
    "customerEmail": "jean.dupont@email.com",
    "customerPhone": "06 12 34 56 78",
    "date": "2026-01-15T00:00:00.000Z",
    "time": "19:30",
    "numberOfGuests": 4,
    "status": "pending",
    "notes": "Allergie aux noix"
  }
}
```

**Notifications automatiques:**
- Un email de confirmation est envoyé au client
- Un email de notification est envoyé au restaurant

**Exemple JavaScript:**
```javascript
async function createReservation(formData) {
  const response = await fetch('http://localhost:4000/api/public/reservations', {
    method: 'POST',
    headers: {
      'X-API-Key': 'VOTRE_CLE_API',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      customerName: formData.name,
      customerEmail: formData.email,
      customerPhone: formData.phone,
      date: formData.date, // Format: YYYY-MM-DD
      time: formData.time, // Format: HH:MM
      numberOfGuests: parseInt(formData.guests),
      notes: formData.notes || ''
    })
  });

  if (response.ok) {
    const data = await response.json();
    alert('Réservation confirmée ! Vous allez recevoir un email.');
    return data.reservation;
  } else {
    const error = await response.json();
    alert(`Erreur: ${error.error.message}`);
  }
}
```

---

### 3. Vérifier la disponibilité d'une date

**Endpoint:** `GET /api/public/availability/:date`

**Headers requis:**
- `X-API-Key: VOTRE_CLE_API`

**Paramètres:**
- `date` (dans l'URL) - Format `YYYY-MM-DD`

**Réponse (disponible):**
```json
{
  "available": true,
  "openingHours": [
    { "start": "12:00", "end": "14:00" },
    { "start": "19:00", "end": "22:00" }
  ],
  "existingReservations": 5,
  "defaultDuration": 90
}
```

**Réponse (non disponible - bloqué):**
```json
{
  "available": false,
  "reason": "blocked",
  "message": "Événement privé"
}
```

**Réponse (non disponible - fermé):**
```json
{
  "available": false,
  "reason": "closed",
  "message": "Restaurant is closed on sundays"
}
```

**Exemple JavaScript:**
```javascript
async function checkAvailability(date) {
  const response = await fetch(
    `http://localhost:4000/api/public/availability/${date}`,
    {
      headers: {
        'X-API-Key': 'VOTRE_CLE_API'
      }
    }
  );

  const data = await response.json();

  if (data.available) {
    console.log('Restaurant ouvert !');
    console.log('Horaires:', data.openingHours);
    console.log('Réservations existantes:', data.existingReservations);
  } else {
    console.log('Indisponible:', data.message);
  }

  return data;
}
```

---

### 4. Obtenir les créneaux horaires disponibles

**Endpoint:** `GET /api/public/time-slots/:date`

**Headers requis:**
- `X-API-Key: VOTRE_CLE_API`

**Paramètres:**
- `date` (dans l'URL) - Format `YYYY-MM-DD`
- `numberOfGuests` (query optionnel) - Nombre de personnes

**Réponse:**
```json
{
  "available": true,
  "slots": [
    "12:00", "12:30", "13:00", "13:30",
    "19:00", "19:30", "20:00", "20:30", "21:00"
  ],
  "existingReservations": [
    { "time": "12:30", "numberOfGuests": 4 },
    { "time": "20:00", "numberOfGuests": 2 }
  ],
  "config": {
    "defaultDuration": 90,
    "totalTables": 15,
    "averageCapacity": 4
  }
}
```

**Exemple JavaScript:**
```javascript
async function getTimeSlots(date) {
  const response = await fetch(
    `http://localhost:4000/api/public/time-slots/${date}`,
    {
      headers: {
        'X-API-Key': 'VOTRE_CLE_API'
      }
    }
  );

  const data = await response.json();

  if (data.available) {
    // Créer un <select> avec les créneaux disponibles
    const select = document.getElementById('timeSelect');
    data.slots.forEach(slot => {
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = slot;

      // Marquer les créneaux déjà réservés
      const isBooked = data.existingReservations.some(r => r.time === slot);
      if (isBooked) {
        option.textContent += ' (réservations existantes)';
      }

      select.appendChild(option);
    });
  }
}
```

---

### 5. Obtenir les informations du restaurant

**Endpoint:** `GET /api/public/restaurant-info`

**Headers requis:**
- `X-API-Key: VOTRE_CLE_API`

**Réponse:**
```json
{
  "restaurant": {
    "name": "Le Bistrot Parisien",
    "address": "123 Rue de la Gastronomie, 75001 Paris",
    "phone": "01 23 45 67 89",
    "email": "contact@bistrot.fr",
    "openingHours": {
      "monday": {
        "closed": false,
        "slots": [
          { "start": "12:00", "end": "14:00" },
          { "start": "19:00", "end": "22:00" }
        ]
      },
      "tuesday": { "closed": false, "slots": [...] },
      "sunday": { "closed": true, "slots": [] }
    },
    "reservationConfig": {
      "defaultDuration": 90,
      "useOpeningHours": true
    },
    "tablesConfig": {
      "totalTables": 15,
      "averageCapacity": 4
    }
  }
}
```

**Exemple JavaScript:**
```javascript
async function displayRestaurantInfo() {
  const response = await fetch('http://localhost:4000/api/public/restaurant-info', {
    headers: {
      'X-API-Key': 'VOTRE_CLE_API'
    }
  });

  const { restaurant } = await response.json();

  document.getElementById('restaurant-name').textContent = restaurant.name;
  document.getElementById('restaurant-address').textContent = restaurant.address;
  document.getElementById('restaurant-phone').textContent = restaurant.phone;

  // Afficher les horaires
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  days.forEach((day, index) => {
    const schedule = restaurant.openingHours[day];
    if (schedule.closed) {
      console.log(`${dayNames[index]}: Fermé`);
    } else {
      const hours = schedule.slots.map(s => `${s.start}-${s.end}`).join(', ');
      console.log(`${dayNames[index]}: ${hours}`);
    }
  });
}
```

---

## Guide d'intégration

### Exemple complet : Formulaire de réservation

Voici un exemple HTML/JavaScript complet pour intégrer un formulaire de réservation sur votre site :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Réserver une table</title>
  <style>
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; }
    input, select, textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    button {
      background: #007bff;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .error { color: red; margin-top: 10px; }
    .success { color: green; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Réserver une table</h1>

  <form id="reservationForm">
    <div class="form-group">
      <label for="name">Nom complet *</label>
      <input type="text" id="name" required>
    </div>

    <div class="form-group">
      <label for="email">Email *</label>
      <input type="email" id="email" required>
    </div>

    <div class="form-group">
      <label for="phone">Téléphone *</label>
      <input type="tel" id="phone" required>
    </div>

    <div class="form-group">
      <label for="date">Date *</label>
      <input type="date" id="date" required>
    </div>

    <div class="form-group">
      <label for="time">Heure *</label>
      <select id="time" required>
        <option value="">Sélectionnez une heure</option>
      </select>
    </div>

    <div class="form-group">
      <label for="guests">Nombre de personnes *</label>
      <input type="number" id="guests" min="1" max="20" required>
    </div>

    <div class="form-group">
      <label for="notes">Notes / Allergies</label>
      <textarea id="notes" rows="3"></textarea>
    </div>

    <button type="submit">Réserver</button>

    <div id="message"></div>
  </form>

  <script>
    const API_URL = 'http://localhost:4000/api/public';
    const API_KEY = 'VOTRE_CLE_API'; // Remplacez par votre vraie clé

    // Charger les créneaux horaires quand la date change
    document.getElementById('date').addEventListener('change', async (e) => {
      const date = e.target.value;
      if (!date) return;

      try {
        // Vérifier la disponibilité
        const availResponse = await fetch(`${API_URL}/availability/${date}`, {
          headers: { 'X-API-Key': API_KEY }
        });
        const availData = await availResponse.json();

        if (!availData.available) {
          showMessage(`Indisponible: ${availData.message}`, 'error');
          document.getElementById('time').innerHTML = '<option value="">Aucun créneau disponible</option>';
          return;
        }

        // Récupérer les créneaux
        const slotsResponse = await fetch(`${API_URL}/time-slots/${date}`, {
          headers: { 'X-API-Key': API_KEY }
        });
        const slotsData = await slotsResponse.json();

        // Remplir le select
        const timeSelect = document.getElementById('time');
        timeSelect.innerHTML = '<option value="">Sélectionnez une heure</option>';

        slotsData.slots.forEach(slot => {
          const option = document.createElement('option');
          option.value = slot;
          option.textContent = slot;
          timeSelect.appendChild(option);
        });

      } catch (error) {
        showMessage('Erreur lors de la vérification de la disponibilité', 'error');
      }
    });

    // Soumettre la réservation
    document.getElementById('reservationForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        customerName: document.getElementById('name').value,
        customerEmail: document.getElementById('email').value,
        customerPhone: document.getElementById('phone').value,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        numberOfGuests: parseInt(document.getElementById('guests').value),
        notes: document.getElementById('notes').value
      };

      try {
        const response = await fetch(`${API_URL}/reservations`, {
          method: 'POST',
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
          showMessage('Réservation confirmée ! Un email de confirmation vous a été envoyé.', 'success');
          document.getElementById('reservationForm').reset();
        } else {
          showMessage(`Erreur: ${data.error.message}`, 'error');
        }
      } catch (error) {
        showMessage('Erreur lors de la création de la réservation', 'error');
      }
    });

    function showMessage(text, type) {
      const messageDiv = document.getElementById('message');
      messageDiv.textContent = text;
      messageDiv.className = type;
    }
  </script>
</body>
</html>
```

### Exemple complet : Affichage du menu

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Notre Menu</title>
  <style>
    .menu-category {
      margin-bottom: 40px;
    }
    .menu-category h2 {
      color: #333;
      border-bottom: 2px solid #007bff;
      padding-bottom: 10px;
    }
    .dish {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      padding: 10px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .dish-info h3 {
      margin: 0 0 5px 0;
      color: #555;
    }
    .dish-description {
      color: #777;
      font-size: 14px;
    }
    .dish-price {
      font-weight: bold;
      color: #007bff;
      font-size: 18px;
    }
    .allergens {
      color: #d9534f;
      font-size: 12px;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <h1>Notre Menu</h1>
  <div id="menu"></div>

  <script>
    const API_KEY = 'VOTRE_CLE_API'; // Remplacez par votre vraie clé

    async function loadMenu() {
      try {
        const response = await fetch(`http://localhost:4000/api/public/menu/${API_KEY}`);
        const data = await response.json();

        const menuDiv = document.getElementById('menu');

        if (data.displayMode === 'pdf') {
          // Mode PDF
          menuDiv.innerHTML = `
            <p>Notre menu est disponible en PDF :</p>
            <a href="${data.pdfUrl}" target="_blank" class="btn">Télécharger le menu (PDF)</a>
          `;
        } else {
          // Mode détaillé
          data.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'menu-category';

            let html = `<h2>${category.name}</h2>`;

            category.dishes.forEach(dish => {
              const allergens = dish.allergens && dish.allergens.length > 0
                ? `<div class="allergens">Allergènes: ${dish.allergens.join(', ')}</div>`
                : '';

              html += `
                <div class="dish">
                  <div class="dish-info">
                    <h3>${dish.name}</h3>
                    <div class="dish-description">${dish.description}</div>
                    ${allergens}
                  </div>
                  <div class="dish-price">${dish.price.toFixed(2)}€</div>
                </div>
              `;
            });

            categoryDiv.innerHTML = html;
            menuDiv.appendChild(categoryDiv);
          });
        }
      } catch (error) {
        document.getElementById('menu').innerHTML = '<p>Erreur lors du chargement du menu</p>';
        console.error('Error loading menu:', error);
      }
    }

    // Charger le menu au chargement de la page
    loadMenu();
  </script>
</body>
</html>
```

---

## Gestion des erreurs

### Codes de statut HTTP

- **200 OK** - Requête réussie
- **201 Created** - Réservation créée avec succès
- **400 Bad Request** - Erreur de validation (données manquantes ou invalides)
- **401 Unauthorized** - API key manquante ou invalide
- **404 Not Found** - Restaurant non trouvé ou inactif
- **500 Internal Server Error** - Erreur serveur

### Format des erreurs

Toutes les erreurs retournent un objet JSON avec cette structure :

```json
{
  "error": {
    "message": "Description de l'erreur",
    "details": [] // Optionnel, pour les erreurs de validation Zod
  }
}
```

### Exemples d'erreurs courantes

**API Key manquante:**
```json
{
  "error": {
    "message": "API key is required. Please provide it in the X-API-Key header."
  }
}
```

**API Key invalide:**
```json
{
  "error": {
    "message": "Invalid API key or restaurant is inactive"
  }
}
```

**Erreur de validation:**
```json
{
  "error": {
    "message": "Validation error",
    "details": [
      {
        "path": ["customerEmail"],
        "message": "Invalid email"
      }
    ]
  }
}
```

**Date non disponible:**
```json
{
  "error": {
    "message": "This date is not available for reservations",
    "reason": "Événement privé"
  }
}
```

### Gestion des erreurs en JavaScript

```javascript
async function safeApiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      // Gérer les différents types d'erreurs
      if (response.status === 401) {
        console.error('Erreur d\'authentification - Vérifiez votre API key');
      } else if (response.status === 400) {
        console.error('Données invalides:', data.error.details || data.error.message);
      } else if (response.status === 404) {
        console.error('Restaurant non trouvé');
      } else {
        console.error('Erreur serveur:', data.error.message);
      }

      throw new Error(data.error.message);
    }

    return data;
  } catch (error) {
    console.error('Erreur lors de l\'appel API:', error);
    throw error;
  }
}

// Utilisation
try {
  const data = await safeApiCall(`${API_URL}/restaurant-info`, {
    headers: { 'X-API-Key': API_KEY }
  });
  console.log('Restaurant:', data.restaurant.name);
} catch (error) {
  // Afficher un message à l'utilisateur
  alert('Une erreur est survenue. Veuillez réessayer.');
}
```

---

## Support et contact

Pour toute question ou problème avec l'API :
- Vérifiez que votre API key est valide et active
- Assurez-vous que votre restaurant est actif dans le système
- Consultez les logs de votre navigateur pour les erreurs JavaScript
- Contactez le support TableMaster si le problème persiste

---

**Version:** 1.0
**Dernière mise à jour:** Janvier 2026
