export type Locale = 'fr' | 'en';

type Params = Record<string, string | number>;

const fr: Record<string, string> = {
  // Subjects
  'subject.passwordReset': 'Réinitialisation de votre mot de passe - TableMaster',
  'subject.passwordChanged': 'Votre mot de passe a été modifié - TableMaster',
  'subject.pendingReservation': 'Demande de réservation reçue - {restaurant}',
  'subject.confirmation': 'Réservation confirmée - {restaurant}',
  'subject.directConfirmation': 'Confirmation de réservation - {restaurant}',
  'subject.cancellation': 'Annulation confirmée - {restaurant}',
  'subject.restaurantNotification': '[TableMaster] {title} - {customer}',
  'subject.reservationUpdate': 'Mise à jour de réservation - {restaurant}',
  'subject.reviewRequest': 'Votre réservation chez {restaurant}',
  'subject.quotaWarning': '[TableMaster] {title} - {current}/{limit} réservations',
  'subject.welcome': 'Bienvenue sur TableMaster',
  'subject.subscriptionConfirmed': 'Abonnement {plan} confirmé - TableMaster',
  'subject.subscriptionExtended': '{days} jour(s) offert(s) sur votre abonnement - TableMaster',
  'subject.planDowngrade': 'Votre abonnement TableMaster a été modifié - Changement de plan',
  'subject.trialReminder': 'Votre essai gratuit TableMaster se termine bientôt',
  'subject.paymentCompletion': 'Finalisez votre inscription sur TableMaster',
  'subject.reminder': 'Rappel : Réservation demain - {restaurant}',
  'subject.emailVerification': 'Vérifiez votre adresse email - TableMaster',
  'subject.commercialInvitation': '{name} — Finalisez votre inscription TableMaster',
  'subject.contactMessage': 'Nouveau message de contact - TableMaster',

  // Reservation statuses
  'status.pending': 'En attente',
  'status.confirmed': 'Confirmée',
  'status.cancelled': 'Annulée',
  'status.completed': 'Terminée',

  // Restaurant notification actions
  'action.created.title': 'Nouvelle réservation',
  'action.created.verb': 'créée',
  'action.updated.title': 'Réservation modifiée',
  'action.updated.verb': 'modifiée',
  'action.cancelled.title': 'Réservation annulée',
  'action.cancelled.verb': 'annulée',
  'notesLabel': 'Notes :',

  // Welcome
  'welcome.trial': "{days} jours d'essai gratuit",
  'welcome.noTrial': 'Votre abonnement démarre immédiatement',
  'welcome.userName': 'Restaurateur',

  // Commercial invitation
  'commercial.planPro': 'Pro (69€/mois)',
  'commercial.planStarter': 'Starter (39€/mois)',
  'commercial.trial': "{days} jours d'essai gratuit",
  'commercial.noTrial': "Sans période d'essai",
  'commercial.discount': "-{percent}% sur le premier mois · valable 24h",
  'commercial.discountInfo': "{discount}. Aucun prélèvement avant la fin de l'essai.",
  'commercial.noDiscountInfo': "Aucun prélèvement avant la fin de l'essai.",

  // Quota warnings
  'quota.80.headerTitle': 'Quota bientôt atteint',
  'quota.80.message': 'Vous avez utilisé <strong>{percentage}%</strong> de votre quota mensuel de réservations. Il vous reste encore <strong>{remaining} réservations</strong> ce mois.',
  'quota.80.cta': '<div style="background-color: #dbeafe; padding: 15px; border-radius: 4px; margin-top: 20px;"><p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Astuce :</strong> Passez au plan Pro pour des réservations illimitées et ne plus vous soucier des limites mensuelles.</p></div>',
  'quota.90.headerTitle': 'Attention : Quota presque atteint',
  'quota.90.message': '<strong>Attention !</strong> Vous avez utilisé <strong>{percentage}%</strong> de votre quota mensuel. Il ne vous reste que <strong>{remaining} réservations</strong> ce mois.',
  'quota.90.cta': '<div style="background-color: #dbeafe; padding: 15px; border-radius: 4px; margin-top: 20px;"><p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Recommandé :</strong> Pour éviter les interruptions, passez dès maintenant au plan Pro pour bénéficier de réservations illimitées.</p></div>',
  'quota.100.headerTitle': 'Quota mensuel atteint',
  'quota.100.message': '<strong>Limite atteinte !</strong> Vous avez atteint votre quota mensuel de <strong>{limit} réservations</strong>. Vous ne pouvez plus créer de nouvelles réservations ce mois.',
  'quota.100.cta': '<div style="background-color: #fee2e2; padding: 15px; border-radius: 4px; margin-top: 20px; border: 2px solid #dc2626;"><p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: bold;">Action requise : Passez au plan Pro immédiatement pour continuer à accepter des réservations.</p></div>',
};

