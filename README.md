# TableMaster API

Backend API for TableMaster - Restaurant Administration Platform

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT
- **File Storage:** Google Cloud Storage
- **Email:** Brevo API

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB Atlas account (or local MongoDB)
- Google Cloud Storage bucket (for file uploads)
- Brevo API key (for emails)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Development

```bash
# Run in development mode (with hot reload)
npm run dev
```

The API will be available at `http://localhost:4000`

### Build & Production

```bash
# Build TypeScript
npm run build

# Run production server
npm start

# Or use PM2
pm2 start ecosystem.config.js
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Email System Setup

TableMaster uses [Brevo](https://www.brevo.com/) (formerly Sendinblue) for transactional emails.

### Getting a Brevo API Key

1. **Create a Free Brevo Account:**
   - Visit [https://www.brevo.com/](https://www.brevo.com/)
   - Sign up for a free account (300 emails/day limit)

2. **Generate API Key:**
   - Log in to Brevo Dashboard
   - Navigate to **Settings → API Keys**
   - Click **Generate a new API Key**
   - Copy the API key (v3)

3. **Configure Environment:**
   ```bash
   # Add to .env file
   BREVO_API_KEY=your_api_key_here
   EMAIL_SENDER=your-email@example.com
   EMAIL_ENABLED=true
   ```

### Testing Email Configuration

```bash
# Test Brevo connection
npx ts-node src/scripts/test-brevo-connection.ts

# Expected output:
# ✅ Brevo API connection successful!
# Account email: your-email@example.com
# Plan: Free
# Credits remaining: 300
```

### Email Types Supported

- **Password Reset** - JWT-secured password recovery links
- **Reservation Pending** - New reservation awaiting confirmation
- **Reservation Confirmed** - Confirmed reservation with cancellation link
- **Direct Confirmation** - Phone reservations created by restaurant
- **Cancellation Confirmation** - Confirmation after customer cancels

### Quota Management

The free Brevo plan includes **300 emails/day**. The system automatically:
- Tracks daily email quota using Redis
- Alerts at 90% usage (270 emails)
- Blocks sending at 100% usage

### Required Environment Variables

```env
# Brevo API
BREVO_API_KEY=your_brevo_api_key
EMAIL_SENDER=your-email@example.com
EMAIL_ENABLED=true

# Template IDs (configured in Story 1.2)
BREVO_TEMPLATE_PASSWORD_RESET=1
BREVO_TEMPLATE_PENDING=2
BREVO_TEMPLATE_CONFIRMATION=3
BREVO_TEMPLATE_DIRECT=4
BREVO_TEMPLATE_CANCELLATION=5

# Redis (for quota tracking)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
```

### Architecture Reference

For complete email system architecture, see:
- `docs/architecture/email-system-brevo.md` - Technical architecture
- `docs/stories/epic-1-email-system-brevo.md` - Implementation plan

## Project Structure

```
src/
├── config/          # Configuration files (database, etc.)
├── controllers/     # Request handlers
├── middleware/      # Express middleware (auth, validation, etc.)
├── models/          # Mongoose models
├── routes/          # API routes
├── types/           # TypeScript types/interfaces
├── utils/           # Utility functions (logger, etc.)
├── app.ts           # Express app setup
└── server.ts        # Server entry point
```

## Environment Variables

See `.env.example` for required environment variables.

## API Documentation

### Health Check

```
GET /health
Response: { status: "ok", timestamp: "...", database: "connected" }
```

More endpoints will be documented as they are implemented.

## License

ISC
