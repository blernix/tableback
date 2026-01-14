import { Request, Response } from 'express';
import { z } from 'zod';
import DayBlock from '../models/DayBlock.model';
import logger from '../utils/logger';

// Validation schemas
const createDayBlockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().trim().optional(),
});

const bulkCreateDayBlocksSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(100),
  reason: z.string().trim().optional(),
});

// Get all blocked days for a restaurant
export const getDayBlocks = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.user!.restaurantId;

    const dayBlocks = await DayBlock.find({ restaurantId })
      .sort({ date: 1 })
      .lean();

    res.json({ dayBlocks });
  } catch (error) {
    logger.error('Error fetching day blocks:', error);
    res.status(500).json({
      error: {
        message: 'Error fetching blocked days',
      },
    });
  }
};

// Create a single blocked day
export const createDayBlock = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.user!.restaurantId;
    const validated = createDayBlockSchema.parse(req.body);

    // Check if already blocked
    const existing = await DayBlock.findOne({
      restaurantId,
      date: new Date(validated.date),
    });

    if (existing) {
      res.status(400).json({
        error: {
          message: 'This day is already blocked',
        },
      });
      return;
    }

    const dayBlock = await DayBlock.create({
      restaurantId,
      date: new Date(validated.date),
      reason: validated.reason,
    });

    res.status(201).json({ dayBlock });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error creating day block:', error);
    res.status(500).json({
      error: {
        message: 'Error creating blocked day',
      },
    });
  }
};

// Bulk create blocked days
export const bulkCreateDayBlocks = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.user!.restaurantId;
    const validated = bulkCreateDayBlocksSchema.parse(req.body);

    const dayBlocks = [];
    const errors = [];

    for (const dateStr of validated.dates) {
      try {
        const existing = await DayBlock.findOne({
          restaurantId,
          date: new Date(dateStr),
        });

        if (!existing) {
          const dayBlock = await DayBlock.create({
            restaurantId,
            date: new Date(dateStr),
            reason: validated.reason,
          });
          dayBlocks.push(dayBlock);
        } else {
          errors.push({ date: dateStr, reason: 'Already blocked' });
        }
      } catch (error) {
        errors.push({ date: dateStr, reason: 'Failed to create' });
      }
    }

    res.status(201).json({
      message: `Created ${dayBlocks.length} blocked days`,
      dayBlocks,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error bulk creating day blocks:', error);
    res.status(500).json({
      error: {
        message: 'Error creating blocked days',
      },
    });
  }
};

// Delete a blocked day
export const deleteDayBlock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const restaurantId = req.user!.restaurantId;

    const dayBlock = await DayBlock.findOneAndDelete({
      _id: id,
      restaurantId,
    });

    if (!dayBlock) {
      res.status(404).json({
        error: {
          message: 'Blocked day not found',
        },
      });
      return;
    }

    res.json({ message: 'Blocked day deleted successfully' });
  } catch (error) {
    logger.error('Error deleting day block:', error);
    res.status(500).json({
      error: {
        message: 'Error deleting blocked day',
      },
    });
  }
};

// Check if a specific date is blocked
export const checkDayBlock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.params;
    const restaurantId = req.user!.restaurantId;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({
        error: {
          message: 'Invalid date format. Use YYYY-MM-DD',
        },
      });
      return;
    }

    const dayBlock = await DayBlock.findOne({
      restaurantId,
      date: new Date(date),
    });

    res.json({
      isBlocked: !!dayBlock,
      dayBlock: dayBlock || null,
    });
  } catch (error) {
    logger.error('Error checking day block:', error);
    res.status(500).json({
      error: {
        message: 'Error checking blocked day',
      },
    });
  }
};
