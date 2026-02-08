import Stripe from 'stripe';
import logger from '../utils/logger';

if (!process.env.STRIPE_SECRET_KEY) {
  logger.error('STRIPE_SECRET_KEY is not defined in environment variables');
  throw new Error('STRIPE_SECRET_KEY must be defined');
}

// Initialize Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

// Stripe product and price IDs (to be created in Stripe Dashboard)
export const STRIPE_CONFIG = {
  products: {
    starter: {
      productId: process.env.STRIPE_PRODUCT_STARTER_ID || '',
      priceId: process.env.STRIPE_PRICE_STARTER_ID || '',
      name: 'Starter',
      amount: 3900, // 39€ in cents
      currency: 'eur',
      interval: 'month' as Stripe.Price.Recurring.Interval,
      features: [
        '50 réservations par mois',
        'Widget standard',
        'Gestion horaires et jours fermés',
        'Support par email',
      ],
    },
    pro: {
      productId: process.env.STRIPE_PRODUCT_PRO_ID || '',
      priceId: process.env.STRIPE_PRICE_PRO_ID || '',
      name: 'Pro',
      amount: 6900, // 69€ in cents
      currency: 'eur',
      interval: 'month' as Stripe.Price.Recurring.Interval,
      features: [
        'Réservations illimitées',
        'Widget personnalisable (couleurs, police)',
        'Gestion horaires et jours fermés',
        'Support prioritaire',
        'Analytics avancées',
      ],
    },
  },
  webhook: {
    secret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  urls: {
    success: `${process.env.FRONTEND_URL}/signup/success`,
    cancel: `${process.env.FRONTEND_URL}/signup/cancel`,
    return: `${process.env.FRONTEND_URL}/dashboard`,
  },
};

// Validate Stripe configuration
export function validateStripeConfig(): boolean {
  const errors: string[] = [];

  if (!process.env.STRIPE_SECRET_KEY) {
    errors.push('STRIPE_SECRET_KEY is missing');
  }

  if (!STRIPE_CONFIG.products.starter.priceId) {
    errors.push('STRIPE_PRICE_STARTER_ID is missing');
  }

  if (!STRIPE_CONFIG.products.pro.priceId) {
    errors.push('STRIPE_PRICE_PRO_ID is missing');
  }

  if (!STRIPE_CONFIG.webhook.secret) {
    logger.warn('STRIPE_WEBHOOK_SECRET is missing - webhooks will not work');
  }

  if (errors.length > 0) {
    logger.error('Stripe configuration errors:', errors);
    return false;
  }

  logger.info('Stripe configuration validated successfully');
  return true;
}

export default stripe;
