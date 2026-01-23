import { Request, Response } from 'express';
import { Types } from 'mongoose';
import crypto from 'crypto';
import logger from '../utils/logger';
import { logSseNotification } from './notificationAnalyticsService';

// Interface for connected clients
interface SSEClient {
  id: string;
  restaurantId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  res: Response;
  connectedAt: Date;
  heartbeatInterval?: NodeJS.Timeout;
  maxDurationTimeout?: NodeJS.Timeout;
}

// Store connected clients
const connectedClients: SSEClient[] = [];

// Configuration
const MAX_CONNECTIONS_PER_USER = 5; // Maximum SSE connections per user
const MAX_CONNECTIONS_PER_RESTAURANT = 50; // Maximum SSE connections per restaurant
const MAX_CONNECTION_DURATION = 60 * 60 * 1000; // 1 hour maximum per connection
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CLEANUP_INTERVAL = 60000; // Clean up dead connections every 1 minute

// Event types
export type ReservationEventType = 'reservation_created' | 'reservation_updated' | 'reservation_cancelled' | 'reservation_confirmed' | 'reservation_completed';

export interface ReservationEvent {
  type: ReservationEventType;
  reservation: {
    id: string;
    customerName: string;
    customerEmail: string;
    date: string;
    time: string;
    numberOfGuests: number;
    status: string;
    restaurantId: string;
  };
  timestamp: string;
}

// Initialize SSE connection
export const initializeSSE = (req: Request, res: Response): void => {
  const userId = req.user?.userId || 'unknown';
  const restaurantId = req.user?.restaurantId || 'unknown';

  // Check connection limits per user
  const userConnections = connectedClients.filter(c => c.userId.toString() === userId.toString());
  if (userConnections.length >= MAX_CONNECTIONS_PER_USER) {
    logger.warn(`User ${userId} exceeded max SSE connections (${MAX_CONNECTIONS_PER_USER}). Closing oldest connection.`);

    // Close the oldest connection for this user
    const oldestConnection = userConnections.sort((a, b) =>
      a.connectedAt.getTime() - b.connectedAt.getTime()
    )[0];

    try {
      oldestConnection.res.end();
    } catch (error) {
      logger.error('Error closing oldest SSE connection:', error);
    }

    // Remove from connected clients
    const index = connectedClients.findIndex(c => c.id === oldestConnection.id);
    if (index !== -1) {
      connectedClients.splice(index, 1);
    }
  }

  // Check connection limits per restaurant
  const restaurantConnections = connectedClients.filter(c =>
    c.restaurantId.toString() === restaurantId.toString()
  );
  if (restaurantConnections.length >= MAX_CONNECTIONS_PER_RESTAURANT) {
    logger.warn(`Restaurant ${restaurantId} exceeded max SSE connections (${MAX_CONNECTIONS_PER_RESTAURANT}).`);
    res.status(429).json({
      error: { message: 'Too many active connections for this restaurant. Please try again later.' }
    });
    return;
  }

  // Get CORS origin from environment or default to localhost for dev
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
  const isDevelopment = process.env.NODE_ENV === 'development';
  const origin = req.headers.origin || '';

  // In development, allow all origins. In production, only allow configured origins
  const allowOrigin = isDevelopment || corsOrigins.includes(origin) ? origin : corsOrigins[0];

  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
  });

  // Send initial connection event
  res.write('event: connected\n');
  res.write(`data: ${JSON.stringify({ message: 'SSE connection established' })}\n\n`);

  // Store client connection
  const client: SSEClient = {
    id: crypto.randomUUID(), // Use UUID to avoid collisions
    restaurantId,
    userId,
    res,
    connectedAt: new Date(),
  };

  connectedClients.push(client);

  // Log connection
  logger.info(`SSE client connected: ${client.id} (restaurant: ${client.restaurantId})`);

  // Helper function to cleanup client connection
  const cleanupClient = (reason: string) => {
    // Clear intervals and timeouts
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }
    if (client.maxDurationTimeout) {
      clearTimeout(client.maxDurationTimeout);
    }

    // End response if not already ended
    try {
      if (!res.writableEnded) {
        res.end();
      }
    } catch (error) {
      // Ignore errors when ending response
    }

    // Remove client from connected clients list
    const index = connectedClients.findIndex(c => c.id === client.id);
    if (index !== -1) {
      connectedClients.splice(index, 1);
      logger.info(`SSE client ${client.id} disconnected (${reason})`);
    }
  };

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      if (req.destroyed || res.writableEnded) {
        cleanupClient('destroyed');
        return;
      }
      res.write(': heartbeat\n\n');
    } catch (error) {
      logger.warn(`Heartbeat failed for client ${client.id}, cleaning up`);
      cleanupClient('heartbeat_error');
    }
  }, HEARTBEAT_INTERVAL);

  // Set maximum connection duration (1 hour)
  const maxDurationTimeout = setTimeout(() => {
    logger.info(`SSE client ${client.id} reached max duration, disconnecting`);
    cleanupClient('max_duration');
  }, MAX_CONNECTION_DURATION);

  // Store intervals/timeouts in client object
  client.heartbeatInterval = heartbeatInterval;
  client.maxDurationTimeout = maxDurationTimeout;

  // Handle client disconnect - SINGLE listener for all cleanup
  req.on('close', () => {
    cleanupClient('client_closed');
  });

  // Handle request errors
  req.on('error', (error) => {
    logger.error(`SSE client ${client.id} error:`, error);
    cleanupClient('request_error');
  });
};

