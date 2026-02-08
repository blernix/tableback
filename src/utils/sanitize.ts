/**
 * Sanitization utilities to prevent XSS and injection attacks
 */

/**
 * Remove HTML tags and dangerous characters from a string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return (
    input
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove script content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers (onclick, onerror, etc.)
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove data: protocol (can be used for XSS)
      .replace(/data:text\/html/gi, '')
      // Trim whitespace
      .trim()
  );
}

/**
 * Sanitize email - only allow valid email characters
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  // Only keep characters valid in emails
  return email
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, '')
    .trim();
}

/**
 * Sanitize phone number - only allow digits, spaces, +, -, (, )
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') {
    return '';
  }

  // Only keep valid phone characters
  return phone.replace(/[^0-9+\-() ]/g, '').trim();
}

/**
 * Sanitize notes/text fields - allow some formatting but remove dangerous content
 */
export function sanitizeNotes(notes: string): string {
  if (typeof notes !== 'string') {
    return '';
  }

  return (
    notes
      // Remove HTML tags except safe ones (none for now)
      .replace(/<[^>]*>/g, '')
      // Remove script content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Normalize whitespace but keep newlines
      .replace(/[ \t]+/g, ' ')
      .trim()
  );
}

/**
 * Validate and sanitize a complete reservation input object
 */
export interface SanitizedReservationInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  time: string;
  numberOfGuests: number;
  notes?: string;
  _honeypot?: string; // Bot detection field
}

export function sanitizeReservationInput(input: any): SanitizedReservationInput {
  return {
    customerName: sanitizeString(input.customerName || ''),
    customerEmail: sanitizeEmail(input.customerEmail || ''),
    customerPhone: sanitizePhone(input.customerPhone || ''),
    date: String(input.date || '').trim(),
    time: String(input.time || '').trim(),
    numberOfGuests: parseInt(input.numberOfGuests) || 0,
    notes: input.notes ? sanitizeNotes(input.notes) : '',
    _honeypot: input._honeypot ? String(input._honeypot) : '',
  };
}
