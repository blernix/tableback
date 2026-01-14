import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

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
  logoUrl?: string;
  menu: {
    displayMode: 'pdf' | 'detailed' | 'both';
    pdfUrl?: string;
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
    logoUrl: {
      type: String,
      default: null,
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

// Generate API key before saving
restaurantSchema.pre('save', function (next) {
  if (!this.apiKey) {
    this.apiKey = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Method to generate new API key
restaurantSchema.methods.generateApiKey = function (): string {
  this.apiKey = crypto.randomBytes(32).toString('hex');
  return this.apiKey;
};

// Indexes
restaurantSchema.index({ apiKey: 1 }, { unique: true });
restaurantSchema.index({ status: 1 });

const Restaurant = mongoose.model<IRestaurant>('Restaurant', restaurantSchema);

export default Restaurant;
