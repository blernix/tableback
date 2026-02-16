import Stripe from 'stripe';
import { stripe, STRIPE_CONFIG } from '../config/stripe.config';
import Restaurant from '../models/Restaurant.model';
import SubscriptionHistory from '../models/SubscriptionHistory.model';
import User from '../models/User.model';
import logger from '../utils/logger';
import { Types } from 'mongoose';
import { sendWelcomeEmail, sendSubscriptionConfirmedEmail } from './emailService';

/**
 * Create a Stripe Checkout Session for a new subscription
 */
export async function createCheckoutSession(params: {
  restaurantId: string;
  plan: 'starter' | 'pro';
  email: string;
  acceptedTerms?: boolean;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<Stripe.Checkout.Session> {
  try {
    const { restaurantId, plan, email, acceptedTerms, successUrl, cancelUrl } = params;

    const priceId = STRIPE_CONFIG.products[plan].priceId;

    if (!priceId) {
      throw new Error(`Price ID not configured for plan: ${plan}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'link'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        restaurantId,
        plan,
        acceptedTerms: acceptedTerms?.toString(),
      },
      subscription_data: {
        metadata: {
          restaurantId,
          plan,
          acceptedTerms: acceptedTerms?.toString(),
        },
      },
      success_url: successUrl || STRIPE_CONFIG.urls.success,
      cancel_url: cancelUrl || STRIPE_CONFIG.urls.cancel,
      allow_promotion_codes: true,
    } as any);

    logger.info(`Checkout session created for restaurant ${restaurantId}`, {
      sessionId: session.id,
      plan,
    });

    return session;
  } catch (error) {
    logger.error('Failed to create checkout session:', error);
    throw error;
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscription
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl?: string;
}): Promise<Stripe.BillingPortal.Session> {
  try {
    const { customerId, returnUrl } = params;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || STRIPE_CONFIG.urls.return,
    });

    logger.info(`Portal session created for customer ${customerId}`);

    return session;
  } catch (error) {
    logger.error('Failed to create portal session:', error);
    throw error;
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  logger.info(`Processing Stripe webhook: ${event.type}`, {
    eventId: event.id,
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'setup_intent.setup_failed':
        await handleSetupIntentFailed(event.data.object as Stripe.SetupIntent);
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    logger.error(`Failed to process webhook event ${event.type}:`, error);
    throw error;
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const { restaurantId, plan } = session.metadata || {};

  if (!restaurantId || !plan) {
    logger.error('Missing metadata in checkout session', { sessionId: session.id });
    return;
  }

  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    logger.error(`Restaurant not found: ${restaurantId}`);
    return;
  }

  // Update restaurant with Stripe customer ID
  if (session.customer) {
    // Activate restaurant status
    restaurant.status = 'active';

    restaurant.subscription = {
      plan: plan as 'starter' | 'pro',
      status: 'active',
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
    };

    // Initialize reservation quota based on plan
    if (plan === 'starter') {
      restaurant.reservationQuota = {
        monthlyCount: 0,
        lastResetDate: new Date(),
        limit: 400,
        emailsSent: {
          at80: false,
          at90: false,
          at100: false,
        },
      };
    } else if (plan === 'pro') {
      restaurant.reservationQuota = {
        monthlyCount: 0,
        lastResetDate: new Date(),
        limit: -1, // Unlimited
        emailsSent: {
          at80: false,
          at90: false,
          at100: false,
        },
      };
    }

    await restaurant.save();

    logger.info(`Restaurant ${restaurantId} subscription activated`);

    // Send welcome and subscription confirmation emails
    try {
      // Find the user associated with this restaurant
      const user = await User.findOne({ restaurantId: restaurant._id });

      if (user) {
        // Send welcome email (user doesn't have a name field, use restaurant name)
        await sendWelcomeEmail(
          { name: restaurant.name, email: user.email },
          { name: restaurant.name }
        );

        // Send subscription confirmation email
        const planName = plan === 'starter' ? 'Starter' : 'Pro';
        const price = plan === 'starter' ? '39€ / mois' : '69€ / mois';
        const quotaLimit = plan === 'starter' ? 400 : undefined;

        // Calculate next billing date (30 days from now)
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);
        const nextBillingDate = nextBilling.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        await sendSubscriptionConfirmedEmail(
          { name: restaurant.name, email: user.email },
          {
            planName,
            price,
            billingPeriod: 'Mensuel',
            nextBillingDate,
            isProPlan: plan === 'pro',
            quotaLimit,
          }
        );

        logger.info(`Welcome and subscription emails sent to ${user.email}`);
      }
    } catch (emailError) {
      logger.error('Failed to send welcome/subscription emails:', emailError);
      // Don't fail the checkout process if emails fail
    }
  }
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const { restaurantId, plan } = subscription.metadata;

  if (!restaurantId) {
    logger.error('Missing restaurantId in subscription metadata');
    return;
  }

  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    logger.error(`Restaurant not found: ${restaurantId}`);
    return;
  }

  // Update restaurant subscription and activate restaurant
  const subscriptionStatus = subscription.status === 'active' ? 'active' : 'trial';

  restaurant.subscription = {
    plan: (plan as 'starter' | 'pro') || 'starter',
    status: subscriptionStatus,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
  };

  // Activate restaurant when subscription is active or in trial
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trial') {
    restaurant.status = 'active';
  }

  // Initialize reservation quota for Starter plan
  if (plan === 'starter') {
    restaurant.reservationQuota = {
      monthlyCount: 0,
      lastResetDate: new Date(),
      limit: 400,
      emailsSent: {
        at80: false,
        at90: false,
        at100: false,
      },
    };
  } else if (plan === 'pro') {
    // Pro plan has unlimited reservations
    restaurant.reservationQuota = {
      monthlyCount: 0,
      lastResetDate: new Date(),
      limit: -1, // Unlimited
      emailsSent: {
        at80: false,
        at90: false,
        at100: false,
      },
    };
  }

  await restaurant.save();

  // Log to history
  await SubscriptionHistory.create({
    restaurantId: new Types.ObjectId(restaurantId),
    eventType: 'subscription_created',
    plan: plan as 'starter' | 'pro',
    stripeEventId: subscription.id,
    metadata: {
      subscriptionStatus: subscription.status,
      currentPeriodEnd: (subscription as any).current_period_end,
    },
  });

  logger.info(`Subscription created for restaurant ${restaurantId}`, {
    subscriptionId: subscription.id,
    plan,
  });
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const { restaurantId } = subscription.metadata;

  if (!restaurantId) {
    logger.error('Missing restaurantId in subscription metadata');
    return;
  }

  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    logger.error(`Restaurant not found: ${restaurantId}`);
    return;
  }

  const previousPlan = restaurant.subscription?.plan;
  const newPlan = determinePlanFromSubscription(subscription);
  const newStatus = mapStripeStatus(subscription.status);

  // Update subscription details
  restaurant.subscription = {
    ...restaurant.subscription,
    plan: newPlan,
    status: newStatus,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
  };

  // Update restaurant status based on subscription status
  if (newStatus === 'active' || newStatus === 'trial') {
    restaurant.status = 'active';
  } else if (newStatus === 'cancelled' || newStatus === 'expired' || newStatus === 'past_due') {
    restaurant.status = 'inactive';
  }

  // Update quota limit when plan changes
  if (previousPlan !== newPlan) {
    if (newPlan === 'starter') {
      // Downgrade to Starter: set limit to 400
      if (!restaurant.reservationQuota) {
        restaurant.reservationQuota = {
          monthlyCount: 0,
          lastResetDate: new Date(),
          limit: 400,
          emailsSent: { at80: false, at90: false, at100: false },
        };
      } else {
        restaurant.reservationQuota.limit = 400;
      }
    } else if (newPlan === 'pro') {
      // Upgrade to Pro: set limit to unlimited
      if (!restaurant.reservationQuota) {
        restaurant.reservationQuota = {
          monthlyCount: 0,
          lastResetDate: new Date(),
          limit: -1,
          emailsSent: { at80: false, at90: false, at100: false },
        };
      } else {
        restaurant.reservationQuota.limit = -1;
      }
    }
  }

  await restaurant.save();

  // Determine event type
  let eventType: any = 'subscription_updated';
  if (previousPlan && previousPlan !== newPlan) {
    eventType = newPlan === 'pro' ? 'plan_upgraded' : 'plan_downgraded';
  } else if ((subscription as any).cancel_at_period_end) {
    eventType = 'subscription_cancelled';
  }

  // Log to history
  await SubscriptionHistory.create({
    restaurantId: new Types.ObjectId(restaurantId),
    eventType,
    plan: newPlan,
    previousPlan: previousPlan as 'starter' | 'pro' | undefined,
    stripeEventId: subscription.id,
    metadata: {
      subscriptionStatus: subscription.status,
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    },
  });

  logger.info(`Subscription updated for restaurant ${restaurantId}`, {
    subscriptionId: subscription.id,
    previousPlan,
    newPlan,
    eventType,
  });
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const { restaurantId } = subscription.metadata;

  if (!restaurantId) {
    logger.error('Missing restaurantId in subscription metadata');
    return;
  }

  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    logger.error(`Restaurant not found: ${restaurantId}`);
    return;
  }

  // Update subscription status to cancelled and deactivate restaurant
  if (restaurant.subscription) {
    restaurant.subscription.status = 'cancelled';
    restaurant.status = 'inactive';
    await restaurant.save();
  }

  // Log to history
  await SubscriptionHistory.create({
    restaurantId: new Types.ObjectId(restaurantId),
    eventType: 'subscription_cancelled',
    plan: restaurant.subscription?.plan || 'starter',
    stripeEventId: subscription.id,
  });

  logger.info(`Subscription cancelled for restaurant ${restaurantId}`, {
    subscriptionId: subscription.id,
  });
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  if (!(invoice as any).subscription) {
    return; // Not a subscription invoice
  }

  const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);

  const { restaurantId } = subscription.metadata;

  if (!restaurantId) {
    return;
  }

  // Log to history
  await SubscriptionHistory.create({
    restaurantId: new Types.ObjectId(restaurantId),
    eventType: 'payment_succeeded',
    plan: determinePlanFromSubscription(subscription),
    stripeEventId: invoice.id,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_paid / 100, // Convert cents to euros
    currency: invoice.currency,
    metadata: {
      invoiceNumber: invoice.number,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
    },
  });

  logger.info(`Payment succeeded for restaurant ${restaurantId}`, {
    invoiceId: invoice.id,
    amount: invoice.amount_paid / 100,
  });
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  if (!(invoice as any).subscription) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);

  const { restaurantId } = subscription.metadata;

  if (!restaurantId) {
    return;
  }

  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant || !restaurant.subscription) {
    return;
  }

  // Update subscription status to past_due and deactivate restaurant
  restaurant.subscription.status = 'past_due';
  restaurant.status = 'inactive';
  await restaurant.save();

  // Log to history
  await SubscriptionHistory.create({
    restaurantId: new Types.ObjectId(restaurantId),
    eventType: 'payment_failed',
    plan: restaurant.subscription.plan,
    stripeEventId: invoice.id,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_due / 100,
    currency: invoice.currency,
    metadata: {
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt,
    },
  });

  logger.warn(`Payment failed for restaurant ${restaurantId}`, {
    invoiceId: invoice.id,
    amount: invoice.amount_due / 100,
  });

  // TODO: Send email notification to restaurant
}

/**
 * Helper: Determine plan from Stripe subscription
 */
function determinePlanFromSubscription(subscription: Stripe.Subscription): 'starter' | 'pro' {
  const priceId = subscription.items.data[0]?.price.id;

  if (priceId === STRIPE_CONFIG.products.pro.priceId) {
    return 'pro';
  }

  return 'starter';
}

/**
 * Helper: Map Stripe status to our status
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired' {
  switch (stripeStatus) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'cancelled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'expired';
  }
}

/**
 * Get subscription details for a restaurant
 */
export async function getSubscriptionDetails(restaurantId: string): Promise<{
  subscription: Stripe.Subscription | null;
  customer: Stripe.Customer | null;
}> {
  try {
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || !restaurant.subscription?.stripeSubscriptionId) {
      return { subscription: null, customer: null };
    }

    const subscription = await stripe.subscriptions.retrieve(
      restaurant.subscription.stripeSubscriptionId
    );

    const customer = restaurant.subscription.stripeCustomerId
      ? await stripe.customers.retrieve(restaurant.subscription.stripeCustomerId)
      : null;

    return {
      subscription,
      customer: customer && 'email' in customer ? customer : null,
    };
  } catch (error) {
    logger.error('Failed to get subscription details:', error);
    throw error;
  }
}

/**
 * Update subscription (change plan, extend, activate)
 */
export async function updateSubscription(params: {
  restaurantId: string;
  action: 'change_plan' | 'extend_subscription' | 'activate';
  plan?: 'starter' | 'pro';
  days?: number;
}): Promise<Stripe.Subscription> {
  try {
    const { restaurantId, action, plan, days } = params;

    // Get restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant || !restaurant.subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    const subscriptionId = restaurant.subscription.stripeSubscriptionId;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    let updateData: Stripe.SubscriptionUpdateParams = {};

    switch (action) {
      case 'change_plan': {
        if (!plan) {
          throw new Error('Plan is required for change_plan action');
        }

        const priceId = STRIPE_CONFIG.products[plan].priceId;
        if (!priceId) {
          throw new Error(`Price ID not configured for plan: ${plan}`);
        }

        // Update subscription with new price
        updateData = {
          items: [
            {
              id: subscription.items.data[0].id,
              price: priceId,
            },
          ],
          metadata: {
            ...subscription.metadata,
            plan,
          },
          proration_behavior: 'always_invoice',
        };

        logger.info(`Changing plan for restaurant ${restaurantId}`, {
          subscriptionId,
          fromPlan: restaurant.subscription.plan,
          toPlan: plan,
          priceId,
        });
        break;
      }

      case 'extend_subscription': {
        if (!days || days < 1 || days > 365) {
          throw new Error('Days must be between 1 and 365');
        }

        // For extension, we only update metadata and ensure subscription is not cancelled
        // The actual date extension is handled in MongoDB (admin controller)
        updateData = {
          cancel_at_period_end: false, // Remove cancellation if present
          metadata: {
            ...subscription.metadata,
            extendedByAdmin: days.toString(),
            extensionDays: days.toString(),
          },
        };

        logger.info(`Extending subscription for restaurant ${restaurantId}`, {
          subscriptionId,
          days,
          note: 'Date extension handled in MongoDB, metadata updated in Stripe',
        });
        break;
      }

      case 'activate': {
        // Reactivate subscription (remove cancellation at period end)
        const activatePlan = plan || restaurant.subscription.plan || 'starter';

        updateData = {
          cancel_at_period_end: false,
          metadata: {
            ...subscription.metadata,
            reactivatedByAdmin: new Date().toISOString(),
            plan: activatePlan,
          },
        };

        // If plan is provided and different from current, also update price
        if (plan && restaurant.subscription.plan !== plan) {
          const priceId = STRIPE_CONFIG.products[plan].priceId;
          if (priceId) {
            updateData.items = [
              {
                id: subscription.items.data[0].id,
                price: priceId,
              },
            ];
          }
        }

        logger.info(`Activating subscription for restaurant ${restaurantId}`, {
          subscriptionId,
          plan: activatePlan,
          wasCancelled: (subscription as any).cancel_at_period_end,
        });
        break;
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    // Apply update if we have changes
    let updatedSubscription = subscription;
    if (Object.keys(updateData).length > 0) {
      updatedSubscription = await stripe.subscriptions.update(subscriptionId, updateData);
    }

    logger.info(`Subscription updated successfully for restaurant ${restaurantId}`, {
      subscriptionId,
      action,
      plan,
      days,
    });

    return updatedSubscription;
  } catch (error) {
    logger.error(`Failed to update subscription for restaurant ${params.restaurantId}:`, {
      action: params.action,
      plan: params.plan,
      days: params.days,
      error: (error as any).message,
    });
    throw error;
  }
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(params: {
  restaurantId: string;
  immediately?: boolean;
}): Promise<Stripe.Subscription> {
  try {
    const { restaurantId, immediately = false } = params;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || !restaurant.subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    const subscription = await stripe.subscriptions.update(
      restaurant.subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: !immediately,
        ...(immediately && { cancel_at: Math.floor(Date.now() / 1000) }),
      }
    );

    // Update restaurant
    if (restaurant.subscription) {
      restaurant.subscription.cancelAtPeriodEnd = (subscription as any).cancel_at_period_end;
      if (immediately) {
        restaurant.subscription.status = 'cancelled';
      }
      await restaurant.save();
    }

    logger.info(`Subscription cancelled for restaurant ${restaurantId}`, {
      immediately,
      subscriptionId: subscription.id,
    });

    return subscription;
  } catch (error) {
    logger.error('Failed to cancel subscription:', error);
    throw error;
  }
}

/**
 * Handle setup intent failed (e.g., 3D Secure authentication failure)
 */
async function handleSetupIntentFailed(setupIntent: Stripe.SetupIntent): Promise<void> {
  logger.warn('Setup intent failed:', {
    setupIntentId: setupIntent.id,
    customerId: setupIntent.customer,
    lastError: setupIntent.last_setup_error,
    status: setupIntent.status,
  });

  // Optional: Could send email to user about payment failure
  // But since checkout wasn't completed, restaurant remains inactive
  // User will need to retry payment via /signup/cancel page
}

/**
 * Handle setup intent succeeded
 */
async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent): Promise<void> {
  logger.info('Setup intent succeeded:', {
    setupIntentId: setupIntent.id,
    customerId: setupIntent.customer,
    paymentMethodId: setupIntent.payment_method,
    status: setupIntent.status,
  });
}
