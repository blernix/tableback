import * as brevo from '@getbrevo/brevo';
import {
  sendEmail,
  sendPasswordResetEmail,
  sendPendingReservationEmail,
  sendConfirmationEmail,
  sendDirectConfirmationEmail,
  sendCancellationConfirmationEmail,
  resetApiInstance,
} from '../../services/emailService';

// Mock Brevo SDK
jest.mock('@getbrevo/brevo');

// Mock tokenService
jest.mock('../../services/tokenService', () => ({
  generatePasswordResetToken: jest.fn(() => 'mock-reset-token-123'),
  generateReservationCancelToken: jest.fn(() => 'mock-cancel-token-456'),
}));

describe('EmailService', () => {
  let mockSendTransacEmail: jest.Mock;
  let mockSetApiKey: jest.Mock;
  let mockApiInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the singleton API instance
    resetApiInstance();

    // Setup mock API instance
    mockSendTransacEmail = jest.fn().mockResolvedValue({
      body: { messageId: 'test-message-id-123' },
      response: { statusCode: 200 },
    });

    mockSetApiKey = jest.fn();

    mockApiInstance = {
      sendTransacEmail: mockSendTransacEmail,
      setApiKey: mockSetApiKey,
    };

    // Mock the TransactionalEmailsApi constructor
    (brevo.TransactionalEmailsApi as any) = jest.fn(() => mockApiInstance);

    // Set test environment variables
    process.env.EMAIL_ENABLED = 'true';
    process.env.BREVO_API_KEY = 'test-api-key';
    process.env.EMAIL_SENDER = 'test@tablemaster.fr';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.BACKEND_URL = 'http://localhost:4000';
    process.env.JWT_SECRET = 'test-secret-key';
  });

  describe('sendEmail (generic function)', () => {
    it('should send email successfully with HTML template', async () => {
      const result = await sendEmail({
        to: 'test@example.com',
        toName: 'Test User',
        subject: 'Test Subject',
        templateName: 'password-reset',
        params: { userName: 'Test', resetLink: 'http://example.com/reset' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id-123');
      expect(mockSendTransacEmail).toHaveBeenCalled();

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.htmlContent).toBeDefined();
      expect(typeof emailData.htmlContent).toBe('string');
      expect(emailData.textContent).toBeDefined();
      expect(typeof emailData.textContent).toBe('string');
      expect(emailData.textContent.length).toBeGreaterThan(0);
    });

    it('should include sender information', async () => {
      await sendEmail({
        to: 'test@example.com',
        toName: 'Test User',
        subject: 'Test',
        templateName: 'password-reset',
        params: { userName: 'Test', resetLink: 'http://example.com/reset' },
      });

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.sender).toEqual({
        email: 'test@tablemaster.fr',
        name: 'TableMaster',
      });
    });

    it('should include reply-to when provided', async () => {
      await sendEmail({
        to: 'test@example.com',
        toName: 'Test User',
        subject: 'Test',
        templateName: 'password-reset',
        params: { userName: 'Test', resetLink: 'http://example.com/reset' },
        replyTo: {
          email: 'restaurant@example.com',
          name: 'Restaurant Name',
        },
      });

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.replyTo).toEqual({
        email: 'restaurant@example.com',
        name: 'Restaurant Name',
      });
    });

    it('should return error on API failure', async () => {
      mockSendTransacEmail.mockRejectedValue(new Error('API Error'));

      const result = await sendEmail({
        to: 'test@example.com',
        toName: 'Test User',
        subject: 'Test',
        templateName: 'password-reset',
        params: { userName: 'Test', resetLink: 'http://example.com/reset' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    }, 15000);

    it('should skip sending when EMAIL_ENABLED is false', async () => {
      process.env.EMAIL_ENABLED = 'false';

      // Reset modules to pick up new env var
      jest.resetModules();
      const { sendEmail: sendEmailDisabled } = jest.requireActual('../../services/emailService');

      const result = await sendEmailDisabled({
        to: 'test@example.com',
        toName: 'Test User',
        subject: 'Test',
        templateName: 'password-reset',
        params: { userName: 'Test', resetLink: 'http://example.com/reset' },
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with generated token', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      };

      const result = await sendPasswordResetEmail(mockUser);

      expect(result.success).toBe(true);
      expect(mockSendTransacEmail).toHaveBeenCalled();

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.to[0].email).toBe('user@example.com');
      expect(emailData.subject).toContain('Réinitialisation de votre mot de passe');
      expect(emailData.htmlContent).toContain('Test User');
      expect(emailData.htmlContent).toContain('reset-password?token=');
    });

    it('should use email as name fallback', async () => {
      const userWithoutName = {
        _id: 'user-123',
        email: 'user@example.com',
      };

      await sendPasswordResetEmail(userWithoutName);

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.to[0].name).toBe('user@example.com');
      expect(emailData.htmlContent).toContain('Utilisateur');
    });
  });

  describe('sendPendingReservationEmail', () => {
    const mockReservation = {
      _id: 'res-123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      date: new Date('2026-06-15'),
      time: '19:30',
      partySize: 4,
      restaurantId: 'rest-123',
    };

    const mockRestaurant = {
      _id: 'rest-123',
      name: 'Le Gourmet',
      email: 'contact@legourmet.fr',
      phone: '0123456789',
    };

    it('should send pending reservation email with correct variables', async () => {
      const result = await sendPendingReservationEmail(mockReservation, mockRestaurant);

      expect(result.success).toBe(true);
      expect(mockSendTransacEmail).toHaveBeenCalled();

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.to[0].email).toBe('john@example.com');
      expect(emailData.to[0].name).toBe('John Doe');
      expect(emailData.subject).toContain('Le Gourmet');
      expect(emailData.htmlContent).toContain('John Doe');
      expect(emailData.htmlContent).toContain('Le Gourmet');
      expect(emailData.htmlContent).toContain('19:30');
      expect(emailData.htmlContent).toContain('4');
    });

    it('should format date in French locale', async () => {
      await sendPendingReservationEmail(mockReservation, mockRestaurant);

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.htmlContent).toMatch(/juin/);
    });
  });

  describe('sendConfirmationEmail', () => {
    const mockReservation = {
      _id: 'res-123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      date: new Date('2026-06-15'),
      time: '19:30',
      partySize: 4,
      restaurantId: 'rest-123',
    };

    const mockRestaurant = {
      _id: 'rest-123',
      name: 'Le Gourmet',
      email: 'contact@legourmet.fr',
      phone: '0123456789',
    };

    it('should send confirmation email with generated cancellation token', async () => {
      const result = await sendConfirmationEmail(mockReservation, mockRestaurant);

      expect(result.success).toBe(true);
      expect(mockSendTransacEmail).toHaveBeenCalled();

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.subject).toContain('Réservation confirmée');
      expect(emailData.subject).toContain('Le Gourmet');
      expect(emailData.htmlContent).toContain('John Doe');
      expect(emailData.htmlContent).toContain('Le Gourmet');
      expect(emailData.htmlContent).toContain('0123456789');
      expect(emailData.htmlContent).toContain('contact@legourmet.fr');
      expect(emailData.htmlContent).toContain('/api/public/reservations/cancel');
    });

    it('should set reply-to to restaurant email', async () => {
      await sendConfirmationEmail(mockReservation, mockRestaurant);

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.replyTo).toEqual({
        email: 'contact@legourmet.fr',
        name: 'Le Gourmet',
      });
    });
  });

  describe('sendDirectConfirmationEmail', () => {
    const mockReservation = {
      _id: 'res-123',
      customerName: 'Jane Smith',
      customerEmail: 'jane@example.com',
      date: new Date('2026-07-20'),
      time: '20:00',
      partySize: 2,
      restaurantId: 'rest-456',
    };

    const mockRestaurant = {
      _id: 'rest-456',
      name: 'La Brasserie',
      email: 'info@labrasserie.fr',
      phone: '0987654321',
    };

    it('should send direct confirmation email with generated token', async () => {
      const result = await sendDirectConfirmationEmail(mockReservation, mockRestaurant);

      expect(result.success).toBe(true);
      expect(mockSendTransacEmail).toHaveBeenCalled();

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.subject).toContain('Confirmation de réservation');
      expect(emailData.htmlContent).toContain('Jane Smith');
      expect(emailData.htmlContent).toContain('La Brasserie');
    });

    it('should include all required variables', async () => {
      await sendDirectConfirmationEmail(mockReservation, mockRestaurant);

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.htmlContent).toContain('Jane Smith');
      expect(emailData.htmlContent).toContain('La Brasserie');
      expect(emailData.htmlContent).toContain('0987654321');
      expect(emailData.htmlContent).toContain('info@labrasserie.fr');
      expect(emailData.htmlContent).toContain('/api/public/reservations/cancel');
    });
  });

  describe('sendCancellationConfirmationEmail', () => {
    const mockReservation = {
      _id: 'res-789',
      customerName: 'Bob Martin',
      customerEmail: 'bob@example.com',
      date: new Date('2026-08-10'),
      time: '18:00',
      partySize: 3,
      restaurantId: 'rest-789',
    };

    const mockRestaurant = {
      _id: 'rest-789',
      name: 'Le Bistrot',
      email: 'hello@lebistrot.fr',
      phone: '0111223344',
    };

    it('should send cancellation confirmation email', async () => {
      const result = await sendCancellationConfirmationEmail(mockReservation, mockRestaurant);

      expect(result.success).toBe(true);
      expect(mockSendTransacEmail).toHaveBeenCalled();

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      expect(emailData.to[0].email).toBe('bob@example.com');
      expect(emailData.subject).toContain('Annulation confirmée');
      expect(emailData.htmlContent).toContain('Bob Martin');
      expect(emailData.htmlContent).toContain('Le Bistrot');
    });

    it('should NOT include cancellation link', async () => {
      await sendCancellationConfirmationEmail(mockReservation, mockRestaurant);

      const emailData = mockSendTransacEmail.mock.calls[0][0];
      // Cancellation email should not have a cancellation link (already cancelled)
      expect(emailData.htmlContent).not.toContain('/api/public/reservations/cancel?token=');
    });
  });
});
