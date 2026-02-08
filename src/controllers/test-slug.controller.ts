import { Request, Response } from 'express';

export const testSlug = async (_req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Slug test works!' });
};

export const updateRestaurantSlug = async (_req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Slug update works!' });
};