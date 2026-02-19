import * as brevo from '@getbrevo/brevo';
import retry from 'async-retry';
import { readFileSync } from 'fs';
import { join } from 'path';
import brevoConfig from '../config/brevo';
import logger from '../utils/logger';
import { generatePasswordResetToken, generateReservationCancelToken } from './tokenService';

// Types
interface EmailParams {
  [key: string]: string | number | undefined;
}

interface EmailOptions {
  to: string;
  toName: string;
  subject: string;
  templateName: string;
  params: EmailParams;
  replyTo?: {
    email: string;
    name: string;
  };
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

interface User {
  email: string;
  name?: string;
}

interface Restaurant {
  _id: string;
  name: string;
  email: string;
  phone: string;
}

interface Reservation {
  _id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  date: Date | string;
  time: string;
  partySize: number;
  restaurantId: string;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

// Quota check stub (will be implemented in Story 1.7)
const canSendEmail = async (): Promise<boolean> => {
  return true; // Always allow for now
};

// Initialize Brevo API
let apiInstance: brevo.TransactionalEmailsApi | null = null;

function getBrevoApiInstance(): brevo.TransactionalEmailsApi {
  if (!apiInstance) {
    apiInstance = new brevo.TransactionalEmailsApi();
    if (brevoConfig.apiKey) {
      apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    }
  }
  return apiInstance;
}

/**
 * Load email template and replace variables
 *
 * @param templateName - Template file name (without .html extension)
 * @param params - Variables to replace in template
 * @returns HTML content with replaced variables
 */
function loadTemplate(templateName: string, params: EmailParams): string {
  const templatePath = join(__dirname, '../templates/emails', `${templateName}.html`);
  let html = readFileSync(templatePath, 'utf-8');

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

/**
 * Generic email sending function via Brevo API with HTML templates
 *
 * @param options - Email options
 * @param options.to - Recipient email address
 * @param options.toName - Recipient name
 * @param options.subject - Email subject
 * @param options.templateName - Template file name (without .html)
 * @param options.params - Template parameters (dynamic variables)
 * @param options.replyTo - Optional reply-to email
 * @returns Promise with email result
 */
async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { to, toName, subject, templateName, params, replyTo } = options;

  try {
    // Feature flag check
    if (!brevoConfig.enabled) {
      logger.info('Email sending disabled via EMAIL_ENABLED flag');
      return { success: true, skipped: true };
    }

    // Quota check (stub for now - Story 1.7)
    const hasQuota = await canSendEmail();
    if (!hasQuota) {
      throw new Error('Quota quotidien atteint (300 emails/jour)');
    }

    // Load and render HTML template
    const htmlContent = loadTemplate(templateName, params);

    // Prepare email
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: to, name: toName }];
    sendSmtpEmail.sender = {
      email: brevoConfig.senderEmail,
      name: brevoConfig.senderName,
    };
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.textContent = generatePlainTextFromHtml(htmlContent);

    // Optional reply-to for restaurant emails
    if (replyTo) {
      sendSmtpEmail.replyTo = replyTo;
    }

    const api = getBrevoApiInstance();

    // Send with retry logic
    const result = await retry(
      async (bail: (error: Error) => void) => {
        try {
          return await api.sendTransacEmail(sendSmtpEmail);
        } catch (error: any) {
          // Don't retry on client errors (400-499)
          if (error.response && error.response.status >= 400 && error.response.status < 500) {
            bail(error);
            return;
          }
          throw error;
        }
      },
      {
        retries: brevoConfig.retry.maxAttempts,
        minTimeout: brevoConfig.retry.minTimeout,
        maxTimeout: brevoConfig.retry.maxTimeout,
        onRetry: (error: Error, attempt: number) => {
          logger.warn(`Email retry attempt ${attempt}`, {
            to,
            templateName,
            error: error.message,
          });
        },
      }
    );

    logger.info('Email sent successfully', {
      to,
      subject,
      templateName,
      messageId: result?.body?.messageId,
    });

    return { success: true, messageId: result?.body?.messageId };
  } catch (error: any) {
    logger.error('Email sending failed', {
      to,
      subject,
      templateName,
      error: error.message,
      stack: error.stack,
    });

    return { success: false, error: error.message };
  }
}