const en: Record<string, string> = {
  'subject.passwordReset': 'Reset your password - TableMaster',
  'subject.passwordChanged': 'Your password has been changed - TableMaster',
  'subject.pendingReservation': 'Reservation request received - {restaurant}',
  'subject.confirmation': 'Reservation confirmed - {restaurant}',
  'subject.directConfirmation': 'Reservation confirmation - {restaurant}',
  'subject.cancellation': 'Cancellation confirmed - {restaurant}',
  'subject.restaurantNotification': '[TableMaster] {title} - {customer}',
  'subject.reservationUpdate': 'Reservation update - {restaurant}',
  'subject.reviewRequest': 'Your reservation at {restaurant}',
  'subject.quotaWarning': '[TableMaster] {title} - {current}/{limit} reservations',
  'subject.welcome': 'Welcome to TableMaster',
  'subject.subscriptionConfirmed': '{plan} subscription confirmed - TableMaster',
  'subject.subscriptionExtended': '{days} free day(s) added to your subscription - TableMaster',
  'subject.planDowngrade': 'Your TableMaster subscription has changed - Plan change',
  'subject.trialReminder': 'Your TableMaster free trial is ending soon',
  'subject.paymentCompletion': 'Complete your TableMaster registration',
  'subject.reminder': 'Reminder: Reservation tomorrow - {restaurant}',
  'subject.emailVerification': 'Verify your email address - TableMaster',
  'subject.commercialInvitation': '{name} — Complete your TableMaster registration',
  'subject.contactMessage': 'New contact message - TableMaster',

  'status.pending': 'Pending',
  'status.confirmed': 'Confirmed',
  'status.cancelled': 'Cancelled',
  'status.completed': 'Completed',

  'action.created.title': 'New reservation',
  'action.created.verb': 'created',
  'action.updated.title': 'Reservation updated',
  'action.updated.verb': 'updated',
  'action.cancelled.title': 'Reservation cancelled',
  'action.cancelled.verb': 'cancelled',
  'notesLabel': 'Notes:',

  'welcome.trial': '{days}-day free trial',
  'welcome.noTrial': 'Your subscription starts immediately',
  'welcome.userName': 'Restaurant owner',

  'commercial.planPro': 'Pro (€69/month)',
  'commercial.planStarter': 'Starter (€39/month)',
  'commercial.trial': '{days}-day free trial',
  'commercial.noTrial': 'No trial period',
  'commercial.discount': '-{percent}% off your first month · valid for 24h',
  'commercial.discountInfo': '{discount}. No charge until the end of the trial.',
  'commercial.noDiscountInfo': 'No charge until the end of the trial.',

  'quota.80.headerTitle': 'Quota almost reached',
  'quota.80.message': 'You have used <strong>{percentage}%</strong> of your monthly reservation quota. You still have <strong>{remaining} reservations</strong> left this month.',
  'quota.80.cta': '<div style="background-color: #dbeafe; padding: 15px; border-radius: 4px; margin-top: 20px;"><p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Tip:</strong> Upgrade to Pro for unlimited reservations and never worry about monthly limits again.</p></div>',
  'quota.90.headerTitle': 'Warning: Quota almost reached',
  'quota.90.message': '<strong>Attention!</strong> You have used <strong>{percentage}%</strong> of your monthly quota. You only have <strong>{remaining} reservations</strong> left this month.',
  'quota.90.cta': '<div style="background-color: #dbeafe; padding: 15px; border-radius: 4px; margin-top: 20px;"><p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Recommended:</strong> To avoid interruptions, upgrade to Pro now for unlimited reservations.</p></div>',
  'quota.100.headerTitle': 'Monthly quota reached',
  'quota.100.message': '<strong>Limit reached!</strong> You have reached your monthly quota of <strong>{limit} reservations</strong>. You can no longer create new reservations this month.',
  'quota.100.cta': '<div style="background-color: #fee2e2; padding: 15px; border-radius: 4px; margin-top: 20px; border: 2px solid #dc2626;"><p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: bold;">Action required: Upgrade to Pro immediately to keep accepting reservations.</p></div>',
};

const dictionaries: Record<Locale, Record<string, string>> = { fr, en };

/**
 * Resolve a message key for the given locale, with `{param}` interpolation.
 */
export function t(locale: Locale, key: string, params: Params = {}): string {
  const dict = dictionaries[locale] || dictionaries.fr;
  let message = dict[key] ?? dictionaries.fr[key] ?? key;

  Object.keys(params).forEach((k) => {
    const value = params[k];
    if (value !== undefined && value !== null) {
      message = message.split(`{${k}}`).join(String(value));
    }
  });

  return message;
}

/**
 * Normalize an arbitrary locale value to a supported Locale.
 */
export function normalizeLocale(locale?: unknown, fallback: Locale = 'fr'): Locale {
  return locale === 'en' ? 'en' : fallback;
}

/**
 * Format a date according to a locale (for email bodies).
 */
export function formatDateLocale(
  dateInput: Date | string,
  locale: Locale = 'fr'
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
