import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: Types.ObjectId;
        email: string;
        role: 'admin' | 'restaurant' | 'server';
        restaurantId?: Types.ObjectId;
      };
    }
  }
}