/**
 * FORMAT DATE HELPER
 * Convert date to French locale format (e.g., "12 janvier 2026")
 */
function formatDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * ESCAPE HTML HELPER
 * Escape HTML special characters to prevent XSS attacks in emails
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * GENERATE PLAIN TEXT FROM HTML HELPER
 * Convert HTML email content to plain text for better email client compatibility
 */
function generatePlainTextFromHtml(html: string): string {
  // Remove CSS styles and scripts
  let text = html.replace(/<style[^>]*>.*?<\/style>/gis, '');
  text = text.replace(/<script[^>]*>.*?<\/script>/gis, '');

  // Replace common HTML elements with plain text equivalents
  text = text
    // Replace line breaks and paragraphs
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/table>/gi, '\n')
    // Replace list items
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    // Replace headings
    .replace(/<h[1-6][^>]*>/gi, '')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Remove all other HTML tags but keep content
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    // Trim and clean up line breaks
    .trim()
    .replace(/\n\s+\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n');

  // Extract URLs from anchor tags (basic extraction)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');

  // Ensure reasonable length
  if (text.length > 10000) {
    text = text.substring(0, 10000) + '...';
  }

  return text;
}

/**
 * 1. SEND PASSWORD RESET EMAIL
 *
 * Template: password-reset.html
 * Variables: userName, resetLink
 *
 * @param user - User object with email, name, and _id
 */
export async function sendPasswordResetEmail(user: User & { _id: string }): Promise<EmailResult> {
  // Generate JWT token for password reset
  const resetToken = generatePasswordResetToken(user._id);
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  return sendEmail({
    to: user.email,
    toName: user.name || user.email,
    subject: 'Réinitialisation de votre mot de passe - TableMaster',
    templateName: 'password-reset',
    params: {
      userName: user.name || 'Utilisateur',
      resetLink,
    },
  });
}

/**
 * 2. SEND PENDING RESERVATION EMAIL
 *
 * Sent when customer creates reservation from website (status: pending)
 *
 * Template: pending-reservation.html
 * Variables: customerName, restaurantName, reservationDate, reservationTime, partySize
 *
 * @param reservation - Reservation object
 * @param restaurant - Restaurant object
 */
export async function sendPendingReservationEmail(
  reservation: Reservation,
  restaurant: Restaurant
): Promise<EmailResult> {
  return sendEmail({
    to: reservation.customerEmail,
    toName: reservation.customerName,
    subject: `Demande de réservation reçue - ${restaurant.name}`,
    templateName: 'pending-reservation',
    params: {
      customerName: reservation.customerName,
      restaurantName: restaurant.name,
      reservationDate: formatDate(reservation.date),
      reservationTime: reservation.time,
      partySize: reservation.partySize,
    },
  });
}

/**
 * 3. SEND CONFIRMATION EMAIL
 *
 * Sent when restaurant confirms the reservation
 *
 * Template: confirmation.html
 * Variables: customerName, restaurantName, restaurantPhone, restaurantEmail,
 *           reservationDate, reservationTime, partySize, cancellationLink
 *
 * @param reservation - Reservation object
 * @param restaurant - Restaurant object
 */
export async function sendConfirmationEmail(
  reservation: Reservation,
  restaurant: Restaurant
): Promise<EmailResult> {
  // Generate JWT token for reservation cancellation
  const cancellationToken = generateReservationCancelToken(
    reservation._id,
    reservation.restaurantId
  );
  const cancellationLink = `${process.env.BACKEND_URL}/api/public/reservations/cancel?token=${cancellationToken}`;

  return sendEmail({
    to: reservation.customerEmail,
    toName: reservation.customerName,
    subject: `Réservation confirmée - ${restaurant.name}`,
    templateName: 'confirmation',
    params: {
      customerName: reservation.customerName,
      restaurantName: restaurant.name,
      restaurantPhone: restaurant.phone,
      restaurantEmail: restaurant.email,
      reservationDate: formatDate(reservation.date),
      reservationTime: reservation.time,
      partySize: reservation.partySize,
      cancellationLink,
    },
    replyTo: {
      email: restaurant.email,
      name: restaurant.name,
    },
  });
}

