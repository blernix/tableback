import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';
import { generateShortCode } from '../utils/slugGenerator';

interface OpeningSlot {
  start: string;
  end: string;
}

interface DaySchedule {
  closed: boolean;
  slots: OpeningSlot[];
}

interface OpeningHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface TableType {
  id?: string;
  type: string;
  quantity: number;
  capacity: number;
}

export interface IRestaurant extends Document {
  name: string;
  address: string;
  phone: string;
  email: string;
  apiKey: string;
  status: 'active' | 'inactive';
  timezone: string;
  logoUrl?: string;
  googleReviewLink?: string;
  // Account type and subscription
  accountType: 'managed' | 'self-service';
  subscription?: {
    plan: 'starter' | 'pro';
    status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    trialEndsAt?: Date;
  };
  // Reservation quota (for Starter plan)
  reservationQuota?: {
    monthlyCount: number;
    lastResetDate: Date;
    limit: number; // 400 for Starter, unlimited (-1) for Pro and Managed
    emailsSent?: {
      at80: boolean;
      at90: boolean;
      at100: boolean;
    };
  };
  // Widget customization (Pro plan only)
  widgetConfig?: {
    // Form colors (affecte le formulaire de réservation)
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    borderRadius?: string;
    // Floating button specific colors (bouton flottant uniquement)
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
    buttonHoverColor?: string;
    // Floating button general configs
    buttonText?: string;
    buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    buttonStyle?: 'round' | 'square' | 'minimal';
    buttonIcon?: boolean;
    modalWidth?: string;
    modalHeight?: string;
  };
  // Vanity URL system
  publicSlug?: string; // Short code or custom slug for pretty URLs
  menu: {
    displayMode: 'pdf' | 'detailed' | 'both';
    pdfUrl?: string;
    qrCodeGenerated: boolean;
  };
  openingHours: OpeningHours;
  tablesConfig: {
    mode: 'simple' | 'detailed';
    totalTables?: number;
    averageCapacity?: number;
    tables?: TableType[];
  };
  reservationConfig: {
    defaultDuration: number;
    useOpeningHours: boolean;
    averagePrice?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  generateApiKey(): string;
  isSubscriptionActive(): boolean;
  canCustomizeWidget(): boolean;
  canCreateReservation(): boolean;
  incrementReservationCount(): Promise<void>;
  resetMonthlyReservationCount(): Promise<void>;
  getReservationQuotaInfo(): {
    current: number;
    limit: number;
    remaining: number;
    percentage: number;
    isUnlimited: boolean;
  };
}

const openingSlotSchema = new Schema({
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { _id: false });

const dayScheduleSchema = new Schema({
  closed: { type: Boolean, default: false },
  slots: { type: [openingSlotSchema], default: [] },
}, { _id: false });

const tableTypeSchema = new Schema({
  type: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
}, { _id: false });

const restaurantSchema = new Schema<IRestaurant>(
  {
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    apiKey: {
      type: String,
      unique: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    timezone: {
      type: String,
      default: 'Europe/Paris',
    },
    logoUrl: {
      type: String,
      default: null,
    },
    googleReviewLink: {
      type: String,
      default: null,
    },
    // Account type and subscription
    accountType: {
      type: String,
      enum: ['managed', 'self-service'],
      default: 'managed',
    },
    subscription: {
      plan: {
        type: String,
        enum: ['starter', 'pro'],
        default: undefined,
      },
      status: {
        type: String,
        enum: ['trial', 'active', 'past_due', 'cancelled', 'expired'],
        default: undefined,
      },
      stripeCustomerId: {
        type: String,
        default: undefined,
      },
      stripeSubscriptionId: {
        type: String,
        default: undefined,
      },
      currentPeriodStart: {
        type: Date,
        default: undefined,
      },
      currentPeriodEnd: {
        type: Date,
        default: undefined,
      },
      cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
      },
      trialEndsAt: {
        type: Date,
        default: undefined,
      },
    },
    // Reservation quota (for Starter plan)
    reservationQuota: {
      monthlyCount: {
        type: Number,
        default: 0,
      },
      lastResetDate: {
        type: Date,
        default: () => new Date(),
      },
      limit: {
        type: Number,
        default: -1, // -1 means unlimited (Managed and Pro), 400 for Starter
      },
      emailsSent: {
        at80: {
          type: Boolean,
          default: false,
        },
        at90: {
          type: Boolean,
          default: false,
        },
        at100: {
          type: Boolean,
          default: false,
        },
      },
    },
     // Widget customization (Pro plan only)
     widgetConfig: {
       // Form colors (affecte le formulaire de réservation)
        primaryColor: {
          type: String,
          default: '#0066FF', // Brand blue
        },
        secondaryColor: {
          type: String,
          default: '#2A2A2A', // Dark gray text
        },
       fontFamily: {
         type: String,
         default: 'Inter, system-ui, sans-serif',
       },
       borderRadius: {
         type: String,
         default: '8px',
       },
       // Floating button specific colors (bouton flottant uniquement)
        buttonBackgroundColor: {
          type: String,
          default: '#0066FF', // Même que primaryColor par défaut
        },
       buttonTextColor: {
         type: String,
         default: '#FFFFFF', // Blanc par défaut
       },
       buttonHoverColor: {
         type: String,
         default: '#2563EB', // Bleu plus foncé par défaut
       },
       // Floating button general configs
       buttonText: {
         type: String,
         default: 'Réserver une table',
       },
        buttonPosition: {
          type: String,
          enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
          default: 'bottom-right',
        },
       buttonStyle: {
         type: String,
         enum: ['round', 'square', 'minimal'],
         default: 'round',
       },
       buttonIcon: {
         type: Boolean,
         default: false, // Désactivé par défaut
       },
       modalWidth: {
         type: String,
         default: '500px',
       },
        modalHeight: {
          type: String,
          default: '600px',
        },
        },
        // Vanity URL system - short code + customizable slug
        publicSlug: {
          type: String,
          unique: true,
          sparse: true, // Allow null values for existing restaurants
          lowercase: true,
          trim: true,
          validate: {
            validator: function(v: string) {
              if (!v) return true; // Allow empty/null
              // Alphanumeric + hyphens, 3-50 characters
              return /^[a-z0-9-]{3,50}$/.test(v);
            },
            message: 'Slug must be 3-50 characters, lowercase alphanumeric and hyphens only'
          }
        },
      menu: {
       displayMode: {
        type: String,
        enum: ['pdf', 'detailed', 'both'],
        default: 'detailed',
      },
      pdfUrl: {
        type: String,
        default: null,
      },
      qrCodeGenerated: {
        type: Boolean,
        default: false,
      },
    },
    openingHours: {
      monday: { type: dayScheduleSchema, default: { closed: false, slots: [] } },
      tuesday: { type: dayScheduleSchema, default: { closed: false, slots: [] } },
      wednesday: { type: dayScheduleSchema, default: { closed: false, slots: [] } },
      thursday: { type: dayScheduleSchema, default: { closed: false, slots: [] } },
      friday: { type: dayScheduleSchema, default: { closed: false, slots: [] } },
      saturday: { type: dayScheduleSchema, default: { closed: false, slots: [] } },
      sunday: { type: dayScheduleSchema, default: { closed: false, slots: [] } },
    },
    tablesConfig: {
      mode: {
        type: String,
        enum: ['simple', 'detailed'],
        default: 'simple',
      },
      totalTables: {
        type: Number,
        default: 10,
      },
      averageCapacity: {
        type: Number,
        default: 4,
      },
      tables: {
        type: [tableTypeSchema],
        default: undefined,
      },
    },
    reservationConfig: {
      defaultDuration: {
        type: Number,
        default: 90,
      },
      useOpeningHours: {
        type: Boolean,
        default: true,
      },
      averagePrice: {
        type: Number,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Generate API key and slug before saving
restaurantSchema.pre('save', function (next) {
  if (!this.apiKey) {
    this.apiKey = crypto.randomBytes(32).toString('hex');
  }
  
  // Generate a unique slug if not already set
  if (!this.publicSlug) {
    // Generate a random 8-character slug
    this.publicSlug = generateShortCode(8);
  }
  
  next();
});

// Method to generate new API key
restaurantSchema.methods.generateApiKey = function (): string {
  this.apiKey = crypto.randomBytes(32).toString('hex');
  return this.apiKey;
};

// Method to check if subscription is active
restaurantSchema.methods.isSubscriptionActive = function (): boolean {
  // Managed accounts are always active (no subscription check)
  if (this.accountType === 'managed') {
    return this.status === 'active';
  }

  // Self-service accounts need valid subscription
  if (!this.subscription) {
    return false;
  }

  const { status, currentPeriodEnd, trialEndsAt } = this.subscription;

  // Check if in trial period
  if (status === 'trial' && trialEndsAt) {
    return new Date() < new Date(trialEndsAt);
  }

  // Check if subscription is active and not expired
  if (status === 'active' && currentPeriodEnd) {
    return new Date() < new Date(currentPeriodEnd);
  }

  return false;
};

// Method to check if restaurant can customize widget
restaurantSchema.methods.canCustomizeWidget = function (): boolean {
  // Only self-service Pro plan can customize
  if (this.accountType !== 'self-service') {
    return false;
  }

  if (!this.subscription || this.subscription.plan !== 'pro') {
    return false;
  }

  return this.isSubscriptionActive();
};

// Method to check if restaurant can create a new reservation (quota check)
restaurantSchema.methods.canCreateReservation = function (): boolean {
  // Managed accounts have unlimited reservations
  if (this.accountType === 'managed') {
    return true;
  }

  // Pro plan has unlimited reservations
  if (this.subscription?.plan === 'pro') {
    return true;
  }

  // Starter plan: check monthly quota
  if (!this.reservationQuota) {
    // Initialize quota if missing
    return true;
  }

  // Check if we need to reset (new month)
  const now = new Date();
  const lastReset = new Date(this.reservationQuota.lastResetDate);
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    // Will be reset before next check
    return true;
  }

  // Check if limit is reached
  const limit = this.reservationQuota.limit;
  if (limit === -1) {
    return true; // Unlimited
  }

  return this.reservationQuota.monthlyCount < limit;
};

// Method to increment reservation count
restaurantSchema.methods.incrementReservationCount = async function (): Promise<void> {
  // Only track for Starter plan
  if (this.accountType !== 'self-service' || this.subscription?.plan !== 'starter') {
    return;
  }

  if (!this.reservationQuota) {
    this.reservationQuota = {
      monthlyCount: 0,
      lastResetDate: new Date(),
      limit: 400,
      emailsSent: { at80: false, at90: false, at100: false },
    };
  }

  // Check if we need to reset (new month)
  const now = new Date();
  const lastReset = new Date(this.reservationQuota.lastResetDate);
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.reservationQuota.monthlyCount = 0;
    this.reservationQuota.lastResetDate = now;
    // Reset email sent flags
    this.reservationQuota.emailsSent = { at80: false, at90: false, at100: false };
  }

  // Increment count
  this.reservationQuota.monthlyCount += 1;

  // Calculate current quota info
  const quotaInfo = this.getReservationQuotaInfo();

  // Check thresholds and send notification emails (async, don't block)
  setImmediate(async () => {
    try {
      const { sendQuotaWarningEmail } = await import('../services/emailService');

      if (!this.reservationQuota?.emailsSent) {
        return;
      }

      // Send 80% warning
      if (quotaInfo.percentage >= 80 && !this.reservationQuota.emailsSent.at80) {
        await sendQuotaWarningEmail(
          { _id: this._id.toString(), name: this.name, email: this.email },
          quotaInfo,
          80
        );
        this.reservationQuota.emailsSent.at80 = true;
        await this.save();
      }

      // Send 90% warning
      if (quotaInfo.percentage >= 90 && !this.reservationQuota.emailsSent.at90) {
        await sendQuotaWarningEmail(
          { _id: this._id.toString(), name: this.name, email: this.email },
          quotaInfo,
          90
        );
        this.reservationQuota.emailsSent.at90 = true;
        await this.save();
      }

      // Send 100% warning
      if (quotaInfo.percentage >= 100 && !this.reservationQuota.emailsSent.at100) {
        await sendQuotaWarningEmail(
          { _id: this._id.toString(), name: this.name, email: this.email },
          quotaInfo,
          100
        );
        this.reservationQuota.emailsSent.at100 = true;
        await this.save();
      }
    } catch (error) {
      // Use dynamic import for logger to avoid circular dependency
      const { default: logger } = await import('../utils/logger');
      logger.error('Error sending quota warning email:', error);
    }
  });

  await this.save();
};

// Method to reset monthly reservation count
restaurantSchema.methods.resetMonthlyReservationCount = async function (): Promise<void> {
  if (!this.reservationQuota) {
    return;
  }

  this.reservationQuota.monthlyCount = 0;
  this.reservationQuota.lastResetDate = new Date();
  // Reset email sent flags
  this.reservationQuota.emailsSent = { at80: false, at90: false, at100: false };
  await this.save();
};

// Method to get reservation quota information
restaurantSchema.methods.getReservationQuotaInfo = function () {
  // Managed accounts and Pro plan have unlimited
  if (this.accountType === 'managed' || this.subscription?.plan === 'pro') {
    return {
      current: 0,
      limit: -1,
      remaining: -1,
      percentage: 0,
      isUnlimited: true,
    };
  }

  // Starter plan
  if (!this.reservationQuota) {
    return {
      current: 0,
      limit: 400,
      remaining: 400,
      percentage: 0,
      isUnlimited: false,
    };
  }

  const current = this.reservationQuota.monthlyCount || 0;
  const limit = this.reservationQuota.limit;
  const remaining = limit === -1 ? -1 : Math.max(0, limit - current);
  const percentage = limit === -1 ? 0 : Math.min(100, Math.round((current / limit) * 100));

  return {
    current,
    limit,
    remaining,
    percentage,
    isUnlimited: limit === -1,
  };
};

// Indexes
restaurantSchema.index({ status: 1 });
restaurantSchema.index({ accountType: 1 });
restaurantSchema.index({ 'subscription.status': 1 });
restaurantSchema.index({ 'subscription.stripeCustomerId': 1 });

const Restaurant = mongoose.model<IRestaurant>('Restaurant', restaurantSchema);

export default Restaurant;
