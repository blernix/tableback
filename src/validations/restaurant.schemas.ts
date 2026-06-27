import { z } from 'zod';

const timeSlotSchema = z.object({
  start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid start time (HH:MM)'),
  end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid end time (HH:MM)'),
});

const dayScheduleSchema = z.object({
  closed: z.boolean(),
  slots: z.array(timeSlotSchema),
});

export const updateBasicInfoSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  googleReviewLink: z.string().url().optional().or(z.literal('')),
});

export const updateOpeningHoursSchema = z.object({
  monday: dayScheduleSchema.optional(),
  tuesday: dayScheduleSchema.optional(),
  wednesday: dayScheduleSchema.optional(),
  thursday: dayScheduleSchema.optional(),
  friday: dayScheduleSchema.optional(),
  saturday: dayScheduleSchema.optional(),
  sunday: dayScheduleSchema.optional(),
});

export const switchMenuModeSchema = z.object({
  displayMode: z.enum(['pdf', 'detailed', 'both']),
});

export const updateTablesConfigSchema = z.object({
  mode: z.enum(['simple', 'detailed']).optional(),
  totalTables: z.number().int().min(1).optional(),
  averageCapacity: z.number().int().min(1).optional(),
  tables: z.array(z.object({
    type: z.string().min(1),
    quantity: z.number().int().min(1),
    capacity: z.number().int().min(1),
  })).optional(),
});

export const updateReservationConfigSchema = z.object({
  defaultDuration: z.number().int().min(30).max(300).optional(),
  useOpeningHours: z.boolean().optional(),
  averagePrice: z.number().min(0).optional(),
});

export const createClosureSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().optional(),
}).refine(
  (data) => !data.endDate || new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after start date' }
);

export const updateWidgetConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().min(1).max(100).optional(),
  borderRadius: z.string().regex(/^\d+px$/).optional(),
  buttonBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  buttonTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  buttonHoverColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  buttonText: z.string().min(1).max(50).optional(),
  buttonPosition: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
  buttonStyle: z.enum(['round', 'square', 'minimal']).optional(),
  buttonIcon: z.boolean().optional(),
  modalWidth: z.string().regex(/^\d+(px|%)$/).optional(),
  modalHeight: z.string().regex(/^\d+(px|%)$/).optional(),
});

export const sendContactMessageSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  category: z.enum(['question', 'problem', 'other']),
  message: z.string().min(1).max(5000, 'Message must be at most 5000 characters'),
});

export const closureIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid closure ID'),
});