/**
 * 4. SEND DIRECT CONFIRMATION EMAIL
 *
 * Sent when restaurant creates phone reservation directly (status: confirmed)
 *
 * Template: direct-confirmation.html
 * Variables: customerName, restaurantName, restaurantPhone, restaurantEmail,
 *           reservationDate, reservationTime, partySize, cancellationLink
 *
 * @param reservation - Reservation object
 * @param restaurant - Restaurant object
 */
export async function sendDirectConfirmationEmail(
  reservation: Reservation,
  restaurant: Restaurant
): Promise<EmailResult> {
  // Generate JWT token for reservation cancellation
  const cancellationToken = generateReservationCancelToken(
    reservation._id,
    reservation.restaurantId
  );
  const cancellationLink = `${process.env.BACKEND_URL}/api/public/reservations/cancel?token=${cancellationToken}`;

  return sendEmail({
    to: reservation.customerEmail,
    toName: reservation.customerName,
    subject: `Confirmation de réservation - ${restaurant.name}`,
    templateName: 'direct-confirmation',
    params: {
      customerName: reservation.customerName,
      restaurantName: restaurant.name,
      restaurantPhone: restaurant.phone,
      restaurantEmail: restaurant.email,
      reservationDate: formatDate(reservation.date),
      reservationTime: reservation.time,
      partySize: reservation.partySize,
      cancellationLink,
    },
    replyTo: {
      email: restaurant.email,
      name: restaurant.name,
    },
  });
}

/**
 * 5. SEND CANCELLATION CONFIRMATION EMAIL
 *
 * Sent after customer cancels reservation from email link
 *
 * Template: cancellation.html
 * Variables: customerName, restaurantName, reservationDate, reservationTime
 *
 * @param reservation - Reservation object
 * @param restaurant - Restaurant object
 */
export async function sendCancellationConfirmationEmail(
  reservation: Reservation,
  restaurant: Restaurant
): Promise<EmailResult> {
  return sendEmail({
    to: reservation.customerEmail,
    toName: reservation.customerName,
    subject: `Annulation confirmée - ${restaurant.name}`,
    templateName: 'cancellation',
    params: {
      customerName: reservation.customerName,
      restaurantName: restaurant.name,
      reservationDate: formatDate(reservation.date),
      reservationTime: reservation.time,
    },
  });
}

/**
 * 6. SEND RESTAURANT NOTIFICATION EMAIL
 *
 * Sent to restaurant when reservation is created, updated, or cancelled
 *
 * Template: restaurant-notification.html
 * Variables: actionTitle, actionVerb, actionColor, customerName, customerEmail,
 *           customerPhone, reservationDate, reservationTime, partySize, status, notesSection
 *
 * @param reservation - Reservation object
 * @param restaurant - Restaurant object
 * @param action - 'created' | 'updated' | 'cancelled'
 */
export async function sendRestaurantNotificationEmail(
  reservation: Reservation,
  restaurant: Restaurant,
  action: 'created' | 'updated' | 'cancelled'
): Promise<EmailResult> {
  const actionConfig = {
    created: {
      title: 'Nouvelle réservation',
      verb: 'créée',
      color: '#2563eb', // blue
    },
    updated: {
      title: 'Réservation modifiée',
      verb: 'modifiée',
      color: '#f59e0b', // amber
    },
    cancelled: {
      title: 'Réservation annulée',
      verb: 'annulée',
      color: '#dc2626', // red
    },
  };

  const config = actionConfig[action];

  // Format notes section if notes exist (escape HTML to prevent XSS)
  let notesSection = '';
  if (reservation.notes && reservation.notes.trim() !== '') {
    const escapedNotes = escapeHtml(reservation.notes);
    notesSection = `<p style="margin: 8px 0;"><strong style="color: #4b5563;">Notes :</strong> <span style="color: #1f2937;">${escapedNotes}</span></p>`;
  }

  return sendEmail({
    to: restaurant.email,
    toName: restaurant.name,
    subject: `[TableMaster] ${config.title} - ${reservation.customerName}`,
    templateName: 'restaurant-notification',
    params: {
      actionTitle: config.title,
      actionVerb: config.verb,
      actionColor: config.color,
      customerName: reservation.customerName,
      customerEmail: reservation.customerEmail,
      customerPhone: reservation.customerPhone || '',
      reservationDate: formatDate(reservation.date),
      reservationTime: reservation.time,
      partySize: reservation.partySize,
      status: reservation.status,
      notesSection,
    },
  });
}

