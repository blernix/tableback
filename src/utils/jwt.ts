import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

interface TokenPayload {
  userId: Types.ObjectId;
  email: string;
  role: 'admin' | 'restaurant' | 'server';
  restaurantId?: Types.ObjectId;
}

export const generateToken = (payload: TokenPayload): string => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(
    {
      userId: payload.userId.toString(),
      email: payload.email,
      role: payload.role,
      restaurantId: payload.restaurantId?.toString(),
    },
    jwtSecret,
    {
      expiresIn: '24h', // Token expires in 24 hours
    }
  );
};
