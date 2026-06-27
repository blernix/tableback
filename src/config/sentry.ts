import * as Sentry from '@sentry/node';

export const captureError = (error: Error, context?: Record<string, unknown>) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, { level });
};

export const setUserContext = (user: { id?: string; email?: string; restaurantId?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    ip_address: '{{auto}}',
    extras: {
      restaurantId: user.restaurantId,
    },
  });
};

export const clearUserContext = () => {
  Sentry.setUser(null);
};

export const flushSentry = async (timeout = 2000) => {
  try {
    await Sentry.flush(timeout);
  } catch (error) {
    // Silent failure — Sentry may already be shut down
  }
};