/**
 * 7. SEND RESERVATION UPDATE EMAIL
 *
 * Sent to customer when reservation is updated (not status to confirmed)
 *
 * Template: reservation-update.html
 * Variables: customerName, restaurantName, reservationDate, reservationTime, partySize, status
 *
 * @param reservation - Reservation object
 * @param restaurant - Restaurant object
 */
export async function sendReservationUpdateEmail(
  reservation: Reservation,
  restaurant: Restaurant
): Promise<EmailResult> {
  const statusMap = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    cancelled: 'Annulée',
    completed: 'Terminée',
  };

  const statusText =
    statusMap[reservation.status as keyof typeof statusMap] || reservation.status || '';

  return sendEmail({
    to: reservation.customerEmail,
    toName: reservation.customerName,
    subject: `Mise à jour de réservation - ${restaurant.name}`,
    templateName: 'reservation-update',
    params: {
      customerName: reservation.customerName,
      restaurantName: restaurant.name,
      reservationDate: formatDate(reservation.date),
      reservationTime: reservation.time,
      partySize: reservation.partySize,
      status: statusText,
    },
  });
}

/**
 * 8. SEND REVIEW REQUEST EMAIL
 *
 * Sent when reservation is marked as completed - asks customer to leave a Google review
 *
 * Template: review-request.html
 * Variables: customerName, restaurantName, restaurantPhone, restaurantEmail, googleReviewLink
 *
 * @param reservation - Reservation object
 * @param restaurant - Restaurant object (with googleReviewLink)
 */
export async function sendReviewRequestEmail(
  reservation: Reservation,
  restaurant: Restaurant & { googleReviewLink?: string }
): Promise<EmailResult> {
  // Only send if restaurant has a Google review link
  if (!restaurant.googleReviewLink) {
    logger.info(
      `Skipping review request email - no Google review link set for restaurant ${restaurant._id}`
    );
    return { success: true, skipped: true };
  }

  logger.info(
    `Sending review request email to ${reservation.customerEmail} for restaurant ${restaurant.name} with Google review link: ${restaurant.googleReviewLink}`
  );
  return sendEmail({
    to: reservation.customerEmail,
    toName: reservation.customerName,
    subject: `Votre réservation chez ${restaurant.name}`,
    templateName: 'review-request',
    params: {
      customerName: reservation.customerName,
      restaurantName: restaurant.name,
      restaurantPhone: restaurant.phone,
      restaurantEmail: restaurant.email,
      googleReviewLink: restaurant.googleReviewLink,
    },
    replyTo: {
      email: restaurant.email,
      name: restaurant.name,
    },
  });
}

/**
 * 9. SEND QUOTA WARNING EMAIL
 *
 * Sent to restaurant when approaching or reaching monthly reservation quota (Starter plan)
 *
 * Template: quota-warning.html
 * Variables: restaurantName, message, current, limit, remaining, percentage,
 *           headerColor, headerIcon, headerTitle, alertBg, alertBorder, alertColor, ctaSection, dashboardLink
 *
 * @param restaurant - Restaurant object with email
 * @param quotaInfo - Quota information object
 * @param level - Warning level: 80, 90, or 100 (percentage)
 */
