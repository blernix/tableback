import { createClient, RedisClientType } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import logger from '../utils/logger';

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (client?.isOpen) return client;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('REDIS_URL not configured. Running without Redis.');
    return null;
  }

  try {
    client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Max reconnection attempts');
          return Math.min(retries * 100, 3000);
        },
      },
    });

    client.on('error', (err) => logger.error('Redis error:', err));
    client.on('connect', () => logger.info('Redis connected'));
    client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    await client.connect();
    return client;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    client = null;
    return null;
  }
}

export async function getRedisStore(prefix: string): Promise<RedisStore | null> {
  const c = await getRedisClient();
  if (!c) return null;

  try {
    return new RedisStore({
      sendCommand: (...args: string[]) => c.sendCommand(args),
      prefix: `ratelimit:${prefix}:`,
    });
  } catch {
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
    client = null;
  }
}
