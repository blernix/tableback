import * as brevo from '@getbrevo/brevo';
import retry from 'async-retry';
import { readFileSync } from 'fs';
import { join } from 'path';
import brevoConfig from '../config/brevo';
import logger from '../utils/logger';
import {
  generatePasswordResetToken,
  generateReservationCancelToken,
} from './tokenService';

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
 * 1. SEND PASSWORD RESET EMAIL
 *
 * Template: password-reset.html
 * Variables: userName, resetLink
 *
 * @param user - User object with email, name, and _id
 */
export async function sendPasswordResetEmail(
  user: User & { _id: string }
): Promise<EmailResult> {
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
  const cancellationToken = generateReservationCancelToken(reservation._id, reservation.restaurantId);
  const cancellationLink = `${process.env.BACKEND_URL}/api/public/reservations/cancel?token=${cancellationToken}`;

  return sendEmail({
    to: reservation.customerEmail,
    toName: reservation.customerName,
    subject: `✅ Réservation confirmée - ${restaurant.name}`,
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
  const cancellationToken = generateReservationCancelToken(reservation._id, reservation.restaurantId);
  const cancellationLink = `${process.env.BACKEND_URL}/api/public/reservations/cancel?token=${cancellationToken}`;

  return sendEmail({
    to: reservation.customerEmail,
    toName: reservation.customerName,
    subject: `✅ Confirmation de réservation - ${restaurant.name}`,
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

  const statusText = statusMap[reservation.status as keyof typeof statusMap] || reservation.status || '';

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

// Export sendEmail for testing purposes
export { sendEmail };

// Reset API instance for testing
export function resetApiInstance(): void {
  apiInstance = null;
}