// Emit event to specific restaurant
export const emitToRestaurant = (restaurantId: string | Types.ObjectId, event: ReservationEvent): void => {
  const restaurantIdStr = restaurantId.toString();
  
  const clients = connectedClients.filter(client => 
    client.restaurantId.toString() === restaurantIdStr
  );

  if (clients.length === 0) {
    return;
  }

  const eventData = JSON.stringify(event);
  
  clients.forEach(client => {
    try {
      // Log SSE notification for analytics
      logSseNotification(
        client.userId as Types.ObjectId,
        client.restaurantId as Types.ObjectId,
        event.type,
        client.id
      ).then(analyticsId => {
        if (analyticsId) {
          logger.debug(`SSE analytics logged for client ${client.id}: ${event.type}`);
        }
      }).catch(error => {
        logger.error('Failed to log SSE analytics', { error, clientId: client.id });
      });

      client.res.write(`event: ${event.type}\n`);
      client.res.write(`data: ${eventData}\n\n`);
      
      logger.debug(`SSE event sent to client ${client.id}: ${event.type}`);
    } catch {
      // Client connection is broken, remove it
      const index = connectedClients.findIndex(c => c.id === client.id);
      if (index !== -1) {
        connectedClients.splice(index, 1);
        logger.info(`Removed broken SSE client: ${client.id}`);
      }
    }
  });

  logger.info(`SSE event "${event.type}" sent to ${clients.length} client(s) for restaurant ${restaurantIdStr}`);
};

// Emit event to all restaurants (admin use)
export const emitToAll = (event: ReservationEvent): void => {
  if (connectedClients.length === 0) {
    return;
  }

  const eventData = JSON.stringify(event);
  
  connectedClients.forEach(client => {
    try {
      client.res.write(`event: ${event.type}\n`);
      client.res.write(`data: ${eventData}\n\n`);
    } catch {
      // Client connection is broken, remove it
      const index = connectedClients.findIndex(c => c.id === client.id);
      if (index !== -1) {
        connectedClients.splice(index, 1);
      }
    }
  });

  logger.info(`SSE event "${event.type}" sent to all ${connectedClients.length} client(s)`);
};

// Get connected clients count
export const getConnectedClientsCount = (): number => {
  return connectedClients.length;
};

// Get connected clients by restaurant
export const getConnectedClientsByRestaurant = (restaurantId: string | Types.ObjectId): SSEClient[] => {
  const restaurantIdStr = restaurantId.toString();
  return connectedClients.filter(client => client.restaurantId.toString() === restaurantIdStr);
};

// Helper function to create reservation events
export const createReservationEvent = (
  type: ReservationEventType,
  reservation: any,
  restaurantId: string | Types.ObjectId
): ReservationEvent => {
  return {
    type,
    reservation: {
      id: reservation._id?.toString() || reservation.id,
      customerName: reservation.customerName,
      customerEmail: reservation.customerEmail,
      date: reservation.date instanceof Date ? reservation.date.toISOString().split('T')[0] : reservation.date,
      time: reservation.time,
      numberOfGuests: reservation.numberOfGuests,
      status: reservation.status,
      restaurantId: restaurantId.toString(),
    },
    timestamp: new Date().toISOString(),
  };
};

// Periodic cleanup of dead connections (every 1 minute)
setInterval(() => {
  const now = Date.now();
  const deadClients: string[] = [];

  connectedClients.forEach((client) => {
    try {
      // Check if response is writable
      if (client.res.writableEnded || client.res.destroyed) {
        deadClients.push(client.id);
        return;
      }

      // Check if connection is too old (should have been handled by timeout, but double-check)
      const connectionAge = now - client.connectedAt.getTime();
      if (connectionAge > MAX_CONNECTION_DURATION) {
        logger.warn(`SSE client ${client.id} exceeded max duration (${connectionAge}ms), force closing`);
        deadClients.push(client.id);
      }
    } catch (error) {
      // If we can't check the client, it's probably dead
      deadClients.push(client.id);
    }
  });

  // Remove dead clients
  if (deadClients.length > 0) {
    deadClients.forEach((clientId) => {
      const index = connectedClients.findIndex((c) => c.id === clientId);
      if (index !== -1) {
        const client = connectedClients[index];

        // Cleanup intervals/timeouts
        if (client.heartbeatInterval) {
          clearInterval(client.heartbeatInterval);
        }
        if (client.maxDurationTimeout) {
          clearTimeout(client.maxDurationTimeout);
        }

        // Try to end response
        try {
          if (!client.res.writableEnded) {
            client.res.end();
          }
        } catch (error) {
          // Ignore
        }

        connectedClients.splice(index, 1);
      }
    });

    logger.info(`Cleaned up ${deadClients.length} dead SSE connection(s). Active: ${connectedClients.length}`);
  }
}, CLEANUP_INTERVAL);