export async function sendQuotaWarningEmail(
  restaurant: { _id: string; name: string; email: string },
  quotaInfo: { current: number; limit: number; remaining: number; percentage: number },
  level: 80 | 90 | 100
): Promise<EmailResult> {
  // Define email configuration based on warning level
  const levelConfig = {
    80: {
      headerColor: '#f59e0b', // amber
      headerIcon: '',
      headerTitle: 'Quota bientôt atteint',
      alertBg: '#fffbeb',
      alertBorder: '#f59e0b',
      alertColor: '#92400e',
      message: `Vous avez utilisé <strong>${quotaInfo.percentage}%</strong> de votre quota mensuel de réservations. Il vous reste encore <strong>${quotaInfo.remaining} réservations</strong> ce mois.`,
      ctaSection: `<div style="background-color: #dbeafe; padding: 15px; border-radius: 4px; margin-top: 20px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
           <strong>Astuce :</strong> Passez au plan Pro pour des réservations illimitées et ne plus vous soucier des limites mensuelles.
        </p>
      </div>`,
    },
    90: {
      headerColor: '#f97316', // orange
      headerIcon: '',
      headerTitle: 'Attention : Quota presque atteint',
      alertBg: '#fff7ed',
      alertBorder: '#f97316',
      alertColor: '#7c2d12',
      message: `<strong>Attention !</strong> Vous avez utilisé <strong>${quotaInfo.percentage}%</strong> de votre quota mensuel. Il ne vous reste que <strong>${quotaInfo.remaining} réservations</strong> ce mois.`,
      ctaSection: `<div style="background-color: #dbeafe; padding: 15px; border-radius: 4px; margin-top: 20px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
           <strong>Recommandé :</strong> Pour éviter les interruptions, passez dès maintenant au plan Pro pour bénéficier de réservations illimitées.
        </p>
      </div>`,
    },
    100: {
      headerColor: '#dc2626', // red
      headerIcon: '',
      headerTitle: 'Quota mensuel atteint',
      alertBg: '#fef2f2',
      alertBorder: '#dc2626',
      alertColor: '#991b1b',
      message: `<strong>Limite atteinte !</strong> Vous avez atteint votre quota mensuel de <strong>${quotaInfo.limit} réservations</strong>. Vous ne pouvez plus créer de nouvelles réservations ce mois.`,
      ctaSection: `<div style="background-color: #fee2e2; padding: 15px; border-radius: 4px; margin-top: 20px; border: 2px solid #dc2626;">
        <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: bold;">
           Action requise : Passez au plan Pro immédiatement pour continuer à accepter des réservations.
        </p>
      </div>`,
    },
  };

  const config = levelConfig[level];
  const dashboardLink = `${process.env.FRONTEND_URL}/dashboard`;

  return sendEmail({
    to: restaurant.email,
    toName: restaurant.name,
    subject: `[TableMaster] ${config.headerTitle} - ${quotaInfo.current}/${quotaInfo.limit} réservations`,
    templateName: 'quota-warning',
    params: {
      restaurantName: restaurant.name,
      message: config.message,
      current: quotaInfo.current,
      limit: quotaInfo.limit,
      remaining: quotaInfo.remaining,
      percentage: quotaInfo.percentage,
      headerColor: config.headerColor,
      headerIcon: config.headerIcon,
      headerTitle: config.headerTitle,
      alertBg: config.alertBg,
      alertBorder: config.alertBorder,
      alertColor: config.alertColor,
      ctaSection: config.ctaSection,
      dashboardLink,
    },
  });
}

/**
 * 10. SEND WELCOME EMAIL
 *
 * Sent when new restaurant account is created
 *
 * Template: welcome.html
 * Variables: userName, restaurantName, dashboardLink
 *
 * @param user - User object with name and email
 * @param restaurant - Restaurant object with name
 */
export async function sendWelcomeEmail(
  user: { name?: string; email: string },
  restaurant: { name: string }
): Promise<EmailResult> {
  const dashboardLink = `${process.env.FRONTEND_URL}/dashboard`;

  return sendEmail({
    to: user.email,
    toName: user.name || user.email,
    subject: 'Bienvenue sur TableMaster',
    templateName: 'welcome',
    params: {
      userName: user.name || 'Restaurateur',
      restaurantName: restaurant.name,
      dashboardLink,
    },
  });
}

/**
 * 11. SEND SUBSCRIPTION CONFIRMED EMAIL
 *
 * Sent after successful Stripe payment and subscription creation
 *
 * Template: subscription-confirmed.html
 * Variables: userName, planName, price, billingPeriod, nextBillingDate,
 *           isProPlan, quotaLimit, dashboardLink, billingLink
 *
 * @param user - User object with name and email
 * @param subscriptionInfo - Subscription details
 */
