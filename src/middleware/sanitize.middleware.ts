import { Request, Response, NextFunction } from 'express';

/**
 * Recursively sanitize data by trimming strings and removing excessive whitespace
 */
const sanitizeData = (data: any): any => {
  if (typeof data === 'string') {
    // Trim and replace multiple spaces with single space
    return data.trim().replace(/\s+/g, ' ');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  
  if (data !== null && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      sanitized[key] = sanitizeData(data[key]);
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Middleware to sanitize request body, query, and params
 */
export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = sanitizeData(req.body);
    }
    
    if (req.query && Object.keys(req.query).length > 0) {
      req.query = sanitizeData(req.query);
    }
    
    if (req.params && Object.keys(req.params).length > 0) {
      req.params = sanitizeData(req.params);
    }
  } catch (error) {
    // Log but don't block the request - validation will catch issues later
    console.warn('Sanitization error:', error);
  }
  
  next();
};

/**
 * Middleware to sanitize strings only (no whitespace replacement)
 */
export const sanitizeStrings = (req: Request, _res: Response, next: NextFunction): void => {
  const sanitize = (data: any): any => {
    if (typeof data === 'string') {
      return data.trim();
    }
    
    if (Array.isArray(data)) {
      return data.map(sanitize);
    }
    
    if (data !== null && typeof data === 'object') {
      const sanitized: any = {};
      for (const key in data) {
        sanitized[key] = sanitize(data[key]);
      }
      return sanitized;
    }
    
    return data;
  };
  
  try {
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = sanitize(req.body);
    }
  } catch (error) {
    console.warn('String sanitization error:', error);
  }
  
  next();
};