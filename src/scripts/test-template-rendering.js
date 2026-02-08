const fs = require('fs');
const path = require('path');

// Simple template replacement function (same as emailService.ts)
function loadTemplate(templateName, params) {
  const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
  let html = fs.readFileSync(templatePath, 'utf-8');

  // Replace all {{variable}} with actual values
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== undefined) {
      // Replace all occurrences of {{key}} with value
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value));
    }
  });

  return html;
}

// Test data
const testData = {
  'welcome': {
    userName: 'Jean Dupont',
    restaurantName: 'Le Gourmet',
    dashboardLink: 'https://app.tablemaster.com/dashboard'
  },
  'confirmation': {
    customerName: 'Marie Martin',
    restaurantName: 'Le Bistrot',
    restaurantPhone: '01 23 45 67 89',
    restaurantEmail: 'contact@lebistrot.fr',
    reservationDate: '15 juin 2026',
    reservationTime: '19:30',
    partySize: '4 personnes',
    cancellationLink: 'https://api.tablemaster.com/cancel?token=abc123'
  },
  'cancellation': {
    customerName: 'Pierre Durand',
    restaurantName: 'La Table Ronde',
    reservationDate: '20 juin 2026',
    reservationTime: '20:00'
  },
  'pending-reservation': {
    customerName: 'Sophie Bernard',
    restaurantName: 'Le Petit Chef',
    reservationDate: '18 juin 2026',
    reservationTime: '12:30',
    partySize: '2 personnes'
  },
  'subscription-confirmed': {
    userName: 'Restaurateur Test',
    planName: 'Pro',
    price: '49€/mois',
    billingPeriod: 'Mensuel',
    nextBillingDate: '15 juillet 2026',
    isProPlan: 'true',
    quotaLimit: '300',
    dashboardLink: 'https://app.tablemaster.com/dashboard',
    billingLink: 'https://app.tablemaster.com/dashboard/billing',
    proSectionStyle: 'display: block;',
    starterSectionStyle: 'display: none;'
  }
};

// Create preview directory
const previewDir = path.join(__dirname, '../../preview-emails');
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true });
}

// Render each template
Object.entries(testData).forEach(([templateName, params]) => {
  try {
    const html = loadTemplate(templateName, params);
    const outputPath = path.join(previewDir, `${templateName}-preview.html`);
    fs.writeFileSync(outputPath, html);
    console.log(`✓ ${templateName}.html rendered to ${outputPath}`);
  } catch (error) {
    console.error(`✗ Error rendering ${templateName}:`, error.message);
  }
});

console.log('\n✅ All templates rendered. Open preview-emails/ in browser to view.');