export async function sendSubscriptionConfirmedEmail(
  user: { name?: string; email: string },
  subscriptionInfo: {
    planName: string;
    price: string;
    billingPeriod: string;
    nextBillingDate: string;
    isProPlan: boolean;
    quotaLimit?: number;
  }
): Promise<EmailResult> {
  const dashboardLink = `${process.env.FRONTEND_URL}/dashboard`;
  const billingLink = `${process.env.FRONTEND_URL}/dashboard/billing`;

  // Styles for conditional display
  const proSectionStyle = subscriptionInfo.isProPlan ? 'display: block;' : 'display: none;';
  const starterSectionStyle = subscriptionInfo.isProPlan ? 'display: none;' : 'display: block;';

  return sendEmail({
    to: user.email,
    toName: user.name || user.email,
    subject: `Abonnement ${subscriptionInfo.planName} confirmé - TableMaster`,
    templateName: 'subscription-confirmed',
    params: {
      userName: user.name || 'Restaurateur',
      planName: subscriptionInfo.planName,
      price: subscriptionInfo.price,
      billingPeriod: subscriptionInfo.billingPeriod,
      nextBillingDate: subscriptionInfo.nextBillingDate,
      isProPlan: subscriptionInfo.isProPlan ? 'true' : '',
      quotaLimit: subscriptionInfo.quotaLimit || 0,
      dashboardLink,
      billingLink,
      proSectionStyle,
      starterSectionStyle,
    },
  });
}

/**
 * Send subscription extended email (when admin offers free days)
 */
export async function sendSubscriptionExtendedEmail(
  restaurant: { name: string; email: string },
  extensionInfo: {
    daysOffered: number;
    previousEndDate: string;
    newEndDate: string;
  }
): Promise<EmailResult> {
  const dashboardLink = `${process.env.FRONTEND_URL}/dashboard`;

  return sendEmail({
    to: restaurant.email,
    toName: restaurant.name,
    subject: `${extensionInfo.daysOffered} jour(s) offert(s) sur votre abonnement - TableMaster`,
    templateName: 'subscription-extended',
    params: {
      restaurantName: restaurant.name,
      daysOffered: extensionInfo.daysOffered,
      previousEndDate: extensionInfo.previousEndDate,
      newEndDate: extensionInfo.newEndDate,
      dashboardLink,
    },
  });
}

/**
 * Send plan downgrade email (when changing from Pro to Starter)
 */
export async function sendPlanDowngradeEmail(
  restaurant: { name: string; email: string },
  planInfo: {
    fromPlan: string;
    toPlan: string;
    quotaLimit: string;
    monthlyPrice: string;
  }
): Promise<EmailResult> {
  const dashboardLink = `${process.env.FRONTEND_URL}/dashboard`;
  const upgradeLink = `${process.env.FRONTEND_URL}/dashboard/settings/billing`;

  return sendEmail({
    to: restaurant.email,
    toName: restaurant.name,
    subject: `Votre abonnement TableMaster a été modifié - Changement de plan`,
    templateName: 'plan-downgrade',
    params: {
      restaurantName: restaurant.name,
      fromPlan: planInfo.fromPlan,
      toPlan: planInfo.toPlan,
      quotaLimit: planInfo.quotaLimit,
      monthlyPrice: planInfo.monthlyPrice,
      dashboardLink,
      upgradeLink,
    },
  });
}

/**
 * Send trial reminder email (7 days before trial ends)
 */
export async function sendTrialReminderEmail(
  restaurant: { name: string; email: string },
  trialEndDate: Date
): Promise<EmailResult> {
  const dashboardLink = `${process.env.FRONTEND_URL}/dashboard`;
  const billingLink = `${process.env.FRONTEND_URL}/dashboard/settings/billing`;
  const trialEndFormatted = trialEndDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return sendEmail({
    to: restaurant.email,
    toName: restaurant.name,
    subject: `Votre essai gratuit TableMaster se termine bientôt`,
    templateName: 'trial-reminder',
    params: {
      restaurantName: restaurant.name,
      trialEndDate: trialEndFormatted,
      dashboardLink,
      billingLink,
    },
  });
}

// Export sendEmail for testing purposes
export { sendEmail };

// Reset API instance for testing
export function resetApiInstance(): void {
  apiInstance = null;
}
